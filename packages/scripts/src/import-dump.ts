import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Debug from "debug";

const log = Debug("atw:import-dump");

export interface ImportDumpResult {
  imported: string[];
  excluded_pii_tables: string[];
  dropped_pii_columns: Array<[string, string]>;
  warnings: string[];
}

export interface ImportDumpOptions {
  dumpPath: string;
  schemaMap: SchemaMapForImport;
  replace?: boolean;
  connectionConfig: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
}

/**
 * Narrow slice of the schema-map we consume for filtering. The full
 * schema-map.md loader lives elsewhere; callers pass just what we need.
 */
export interface SchemaMapForImport {
  includedTables: string[];
  piiTables: string[];
  piiColumns: Array<{ table: string; column: string }>;
}

/* ----- Lightweight SQL dump splitter -----------------------------------
 *
 * The production implementation MUST use a real Postgres client — but for
 * filtering + rewriting we operate on the text. We recognize:
 *   - CREATE TABLE <schema>.<name> (...) [...]
 *   - COPY <schema>.<name> (col, col, ...) FROM stdin;
 *     data lines
 *     \.
 *   - ALTER TABLE / CREATE INDEX / ... — emitted verbatim if their
 *     referenced table is kept.
 *
 * The goal is to produce a FILTERED sql string that can be piped into psql,
 * not to be a full pg_dump parser. Sufficient for well-formed dumps of the
 * shape Feature 001 users produce.
 */

export interface ParsedStatement {
  kind: "create_table" | "copy" | "alter_table" | "create_index" | "set" | "other";
  tableRef?: string;
  text: string;
  columns?: string[];
  dataLines?: string[];
}

const TABLE_REF_RE = /^(?:"?(?<schema>[A-Za-z_][A-Za-z0-9_]*)"?\.)?"?(?<name>[A-Za-z_][A-Za-z0-9_]*)"?/;

function extractTableRef(raw: string): string | undefined {
  const m = raw.match(TABLE_REF_RE);
  if (!m || !m.groups) return undefined;
  return (m.groups.name ?? "").toLowerCase();
}

/**
 * pg_dump 17/18 emits a handful of constructs that older Postgres servers
 * and our text-mode importer do not understand. Strip them here so the
 * filtered output is replayable against a stock `pgvector/pgvector:pg16`
 * target without manual hand-edits (FR-030, R12):
 *
 *   - `SET transaction_timeout = …;` (introduced in pg17)
 *   - `\restrict <token>` / `\unrestrict <token>` psql meta-commands that
 *     appear at the top/bottom of dumps and must not be sent to the
 *     server
 *   - `ALTER TABLE … OWNER TO <role>;` — the target role often does not
 *     exist on the ATW reference instance, and ownership is irrelevant
 *     for a read-only schema replica
 */
export function sanitizePgDump17(sql: string): string {
  const out: string[] = [];
  for (const line of sql.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (/^SET\s+transaction_timeout\b/i.test(trimmed)) continue;
    if (/^\\(restrict|unrestrict)\b/.test(trimmed)) continue;
    out.push(line);
  }
  let joined = out.join("\n");
  joined = joined.replace(
    /^[ \t]*ALTER\s+TABLE\s+(?:ONLY\s+)?[^\n;]*\bOWNER\s+TO\s+[^;]*;[ \t]*\r?\n?/gim,
    "",
  );
  return joined;
}

export function splitStatements(sql: string): ParsedStatement[] {
  const out: ParsedStatement[] = [];
  const lines = sql.split(/\r?\n/);
  let i = 0;
  let buf: string[] = [];
  while (i < lines.length) {
    const line = lines[i];
    // COPY blocks are multi-line and terminated with \.
    const copyMatch = line.match(/^COPY\s+(?:"?(\w+)"?\.)?"?(\w+)"?\s*\(([^)]*)\)\s+FROM\s+stdin/i);
    if (copyMatch) {
      const table = copyMatch[2].toLowerCase();
      const columns = copyMatch[3]
        .split(",")
        .map((c) => c.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
      const headerLine = line;
      const data: string[] = [];
      i++;
      while (i < lines.length && lines[i] !== "\\.") {
        data.push(lines[i]);
        i++;
      }
      out.push({
        kind: "copy",
        tableRef: table,
        columns,
        dataLines: data,
        text: headerLine + "\n" + data.join("\n") + "\n\\.",
      });
      i++; // skip the \.
      continue;
    }
    buf.push(line);
    if (/;\s*$/.test(line)) {
      const text = buf.join("\n").trim();
      buf = [];
      if (text.length === 0) {
        i++;
        continue;
      }
      const head = text.slice(0, 200).toUpperCase();
      if (/^CREATE\s+TABLE/.test(head)) {
        const after = text.replace(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i, "");
        const tableRef = extractTableRef(after);
        out.push({ kind: "create_table", tableRef, text });
      } else if (/^ALTER\s+TABLE/.test(head)) {
        const after = text.replace(/^ALTER\s+TABLE\s+(?:ONLY\s+)?/i, "");
        const tableRef = extractTableRef(after);
        out.push({ kind: "alter_table", tableRef, text });
      } else if (/^CREATE\s+(?:UNIQUE\s+)?INDEX/.test(head)) {
        const m = text.match(/\bON\s+(?:ONLY\s+)?(?:"?(\w+)"?\.)?"?(\w+)"?/i);
        out.push({
          kind: "create_index",
          tableRef: m ? m[2].toLowerCase() : undefined,
          text,
        });
      } else if (/^SET\b/.test(head)) {
        out.push({ kind: "set", text });
      } else {
        out.push({ kind: "other", text });
      }
    }
    i++;
  }
  if (buf.length > 0 && buf.join("").trim().length > 0) {
    out.push({ kind: "other", text: buf.join("\n").trim() });
  }
  return out;
}

export interface FilterResult {
  filteredSql: string;
  imported: string[];
  excludedPiiTables: string[];
  droppedPiiColumns: Array<[string, string]>;
  warnings: string[];
}

export function filterDump(
  sql: string,
  map: SchemaMapForImport,
  targetSchema = "client_ref",
): FilterResult {
  const statements = splitStatements(sanitizePgDump17(sql));
  const included = new Set(map.includedTables.map((t) => t.toLowerCase()));
  const pii = new Set(map.piiTables.map((t) => t.toLowerCase()));
  const piiCols = new Map<string, Set<string>>();
  for (const { table, column } of map.piiColumns) {
    const t = table.toLowerCase();
    if (!piiCols.has(t)) piiCols.set(t, new Set());
    piiCols.get(t)!.add(column.toLowerCase());
  }

  const imported = new Set<string>();
  const excludedPiiTables = new Set<string>();
  const droppedCols: Array<[string, string]> = [];
  const warnings: string[] = [];
  const lines: string[] = [];

  lines.push(`CREATE SCHEMA IF NOT EXISTS ${targetSchema};`);
  lines.push(`SET search_path TO ${targetSchema}, public;`);

  for (const st of statements) {
    if (st.kind === "set" || st.kind === "other") {
      lines.push(st.text);
      continue;
    }
    if (!st.tableRef) {
      lines.push(st.text);
      continue;
    }
    if (pii.has(st.tableRef)) {
      excludedPiiTables.add(st.tableRef);
      continue;
    }
    if (!included.has(st.tableRef)) {
      continue;
    }
    // Rewrite target schema to client_ref.
    const rewrite = (text: string): string =>
      text.replace(
        /\b(?:public\.)?("?)(\w+)\1/g,
        (match, _q, _name: string) => match, // tables already unqualified land in search_path schema
      );

    if (st.kind === "create_table") {
      const dropFor = piiCols.get(st.tableRef);
      let text = rewrite(st.text);
      // Replace any "public." prefix with client_ref so the table lands in
      // the right schema regardless of search_path state.
      text = text.replace(/\bpublic\./g, `${targetSchema}.`);
      if (dropFor && dropFor.size > 0) {
        // Strip PII column definitions. We do a regex over the inside of
        // the outer parentheses — good enough for well-formed pg_dump
        // output.
        const openIdx = text.indexOf("(");
        const closeIdx = text.lastIndexOf(")");
        if (openIdx > -1 && closeIdx > openIdx) {
          const head = text.slice(0, openIdx + 1);
          const body = text.slice(openIdx + 1, closeIdx);
          const tail = text.slice(closeIdx);
          const cols = splitTopLevel(body, ",");
          const kept: string[] = [];
          for (const c of cols) {
            const nameMatch = c.trim().match(/^"?(\w+)"?/);
            const n = nameMatch ? nameMatch[1].toLowerCase() : "";
            if (n && dropFor.has(n)) {
              droppedCols.push([st.tableRef, n]);
              continue;
            }
            kept.push(c);
          }
          text = head + kept.join(",") + tail;
        }
      }
      imported.add(st.tableRef);
      lines.push(text);
      continue;
    }
    if (st.kind === "copy") {
      const dropFor = piiCols.get(st.tableRef);
      const cols = st.columns ?? [];
      const keepMask = cols.map((c) => !dropFor || !dropFor.has(c.toLowerCase()));
      const keptCols = cols.filter((_c, i) => keepMask[i]);
      if (keptCols.length === 0) {
        warnings.push(`Skipped COPY ${st.tableRef}: every column is PII-flagged.`);
        continue;
      }
      const header = `COPY ${targetSchema}.${st.tableRef} (${keptCols.map((c) => `"${c}"`).join(", ")}) FROM stdin;`;
      const filteredLines: string[] = [];
      for (const l of st.dataLines ?? []) {
        if (l === "\\.") break;
        const parts = l.split("\t");
        const keptParts = parts.filter((_p, i) => keepMask[i]);
        filteredLines.push(keptParts.join("\t"));
      }
      lines.push(header);
      lines.push(...filteredLines);
      lines.push("\\.");
      continue;
    }
    if (st.kind === "alter_table" || st.kind === "create_index") {
      // Emit the DDL only for kept tables; rewrite public. prefix.
      const rewritten = st.text.replace(/\bpublic\./g, `${targetSchema}.`);
      lines.push(rewritten);
      continue;
    }
  }

  return {
    filteredSql: lines.join("\n") + "\n",
    imported: Array.from(imported),
    excludedPiiTables: Array.from(excludedPiiTables),
    droppedPiiColumns: droppedCols,
    warnings,
  };
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.length > 0) out.push(cur);
  return out;
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  dump: string;
  schemaMap: string;
  replace: boolean;
  json: boolean;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      dump: { type: "string" },
      "schema-map": { type: "string" },
      replace: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      host: { type: "string" },
      port: { type: "string" },
      user: { type: "string" },
      password: { type: "string" },
      database: { type: "string" },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  if (!values.dump) throw new Error("--dump <path> is required");
  if (!values["schema-map"]) throw new Error("--schema-map <path> is required");
  const port = values.port ? Number.parseInt(String(values.port), 10) : 5433;
  return {
    dump: String(values.dump),
    schemaMap: String(values["schema-map"]),
    replace: Boolean(values.replace),
    json: Boolean(values.json),
    host: String(values.host ?? "127.0.0.1"),
    port,
    user: String(values.user ?? "atw"),
    password: String(values.password ?? "atw"),
    database: String(values.database ?? "atw"),
  };
}

async function loadSchemaMapForImport(schemaMapPath: string): Promise<SchemaMapForImport> {
  // Feature 001 writes schema-map.md as YAML frontmatter + markdown. The
  // authoritative parser lives in `load-artifact.ts`. We import it lazily
  // to keep this module's dependency surface small.
  const { loadArtifactFromFile } = await import("./load-artifact.js");
  const art = await loadArtifactFromFile("schema-map", path.resolve(schemaMapPath));
  if (art.kind !== "schema-map") {
    throw new Error(`Loaded artifact at ${schemaMapPath} is not a schema-map`);
  }
  const includedTables = new Set<string>();
  const piiTables: string[] = [];
  const piiColumns: Array<{ table: string; column: string }> = [];
  for (const ent of art.content.entities) {
    if (ent.classification === "indexable" || ent.classification === "reference") {
      for (const t of ent.sourceTables) includedTables.add(t.toLowerCase());
      for (const c of ent.columns) {
        if (c.decision === "exclude-pii") {
          for (const t of ent.sourceTables) {
            piiColumns.push({ table: t.toLowerCase(), column: c.name.toLowerCase() });
          }
        }
      }
    }
  }
  for (const ex of art.content.piiExcluded) {
    if (ex.columns.length === 0) piiTables.push(ex.table.toLowerCase());
    for (const col of ex.columns) {
      piiColumns.push({ table: ex.table.toLowerCase(), column: col.toLowerCase() });
    }
  }
  return {
    includedTables: Array.from(includedTables),
    piiTables,
    piiColumns,
  };
}

/**
 * Programmatic entry used by the orchestrator. Reads the dump, runs
 * `filterDump`, and executes the filtered SQL against Postgres.
 */
export async function importDump(opts: ImportDumpOptions): Promise<ImportDumpResult> {
  const dumpSql = await fs.readFile(opts.dumpPath, "utf8");
  const filtered = filterDump(dumpSql, opts.schemaMap);
  const { Client } = await import("pg");
  const client = new Client(opts.connectionConfig);
  await client.connect();
  try {
    if (opts.replace) {
      for (const t of filtered.imported) {
        await client.query(`DROP TABLE IF EXISTS client_ref.${t} CASCADE`);
      }
    }
    log("executing filtered dump (%d chars)", filtered.filteredSql.length);
    await client.query(filtered.filteredSql);
  } finally {
    await client.end().catch(() => void 0);
  }
  return {
    imported: filtered.imported,
    excluded_pii_tables: filtered.excludedPiiTables,
    dropped_pii_columns: filtered.droppedPiiColumns,
    warnings: filtered.warnings,
  };
}

export async function runImportDump(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-import-dump: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write(
      "atw-import-dump --dump <path> --schema-map <path> [--replace] [--json]\n",
    );
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-import-dump 0.1.0\n");
    return 0;
  }

  try {
    const dumpSql = await fs.readFile(opts.dump, "utf8");
    const schemaMap = await loadSchemaMapForImport(opts.schemaMap);
    const filtered = filterDump(dumpSql, schemaMap);

    const { Client } = await import("pg");
    const client = new Client({
      host: opts.host,
      port: opts.port,
      user: opts.user,
      password: opts.password,
      database: opts.database,
    });
    await client.connect();
    try {
      if (opts.replace) {
        for (const t of filtered.imported) {
          await client.query(`DROP TABLE IF EXISTS client_ref.${t} CASCADE`);
        }
      }
      log("executing filtered dump (%d chars)", filtered.filteredSql.length);
      await client.query(filtered.filteredSql);
    } finally {
      await client.end().catch(() => void 0);
    }

    const result: ImportDumpResult = {
      imported: filtered.imported,
      excluded_pii_tables: filtered.excludedPiiTables,
      dropped_pii_columns: filtered.droppedPiiColumns,
      warnings: filtered.warnings,
    };
    if (opts.json) {
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      process.stdout.write(
        `imported=${result.imported.length} excluded_pii_tables=${result.excluded_pii_tables.length} dropped_pii_columns=${result.dropped_pii_columns.length}\n`,
      );
    }
    return 0;
  } catch (err) {
    process.stderr.write(`atw-import-dump: ${(err as Error).message}\n`);
    return 8;
  }
}
