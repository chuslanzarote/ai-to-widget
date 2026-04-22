import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli } from "../../packages/installer/src/index.js";

describe("installer: conflict detection", () => {
  let tmp: string;
  let stderrLines: string[];
  let origWrite: typeof process.stderr.write;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-installer-conflict-"));
    stderrLines = [];
    origWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrLines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(async () => {
    process.stderr.write = origWrite;
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("exits 2 and lists conflicts when .atw already exists", async () => {
    const targetDir = path.join(tmp, "demo");
    await fs.mkdir(path.join(targetDir, ".atw", "config"), { recursive: true });
    await fs.writeFile(path.join(targetDir, ".atw", "config", "project.md"), "# prior\n");

    const code = await runCli({ argv: [targetDir] });
    expect(code).toBe(2);
    const joined = stderrLines.join("");
    expect(joined).toMatch(/Refusing to overwrite/);
    expect(joined).toContain(".atw");
  });
});
