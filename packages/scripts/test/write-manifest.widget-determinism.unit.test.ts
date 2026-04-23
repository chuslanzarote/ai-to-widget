import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { compileWidget } from "../src/compile-widget.js";
import { buildWidgetManifestSection } from "../src/write-manifest.js";

describe("widget manifest section determinism (T017 / US3)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-manif-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("two compiles against the same source yield deep-equal manifest sections", async () => {
    const out1 = path.join(tmp, "one");
    const out2 = path.join(tmp, "two");
    const r1 = await compileWidget({ outDir: out1 });
    const r2 = await compileWidget({ outDir: out2 });
    const s1 = buildWidgetManifestSection(r1, r1.source);
    const s2 = buildWidgetManifestSection(r2, r2.source);
    // paths differ (different outDirs) — normalize out to compare the rest.
    const strip = (s: ReturnType<typeof buildWidgetManifestSection>) => ({
      ...s,
      js: { ...s.js, path: path.basename(s.js.path) },
      css: { ...s.css, path: path.basename(s.css.path) },
    });
    expect(strip(s2)).toEqual(strip(s1));
  });
});
