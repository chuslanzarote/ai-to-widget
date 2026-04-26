import { describe, it, expect } from "vitest";
import {
  estimateCost,
  formatCostBreakdown,
  COST_CONSTANTS,
} from "../src/lib/cost-estimator.js";
import { CostEstimateSchema } from "../src/lib/types.js";

describe("cost-estimator (T089 / FR-035)", () => {
  it("computes enrichment calls = entities × multiplier (default multiplier 1)", () => {
    const e = estimateCost({ entityCounts: { product: 300, category: 25 } });
    expect(e.enrichmentCalls).toBe(325);
  });

  it("applies a 20% retry buffer by default per FR-035", () => {
    const e = estimateCost({
      entityCounts: { product: 100 },
      perCallCostUsd: 0.03,
    });
    // subtotal = 100 * 0.03 = 3.00, buffer = 0.6, total = 3.60
    expect(e.perCallCostUsd).toBe(0.03);
    expect(e.retryBufferUsd).toBeCloseTo(0.6, 2);
    expect(e.totalCostUsd).toBeCloseTo(3.6, 2);
  });

  it("exposes a four-field CostEstimate matching the data-model contract", () => {
    const e = estimateCost({ entityCounts: { product: 50 } });
    const { enrichmentCalls, perCallCostUsd, totalCostUsd, retryBufferUsd } = e;
    expect(() =>
      CostEstimateSchema.parse({ enrichmentCalls, perCallCostUsd, totalCostUsd, retryBufferUsd }),
    ).not.toThrow();
  });

  it("honours per-entity multiplier overrides", () => {
    const e = estimateCost({
      entityCounts: { product: 10 },
      perEntityMultiplier: 2,
      perCallCostUsd: 0.05,
      retryBufferRatio: 0,
    });
    expect(e.enrichmentCalls).toBe(20);
    expect(e.totalCostUsd).toBeCloseTo(1.0, 2);
    expect(e.retryBufferUsd).toBe(0);
  });

  it("rejects negative inputs", () => {
    expect(() => estimateCost({ entityCounts: { product: -1 } })).toThrow();
    expect(() =>
      estimateCost({ entityCounts: { product: 1 }, perCallCostUsd: -0.01 }),
    ).toThrow();
  });

  it("formats the breakdown with all four components visible", () => {
    const e = estimateCost({ entityCounts: { product: 100 } });
    const text = formatCostBreakdown(e);
    expect(text).toMatch(/Enrichment calls:\s+100/);
    expect(text).toMatch(/Per-call cost/);
    expect(text).toMatch(/Subtotal/);
    expect(text).toMatch(/Retry buffer/);
    expect(text).toMatch(/Estimated total/);
  });

  it("exports defaults aligning with FR-035 (+20% buffer)", () => {
    expect(COST_CONSTANTS.retryBufferRatio).toBe(0.2);
    expect(COST_CONSTANTS.perEntityMultiplier).toBe(1);
    expect(COST_CONSTANTS.perCallCostUsd).toBeGreaterThan(0);
  });
});
