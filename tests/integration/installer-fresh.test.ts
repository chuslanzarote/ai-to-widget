import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli } from "../../packages/installer/src/index.js";

describe("installer: fresh scaffold", () => {
  let tmp: string;
  let prevCwd: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-installer-fresh-"));
    prevCwd = process.cwd();
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("creates the full .atw tree plus command files in < 60s", async () => {
    const targetDir = path.join(tmp, "demo");
    const start = Date.now();
    const code = await runCli({ argv: [targetDir] });
    const elapsedMs = Date.now() - start;
    expect(code).toBe(0);
    expect(elapsedMs).toBeLessThan(60_000);

    const expected = [
      ".atw/config",
      ".atw/artifacts",
      ".atw/inputs",
      ".atw/state",
      ".atw/templates",
      ".claude/commands/atw.init.md",
      ".claude/commands/atw.brief.md",
      ".claude/commands/atw.schema.md",
      ".claude/commands/atw.api.md",
      ".claude/commands/atw.plan.md",
      "docker-compose.yml",
      "README-atw.md",
      "package.json",
      ".gitignore",
    ];

    for (const rel of expected) {
      const full = path.join(targetDir, rel);
      const stat = await fs.stat(full).catch(() => null);
      expect(stat, `expected ${rel} to exist`).not.toBeNull();
    }

    const gitignore = await fs.readFile(path.join(targetDir, ".gitignore"), "utf8");
    expect(gitignore).toContain(".atw/inputs/");
  });
});
