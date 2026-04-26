import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli } from "../../packages/installer/src/index.js";

describe("installer: .gitignore management", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-installer-gitignore-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("creates .gitignore when absent", async () => {
    const targetDir = path.join(tmp, "case-create");
    const code = await runCli({ argv: [targetDir] });
    expect(code).toBe(0);
    const contents = await fs.readFile(path.join(targetDir, ".gitignore"), "utf8");
    expect(contents).toMatch(/\.atw\/inputs\//);
  });

  it("appends the atw block when .gitignore exists without it", async () => {
    const targetDir = path.join(tmp, "case-append");
    await fs.mkdir(targetDir, { recursive: true });
    const prior = "node_modules/\ndist/\n";
    await fs.writeFile(path.join(targetDir, ".gitignore"), prior);

    const code = await runCli({ argv: [targetDir] });
    expect(code).toBe(0);
    const contents = await fs.readFile(path.join(targetDir, ".gitignore"), "utf8");
    expect(contents.startsWith(prior)).toBe(true);
    expect(contents).toMatch(/\.atw\/inputs\//);
  });

  it("is a no-op when .gitignore already contains the rule", async () => {
    const targetDir = path.join(tmp, "case-noop");
    await fs.mkdir(targetDir, { recursive: true });
    const prior = "node_modules/\n.atw/inputs/\n";
    await fs.writeFile(path.join(targetDir, ".gitignore"), prior);

    const code = await runCli({ argv: [targetDir] });
    expect(code).toBe(0);
    const contents = await fs.readFile(path.join(targetDir, ".gitignore"), "utf8");
    expect(contents).toBe(prior);
  });
});
