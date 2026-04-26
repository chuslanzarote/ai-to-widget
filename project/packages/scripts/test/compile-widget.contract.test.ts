import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { compileWidget, runCompileWidget } from "../src/compile-widget.js";

describe("atw-compile-widget contract (Feature 004)", () => {
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

  it("library: compiles real @atw/widget source (no stub path)", async () => {
    const outDir = path.join(tmp, "dist");
    const result = await compileWidget({ outDir });
    expect(result.js.bytes).toBeGreaterThan(1024);
    expect(result.js.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.js.gzip_bytes).toBeGreaterThan(0);
    expect(result.source.package_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(result.source.tree_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("library: bundle is byte-deterministic across runs", async () => {
    const outDir = path.join(tmp, "dist");
    const first = await compileWidget({ outDir });
    const second = await compileWidget({ outDir });
    expect(second.js.sha256).toBe(first.js.sha256);
    expect(second.css.sha256).toBe(first.css.sha256);
    expect(second.source.tree_hash).toBe(first.source.tree_hash);
  });
});
