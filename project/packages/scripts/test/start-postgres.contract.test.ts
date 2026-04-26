import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runStartPostgres } from "../src/start-postgres.js";

describe("atw-start-postgres contract (T039)", () => {
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

  it("exit 0 on --help and prints usage", async () => {
    const code = await runStartPostgres(["--help"]);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toContain("atw-start-postgres");
    expect(out).toContain("--port");
  });

  it("exit 0 on --version", async () => {
    const code = await runStartPostgres(["--version"]);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toMatch(/atw-start-postgres \d+\.\d+\.\d+/);
  });

  it("exit 3 on invalid --port value", async () => {
    const code = await runStartPostgres(["--port", "not-a-number"]);
    expect(code).toBe(3);
    const err = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(err).toContain("--port");
  });

  it("exit 3 on out-of-range --port", async () => {
    const code = await runStartPostgres(["--port", "999999"]);
    expect(code).toBe(3);
  });

  it("exit 3 on unknown flag", async () => {
    const code = await runStartPostgres(["--definitely-not-a-flag"]);
    expect(code).toBe(3);
  });
});
