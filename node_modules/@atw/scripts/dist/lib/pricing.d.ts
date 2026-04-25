/**
 * Anthropic model pricing table (USD per 1M tokens). Extended in Feature 009
 * from a single OPUS_PRICING constant to a `MODEL_PRICING` map keyed by
 * `ModelSnapshot` so the pre-call cost countdown (FR-006a) can show the
 * correct estimate for any configured snapshot.
 *
 * Source: https://www.anthropic.com/pricing (2026-04). Update this table
 * whenever pricing changes. Constitution VIII reproducibility relies on the
 * `model_snapshot` recorded in build provenance reflecting the snapshot used
 * at LLM-call time; this table is the cost-side companion.
 */
export type ModelSnapshot = "claude-opus-4-7" | "claude-sonnet-4-6" | "claude-haiku-4-5";
export interface PricingEntry {
    readonly model: ModelSnapshot;
    readonly inputPerMillion: number;
    readonly outputPerMillion: number;
}
export declare const MODEL_PRICING: Readonly<Record<ModelSnapshot, PricingEntry>>;
/**
 * Backward-compatible alias preserved for Feature 002 callers. New code SHOULD
 * read `MODEL_PRICING[snapshot]` instead.
 */
export declare const OPUS_PRICING: PricingEntry;
export declare const SUPPORTED_MODEL_SNAPSHOTS: readonly ModelSnapshot[];
export declare function isSupportedSnapshot(value: string): value is ModelSnapshot;
export interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
}
export declare function computeCostUsd(usage: TokenUsage, snapshot?: ModelSnapshot): number;
export declare function costVariancePct(actualUsd: number, estimatedUsd: number): number;
//# sourceMappingURL=pricing.d.ts.map