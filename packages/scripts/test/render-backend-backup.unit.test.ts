/**
 * T097 / US8 — unit test for `--backup` behavior in render-backend.
 *
 * Contract (FR-074):
 *   1. Hand-edited target file + unchanged template → preserved (action
 *      "unchanged", no `.bak` written).
 *   2. Hand-edited target file + changed template + `--backup` set →
 *      `<path>.bak` written with the pre-existing content, then the
 *      target is overwritten with the rendered output (action
 *      "rewritten").
 *   3. Hand-edited target file + changed template + `--backup` NOT set →
 *      target overwritten, NO `.bak` written (action "rewritten").
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { renderBackend } from "../src/render-backend.js";

describe("render-backend --backup (T097 / US8)", () => {
  let tmp: string;
  const baseContext = {
    projectName: "demo",
    embeddingModel: "Xenova/bge-small-multilingual-v1.5",
    anthropicModel: "claude-opus-4-7",
    generatedAt: "2026-04-22T00:00:00Z",
  };

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-render-backup-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("preserves a hand-edited target when the template output is unchanged", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, "x.ts.hbs"),
      "// {{projectName}}\n",
    );

    const first = await renderBackend({
      templatesDir,
      outputDir,
      context: baseContext,
      backup: true,
    });
    expect(first[0].action).toBe("created");

    // No edit, re-render → unchanged. No `.bak` should appear.
    const second = await renderBackend({
      templatesDir,
      outputDir,
      context: baseContext,
      backup: true,
    });
    expect(second[0].action).toBe("unchanged");
    expect(second[0].backup).toBeUndefined();
    await expect(fs.access(path.join(outputDir, "x.ts.bak"))).rejects.toThrow();
  });

  it("writes a .bak sibling then overwrites when template changes AND --backup is set", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(templatesDir, { recursive: true });

    // Initial template
    const tplPath = path.join(templatesDir, "x.ts.hbs");
    await fs.writeFile(tplPath, "// {{projectName}} v1\n");
    const first = await renderBackend({
      templatesDir,
      outputDir,
      context: baseContext,
      backup: true,
    });
    expect(first[0].action).toBe("created");

    // Simulate a hand edit of the rendered target (what the Builder might do).
    const targetPath = path.join(outputDir, "x.ts");
    const handEdited = "// demo v1\n// builder hand edit\n";
    await fs.writeFile(targetPath, handEdited);

    // Now bump the template so the rendered output differs from the hand edit.
    await fs.writeFile(tplPath, "// {{projectName}} v2\n");
    const second = await renderBackend({
      templatesDir,
      outputDir,
      context: baseContext,
      backup: true,
    });

    expect(second[0].action).toBe("rewritten");
    expect(second[0].backup).toBeDefined();

    const bakPath = path.join(outputDir, "x.ts.bak");
    const bak = await fs.readFile(bakPath, "utf8");
    expect(bak).toBe(handEdited);

    const current = await fs.readFile(targetPath, "utf8");
    expect(current).toBe("// demo v2\n");
  });

  it("does NOT write a .bak when --backup is unset even if content differs", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(templatesDir, { recursive: true });

    const tplPath = path.join(templatesDir, "x.ts.hbs");
    await fs.writeFile(tplPath, "// {{projectName}} v1\n");
    await renderBackend({
      templatesDir,
      outputDir,
      context: baseContext,
      backup: false,
    });

    const targetPath = path.join(outputDir, "x.ts");
    await fs.writeFile(targetPath, "// hand edit\n");

    await fs.writeFile(tplPath, "// {{projectName}} v2\n");
    const second = await renderBackend({
      templatesDir,
      outputDir,
      context: baseContext,
      backup: false,
    });

    expect(second[0].action).toBe("rewritten");
    expect(second[0].backup).toBeUndefined();
    await expect(fs.access(path.join(outputDir, "x.ts.bak"))).rejects.toThrow();
  });
});
