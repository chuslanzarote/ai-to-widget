/**
 * T102 / Polish — build-pii-scan integration test.
 *
 * Contract: injecting a PII value from a PII-flagged column into an
 * Opus-mocked enrichment response must cause the post-build compliance
 * scan (`atw-scan-pii-leaks`) to FAIL the build. The resulting manifest
 * must:
 *   - carry `result: "failed"`
 *   - carry a non-empty `compliance_scan.matches[]` entry that names the
 *     offending PII value and the atw_documents column where it was
 *     found (SC-018, FR-088)
 *
 * Requires Docker. Auto-skips without ATW_E2E_DOCKER=1 just like T052.
 *
 * The PII value is `ava.jensen@example.com` — present in the
 * `public.customer.email` column of the Aurelia fixture (schema-map.md
 * flags `customer` → [email, phone, first_name, last_name] as direct
 * PII).
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
const PII_VALUE = "ava.jensen@example.com";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-pii-"));
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

function enrichmentWithPii(): string {
  // The document intentionally contains a real customer email string that
  // came from a PII-flagged column. The post-build scanner must flag it.
  return JSON.stringify({
    kind: "enriched",
    document:
      `This indexable entity can be reached by contacting ${PII_VALUE} for ` +
      `verification. It is suitable for retrieval augmented testing in the ` +
      `Build Pipeline feature.`,
    facts: [
      { claim: "entity is from the Aurelia fixture", source: "primary_record.id" },
    ],
    categories: { source: ["aurelia"] },
  });
}

describe.skipIf(!DOCKER_AVAILABLE)("build PII scan (T102 / SC-018 / FR-088)", () => {
  it("fails the build when enrichment leaks a PII-flagged value", async () => {
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
            contentText: enrichmentWithPii(),
            usage: { input_tokens: 1200, output_tokens: 400 },
          };
        },
      },
    });

    // Builds with PII leaks must fail — not "partial", not "success".
    expect(run.manifest.result).toBe("failed");

    // The compliance scan ran and found at least one match referencing
    // the injected PII value.
    expect(run.manifest.compliance_scan.ran).toBe(true);
    expect(run.manifest.compliance_scan.clean).toBe(false);
    expect(run.manifest.compliance_scan.matches.length).toBeGreaterThan(0);
    const hasEmailMatch = run.manifest.compliance_scan.matches.some((m) =>
      JSON.stringify(m).toLowerCase().includes(PII_VALUE),
    );
    expect(
      hasEmailMatch,
      `expected compliance_scan.matches to reference ${PII_VALUE}: ${JSON.stringify(run.manifest.compliance_scan.matches)}`,
    ).toBe(true);
  }, 30 * 60 * 1000);
});
