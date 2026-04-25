import { BuildManifest } from "./lib/types.js";
import { formatLine } from "./lib/progress.js";
import { OpusClient } from "./enrich-entity.js";
export interface OrchestratorFlags {
    projectRoot: string;
    force?: boolean;
    dryRun?: boolean;
    concurrency?: number;
    postgresPort?: number;
    entitiesOnly?: boolean;
    noEnrich?: boolean;
    backup?: boolean;
    yes?: boolean;
    help?: boolean;
    version?: boolean;
    /** Test hook: inject a fake OpusClient so integration tests can avoid real API calls. */
    opusClient?: OpusClient;
}
export interface OrchestratorResult {
    exitCode: number;
    manifest: BuildManifest | null;
}
/**
 * Orchestrator entry point for `/atw.build`.
 *
 * Sequence (US1 happy path, contract: slash-command.md §3):
 *   BOOT → MIGRATE → IMPORT → ENRICH → RENDER → BUNDLE → IMAGE → SCAN → DONE
 *
 * US2 adds the full validator + sharpening retry in enrich-entity.
 * US3 adds source_hash skip; US4 adds cost accounting;
 * US5 adds manifest-diff incremental short-circuit; US6 failure reasons;
 * US7 adds SIGINT handling; US8 determinism; US9 --concurrency auto-reduce.
 */
export declare function runBuild(flags: OrchestratorFlags): Promise<OrchestratorResult>;
export declare function generateBuildId(nowMs?: number): string;
export declare function generateUlid(nowMs?: number): string;
/**
 * Parse argv into OrchestratorFlags. Shared by the CLI shim and by tests.
 */
export declare function parseArgs(argv: string[], projectRoot: string): OrchestratorFlags;
export { formatLine };
//# sourceMappingURL=orchestrator.d.ts.map