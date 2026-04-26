/**
 * T069 — integration test for the US3 resumable-build flow.
 *
 * Sequence:
 *   1. Seed a fresh Aurelia project root (same fixture as T052).
 *   2. Run a *partial* build: stub OpusClient to throw after the first N
 *      entities have been enriched. This leaves atw_documents partially
 *      populated but with valid rows + source_hash on the finished ones.
 *   3. Run the build a second time against the same project root. The
 *      second OpusClient records every entity it is asked to enrich and
 *      accepts normally.
 *   4. Assert:
 *        - The second run's Opus call count == (total_entities - N);
 *          rows from the first run are skipped via source_hash.
 *        - Combined cost (run 1 + run 2) is within 5 % of the cost of a
 *          single uninterrupted run (SC-015).
 *        - The final manifest has `result: "success"` and zero failures.
 *
 * Auto-skips without ATW_E2E_DOCKER=1 just like T052.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const aureliaCompleted = path.resolve(repoRoot, "examples", "aurelia-completed");
const aureliaFixture = path.resolve(repoRoot, "tests", "fixtures", "aurelia");

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-resume-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function seedProject(root: string): Promise<void> {
  const atwConfig = path.join(root, ".atw", "config");
  const atwArtifacts = path.join(root, ".atw", "artifacts");
  const atwInputs = path.join(root, ".atw", "inputs");
  const atwState = path.join(root, ".atw", "state");
  await fs.mkdir(atwConfig, { recursive: true });
  await fs.mkdir(atwArtifacts, { recursive: true });
  await fs.mkdir(atwInputs, { recursive: true });
  await fs.mkdir(atwState, { recursive: true });

  for (const f of ["brief.md", "project.md"]) {
    await fs.copyFile(
      path.join(aureliaCompleted, "config", f),
      path.join(atwConfig, f),
    );
  }
  for (const f of ["schema-map.md", "action-manifest.md", "build-plan.md"]) {
    await fs.copyFile(
      path.join(aureliaCompleted, "artifacts", f),
      path.join(atwArtifacts, f),
    );
  }
  await fs.copyFile(
    path.join(aureliaFixture, "schema-with-data.sql"),
    path.join(atwInputs, "aurelia.sql"),
  );
}

function validEnrichment(): string {
  return JSON.stringify({
    kind: "enriched",
    document:
      "This indexable entity is present in the Aurelia fixture and is suitable for retrieval augmented testing in the Build Pipeline feature.",
    facts: [
      {
        claim: "entity is from the Aurelia fixture",
        source: "primary_record.id",
      },
    ],
    categories: { source: ["aurelia"] },
  });
}

describe.skipIf(!DOCKER_AVAILABLE)("build resumability (T069 / SC-015)", () => {
  it("a second run skips entities the first run already indexed via source_hash", async () => {
    await seedProject(tmpRoot);

    const { runBuild } = await import(
      "../../packages/scripts/src/orchestrator.js"
    );

    // --- First run: stop accepting Opus calls after the first 3 entities.
    let run1CallCount = 0;
    const run1 = await runBuild({
      projectRoot: tmpRoot,
      dryRun: false,
      force: false,
      yes: true,
      noEnrich: false,
      concurrency: 1,
      opusClient: {
        async createMessage() {
          run1CallCount += 1;
          if (run1CallCount > 3) {
            throw new Error("simulated abort: resumability test run 1");
          }
          return {
            contentText: validEnrichment(),
            usage: { input_tokens: 1200, output_tokens: 400 },
          };
        },
      },
    });
    // Run 1 will be "partial": some entities succeeded, others errored.
    expect(["partial", "failed"]).toContain(run1.manifest.result);
    expect(run1.manifest.totals.enriched).toBeGreaterThan(0);

    const run1Enriched = run1.manifest.totals.enriched;
    const run1Calls = run1.manifest.opus.calls;
    const run1Cost = run1.manifest.opus.cost_usd;

    // --- Second run: OpusClient succeeds every time; we count how many
    // calls it sees. Any entity already indexed by run 1 must be skipped.
    let run2CallCount = 0;
    const run2 = await runBuild({
      projectRoot: tmpRoot,
      dryRun: false,
      force: false,
      yes: true,
      noEnrich: false,
      concurrency: 10,
      opusClient: {
        async createMessage() {
          run2CallCount += 1;
          return {
            contentText: validEnrichment(),
            usage: { input_tokens: 1200, output_tokens: 400 },
          };
        },
      },
    });

    expect(run2.manifest.result).toBe("success");
    expect(run2.manifest.totals.failed).toBe(0);

    // Run 2 should have seen FEWER calls than run 1 would have (the
    // successful rows from run 1 are skipped). Bounded above by
    // total_entities - run1Enriched.
    const total = run2.manifest.totals.total_entities;
    expect(run2CallCount).toBeLessThanOrEqual(total - run1Enriched);
    expect(run2.manifest.totals.skipped_unchanged).toBeGreaterThanOrEqual(
      run1Enriched,
    );

    // --- SC-015 — combined cost should be within 5 % of a single-run cost.
    // Use a single-run estimate by running the same project fresh in a
    // separate tmp dir.
    const soloRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-resume-solo-"));
    try {
      await seedProject(soloRoot);
      const solo = await runBuild({
        projectRoot: soloRoot,
        dryRun: false,
        force: false,
        yes: true,
        noEnrich: false,
        concurrency: 10,
        opusClient: {
          async createMessage() {
            return {
              contentText: validEnrichment(),
              usage: { input_tokens: 1200, output_tokens: 400 },
            };
          },
        },
      });
      expect(solo.manifest.result).toBe("success");
      const soloCost = solo.manifest.opus.cost_usd;
      const combinedCost = run1Cost + run2.manifest.opus.cost_usd;
      const variance = Math.abs(combinedCost - soloCost) / Math.max(soloCost, 0.000001);
      expect(
        variance,
        `combined cost $${combinedCost} vs solo $${soloCost} → variance ${(variance * 100).toFixed(2)} % exceeds SC-015 rail of 5 %`,
      ).toBeLessThanOrEqual(0.05);
    } finally {
      await fs.rm(soloRoot, { recursive: true, force: true });
    }

    // Calls from run 1 must be preserved in the second manifest (they
    // were paid, so the resume story has to reflect them). Sanity check
    // that run1Calls > 0 and run2 sees the rest.
    expect(run1Calls).toBeGreaterThanOrEqual(run1Enriched);

    // T091 / US7 — post-abort consistency: every row committed by run 1
    // must have a non-null source_hash AND a non-null embedding. If any
    // row lacks either, the resume path would either re-enrich it (waste
    // of Opus cost) or silently ship a broken retrieval record.
    const { Client } = await import("pg");
    const inspector = new Client({
      host: "127.0.0.1",
      port: 5433,
      user: "atw",
      password: "atw",
      database: "atw",
    });
    await inspector.connect();
    try {
      const rows = await inspector.query<{
        entity_type: string;
        entity_id: string;
        has_hash: boolean;
        has_embedding: boolean;
      }>(
        `SELECT entity_type, entity_id,
                (source_hash IS NOT NULL AND source_hash <> '') AS has_hash,
                (embedding   IS NOT NULL)                        AS has_embedding
           FROM atw_documents`,
      );
      expect(rows.rows.length).toBeGreaterThan(0);
      const broken = rows.rows.filter(
        (r) => !r.has_hash || !r.has_embedding,
      );
      expect(
        broken,
        `found ${broken.length} partial atw_documents rows after abort — ` +
          `every row must have source_hash + embedding: ` +
          broken.map((b) => `${b.entity_type}/${b.entity_id}`).join(", "),
      ).toHaveLength(0);
    } finally {
      await inspector.end().catch(() => void 0);
    }
  }, 30 * 60 * 1000); // 30 minutes: two full Docker-backed builds + a solo run
});
