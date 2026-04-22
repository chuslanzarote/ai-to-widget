import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validateArtifacts } from "../../packages/scripts/src/validate-artifacts.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-quickstart-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("quickstart smoke (T104 / SC-001, SC-002)", () => {
  it("`create-atw` scaffolds a fresh project under 60 seconds (SC-001)", async () => {
    const installerBin = path.resolve(repoRoot, "packages", "installer", "bin", "create-atw.js");
    const start = Date.now();
    const result = spawnSync(process.execPath, [installerBin, tmpRoot], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    const elapsedMs = Date.now() - start;

    expect(result.status, result.stderr).toBe(0);
    expect(elapsedMs).toBeLessThan(60_000);

    const expectedPaths = [
      ".atw/config",
      ".atw/artifacts",
      ".atw/state",
      ".claude/commands/atw.init.md",
      ".claude/commands/atw.brief.md",
      ".claude/commands/atw.schema.md",
      ".claude/commands/atw.api.md",
      ".claude/commands/atw.plan.md",
      "docker-compose.yml",
      "README-atw.md",
    ];
    for (const rel of expectedPaths) {
      const full = path.join(tmpRoot, rel);
      const stat = await fs.stat(full).catch(() => null);
      expect(stat, `scaffold missing ${rel}`).not.toBeNull();
    }
  });

  it("the pre-built examples/aurelia-completed/ passes validate-artifacts clean (SC-003)", async () => {
    const completed = path.resolve(repoRoot, "examples", "aurelia-completed");
    const report = await validateArtifacts({ root: completed });
    expect(report.ok, JSON.stringify(report, null, 2)).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.inconsistencies).toEqual([]);
  });
});
