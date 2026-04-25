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

export type ModelSnapshot =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5";

export interface PricingEntry {
  readonly model: ModelSnapshot;
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}

export const MODEL_PRICING: Readonly<Record<ModelSnapshot, PricingEntry>> = Object.freeze({
  "claude-opus-4-7": Object.freeze({
    model: "claude-opus-4-7",
    inputPerMillion: 15,
    outputPerMillion: 75,
  }),
  "claude-sonnet-4-6": Object.freeze({
    model: "claude-sonnet-4-6",
    inputPerMillion: 3,
    outputPerMillion: 15,
  }),
  "claude-haiku-4-5": Object.freeze({
    model: "claude-haiku-4-5",
    inputPerMillion: 1,
    outputPerMillion: 5,
  }),
});

/**
 * Backward-compatible alias preserved for Feature 002 callers. New code SHOULD
 * read `MODEL_PRICING[snapshot]` instead.
 */
export const OPUS_PRICING = MODEL_PRICING["claude-opus-4-7"];

export const SUPPORTED_MODEL_SNAPSHOTS: readonly ModelSnapshot[] = Object.freeze(
  Object.keys(MODEL_PRICING) as ModelSnapshot[],
);

export function isSupportedSnapshot(value: string): value is ModelSnapshot {
  return value in MODEL_PRICING;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

export function computeCostUsd(
  usage: TokenUsage,
  snapshot: ModelSnapshot = "claude-opus-4-7",
): number {
  const entry = MODEL_PRICING[snapshot];
  const inputCost = (usage.input_tokens / 1_000_000) * entry.inputPerMillion;
  const outputCost = (usage.output_tokens / 1_000_000) * entry.outputPerMillion;
  const total = inputCost + outputCost;
  return Math.round(total * 100) / 100;
}

export function costVariancePct(actualUsd: number, estimatedUsd: number): number {
  if (estimatedUsd === 0) return 0;
  const variance = ((actualUsd - estimatedUsd) / estimatedUsd) * 100;
  return Math.round(variance * 100) / 100;
}
