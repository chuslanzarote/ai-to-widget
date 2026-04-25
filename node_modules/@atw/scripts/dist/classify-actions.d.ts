/**
 * /atw.api ↔ /atw.classify — LLM-native action manifest emission.
 *
 * Single Anthropic `messages.create()` call per source OpenAPI document.
 * The LLM receives the full bundled spec + project.md and returns a
 * JSON-schema-validated manifest via `tool_use` mode (R2). Around the
 * call, parsing/bundling/validation/write stay deterministic
 * (Constitution VI). Retry is the helper from `lib/llm-retry.ts`
 * (FR-008a, R4); cost is surfaced via `lib/cost-estimator.ts`
 * (FR-006a, R5); the manifest is round-tripped through
 * `lib/manifest-io.ts` (FR-007).
 *
 * NB: this replaces the old "chunked-by-entity, multi-call,
 * pre-filter-then-classify" path. Constitution V (Anchored Generation)
 * is satisfied by the per-field citation requirement enforced server-
 * side via the tool-call `input_schema`.
 */
import { type ActionManifest, type ManifestInvariantIssue } from "./lib/schemas/action-manifest.js";
import { ProjectConfigError } from "./lib/runtime-config.js";
import { MODEL_PRICING, type ModelSnapshot } from "./lib/pricing.js";
export interface ClassifyActionsOptions {
    /** Path to or URL of the source OpenAPI document. */
    source: string;
    /** Repository root containing `.atw/` (defaults to cwd). */
    projectRoot?: string;
    /** Target manifest path; defaults to `<projectRoot>/.atw/artifacts/action-manifest.md`. */
    outPath?: string;
    /** Skip the 2-second informational countdown (CI uses this). */
    skipCountdown?: boolean;
    /** Override the SDK key resolution (testing). */
    anthropicApiKey?: string;
}
export interface ClassifyActionsResult {
    manifest: ActionManifest;
    manifestPath: string;
    llm: {
        attempts: number;
        retry_delays_ms: number[];
        input_tokens: number;
        output_tokens: number;
        estimated_cost_usd: number;
        actual_cost_usd: number;
        cost_variance_pct: number;
        model_snapshot: ModelSnapshot;
    };
}
export declare class ClassifyValidationError extends Error {
    readonly issues: ManifestInvariantIssue[];
    constructor(issues: ManifestInvariantIssue[]);
}
export declare function classifyActions(opts: ClassifyActionsOptions): Promise<ClassifyActionsResult>;
export declare function runClassifyActions(argv: string[]): Promise<number>;
export { MODEL_PRICING };
export { ProjectConfigError };
//# sourceMappingURL=classify-actions.d.ts.map