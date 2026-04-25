export interface StartPostgresResult {
    container_id: string;
    port: number;
    started: boolean;
}
export interface StartPostgresOptions {
    port?: number;
    waitSeconds?: number;
    image?: string;
    containerName?: string;
    db?: string;
    user?: string;
    password?: string;
}
/**
 * Start the atw_postgres container using dockerode. No-op when already
 * running. Resolves once Postgres is accepting TCP connections or rejects
 * when the wait deadline elapses.
 *
 * Contract: contracts/scripts.md §1.
 */
export declare function startPostgres(opts?: StartPostgresOptions): Promise<StartPostgresResult>;
export declare function runStartPostgres(argv: string[]): Promise<number>;
//# sourceMappingURL=start-postgres.d.ts.map