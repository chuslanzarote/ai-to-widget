import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCompileWidget } from "../src/compile-widget.js";

describe("atw-compile-widget CLI (T007 / US1)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let tmp: string;
  let stderrBuf: string;

  beforeEach(async () => {
    stderrBuf = "";
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: unknown) => {
        stderrBuf += typeof chunk === "string" ? chunk : String(chunk);
        return true;
      });
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-widget-cli-"));
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("--widget-src-dir is no longer accepted (amended contract)", async () => {
    const code = await runCompileWidget([
      "--widget-src-dir",
      path.join(tmp, "widget", "src"),
      "--out-dir",
      path.join(tmp, "dist"),
    ]);
    expect(code).toBe(3);
  });

  it("successful run exits 0 and emits JSON with source origin", async () => {
    const outDir = path.join(tmp, "dist");
    let stdoutBuf = "";
    stdoutSpy.mockImplementation((chunk: unknown) => {
      stdoutBuf += typeof chunk === "string" ? chunk : String(chunk);
      return true;
    });
    const code = await runCompileWidget(["--out-dir", outDir, "--json"]);
    expect(code).toBe(0);
    const parsed = JSON.parse(stdoutBuf.trim());
    expect(parsed.source.package_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(parsed.source.tree_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(parsed.js.gzip_bytes).toBeGreaterThan(0);
  });
});
