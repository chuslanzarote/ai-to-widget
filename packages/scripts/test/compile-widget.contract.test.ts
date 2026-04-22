import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { compileWidget, runCompileWidget } from "../src/compile-widget.js";

describe("atw-compile-widget contract (T047)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let tmp: string;

  beforeEach(async () => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-widget-"));
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("CLI exit 0 on --help", async () => {
    const code = await runCompileWidget(["--help"]);
    expect(code).toBe(0);
  });

  it("CLI exit 0 on --version", async () => {
    const code = await runCompileWidget(["--version"]);
    expect(code).toBe(0);
  });

  it("CLI exit 3 on unknown flag", async () => {
    const code = await runCompileWidget(["--bogus"]);
    expect(code).toBe(3);
  });

  it("library: emits no-op bundle when widget src is empty", async () => {
    const srcDir = path.join(tmp, "src");
    const outDir = path.join(tmp, "dist");
    await fs.mkdir(srcDir, { recursive: true });
    const result = await compileWidget({ widgetSrcDir: srcDir, outDir });
    expect(result.noop).toBe(true);
    expect(result.js.path).toContain("widget.js");
    expect(result.css.path).toContain("widget.css");
    expect(result.js.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.js.bytes).toBeGreaterThan(0);
  });

  it("library: no-op bundle is byte-deterministic across runs", async () => {
    const srcDir = path.join(tmp, "src");
    const outDir = path.join(tmp, "dist");
    await fs.mkdir(srcDir, { recursive: true });
    const first = await compileWidget({ widgetSrcDir: srcDir, outDir });
    const second = await compileWidget({ widgetSrcDir: srcDir, outDir });
    expect(second.js.sha256).toBe(first.js.sha256);
    expect(second.css.sha256).toBe(first.css.sha256);
  });
});
