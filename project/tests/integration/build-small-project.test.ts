/**
 * T109 / Polish — Small-project integration test (SC-019).
 *
 * Runs `/atw.build` against the mini fixture (single entity type
 * `product`, 20 rows) with Opus stubbed to a fixed response. Asserts
 * the manifest reports `result: "success"` AND duration under the
 * 5-minute wall-clock budget defined by SC-019.
 *
 * Requires Docker. Auto-skips without ATW_E2E_DOCKER=1 just like T052.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const miniFixture = path.resolve(repoRoot, "tests", "fixtures", "mini");

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";
const WALL_CLOCK_BUDGET_SECONDS = 300; // SC-019 "under 5 minutes"

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-mini-"));
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
      path.join(miniFixture, "config", f),
      path.join(atwConfig, f),
    );
  }
  for (const f of ["schema-map.md", "action-manifest.md", "build-plan.md"]) {
    await fs.copyFile(
      path.join(miniFixture, "artifacts", f),
      path.join(atwArtifacts, f),
    );
  }
  await fs.copyFile(
    path.join(miniFixture, "schema-with-data.sql"),
    path.join(atwInputs, "mini.sql"),
  );
}

function stableEnrichment(): string {
  return JSON.stringify({
    kind: "enriched",
    document:
      "This tea-shop product is part of the mini fixture catalog and is " +
      "suitable for retrieval-augmented testing of the Build Pipeline.",
    facts: [
      { claim: "product is in the mini fixture catalog", source: "primary_record.id" },
    ],
    categories: { catalog: ["mini"] },
  });
}

describe.skipIf(!DOCKER_AVAILABLE)("build small project (T109 / SC-019)", () => {
  it("completes /atw.build on the mini fixture under 5 minutes", async () => {
    await seedProject(tmpRoot);

    const { runBuild } = await import(
      "../../packages/scripts/src/orchestrator.js"
    );

    const run = await runBuild({
      projectRoot: tmpRoot,
      dryRun: false,
      force: false,
      yes: true,
      noEnrich: false,
      concurrency: 10,
      opusClient: {
        async createMessage() {
          return {
            contentText: stableEnrichment(),
            usage: { input_tokens: 800, output_tokens: 300 },
          };
        },
      },
    });

    expect(run.manifest.result).toBe("success");
    expect(run.manifest.totals.total_entities).toBe(20);
    expect(run.manifest.totals.enriched).toBe(20);
    expect(
      run.manifest.duration_seconds,
      `wall-clock ${run.manifest.duration_seconds}s exceeds SC-019 budget of ${WALL_CLOCK_BUDGET_SECONDS}s`,
    ).toBeLessThan(WALL_CLOCK_BUDGET_SECONDS);
  }, 15 * 60 * 1000);
});
