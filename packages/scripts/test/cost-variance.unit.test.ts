/**
 * T073 / US4 — unit tests for `cost_variance_pct` computation.
 *
 * Variance is `(actual - estimated) / estimated * 100`. Edge cases:
 *   - estimate == 0 collapses to 0 (no estimate to compare against).
 *   - negative variance is legal (build cheaper than estimated).
 *   - non-finite inputs collapse to 0 so a bad pricing read never
 *     corrupts the manifest.
 */
import { describe, it, expect } from "vitest";
import { computeCostVariancePct } from "../src/lib/cost-variance.js";

describe("computeCostVariancePct", () => {
  it("actual == estimated → 0", () => {
    expect(computeCostVariancePct(12.31, 12.31)).toBe(0);
  });

  it("actual > estimated → positive pct", () => {
    const v = computeCostVariancePct(15, 10);
    expect(v).toBeCloseTo(50, 6);
  });

  it("actual < estimated → negative pct", () => {
    const v = computeCostVariancePct(8, 10);
    expect(v).toBeCloseTo(-20, 6);
  });

  it("zero estimate → 0 (no divide-by-zero)", () => {
    expect(computeCostVariancePct(5, 0)).toBe(0);
    expect(computeCostVariancePct(0, 0)).toBe(0);
  });

  it("negative estimate defensively returns 0", () => {
    expect(computeCostVariancePct(5, -5)).toBe(0);
  });

  it("NaN inputs collapse to 0", () => {
    expect(computeCostVariancePct(NaN, 10)).toBe(0);
    expect(computeCostVariancePct(10, NaN)).toBe(0);
  });

  it("Infinity inputs collapse to 0", () => {
    expect(computeCostVariancePct(Infinity, 10)).toBe(0);
    expect(computeCostVariancePct(10, Infinity)).toBe(0);
  });

  it("SC-017 rail: 20 % over estimate is the boundary", () => {
    const v = computeCostVariancePct(12, 10);
    expect(v).toBeCloseTo(20, 6);
    expect(Math.abs(v)).toBeLessThanOrEqual(20);
  });

  it("small absolute dollars behave as expected", () => {
    // 0.01 -> 0.012 is a +20% variance
    const v = computeCostVariancePct(0.012, 0.01);
    expect(v).toBeCloseTo(20, 4);
  });
});
