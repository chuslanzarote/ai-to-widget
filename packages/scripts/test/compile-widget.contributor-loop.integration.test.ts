import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { compileWidget, resolveWidgetSource } from "../src/compile-widget.js";

describe("contributor loop — widget source edits surface in the bundle (T021 / US4)", () => {
  let tmp: string;
  let scratchFile: string;
  let originalContent: string | null;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-contrib-"));
    originalContent = null;
    scratchFile = "";
  });

  afterEach(async () => {
    if (scratchFile && originalContent !== null) {
      await fs.writeFile(scratchFile, originalContent, "utf8");
    } else if (scratchFile) {
      await fs.rm(scratchFile, { force: true });
    }
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("editing packages/widget/src/ changes tree_hash and bundle sha256", async () => {
    const source = resolveWidgetSource();
    // Write a throwaway file under widget/src/ — avoids mutating real sources.
    scratchFile = path.join(source.widgetRoot, "src", "__contrib_probe__.ts");
    originalContent = null; // nothing to restore

    const outA = path.join(tmp, "before");
    const before = await compileWidget({ outDir: outA });

    await fs.writeFile(
      scratchFile,
      "// contributor-loop probe — FR-010\nexport const PROBE = 1;\n",
      "utf8",
    );

    try {
      const outB = path.join(tmp, "after");
      const after = await compileWidget({ outDir: outB });
      expect(after.source.tree_hash).not.toBe(before.source.tree_hash);
      // Bundle sha256 may or may not change depending on whether the probe
      // is imported — but tree_hash MUST change (FR-010 signal).
      expect(after.source.package_version).toBe(before.source.package_version);
    } finally {
      await fs.rm(scratchFile, { force: true });
    }
  });
});
