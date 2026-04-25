export interface SqlDumpContext {
    /** Filename the build references, e.g. "schema". Appended with `.sql`. */
    name: string;
    /** Absolute project root so we can check for `.atw/inputs/README.md`. */
    projectRoot: string;
    /** Connection fields used when composing the long-form pg_dump. */
    host?: string;
    port?: number | string;
    user?: string;
    database?: string;
}
/**
 * Compose D-SQLDUMP. When `.atw/inputs/README.md` already exists (because
 * `/atw.schema` captured the exact invocation earlier), emit the short
 * variant that points at the README. Otherwise emit the full `pg_dump`
 * command with whatever connection fields are known.
 */
export declare function formatSqlDumpHalt(ctx: SqlDumpContext): Promise<string>;
export declare class MissingSqlDumpError extends Error {
    readonly code: "MISSING_SQL_DUMP";
    constructor(message: string);
}
//# sourceMappingURL=diagnostics.d.ts.map