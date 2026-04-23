/**
 * T080 — Cross-platform determinism smoke (Principle VIII, FR-063, SC-016).
 *
 * Runs the Feature 006 input → artefact pipeline end-to-end with a
 * mocked Opus client and asserts that the four reproducibility-critical
 * outputs are byte-identical when produced twice in separate tmpdirs:
 *
 *   - `.atw/artifacts/openapi.json`           (runAtwApi)
 *   - `.atw/artifacts/action-manifest.md`     (classifyActions → renderActionManifest)
 *   - `.atw/artifacts/action-executors.json`  (renderExecutors)
 *   - `backend/src/tools.ts`                  (renderBackend with tools.ts.hbs)
 *
 * This is the **structural smoke**. The full cross-OS check lives in the
 * CI matrix: the same vitest invocation runs on a Linux row and a
 * Windows row, each logs the four sha256 values via `console.info` with
 * a `[T080-FPRINT]` prefix, and CI's matrix-compare step fails the build
 * if the lines diverge. Same-process determinism (the loop below) is the
 * floor; CI dual-OS comparison builds on top of it.
 *
 * Why this is not Docker-gated:
 *   - No Postgres needed (no embeddings, no documents).
 *   - No Anthropic API calls (Opus is a fixed stub).
 *   - Runs in a few seconds on bare Node; belongs in the default CI lane.
 *
 * Fixture choice: `packages/scripts/test/fixtures/openapi/tiny.json` —
 * the minimal one-shopper-action fixture already used by Feature 006
 * contract tests. Keeps the hash surface small and the expected Stage 1
 * candidate set to a single operation (`postWidgetDemo`).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { runAtwApi } from "../../packages/scripts/src/atw-api.js";
import { parseOpenAPI } from "../../packages/scripts/src/parse-openapi.js";
import { classifyActions } from "../../packages/scripts/src/classify-actions.js";
import { renderActionManifest } from "../../packages/scripts/src/render-action-manifest.js";
import { renderExecutors } from "../../packages/scripts/src/render-executors.js";
import {
  renderBackend,
  defaultTemplatesDir,
  type RuntimeToolDescriptor,
} from "../../packages/scripts/src/render-backend.js";
import {
  actionEntryToDescriptor,
  canonicaliseInputSchema,
} from "../../packages/scripts/src/parse-action-manifest.js";
import type { OpusClient } from "../../packages/scripts/src/enrich-entity.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const FIXTURE = path.resolve(
  repoRoot,
  "packages",
  "scripts",
  "test",
  "fixtures",
  "openapi",
  "tiny.json",
);

const OPENAPI_REL = ".atw/artifacts/openapi.json";
const MANIFEST_REL = ".atw/artifacts/action-manifest.md";
const EXECUTORS_REL = ".atw/artifacts/action-executors.json";

/** Fixed Opus response that keeps the sole tiny.json shopper-safe op. */
function stubOpus(): OpusClient {
  return {
    async createMessage() {
      return {
        contentText: JSON.stringify(["postWidgetDemo"]),
        usage: { input_tokens: 100, output_tokens: 10 },
      };
    },
  };
}

interface Fingerprint {
  openapi: string;
  manifest: string;
  executors: string;
  toolsTs: string;
}

async function sha256OfFile(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return createHash("sha256").update(buf).digest("hex");
}

function sha256OfString(s: string): string {
  return createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
}

/** One end-to-end pass: runs the four stages against a fresh tmpdir. */
async function runPipelineOnce(tmp: string): Promise<Fingerprint> {
  await fs.mkdir(path.join(tmp, ".atw", "artifacts"), { recursive: true });
  await fs.mkdir(path.join(tmp, ".atw", "state"), { recursive: true });

  // Stage 1: /atw.api — canonicalise and pin openapi.json.
  await runAtwApi({ source: FIXTURE, projectRoot: tmp });
  const openapiAbs = path.join(tmp, OPENAPI_REL);
  const openapiSha = await sha256OfFile(openapiAbs);

  // Stage 2: classify (stubbed Opus) → render action-manifest.md.
  const openapiText = await fs.readFile(openapiAbs, "utf8");
  const { parsed, raw: rawDoc } = await parseOpenAPI({
    source: FIXTURE,
    body: openapiText,
  });
  const { manifest } = await classifyActions({
    parsed,
    rawDoc,
    openapiSha256: "sha256:" + openapiSha,
    modelSnapshot: "claude-opus-4-7",
    opusClient: stubOpus(),
    classifiedAt: "2026-04-23T00:00:00Z",
  });
  const manifestMarkdown = renderActionManifest(manifest);
  await fs.writeFile(path.join(tmp, MANIFEST_REL), manifestMarkdown, "utf8");
  const manifestSha = sha256OfString(manifestMarkdown);

  // Stage 3: render action-executors.json.
  const executorsAbs = path.join(tmp, EXECUTORS_REL);
  const executorsRes = await renderExecutors(manifest, {
    outputPath: executorsAbs,
    hostOrigin: "https://shop.example.com",
    widgetOrigin: "https://shop.example.com",
  });

  // Stage 4: render tools.ts — just the one template, under an isolated
  // tpl dir so we don't pull the full backend tree (which needs its
  // _shared vendor pass). Determinism of the remaining templates is
  // covered by render-backend.determinism.integration.test.ts.
  const tplDir = path.join(tmp, "tpl");
  const outDir = path.join(tmp, "backend", "src");
  await fs.mkdir(tplDir, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });
  const toolsTplSrc = await fs.readFile(
    path.join(defaultTemplatesDir(), "tools.ts.hbs"),
    "utf8",
  );
  await fs.writeFile(path.join(tplDir, "tools.ts.hbs"), toolsTplSrc);

  const tools: RuntimeToolDescriptor[] = manifest.included.map((entry) => {
    const d = actionEntryToDescriptor(entry) as RuntimeToolDescriptor;
    d.input_schema = canonicaliseInputSchema(
      d.input_schema as Record<string, unknown>,
    );
    return d;
  });

  await renderBackend({
    templatesDir: tplDir,
    outputDir: outDir,
    context: {
      projectName: "t080-demo",
      embeddingModel: "Xenova/bge-small-multilingual-v1.5",
      anthropicModel: "claude-opus-4-7",
      generatedAt: "2026-04-23T00:00:00Z",
      defaultLocale: "en",
      briefSummary: "T080 cross-platform determinism fixture.",
      tools,
      toolsJson: JSON.stringify(tools, null, 2),
    },
  });
  const toolsTsSha = await sha256OfFile(path.join(outDir, "tools.ts"));

  return {
    openapi: openapiSha,
    manifest: manifestSha,
    executors: executorsRes.sha256,
    toolsTs: toolsTsSha,
  };
}

describe("cross-platform determinism smoke (T080)", () => {
  let tmpA: string;
  let tmpB: string;

  beforeEach(async () => {
    tmpA = await fs.mkdtemp(path.join(os.tmpdir(), "atw-xplat-a-"));
    tmpB = await fs.mkdtemp(path.join(os.tmpdir(), "atw-xplat-b-"));
  });

  afterEach(async () => {
    await fs.rm(tmpA, { recursive: true, force: true });
    await fs.rm(tmpB, { recursive: true, force: true });
  });

  it("two passes in separate tmpdirs produce byte-identical artefacts", async () => {
    const a = await runPipelineOnce(tmpA);
    const b = await runPipelineOnce(tmpB);

    // Same-process determinism floor.
    expect(b.openapi).toBe(a.openapi);
    expect(b.manifest).toBe(a.manifest);
    expect(b.executors).toBe(a.executors);
    expect(b.toolsTs).toBe(a.toolsTs);

    // Emit fingerprint for CI matrix comparison across Linux/Windows
    // rows. CI scrapes `[T080-FPRINT]` prefixed lines from each row's
    // test log and fails if they diverge.
    const fprint = JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      openapi: a.openapi,
      manifest: a.manifest,
      executors: a.executors,
      toolsTs: a.toolsTs,
    });
    // eslint-disable-next-line no-console
    console.info(`[T080-FPRINT] ${fprint}`);
  });

  it("artefact bytes do not carry platform-specific line endings", async () => {
    // CRLF would wreck cross-platform sha256 equality. Pin that none of
    // the four outputs carry \r bytes. `renderExecutors` normalises JSON
    // output; `renderActionManifest` and `runAtwApi` emit LF strings;
    // `renderBackend` strips \r during write. If any of those regresses
    // on Windows this assertion catches it before fingerprint drift
    // silently ships downstream.
    await runPipelineOnce(tmpA);
    for (const rel of [
      OPENAPI_REL,
      MANIFEST_REL,
      EXECUTORS_REL,
    ]) {
      const buf = await fs.readFile(path.join(tmpA, rel));
      expect(buf.includes(0x0d), `${rel} contains CR byte`).toBe(false);
    }
    const toolsBuf = await fs.readFile(
      path.join(tmpA, "backend", "src", "tools.ts"),
    );
    expect(toolsBuf.includes(0x0d), "tools.ts contains CR byte").toBe(false);
  });
});
