import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { parse as parsePgSql, astVisitor } from "pgsql-ast-parser";
import { detectCredentials, REFUSAL_MESSAGE } from "./lib/credential-guard.js";
import { ParsedSQLSchemaSchema, } from "./lib/types.js";
export class ParseSchemaError extends Error {
    line;
    column;
    constructor(message, line, column) {
        super(message);
        this.line = line;
        this.column = column;
    }
}
export class CredentialRejectionError extends Error {
    matches;
    constructor(matches) {
        super(REFUSAL_MESSAGE);
        this.matches = matches;
    }
}
/**
 * Deterministically parses a `pg_dump --schema-only` dump into
 * `ParsedSQLSchema`. Credential paste is refused at the boundary
 * (FR-018 / SC-010). No LLM call. No DB connection.
 */
export async function parseSchemaFromText(opts) {
    const creds = detectCredentials(opts.schemaSql);
    if (creds.found) {
        throw new CredentialRejectionError(creds.matches.map((m) => m.sample));
    }
    let statements;
    try {
        statements = parsePgSql(opts.schemaSql);
    }
    catch (err) {
        const { line, column, message } = normalizeParseError(err);
        throw new ParseSchemaError(message, line, column);
    }
    const bySchema = new Map();
    const ensure = (name) => {
        const existing = bySchema.get(name);
        if (existing)
            return existing;
        const fresh = { tables: [], enums: [], extensions: [] };
        bySchema.set(name, fresh);
        return fresh;
    };
    ensure("public");
    for (const stmt of statements) {
        if (stmt.type === "create table") {
            const table = convertCreateTable(stmt);
            ensure(table.schema).tables.push(table);
        }
        else if (stmt.type === "create enum") {
            const schemaName = stmt.name.schema ?? "public";
            ensure(schemaName).enums.push({ name: stmt.name.name, values: stmt.values.map((v) => v.value) });
        }
        else if (stmt.type === "create extension") {
            const schemaName = stmt.schema?.name ?? "public";
            ensure(schemaName).extensions.push(stmt.extension.name);
        }
    }
    const sampleRows = opts.dataSql ? extractSampleRows(opts.dataSql, 50) : {};
    const parsed = {
        version: 1,
        dialect: "postgres",
        schemas: [...bySchema.entries()].map(([name, v]) => ({ name, tables: v.tables, enums: v.enums, extensions: v.extensions })),
        sampleRows,
        parseErrors: [],
    };
    return { parsed: ParsedSQLSchemaSchema.parse(parsed) };
}
function normalizeParseError(err) {
    const msg = err instanceof Error ? err.message : String(err);
    const m = msg.match(/line\s+(\d+)[,:]?\s*(?:column|col)\s+(\d+)/i);
    if (m)
        return { line: Number(m[1]), column: Number(m[2]), message: msg };
    return { line: 0, column: 0, message: msg };
}
function convertCreateTable(stmt) {
    const tableName = stmt.name.name;
    const schemaName = stmt.name.schema ?? "public";
    const columns = [];
    const foreignKeys = [];
    const uniqueConstraints = [];
    const primaryKey = [];
    for (const entry of stmt.columns) {
        if (entry.kind !== "column")
            continue; // skip `LIKE ...` inherited columns
        const col = entry;
        const name = col.name.name;
        const dataType = dataTypeText(col.dataType);
        let nullable = true;
        let isPk = false;
        let defaultValue = null;
        for (const c of col.constraints ?? []) {
            if (c.type === "not null")
                nullable = false;
            else if (c.type === "null")
                nullable = true;
            else if (c.type === "primary key") {
                isPk = true;
                primaryKey.push(name);
            }
            else if (c.type === "unique") {
                uniqueConstraints.push({ columns: [name] });
            }
            else if (c.type === "default") {
                defaultValue = exprText(c.default);
            }
            else if (c.type === "reference") {
                foreignKeys.push({
                    columns: [name],
                    referenceSchema: c.foreignTable.schema ?? "public",
                    referenceTable: c.foreignTable.name,
                    referenceColumns: (c.foreignColumns ?? []).map((x) => x.name),
                    onDelete: normalizeAction(c.onDelete),
                    onUpdate: normalizeAction(c.onUpdate),
                });
            }
        }
        columns.push({ name, dataType, nullable, default: defaultValue, isPrimaryKey: isPk, comment: null });
    }
    for (const c of stmt.constraints ?? []) {
        if (c.type === "primary key") {
            for (const col of c.columns)
                primaryKey.push(col.name);
        }
        else if (c.type === "unique") {
            uniqueConstraints.push({ columns: c.columns.map((x) => x.name) });
        }
        else if (c.type === "foreign key") {
            foreignKeys.push({
                columns: c.localColumns.map((x) => x.name),
                referenceSchema: c.foreignTable.schema ?? "public",
                referenceTable: c.foreignTable.name,
                referenceColumns: c.foreignColumns.map((x) => x.name),
                onDelete: normalizeAction(c.onDelete),
                onUpdate: normalizeAction(c.onUpdate),
            });
        }
    }
    return {
        schema: schemaName,
        name: tableName,
        columns,
        primaryKey: [...new Set(primaryKey)],
        foreignKeys,
        uniqueConstraints,
        indexes: [],
        inherits: null,
        comment: null,
    };
}
function dataTypeText(dt) {
    // Keep it simple; pgsql-ast-parser returns a nested shape with `name` and optional `arguments`.
    const anyDt = dt;
    if (anyDt.name)
        return anyDt.name;
    return String(anyDt.kind ?? "unknown");
}
function exprText(expr) {
    try {
        return JSON.stringify(expr);
    }
    catch {
        return String(expr);
    }
}
function normalizeAction(raw) {
    if (!raw)
        return null;
    const s = String(raw).toLowerCase();
    if (s.includes("cascade"))
        return "cascade";
    if (s.includes("restrict"))
        return "restrict";
    if (s.includes("set null"))
        return "set null";
    if (s.includes("no action"))
        return "no action";
    return null;
}
/**
 * Extracts row samples from a `--data-only --inserts` SQL dump with a
 * hard cap of `maxRows` per table (FR-016). We do NOT use a full SQL
 * parser here — for the simple `INSERT INTO foo (cols) VALUES (...)`
 * pattern that pg_dump produces, a structural line parser is enough
 * and avoids false positives on CREATE statements.
 */
export function extractSampleRows(dataSql, maxRows) {
    const out = {};
    const insertRx = /INSERT\s+INTO\s+(?:"?([a-zA-Z_][a-zA-Z0-9_]*)"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s*\(([^)]+)\)\s*VALUES\s*([^;]+);/gi;
    for (const m of dataSql.matchAll(insertRx)) {
        const schemaName = m[1] ?? "public";
        const tableName = m[2];
        const columnList = m[3].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const valuesBlob = m[4];
        const rows = splitTopLevelTuples(valuesBlob);
        const key = `${schemaName}.${tableName}`;
        out[key] = out[key] ?? [];
        for (const rowText of rows) {
            if (out[key].length >= maxRows)
                break;
            const values = splitTopLevelCsv(rowText);
            if (values.length !== columnList.length)
                continue;
            const row = {};
            for (let i = 0; i < columnList.length; i++) {
                row[columnList[i]] = coerceLiteral(values[i]);
            }
            out[key].push(row);
        }
        // mirror onto the unqualified name too for easier lookup
        if (!out[tableName])
            out[tableName] = out[key].slice();
    }
    return out;
}
function splitTopLevelTuples(blob) {
    const tuples = [];
    let depth = 0;
    let current = "";
    let inString = false;
    for (let i = 0; i < blob.length; i++) {
        const ch = blob[i];
        if (inString) {
            current += ch;
            if (ch === "'" && blob[i + 1] !== "'")
                inString = false;
            continue;
        }
        if (ch === "'") {
            inString = true;
            current += ch;
            continue;
        }
        if (ch === "(") {
            if (depth === 0)
                current = "";
            else
                current += ch;
            depth++;
            continue;
        }
        if (ch === ")") {
            depth--;
            if (depth === 0) {
                tuples.push(current);
                current = "";
                continue;
            }
            current += ch;
            continue;
        }
        if (depth > 0)
            current += ch;
    }
    return tuples;
}
function splitTopLevelCsv(tuple) {
    const out = [];
    let depth = 0;
    let current = "";
    let inString = false;
    for (let i = 0; i < tuple.length; i++) {
        const ch = tuple[i];
        if (inString) {
            current += ch;
            if (ch === "'" && tuple[i + 1] !== "'")
                inString = false;
            continue;
        }
        if (ch === "'") {
            inString = true;
            current += ch;
            continue;
        }
        if (ch === "(")
            depth++;
        if (ch === ")")
            depth--;
        if (ch === "," && depth === 0) {
            out.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    if (current.trim().length > 0)
        out.push(current.trim());
    return out;
}
function coerceLiteral(raw) {
    if (raw === "NULL" || raw === "null")
        return null;
    const strMatch = raw.match(/^'(.*)'$/s);
    if (strMatch)
        return strMatch[1].replace(/''/g, "'");
    const n = Number(raw);
    if (!Number.isNaN(n))
        return n;
    return raw;
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            schema: { type: "string" },
            data: { type: "string" },
            out: { type: "string" },
        },
        strict: true,
    });
    if (!values.schema)
        throw new Error("--schema <path> is required");
    return {
        schemaPath: values.schema,
        dataPath: values.data ?? null,
        outPath: values.out ?? null,
    };
}
export async function runParseSchema(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-parse-schema: ${err.message}\n`);
        return 3;
    }
    let schemaSql;
    try {
        schemaSql = await fs.readFile(opts.schemaPath, "utf8");
    }
    catch (err) {
        const code = err.code;
        if (code === "ENOENT") {
            process.stderr.write(`atw-parse-schema: file not found: ${opts.schemaPath}\n`);
            return 1;
        }
        process.stderr.write(`atw-parse-schema: ${err.message}\n`);
        return 2;
    }
    let dataSql;
    if (opts.dataPath) {
        try {
            dataSql = await fs.readFile(opts.dataPath, "utf8");
        }
        catch (err) {
            process.stderr.write(`atw-parse-schema: data file unreadable: ${err.message}\n`);
            return 2;
        }
    }
    try {
        const { parsed } = await parseSchemaFromText({
            schemaSql,
            dataSql,
            sourceLabel: opts.schemaPath,
        });
        const payload = JSON.stringify(parsed, null, 2);
        if (opts.outPath) {
            const { writeArtifactAtomic } = await import("./lib/atomic.js");
            await writeArtifactAtomic(path.resolve(opts.outPath), payload + "\n");
        }
        else {
            process.stdout.write(payload + "\n");
        }
        return 0;
    }
    catch (err) {
        if (err instanceof CredentialRejectionError) {
            process.stderr.write(`atw-parse-schema: ${err.message}\n`);
            return 4;
        }
        if (err instanceof ParseSchemaError) {
            process.stderr.write(`atw-parse-schema: parse error at line ${err.line}, column ${err.column}: ${err.message}\n`);
            return 1;
        }
        process.stderr.write(`atw-parse-schema: ${err.message}\n`);
        return 1;
    }
}
// Silence astVisitor unused warning — we reserve it for a future indexes pass.
void astVisitor;
//# sourceMappingURL=parse-schema.js.map