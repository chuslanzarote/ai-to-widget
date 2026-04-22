import { CostEstimateSchema } from "./types.js";

export interface CostEstimateInput {
  entityCounts: Record<string, number>;
  perEntityMultiplier?: number;
  perCallCostUsd?: number;
  retryBufferRatio?: number;
}

export interface CostEstimate {
  enrichmentCalls: number;
  perCallCostUsd: number;
  totalCostUsd: number;
  retryBufferUsd: number;
}

export interface CostEstimateBreakdown extends CostEstimate {
  byEntity: Array<{
    entity: string;
    count: number;
    calls: number;
    subtotalUsd: number;
  }>;
  perEntityMultiplier: number;
  retryBufferRatio: number;
}

export const COST_CONSTANTS = {
  perEntityMultiplier: 1,
  perCallCostUsd: 0.03,
  retryBufferRatio: 0.2,
} as const;

export function estimateCost(input: CostEstimateInput): CostEstimateBreakdown {
  const multiplier = input.perEntityMultiplier ?? COST_CONSTANTS.perEntityMultiplier;
  const perCall = input.perCallCostUsd ?? COST_CONSTANTS.perCallCostUsd;
  const buffer = input.retryBufferRatio ?? COST_CONSTANTS.retryBufferRatio;

  if (multiplier < 0) throw new Error("perEntityMultiplier must be >= 0");
  if (perCall < 0) throw new Error("perCallCostUsd must be >= 0");
  if (buffer < 0) throw new Error("retryBufferRatio must be >= 0");

  const byEntity = Object.entries(input.entityCounts).map(([entity, count]) => {
    if (!Number.isFinite(count) || count < 0 || !Number.isInteger(count)) {
      throw new Error(`entity count for "${entity}" must be a non-negative integer`);
    }
    const calls = count * multiplier;
    return {
      entity,
      count,
      calls,
      subtotalUsd: round2(calls * perCall),
    };
  });

  const enrichmentCalls = byEntity.reduce((sum, b) => sum + b.calls, 0);
  const subtotal = byEntity.reduce((sum, b) => sum + b.subtotalUsd, 0);
  const retryBufferUsd = round2(subtotal * buffer);
  const totalCostUsd = round2(subtotal + retryBufferUsd);

  const estimate = {
    enrichmentCalls,
    perCallCostUsd: perCall,
    totalCostUsd,
    retryBufferUsd,
    byEntity,
    perEntityMultiplier: multiplier,
    retryBufferRatio: buffer,
  };

  CostEstimateSchema.parse({
    enrichmentCalls,
    perCallCostUsd: perCall,
    totalCostUsd,
    retryBufferUsd,
  });

  return estimate;
}

export function formatCostBreakdown(e: CostEstimateBreakdown): string {
  const subtotal = round2(e.totalCostUsd - e.retryBufferUsd);
  return [
    `Enrichment calls:     ${e.enrichmentCalls}`,
    `Per-call cost (USD):  ${e.perCallCostUsd.toFixed(4)}`,
    `Subtotal (USD):       ${subtotal.toFixed(2)}`,
    `Retry buffer (USD):   ${e.retryBufferUsd.toFixed(2)}  (+${Math.round(e.retryBufferRatio * 100)}%)`,
    `Estimated total:      ${e.totalCostUsd.toFixed(2)}`,
  ].join("\n");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
