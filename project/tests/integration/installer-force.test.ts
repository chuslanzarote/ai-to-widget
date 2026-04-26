import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli } from "../../packages/installer/src/index.js";

describe("installer: --force preserves Builder config", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-installer-force-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("overwrites structural files but keeps .atw/config and .atw/artifacts intact", async () => {
    const targetDir = path.join(tmp, "demo");
    await fs.mkdir(path.join(targetDir, ".atw", "config"), { recursive: true });
    await fs.mkdir(path.join(targetDir, ".atw", "artifacts"), { recursive: true });
    const projectMd = path.join(targetDir, ".atw", "config", "project.md");
    const schemaMd = path.join(targetDir, ".atw", "artifacts", "schema-map.md");
    await fs.writeFile(projectMd, "# BUILDER EDIT\n");
    await fs.writeFile(schemaMd, "# BUILDER SCHEMA\n");
    // stale structural file that must be overwritten:
    await fs.writeFile(path.join(targetDir, "README-atw.md"), "STALE");

    const code = await runCli({ argv: [targetDir, "--force"] });
    expect(code).toBe(0);

    const afterProject = await fs.readFile(projectMd, "utf8");
    const afterSchema = await fs.readFile(schemaMd, "utf8");
    expect(afterProject).toContain("BUILDER EDIT");
    expect(afterSchema).toContain("BUILDER SCHEMA");

    const readme = await fs.readFile(path.join(targetDir, "README-atw.md"), "utf8");
    expect(readme).not.toBe("STALE");
  });
});
