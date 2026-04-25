export interface MigrationFile {
    filename: string;
    abspath: string;
    sha256: string;
    sql: string;
}
export interface ApplyResult {
    applied: string[];
    skipped: string[];
    failed: string[];
    warnings?: string[];
}
export interface ApplyOptions {
    dryRun?: boolean;
    connectionConfig: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
    migrationsDir?: string;
}
/**
 * Default migrations directory. Resolves relative to this file so it works
 * whether we're running from TS sources or from the compiled `dist/`.
 */
export declare function defaultMigrationsDir(): string;
export declare function loadMigrations(dir: string): Promise<MigrationFile[]>;
export declare function applyMigrations(opts: ApplyOptions): Promise<ApplyResult>;
export declare function runApplyMigrations(argv: string[]): Promise<number>;
//# sourceMappingURL=apply-migrations.d.ts.map