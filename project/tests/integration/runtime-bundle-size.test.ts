/**
 * T108 — widget bundle-size budget integration test (SC-009 / FR-027).
 * Node-only; no Docker required. Uses esbuild programmatically to run a
 * full widget bundle compile in a temp dir, then asserts the gzipped
 * sizes fit under budget.
 *
 * Note: this test builds the actual `packages/widget/src/*` entry so it
 * acts as defence in depth for the in-flight budget check inside
 * compile-widget.ts (T107).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import os from "node:os";
import { compileWidget } from "../../packages/scripts/src/compile-widget.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-bundle-size-"));
});
afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("widget bundle size budget (T108 / SC-009)", () => {
  it("compiles the live widget entry and fits under 80 KB js + 10 KB css gzipped", async () => {
    const result = await compileWidget({
      outDir: tmp,
      minify: true,
    });
    const js = await fs.readFile(result.js.path);
    const css = await fs.readFile(result.css.path);
    const jsGz = gzipSync(js).byteLength;
    const cssGz = gzipSync(css).byteLength;
    expect(
      jsGz,
      `widget.js.gz = ${jsGz} bytes exceeds 80 KB SC-009 budget`,
    ).toBeLessThanOrEqual(80 * 1024);
    expect(
      cssGz,
      `widget.css.gz = ${cssGz} bytes exceeds 10 KB SC-009 budget`,
    ).toBeLessThanOrEqual(10 * 1024);
  }, 120_000);
});
