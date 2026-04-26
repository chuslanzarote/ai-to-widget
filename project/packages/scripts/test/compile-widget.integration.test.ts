import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { gzipSync } from "node:zlib";
import { runCompileWidget } from "../src/compile-widget.js";

describe("compile-widget integration — fixture Builder (T008 / US1)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let tmp: string;

  beforeEach(async () => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-int-"));
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  // Acceptance scenarios 1, 2, 4 from spec.md US1:
  // 1. Bundle exists at <outDir>/widget.{js,css}.
  // 2. widget.js > 1 KB (not a stub).
  // 4. Re-running produces identical bundles (determinism).
  it("emits real bundles under <outDir> and is deterministic", async () => {
    const outDir = path.join(tmp, "dist");
    const code1 = await runCompileWidget(["--out-dir", outDir]);
    expect(code1).toBe(0);

    const jsPath = path.join(outDir, "widget.js");
    const cssPath = path.join(outDir, "widget.css");
    const js1 = await fs.readFile(jsPath);
    const css1 = await fs.readFile(cssPath);
    expect(js1.byteLength).toBeGreaterThan(1024);
    expect(gzipSync(js1).byteLength).toBeLessThanOrEqual(80 * 1024);
    expect(gzipSync(css1).byteLength).toBeLessThanOrEqual(10 * 1024);

    const code2 = await runCompileWidget(["--out-dir", outDir]);
    expect(code2).toBe(0);
    const js2 = await fs.readFile(jsPath);
    const css2 = await fs.readFile(cssPath);
    expect(js2.equals(js1)).toBe(true);
    expect(css2.equals(css1)).toBe(true);
  });
});
