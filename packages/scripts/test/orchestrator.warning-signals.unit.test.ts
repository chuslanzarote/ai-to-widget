/**
 * T084 — Structural test for the three build-manifest warning signals
 * (FR-014, FR-016, FR-019).
 *
 * The orchestrator collects warnings from two sources:
 *   1. Its own policy checks (`buildWarnings.push(...)`) — the
 *      missing-manifest path and the >20-action "large catalog" signal.
 *   2. `renderExecutors()`'s per-entry warnings — cross-origin
 *      executor detection (FR-016).
 *
 * All three surface in `build-manifest.json` both at the top-level
 * `warnings[]` and under `steps.render.action_executors.warnings[]`.
 * This test pins the exact literals so a future refactor that renames
 * a warning or drops one breaks loudly and points at the drift.
 *
 * Why structural (grep on orchestrator.ts + render-executors.ts)
 * rather than wiring up a full orchestrator run: the actual
 * end-to-end invocations are Docker-gated (Postgres) and would take
 * 30+ seconds. The signals themselves are string literals in source;
 * a grep is sufficient to prove the pushes exist. The behavioural
 * assertions (that these warnings actually propagate to the file on
 * disk) are covered by existing contract tests for render-executors
 * and T071 for the missing-manifest path.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";

const ORCHESTRATOR_SRC = path.resolve(
  __dirname,
  "..",
  "src",
  "orchestrator.ts",
);
const RENDER_EXECUTORS_SRC = path.resolve(
  __dirname,
  "..",
  "src",
  "render-executors.ts",
);

describe("build-manifest warning signals (T084)", () => {
  it("FR-014 — missing manifest pushes the chat-only warning", async () => {
    const src = await fs.readFile(ORCHESTRATOR_SRC, "utf8");
    expect(src).toContain(
      `"No action-manifest.md — widget will be chat-only."`,
    );
  });

  it("FR-014 — empty included list pushes the zero-actions warning", async () => {
    const src = await fs.readFile(ORCHESTRATOR_SRC, "utf8");
    expect(src).toContain(
      `"action-executors catalog has zero actions — widget will be chat-only"`,
    );
    // Gated on `manifest.included.length === 0`, not on `manifest !== null`,
    // so an empty manifest (present file, zero includes) still fires.
    expect(src).toMatch(/manifest\.included\.length\s*===\s*0/);
  });

  it("FR-019 — >20 actions pushes the large-catalog warning", async () => {
    const src = await fs.readFile(ORCHESTRATOR_SRC, "utf8");
    expect(src).toMatch(
      /large catalog \(\$\{manifest\.included\.length\} actions\): consider curating action-manifest\.md/,
    );
    // Threshold is strictly > 20 (21+ fires; exactly 20 does not).
    expect(src).toMatch(/manifest\.included\.length\s*>\s*20/);
  });

  it("FR-016 — cross-origin detection emits a distinct warning from render-executors", async () => {
    const src = await fs.readFile(RENDER_EXECUTORS_SRC, "utf8");
    expect(src).toMatch(
      /cross-origin action "\$\{entry\.toolName\}": host \$\{resolved\.origin\} !== widget \$\{opts\.widgetOrigin\}/,
    );
  });

  it("orchestrator surfaces render-executors warnings into buildWarnings", async () => {
    const src = await fs.readFile(ORCHESTRATOR_SRC, "utf8");
    // Every warning executorResult returns must land in both the
    // build-manifest top-level `warnings[]` and the step-level
    // `action_executors.warnings[]` — so the Builder sees a single
    // rollup and can also trace which step emitted it.
    expect(src).toMatch(
      /for\s*\(\s*const\s+w\s+of\s+executorResult\.warnings\s*\)\s*\{\s*\n[^}]*buildWarnings\.push\(w\);/,
    );
    expect(src).toMatch(/warnings:\s*executorResult\.warnings,/);
  });

  it("build-manifest writes a top-level warnings[] when any were collected", async () => {
    const src = await fs.readFile(ORCHESTRATOR_SRC, "utf8");
    // Two call sites for the manifest literal (success + failure paths);
    // both must gate the warnings field on non-empty to avoid noise on a
    // clean run.
    const occurrences = src.match(
      /buildWarnings\.length\s*>\s*0\s*\?\s*\{\s*warnings:\s*buildWarnings\s*\}\s*:\s*\{\}/g,
    );
    expect(occurrences, "warnings[] serialisation guarded on both paths")
      .not.toBeNull();
    expect(occurrences!.length).toBeGreaterThanOrEqual(2);
  });
});
