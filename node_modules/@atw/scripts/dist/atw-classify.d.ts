import { type OpusClient } from "./enrich-entity.js";
import type { ActionManifest } from "./lib/action-manifest-types.js";
export interface AtwClassifyOptions {
    /** Defaults to `process.cwd()`. All reads/writes under `<projectRoot>/.atw/`. */
    projectRoot?: string;
    /** Inject a fake Opus client for tests. */
    opusClient?: OpusClient;
    /** Override model snapshot for tests. Defaults to `claude-opus-4-7`. */
    modelSnapshot?: string;
    /** Host origin from brief; reserved for cross-origin widget detection. */
    hostOrigin?: string;
    /** Override classifiedAt for deterministic tests. */
    classifiedAt?: string;
    /** Timeout for Opus calls. Defaults to 60 s. */
    opusTimeoutMs?: number;
}
export interface AtwClassifyResult {
    action: "created" | "unchanged" | "rewritten";
    path: string;
    warnings: string[];
    manifest: ActionManifest;
}
export declare function runAtwClassify(opts?: AtwClassifyOptions): Promise<AtwClassifyResult>;
export declare function runAtwClassifyCli(argv: string[]): Promise<number>;
//# sourceMappingURL=atw-classify.d.ts.map