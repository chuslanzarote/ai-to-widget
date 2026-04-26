/**
 * T071/T073 / US4 — helpers for the cost-accounting block in the build
 * manifest (`contracts/manifest.md` §2.6).
 *
 * `cost_variance_pct = (actual - estimated) / estimated * 100`
 *
 * The estimate comes from `build-plan.md` (written by `/atw.plan`); the
 * actual comes from summing real Opus usage during the build. When the
 * estimate is zero (or absent) we deliberately collapse the variance to
 * zero rather than dividing by zero — a zero-variance reading signals
 * "no estimate to compare against" to downstream auditors.
 */

export function computeCostVariancePct(actualCostUsd: number, estimatedCostUsd: number): number {
  if (!Number.isFinite(actualCostUsd) || !Number.isFinite(estimatedCostUsd)) return 0;
  if (estimatedCostUsd <= 0) return 0;
  return ((actualCostUsd - estimatedCostUsd) / estimatedCostUsd) * 100;
}
