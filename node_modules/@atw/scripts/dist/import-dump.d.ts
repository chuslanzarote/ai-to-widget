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
    piiColumns: Array<{
        table: string;
        column: string;
    }>;
}
export interface ParsedStatement {
    kind: "create_table" | "copy" | "alter_table" | "create_index" | "set" | "other";
    tableRef?: string;
    text: string;
    columns?: string[];
    dataLines?: string[];
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
export declare function sanitizePgDump17(sql: string): string;
export declare function splitStatements(sql: string): ParsedStatement[];
export interface FilterResult {
    filteredSql: string;
    imported: string[];
    excludedPiiTables: string[];
    droppedPiiColumns: Array<[string, string]>;
    warnings: string[];
}
export declare function filterDump(sql: string, map: SchemaMapForImport, targetSchema?: string): FilterResult;
/**
 * Programmatic entry used by the orchestrator. Reads the dump, runs
 * `filterDump`, and executes the filtered SQL against Postgres.
 */
export declare function importDump(opts: ImportDumpOptions): Promise<ImportDumpResult>;
export declare function runImportDump(argv: string[]): Promise<number>;
//# sourceMappingURL=import-dump.d.ts.map