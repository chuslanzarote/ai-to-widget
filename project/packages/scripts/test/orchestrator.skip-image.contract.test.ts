/**
 * T020 / US2 — contract test for `--skip-image`.
 *
 * Contract (contracts/orchestrator-cli.md §IMAGE-step failure taxonomy):
 *   - The CLI exposes `--skip-image`. Running `/atw.build --help` must
 *     mention the flag.
 *   - `parseArgs(["--skip-image"])` sets `flags.skipImage = true`.
 *   - Other argv shapes do NOT set the flag.
 *
 * The full runtime assertion (runBuild → steps.image.action === "skipped")
 * lives in an integration test gated on Docker availability; the
 * precondition for this test is that the flag is wired end-to-end so
 * downstream callers can rely on it without Docker.
 */
import { describe, it, expect } from "vitest";
import { parseArgs, runBuild } from "../src/orchestrator.js";

describe("orchestrator --skip-image (T020 / US2)", () => {
  it("--help output advertises --skip-image", async () => {
    const captured: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      captured.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
      );
      return true;
    }) as typeof process.stdout.write;
    try {
      const res = await runBuild({ projectRoot: "/does-not-matter", help: true });
      expect(res.exitCode).toBe(0);
    } finally {
      process.stdout.write = origWrite;
    }
    const out = captured.join("");
    expect(out).toMatch(/--skip-image/);
    expect(out).toMatch(/Suppress the IMAGE step/i);
  });

  it("parseArgs sets skipImage=true when --skip-image is present", () => {
    const flags = parseArgs(["--skip-image"], "/proj");
    expect(flags.skipImage).toBe(true);
  });

  it("parseArgs leaves skipImage unset by default", () => {
    const flags = parseArgs([], "/proj");
    expect(flags.skipImage).toBeUndefined();
  });

  it("parseArgs combines --skip-image with other flags", () => {
    const flags = parseArgs(["--yes", "--skip-image", "--no-enrich"], "/proj");
    expect(flags.skipImage).toBe(true);
    expect(flags.yes).toBe(true);
    expect(flags.noEnrich).toBe(true);
  });
});
