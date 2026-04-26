import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { gzipSync } from "node:zlib";
import { runCompileWidget } from "../src/compile-widget.js";

describe("compile-widget for Aurelia demo (T013 / US2)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let tmp: string;

  beforeEach(async () => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-aurelia-"));
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("emits a real bundle satisfying budget + determinism", async () => {
    // The Aurelia demo has no widget/src of its own; resolution must go
    // through @atw/widget (installed transitively via @atw/scripts).
    // resolveWidgetSource() uses import.meta.url, not cwd — so cwd doesn't
    // matter for the module resolver. Tmp-dir outDir keeps the test hermetic.
    const outDir = path.join(tmp, "dist");

    const code1 = await runCompileWidget(["--out-dir", outDir]);
    expect(code1).toBe(0);

    const js = await fs.readFile(path.join(outDir, "widget.js"));
    const css = await fs.readFile(path.join(outDir, "widget.css"));

    expect(js.byteLength).toBeGreaterThan(1024);
    expect(css.toString("utf8")).toMatch(/\{[^}]+\}/);
    expect(gzipSync(js).byteLength).toBeLessThanOrEqual(80 * 1024);
    expect(gzipSync(css).byteLength).toBeLessThanOrEqual(10 * 1024);

    const code2 = await runCompileWidget(["--out-dir", outDir]);
    expect(code2).toBe(0);
    const js2 = await fs.readFile(path.join(outDir, "widget.js"));
    const css2 = await fs.readFile(path.join(outDir, "widget.css"));
    expect(js2.equals(js)).toBe(true);
    expect(css2.equals(css)).toBe(true);
  });
});
