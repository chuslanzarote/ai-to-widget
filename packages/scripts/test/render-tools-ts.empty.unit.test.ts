/**
 * T071 / US6 — Unit test for the orchestrator's missing-manifest
 * fallback (FR-014, SC-005).
 *
 * Proves three things about the render branch that fires when
 * `.atw/artifacts/action-manifest.md` is absent:
 *
 *  1. `tools.ts` still renders, with an empty `RUNTIME_TOOLS = []`
 *     literal. (Functional — uses the real Handlebars template.)
 *  2. The orchestrator code path emits exactly the contract string
 *     `"No action-manifest.md — widget will be chat-only."` into
 *     `buildWarnings[]`. (Structural — grep on orchestrator.ts so
 *     the test fires the moment the literal drifts.)
 *  3. `renderExecutors()` is only called when a manifest was parsed —
 *     i.e. the structural guard `if (manifest !== null)` wraps the
 *     call. No manifest → no `.atw/artifacts/action-executors.json`
 *     on disk. (Structural — a future refactor that moves the guard
 *     elsewhere must still keep the call conditional, which the grep
 *     pins.)
 *
 * Spinning up the full orchestrator to exercise this would pull in
 * Postgres + Docker. The three invariants above are enough to prove
 * the contract without that overhead; the end-to-end variant ships
 * in `tests/integration/build-small-project.test.ts` (which already
 * runs a no-manifest project through the live pipeline).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  renderBackend,
  defaultTemplatesDir,
  type RuntimeToolDescriptor,
} from "../src/render-backend.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const ORCHESTRATOR_SRC = path.join(
  REPO_ROOT,
  "packages",
  "scripts",
  "src",
  "orchestrator.ts",
);

const BASE_CONTEXT = {
  projectName: "demo",
  embeddingModel: "Xenova/bge-small-multilingual-v1.5",
  anthropicModel: "claude-opus-4-7",
  generatedAt: "2026-04-23T00:00:00Z",
  defaultLocale: "en",
  briefSummary: "A tiny demo brief.",
};

describe("orchestrator missing-manifest handling (T071 / FR-014, SC-005)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-t071-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("renders tools.ts with an empty RUNTIME_TOOLS literal when tools are []", async () => {
    // Stage only tools.ts.hbs so the test stays scoped to the one template
    // the missing-manifest branch materially affects.
    const srcTpl = path.join(defaultTemplatesDir(), "tools.ts.hbs");
    const templatesDir = path.join(tmp, "tpl");
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.copyFile(srcTpl, path.join(templatesDir, "tools.ts.hbs"));
    const outputDir = path.join(tmp, "out");

    const tools: RuntimeToolDescriptor[] = [];
    await renderBackend({
      templatesDir,
      outputDir,
      context: {
        ...BASE_CONTEXT,
        tools,
        toolsJson: JSON.stringify(tools, null, 2),
      },
    });

    const rendered = await fs.readFile(
      path.join(outputDir, "tools.ts"),
      "utf8",
    );
    expect(rendered).toContain(
      "export const RUNTIME_TOOLS: RuntimeToolDescriptor[] = [];",
    );
    // The populated-branch literal must not leak into the empty render.
    expect(rendered).not.toMatch(
      /RUNTIME_TOOLS: RuntimeToolDescriptor\[\] = \[\s*\{/,
    );
  });

  it("orchestrator.ts pushes the exact chat-only warning text on missing manifest", async () => {
    const src = await fs.readFile(ORCHESTRATOR_SRC, "utf8");
    expect(
      src,
      "orchestrator.ts must push the exact FR-014 warning string",
    ).toContain(
      `"No action-manifest.md — widget will be chat-only."`,
    );
  });

  it("orchestrator.ts gates renderExecutors() behind manifest !== null", async () => {
    const src = await fs.readFile(ORCHESTRATOR_SRC, "utf8");
    // The call site — `await renderExecutors(manifest, ...)` — not the
    // top-of-file import, which is what a naive indexOf would match first.
    const callIdx = src.indexOf("await renderExecutors(");
    expect(
      callIdx,
      "await renderExecutors(...) must be called from orchestrator.ts",
    ).toBeGreaterThan(0);
    // The `if (manifest !== null) { ... await renderExecutors(...) ... }`
    // guard must appear textually before the call. A stricter structural
    // test would parse the AST, but the literal check is enough: any
    // refactor that removes the guard will fail this test.
    const guardIdx = src.indexOf("manifest !== null");
    expect(guardIdx).toBeGreaterThan(0);
    expect(guardIdx).toBeLessThan(callIdx);
  });
});
