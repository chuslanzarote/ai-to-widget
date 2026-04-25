import { DEFAULT_INPUT_HASHES_PATH } from "./lib/input-hashes.js";
import { HOST_REQUIREMENTS_REL, type HostRequirementsEmitResult } from "./host-requirements.js";
export type AtwApiAction = "created" | "unchanged" | "rewritten";
export interface AtwApiOptions {
    /** Absolute file path, project-relative path, or `http(s)://` URL. */
    source: string;
    /** Defaults to `process.cwd()`. All writes go under `<projectRoot>/.atw/`. */
    projectRoot?: string;
    /** When true and `.atw/artifacts/openapi.json` exists with a
     *  different hash, copy the prior to `openapi.json.bak` first. */
    backup?: boolean;
}
export interface AtwApiResult {
    action: AtwApiAction;
    /** Repository-relative path, forward-slash separators. */
    path: string;
    /** Canonical `sha256:<hex>` of the written bytes. */
    sha256: string;
    /** Repository-relative path of the meta sidecar. */
    metaPath: string;
    /** Repository-relative path of the backup, when produced. */
    backupPath?: string;
    /**
     * Feature 008 / T046 — `.atw/artifacts/host-requirements.md` emission
     * outcome. `action: "skipped"` when the deployment-type gate fails
     * (no customer-facing-widget). Omitted from the legacy CLI text line
     * so Feature 006 tests keep passing.
     */
    hostRequirements?: HostRequirementsEmitResult;
}
/**
 * Recursive alphabetical key sort → `JSON.stringify(_, null, 2)` →
 * trailing newline. Arrays keep their input order (OpenAPI's
 * `paths[*].parameters[]` and `responses` orderings are
 * semantically significant for human review per data-model.md §1).
 *
 * Idempotent: canonicaliseOpenAPI(canonicaliseOpenAPI(x)) === canonicaliseOpenAPI(x).
 */
export declare function canonicaliseOpenAPI(doc: unknown): string;
/**
 * Programmatic entry used both by the CLI wrapper and by the
 * orchestrator's future `/atw.api` step. Returns the resolved action,
 * hash, and paths; throws the parse-openapi error classes unchanged
 * so callers can map them to exit codes (CLI) or structured
 * `pipeline_failures` (orchestrator).
 */
export declare function runAtwApi(opts: AtwApiOptions): Promise<AtwApiResult>;
export declare function runAtwApiCli(argv: string[]): Promise<number>;
export { DEFAULT_INPUT_HASHES_PATH, HOST_REQUIREMENTS_REL };
//# sourceMappingURL=atw-api.d.ts.map