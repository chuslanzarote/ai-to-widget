/**
 * Opus 4.7 pricing constants as published by Anthropic (2026-04).
 *
 * Contract: contracts/enrichment.md §6
 * Prices are in USD per 1M tokens.
 */
export const OPUS_PRICING = Object.freeze({
  model: "claude-opus-4-7" as const,
  inputPerMillion: 15,
  outputPerMillion: 75,
});

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
}

/**
 * Compute the USD cost for a given token usage pair. Rounded to the nearest
 * cent (two decimals) to avoid floating-point cruft when summed across many
 * calls. Deterministic: given the same inputs always returns the same output.
 */
export function computeCostUsd(usage: TokenUsage): number {
  const inputCost = (usage.input_tokens / 1_000_000) * OPUS_PRICING.inputPerMillion;
  const outputCost = (usage.output_tokens / 1_000_000) * OPUS_PRICING.outputPerMillion;
  const total = inputCost + outputCost;
  return Math.round(total * 100) / 100;
}

/**
 * Variance between actual and estimated cost, in percent, signed.
 * Returns 0 when the estimate is zero to avoid division-by-zero.
 */
export function costVariancePct(actualUsd: number, estimatedUsd: number): number {
  if (estimatedUsd === 0) return 0;
  const variance = ((actualUsd - estimatedUsd) / estimatedUsd) * 100;
  return Math.round(variance * 100) / 100;
}
