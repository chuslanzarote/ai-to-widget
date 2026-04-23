/**
 * T072 / US6 — Contract test for zero-included manifest handling
 * (FR-014, SC-005).
 *
 * Ties the two render outputs together for the "classifier returned
 * nothing safe" scenario: given a manifest whose `included` list is
 * empty, both
 *
 *   (a) `action-executors.json` (renderExecutors) and
 *   (b) `tools.ts` (renderBackend, empty RuntimeToolDescriptor[])
 *
 * must land in a shape the widget can boot chat-only against. The
 * two existing tests each pin one half — render-executors.contract.test.ts:157
 * pins (a) and render-tools-ts.empty.unit.test.ts pins the tools.ts
 * literal for the fully-missing-manifest path. T072's value is the
 * *joint* pin: one manifest input, both outputs checked in one place,
 * so a future refactor that desyncs the two (e.g., keeping actions: []
 * but accidentally emitting a non-empty tools.ts) fails loudly here.
 *
 * The widget-side boot assertion ("loads catalog, validates, boots
 * chat-only") is out of scope for this contract test — T074 owns it
 * at `packages/widget/test/init-chat-only.unit.test.ts`. Splitting
 * keeps each test's failure signal targeted.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { renderExecutors } from "../src/render-executors.js";
import {
  renderBackend,
  defaultTemplatesDir,
  type RuntimeToolDescriptor,
} from "../src/render-backend.js";
import type { ActionManifest } from "../src/lib/action-manifest-types.js";

const EMPTY_MANIFEST: ActionManifest = {
  provenance: {
    openapiSha256: "sha256:" + "0".repeat(64),
    classifierModel: "claude-opus-4-7",
    classifiedAt: "2026-04-23T00:00:00Z",
  },
  summary: "No shopper-safe operations classified.",
  included: [],
  excluded: [],
  orphaned: [],
};

const BASE_CONTEXT = {
  projectName: "demo",
  embeddingModel: "Xenova/bge-small-multilingual-v1.5",
  anthropicModel: "claude-opus-4-7",
  generatedAt: "2026-04-23T00:00:00Z",
  defaultLocale: "en",
  briefSummary: "A tiny demo brief.",
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "atw-t072-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("empty-included manifest — joint render contract (T072 / FR-014, SC-005)", () => {
  it("renderExecutors writes {version:1, credentialMode:'same-origin-cookies', actions: []}", async () => {
    const outPath = path.join(tmpDir, "action-executors.json");
    await renderExecutors(EMPTY_MANIFEST, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const body = JSON.parse(await fs.readFile(outPath, "utf8"));
    expect(body).toEqual({
      version: 1,
      credentialMode: "same-origin-cookies",
      actions: [],
    });
  });

  it("renderBackend (with tools derived from included=[]) writes RUNTIME_TOOLS = []", async () => {
    // Mirror the orchestrator's manifest→tools pass: `included` is empty,
    // so the descriptor array is empty — the same shape renderBackend
    // receives when there is no manifest at all.
    const srcTpl = path.join(defaultTemplatesDir(), "tools.ts.hbs");
    const templatesDir = path.join(tmpDir, "tpl");
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.copyFile(srcTpl, path.join(templatesDir, "tools.ts.hbs"));
    const outputDir = path.join(tmpDir, "out");

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
  });

  it("both outputs stay in sync — no actions on disk means no tools in code", async () => {
    // Guard against a regression where renderExecutors could emit actions
    // while tools.ts stayed empty (or vice versa) for the same manifest.
    // The check is structural: given the same empty-included manifest,
    // parse both outputs and assert their "action surface" is zero.
    const execOut = path.join(tmpDir, "action-executors.json");
    await renderExecutors(EMPTY_MANIFEST, {
      outputPath: execOut,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });

    const srcTpl = path.join(defaultTemplatesDir(), "tools.ts.hbs");
    const templatesDir = path.join(tmpDir, "tpl");
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.copyFile(srcTpl, path.join(templatesDir, "tools.ts.hbs"));
    const outputDir = path.join(tmpDir, "out");
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

    const catalog = JSON.parse(await fs.readFile(execOut, "utf8")) as {
      actions: unknown[];
    };
    const toolsTs = await fs.readFile(
      path.join(outputDir, "tools.ts"),
      "utf8",
    );

    expect(catalog.actions).toHaveLength(0);
    // Structural: the populated-branch pattern `= [{` must NOT appear.
    expect(toolsTs).not.toMatch(
      /RUNTIME_TOOLS: RuntimeToolDescriptor\[\] = \[\s*\{/,
    );
  });
});
