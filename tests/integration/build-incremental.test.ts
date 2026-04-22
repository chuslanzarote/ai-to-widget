/**
 * T077 — integration test for the US5 incremental-rebuild paths.
 *
 * Three scenarios, all against the Aurelia fixture:
 *
 *   1. Re-run with zero changes → completes in under 30 s, zero Opus
 *      calls, manifest result = "nothing-to-do" (SC-013 / FR-080).
 *   2. Touch only `.atw/artifacts/action-manifest.md` → enrichment
 *      skipped, render + bundle + image still run (FR-081).
 *   3. Touch `.atw/config/brief.md` → warning surfaced on stderr
 *      (FR-082).
 *
 * Auto-skips without ATW_E2E_DOCKER=1.
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
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-incr-"));
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

describe.skipIf(!DOCKER_AVAILABLE)("build incremental (T077 / SC-013)", () => {
  it("re-run with zero changes completes in <30 s with result=nothing-to-do", async () => {
    await seedProject(tmpRoot);
    const { runBuild } = await import(
      "../../packages/scripts/src/orchestrator.js"
    );
    // First run populates atw_documents + input-hashes.
    const first = await runBuild({
      projectRoot: tmpRoot,
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
    expect(first.manifest.result).toBe("success");

    // Second run should short-circuit.
    const start = Date.now();
    let calls = 0;
    const second = await runBuild({
      projectRoot: tmpRoot,
      yes: true,
      noEnrich: false,
      concurrency: 10,
      opusClient: {
        async createMessage() {
          calls += 1;
          return {
            contentText: validEnrichment(),
            usage: { input_tokens: 1200, output_tokens: 400 },
          };
        },
      },
    });
    const elapsedSeconds = (Date.now() - start) / 1000;
    expect(second.manifest.result).toBe("nothing-to-do");
    expect(calls).toBe(0);
    expect(
      elapsedSeconds,
      `SC-013: incremental no-op must finish in <30s, got ${elapsedSeconds.toFixed(1)}s`,
    ).toBeLessThan(30);
  }, 20 * 60 * 1000);

  it("touching only action-manifest.md skips enrichment on the second run", async () => {
    await seedProject(tmpRoot);
    const { runBuild } = await import(
      "../../packages/scripts/src/orchestrator.js"
    );
    await runBuild({
      projectRoot: tmpRoot,
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
    // Perturb action-manifest.md (append a trailing comment).
    const amPath = path.join(tmpRoot, ".atw", "artifacts", "action-manifest.md");
    const amBody = await fs.readFile(amPath, "utf8");
    await fs.writeFile(amPath, amBody + "\n<!-- touched by T077 -->\n", "utf8");

    let calls = 0;
    const second = await runBuild({
      projectRoot: tmpRoot,
      yes: true,
      noEnrich: false,
      concurrency: 10,
      opusClient: {
        async createMessage() {
          calls += 1;
          return {
            contentText: validEnrichment(),
            usage: { input_tokens: 1200, output_tokens: 400 },
          };
        },
      },
    });
    // FR-081: no Opus calls because enrichment was skipped.
    expect(calls).toBe(0);
    // Render phase still ran → widget bundle artifacts should exist.
    const widgetJs = await fs
      .stat(path.join(tmpRoot, "dist", "widget.js"))
      .catch(() => null);
    expect(widgetJs, "widget bundle missing after action-manifest-only rebuild").not.toBeNull();
    // Manifest result: nothing-to-do (enrichment skipped, no failures).
    // Depending on total_entities, could also be "success" if render
    // rewrote files; either is acceptable per FR-081 as long as no Opus
    // call happened.
    expect(["success", "nothing-to-do"]).toContain(second.manifest.result);
  }, 20 * 60 * 1000);

  it("touching brief.md surfaces a --force warning on stderr", async () => {
    await seedProject(tmpRoot);
    const { runBuild } = await import(
      "../../packages/scripts/src/orchestrator.js"
    );
    await runBuild({
      projectRoot: tmpRoot,
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
    const briefPath = path.join(tmpRoot, ".atw", "config", "brief.md");
    const briefBody = await fs.readFile(briefPath, "utf8");
    await fs.writeFile(briefPath, briefBody + "\n<!-- edited by T077 -->\n", "utf8");

    const captured: string[] = [];
    const { default: mod } = await import("node:module");
    // Intercept stderr writes non-destructively.
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      // @ts-expect-error forward as-is
      return origWrite(chunk, ...rest);
    }) as typeof process.stderr.write;
    void mod;
    try {
      await runBuild({
        projectRoot: tmpRoot,
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
    } finally {
      process.stderr.write = origWrite;
    }
    const joined = captured.join("");
    expect(joined).toMatch(/brief\.md changed/i);
    expect(joined).toMatch(/--force/);
  }, 20 * 60 * 1000);
});
