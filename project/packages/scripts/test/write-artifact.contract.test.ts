import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runWriteArtifact } from "../src/write-artifact.js";

describe("write-artifact contract", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-write-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("writes content atomically to a new file", async () => {
    const target = path.join(tmp, "nested", "out.md");
    const exit = await runWriteArtifact(["--target", target], {
      stdinContent: "# Hello\n",
    });
    expect(exit).toBe(0);
    expect(await fs.readFile(target, "utf8")).toBe("# Hello\n");
  });

  it("creates a .bak sibling on overwrite", async () => {
    const target = path.join(tmp, "existing.md");
    await fs.writeFile(target, "# Original\n");
    const exit = await runWriteArtifact(["--target", target], {
      stdinContent: "# Updated\n",
    });
    expect(exit).toBe(0);
    expect(await fs.readFile(target, "utf8")).toBe("# Updated\n");
    expect(await fs.readFile(`${target}.bak`, "utf8")).toBe("# Original\n");
  });

  it("honors a custom backup suffix", async () => {
    const target = path.join(tmp, "doc.md");
    await fs.writeFile(target, "v1\n");
    const exit = await runWriteArtifact(
      ["--target", target, "--backup-suffix", ".prev"],
      { stdinContent: "v2\n" },
    );
    expect(exit).toBe(0);
    expect(await fs.readFile(`${target}.prev`, "utf8")).toBe("v1\n");
  });

  it("returns exit 3 for missing --target", async () => {
    const exit = await runWriteArtifact([], { stdinContent: "" });
    expect(exit).toBe(3);
  });

  it("performs Windows-safe rename-over-existing", async () => {
    const target = path.join(tmp, "win.md");
    await fs.writeFile(target, "first\n");
    const exit1 = await runWriteArtifact(["--target", target], { stdinContent: "second\n" });
    const exit2 = await runWriteArtifact(["--target", target], { stdinContent: "third\n" });
    expect(exit1).toBe(0);
    expect(exit2).toBe(0);
    expect(await fs.readFile(target, "utf8")).toBe("third\n");
  });
});
