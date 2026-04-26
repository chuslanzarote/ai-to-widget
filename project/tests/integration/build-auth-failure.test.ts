/**
 * T086 — integration test for the auth-failure halt (FR-085 / US6).
 *
 * When the Builder runs `/atw.build` without ANTHROPIC_API_KEY exported,
 * the orchestrator must:
 *   - print a one-line diagnostic telling them to set the env var
 *   - exit with code 3 BEFORE any Docker container boots
 *
 * This test does not require Docker because the guard fires before BOOT.
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

let tmpRoot: string;
let savedKey: string | undefined;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-authfail-"));
  savedKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(async () => {
  if (savedKey !== undefined) process.env.ANTHROPIC_API_KEY = savedKey;
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

describe("build auth failure (T086 / FR-085)", () => {
  it("halts with exit 3 and FR-085 diagnostic before Docker boots", async () => {
    await seedProject(tmpRoot);
    const { runBuild } = await import(
      "../../packages/scripts/src/orchestrator.js"
    );

    const captured: string[] = [];
    const origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      captured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      // @ts-expect-error forward to the real stream
      return origWrite(chunk, ...rest);
    }) as typeof process.stderr.write;
    let result: { exitCode: number } | null = null;
    try {
      result = await runBuild({
        projectRoot: tmpRoot,
        yes: true,
        noEnrich: false,
        concurrency: 10,
      });
    } finally {
      process.stderr.write = origWrite;
    }

    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(3);
    const joined = captured.join("");
    expect(joined).toMatch(/ANTHROPIC_API_KEY/);
    expect(joined).toMatch(/Anthropic API authentication failed/i);
  });
});
