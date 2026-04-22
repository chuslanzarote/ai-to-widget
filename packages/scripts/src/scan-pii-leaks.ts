import { parseArgs } from "node:util";
import path from "node:path";
import Debug from "debug";
import type { SchemaMapArtifact } from "./lib/types.js";

const log = Debug("atw:scan-pii-leaks");

export interface PiiMatch {
  entity_type: string;
  entity_id: string;
  pii_column: string;
  pii_value: string;
  matched_in: "document" | "facts" | "categories";
  snippet: string;
}

export interface ScanResult {
  clean: boolean;
  values_checked: number;
  matches: PiiMatch[];
}

export interface ScanOptions {
  schemaMap: SchemaMapArtifact;
  connectionConfig: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
}

/**
 * Clarifications Q1 / FR-088: case-insensitive substring match after
 * whitespace normalization (collapse runs of whitespace to a single space
 * and lowercase both sides).
 */
export function normalizeForMatch(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export function findMatches(
  normalizedDoc: string,
  originalDoc: string,
  values: Array<{ column: string; value: string }>,
): Array<{ column: string; value: string; snippet: string }> {
  const hits: Array<{ column: string; value: string; snippet: string }> = [];
  for (const v of values) {
    const needle = normalizeForMatch(v.value);
    if (needle.length < 3) continue; // avoid pathological short matches
    if (normalizedDoc.includes(needle)) {
      const idx = originalDoc.toLowerCase().indexOf(v.value.toLowerCase());
      const snippetStart = Math.max(0, idx - 20);
      const snippetEnd = Math.min(originalDoc.length, idx + v.value.length + 20);
      hits.push({
        column: v.column,
        value: v.value,
        snippet: originalDoc.slice(snippetStart, snippetEnd),
      });
    }
  }
  return hits;
}

export async function scanPiiLeaks(opts: ScanOptions): Promise<ScanResult> {
  const piiCols: Array<{ table: string; column: string }> = [];
  for (const ent of opts.schemaMap.entities) {
    for (const c of ent.columns) {
      if (c.decision === "exclude-pii") {
        for (const t of ent.sourceTables) piiCols.push({ table: t, column: c.name });
      }
    }
  }
  for (const ex of opts.schemaMap.piiExcluded) {
    for (const col of ex.columns) piiCols.push({ table: ex.table, column: col });
  }

  const { Client } = await import("pg");
  const client = new Client(opts.connectionConfig);
  await client.connect();
  const matches: PiiMatch[] = [];
  let checked = 0;
  try {
    // Collect all PII values from client_ref.
    const values: Array<{ column: string; value: string }> = [];
    for (const { table, column } of piiCols) {
      try {
        const res = await client.query<{ v: string }>(
          `SELECT CAST("${column}" AS text) AS v FROM client_ref."${table}" WHERE "${column}" IS NOT NULL`,
        );
        for (const row of res.rows) {
          if (row.v && typeof row.v === "string" && row.v.length >= 3) {
            values.push({ column: `${table}.${column}`, value: row.v });
            checked++;
          }
        }
      } catch (err) {
        log("skip %s.%s: %s", table, column, (err as Error).message);
      }
    }
    // Scan every atw_documents row.
    const docs = await client.query<{
      entity_type: string;
      entity_id: string;
      document: string;
      facts: unknown;
      categories: unknown;
    }>(`SELECT entity_type, entity_id, document, facts, categories FROM atw_documents`);
    for (const row of docs.rows) {
      const doc = row.document ?? "";
      const factsStr = JSON.stringify(row.facts ?? []);
      const catsStr = JSON.stringify(row.categories ?? {});
      const normDoc = normalizeForMatch(doc);
      const normFacts = normalizeForMatch(factsStr);
      const normCats = normalizeForMatch(catsStr);
      for (const m of findMatches(normDoc, doc, values)) {
        matches.push({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          pii_column: m.column,
          pii_value: m.value,
          matched_in: "document",
          snippet: m.snippet,
        });
      }
      for (const m of findMatches(normFacts, factsStr, values)) {
        matches.push({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          pii_column: m.column,
          pii_value: m.value,
          matched_in: "facts",
          snippet: m.snippet,
        });
      }
      for (const m of findMatches(normCats, catsStr, values)) {
        matches.push({
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          pii_column: m.column,
          pii_value: m.value,
          matched_in: "categories",
          snippet: m.snippet,
        });
      }
    }
    return { clean: matches.length === 0, values_checked: checked, matches };
  } finally {
    await client.end().catch(() => void 0);
  }
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  schemaMap: string;
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
      "schema-map": { type: "string" },
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
  if (!values["schema-map"]) throw new Error("--schema-map <path> is required");
  const port = values.port ? Number.parseInt(String(values.port), 10) : 5433;
  return {
    schemaMap: String(values["schema-map"]),
    json: Boolean(values.json),
    host: String(values.host ?? "127.0.0.1"),
    port,
    user: String(values.user ?? "atw"),
    password: String(values.password ?? "atw"),
    database: String(values.database ?? "atw"),
  };
}

export async function runScanPiiLeaks(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-scan-pii-leaks: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write("atw-scan-pii-leaks --schema-map <path> [--json]\n");
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-scan-pii-leaks 0.1.0\n");
    return 0;
  }

  try {
    const { loadArtifactFromFile } = await import("./load-artifact.js");
    const art = await loadArtifactFromFile("schema-map", path.resolve(opts.schemaMap));
    if (art.kind !== "schema-map") {
      throw new Error("Loaded artifact is not a schema-map");
    }
    const result = await scanPiiLeaks({
      schemaMap: art.content,
      connectionConfig: {
        host: opts.host,
        port: opts.port,
        user: opts.user,
        password: opts.password,
        database: opts.database,
      },
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      process.stdout.write(
        `clean=${result.clean} values_checked=${result.values_checked} matches=${result.matches.length}\n`,
      );
    }
    return result.clean ? 0 : 22;
  } catch (err) {
    process.stderr.write(`atw-scan-pii-leaks: ${(err as Error).message}\n`);
    return 1;
  }
}
