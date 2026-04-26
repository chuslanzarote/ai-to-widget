import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runUpsertDocument } from "../src/upsert-document.js";

describe("atw-upsert-document contract (T045)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("exit 0 on --help", async () => {
    const code = await runUpsertDocument(["--help"]);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toContain("--row");
  });

  it("exit 0 on --version", async () => {
    const code = await runUpsertDocument(["--version"]);
    expect(code).toBe(0);
  });

  it("exit 3 on unknown flag", async () => {
    const code = await runUpsertDocument(["--bogus"]);
    expect(code).toBe(3);
  });
});
