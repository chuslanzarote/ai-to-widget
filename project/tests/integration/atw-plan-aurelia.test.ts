import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { validateArtifacts } from "../../packages/scripts/src/validate-artifacts.js";
import {
  estimateCost,
  formatCostBreakdown,
} from "../../packages/scripts/src/lib/cost-estimator.js";
import { writeAureliaArtifacts } from "./fixtures/aurelia-artifacts.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-plan-happy-"));
  await writeAureliaArtifacts(tmpRoot);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("atw.plan happy path (T085 / FR-035)", () => {
  it("passes preflight consistency check with all four artifacts", async () => {
    const report = await validateArtifacts({ root: tmpRoot });
    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.inconsistencies).toEqual([]);
  });

  it("produces a cost estimate with all four components (calls / per-call / total / buffer)", () => {
    // Aurelia-shaped counts per sample-build-plan.md
    const e = estimateCost({
      entityCounts: { product: 300, category: 25, collection: 12, region: 5 },
    });
    expect(e.enrichmentCalls).toBe(342);
    expect(e.perCallCostUsd).toBeGreaterThan(0);
    expect(e.retryBufferUsd).toBeGreaterThan(0);
    expect(e.totalCostUsd).toBeGreaterThan(e.retryBufferUsd);

    // Display contract: breakdown must render all four components.
    const text = formatCostBreakdown(e);
    expect(text).toContain("Enrichment calls:");
    expect(text).toContain("Per-call cost");
    expect(text).toContain("Retry buffer");
    expect(text).toContain("Estimated total");
  });

  it("matches the structural contract of examples/sample-build-plan.md", async () => {
    const samplePath = path.resolve(__dirname, "..", "..", "examples", "sample-build-plan.md");
    const sample = await fs.readFile(samplePath, "utf8");
    // The actual written build-plan.md (generated later) must carry each of
    // these top-level anchor headings — assert the sample owns them so the
    // structural contract is captured here at least once.
    expect(sample).toMatch(/^# Build Plan/m);
    expect(sample).toMatch(/^## Embedding model/m);
    expect(sample).toMatch(/^## Enrichment plan/m);
    expect(sample).toMatch(/^## Build sequence/m);
    expect(sample).toMatch(/### Estimated cost/);
  });
});
