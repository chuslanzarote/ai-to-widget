import { type ParsedSQLSchema } from "./lib/types.js";
export interface ParseSchemaOptions {
    schemaSql: string;
    dataSql?: string;
    /** Optional Builder-facing filename (for error messages only). */
    sourceLabel?: string;
}
export interface ParseSchemaResult {
    parsed: ParsedSQLSchema;
}
export declare class ParseSchemaError extends Error {
    readonly line: number;
    readonly column: number;
    constructor(message: string, line: number, column: number);
}
export declare class CredentialRejectionError extends Error {
    readonly matches: readonly string[];
    constructor(matches: readonly string[]);
}
/**
 * Deterministically parses a `pg_dump --schema-only` dump into
 * `ParsedSQLSchema`. Credential paste is refused at the boundary
 * (FR-018 / SC-010). No LLM call. No DB connection.
 */
export declare function parseSchemaFromText(opts: ParseSchemaOptions): Promise<ParseSchemaResult>;
/**
 * Extracts row samples from a `--data-only --inserts` SQL dump with a
 * hard cap of `maxRows` per table (FR-016). We do NOT use a full SQL
 * parser here — for the simple `INSERT INTO foo (cols) VALUES (...)`
 * pattern that pg_dump produces, a structural line parser is enough
 * and avoids false positives on CREATE statements.
 */
export declare function extractSampleRows(dataSql: string, maxRows: number): Record<string, Record<string, unknown>[]>;
export declare function runParseSchema(argv: string[]): Promise<number>;
//# sourceMappingURL=parse-schema.d.ts.map