import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runEmbedText } from "../src/embed-text.js";

describe("atw-embed-text contract (T043)", () => {
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
    const code = await runEmbedText(["--help"]);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toContain("--text");
  });

  it("exit 0 on --version", async () => {
    const code = await runEmbedText(["--version"]);
    expect(code).toBe(0);
  });

  it("exit 3 when --text missing", async () => {
    const code = await runEmbedText([]);
    expect(code).toBe(3);
    const err = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(err).toContain("--text");
  });

  it("exit 3 on unknown flag", async () => {
    const code = await runEmbedText(["--bogus"]);
    expect(code).toBe(3);
  });
});
