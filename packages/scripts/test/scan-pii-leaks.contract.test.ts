import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runScanPiiLeaks,
  normalizeForMatch,
  findMatches,
} from "../src/scan-pii-leaks.js";

describe("atw-scan-pii-leaks contract (T050)", () => {
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

  it("CLI exit 0 on --help", async () => {
    const code = await runScanPiiLeaks(["--help"]);
    expect(code).toBe(0);
  });

  it("CLI exit 0 on --version", async () => {
    const code = await runScanPiiLeaks(["--version"]);
    expect(code).toBe(0);
  });

  it("CLI exit 3 when --schema-map missing", async () => {
    const code = await runScanPiiLeaks([]);
    expect(code).toBe(3);
    const err = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(err).toContain("--schema-map");
  });

  it("normalizeForMatch lowercases + collapses whitespace (Clarifications Q1 / FR-088)", () => {
    expect(normalizeForMatch("  Hello   World  ")).toBe("hello world");
    expect(normalizeForMatch("CASE\tInsensitive\nText")).toBe("case insensitive text");
  });

  it("findMatches finds case-insensitive substring with adjacent context snippet", () => {
    const original = "See the user at jane@example.com or later.";
    const normalized = normalizeForMatch(original);
    const hits = findMatches(normalized, original, [
      { column: "customer.email", value: "JANE@EXAMPLE.COM" },
    ]);
    expect(hits).toHaveLength(1);
    expect(hits[0].column).toBe("customer.email");
    expect(hits[0].snippet.toLowerCase()).toContain("jane@example.com");
  });

  it("findMatches ignores needles shorter than 3 chars", () => {
    const original = "a b c";
    const normalized = normalizeForMatch(original);
    const hits = findMatches(normalized, original, [
      { column: "c.x", value: "a" },
    ]);
    expect(hits).toHaveLength(0);
  });
});
