/**
 * T085 — integration test for the Docker-daemon-unreachable halt (FR-086).
 *
 * Rather than requiring a real Docker outage, we override the DOCKER_HOST
 * env var to an impossible socket before calling `runBuild`. That makes
 * `dockerode.ping()` fail inside `startPostgres`, producing a
 * `DOCKER_UNREACHABLE` error that the orchestrator surfaces as a one-line
 * diagnostic and exit code 3 per `contracts/slash-command.md` §5.
 *
 * No container is ever booted, so this test does not need ATW_E2E_DOCKER.
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
let savedDockerHost: string | undefined;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-dockerdown-"));
  savedDockerHost = process.env.DOCKER_HOST;
  // Point dockerode at a TCP socket that cannot be reached. This makes
  // `docker.ping()` in start-postgres.ts fail with DOCKER_UNREACHABLE.
  process.env.DOCKER_HOST = "tcp://127.0.0.1:1";
});

afterEach(async () => {
  if (savedDockerHost === undefined) delete process.env.DOCKER_HOST;
  else process.env.DOCKER_HOST = savedDockerHost;
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

describe("build docker unreachable (T085 / FR-086)", () => {
  it("halts with exit 3 and a Docker-unreachable diagnostic", async () => {
    await seedProject(tmpRoot);
    // Ensure the API-key probe passes so we actually reach the BOOT step
    // where Docker is contacted.
    const priorKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-test-not-a-real-key";

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
        // No opusClient stub — we want the real boot path to run.
      });
    } finally {
      process.stderr.write = origWrite;
      if (priorKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = priorKey;
    }

    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(3);
    const joined = captured.join("");
    expect(joined).toMatch(/Docker daemon is not reachable/i);
  }, 60_000);
});
