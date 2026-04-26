import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { compileWidget } from "../src/compile-widget.js";

const STUB_NEEDLE = "no-op bundle";
const STUB_PROSE = "Feature 003 populates later";

describe("compile-widget no-stub regression guard (T006 / US1)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-nostub-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("produces a real bundle > 1 KB", async () => {
    const outDir = path.join(tmp, "dist");
    const result = await compileWidget({ outDir });
    expect(result.js.bytes).toBeGreaterThan(1024);
  });

  it("emits the atw-widget banner", async () => {
    const outDir = path.join(tmp, "dist");
    const result = await compileWidget({ outDir });
    const js = await fs.readFile(result.js.path, "utf8");
    expect(js.startsWith("/* atw-widget */")).toBe(true);
  });

  it("never contains the Feature 003 stub string (FR-002)", async () => {
    const outDir = path.join(tmp, "dist");
    const result = await compileWidget({ outDir });
    const js = await fs.readFile(result.js.path, "utf8");
    expect(js.includes(STUB_NEEDLE)).toBe(false);
    expect(js.includes(STUB_PROSE)).toBe(false);
  });
});
