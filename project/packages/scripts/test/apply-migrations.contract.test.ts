import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runApplyMigrations } from "../src/apply-migrations.js";

describe("atw-apply-migrations contract (T040)", () => {
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
    const code = await runApplyMigrations(["--help"]);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toContain("atw-apply-migrations");
  });

  it("exit 0 on --version", async () => {
    const code = await runApplyMigrations(["--version"]);
    expect(code).toBe(0);
  });

  it("exit 3 on invalid --port", async () => {
    const code = await runApplyMigrations(["--port", "abc"]);
    expect(code).toBe(3);
  });

  it("exit 3 on unknown flag", async () => {
    const code = await runApplyMigrations(["--not-a-flag"]);
    expect(code).toBe(3);
  });
});
