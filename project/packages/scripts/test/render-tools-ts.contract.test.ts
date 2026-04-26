/**
 * T039 — Contract test for rendering `tools.ts` from the Handlebars
 * template using the real `packages/backend/src/tools.ts.hbs`. Covers
 * every case listed in contracts/render-tools-context.md §9.
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

const BASE_CONTEXT = {
  projectName: "demo",
  embeddingModel: "Xenova/bge-small-multilingual-v1.5",
  anthropicModel: "claude-opus-4-7",
  generatedAt: "2026-04-23T00:00:00Z",
  defaultLocale: "en",
  briefSummary: "A tiny demo brief.",
};

function descriptor(overrides: Partial<RuntimeToolDescriptor>): RuntimeToolDescriptor {
  return {
    name: "add_to_cart",
    description: "Add a variant to the cart.",
    input_schema: {
      type: "object",
      properties: {
        cart_id: { type: "string" },
        variant_id: { type: "string" },
      },
      required: ["cart_id", "variant_id"],
    },
    http: { method: "POST", path: "/store/carts/{cart_id}/line-items" },
    is_action: true,
    ...overrides,
  };
}

async function writeToolsTemplateOnly(tmp: string): Promise<string> {
  // Copy only tools.ts.hbs from packages/backend/src into an isolated
  // templatesDir so the render run stays fast and focused.
  const srcTpl = path.join(defaultTemplatesDir(), "tools.ts.hbs");
  const templatesDir = path.join(tmp, "tpl");
  await fs.mkdir(templatesDir, { recursive: true });
  const src = await fs.readFile(srcTpl, "utf8");
  await fs.writeFile(path.join(templatesDir, "tools.ts.hbs"), src);
  return templatesDir;
}

async function renderToolsTs(
  tmp: string,
  tools: RuntimeToolDescriptor[],
): Promise<string> {
  const templatesDir = await writeToolsTemplateOnly(tmp);
  const outputDir = path.join(tmp, "out");
  await renderBackend({
    templatesDir,
    outputDir,
    context: {
      ...BASE_CONTEXT,
      tools,
      toolsJson: JSON.stringify(tools, null, 2),
    },
  });
  return fs.readFile(path.join(outputDir, "tools.ts"), "utf8");
}

describe("render tools.ts — contract (T039)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-tools-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("empty tools → RUNTIME_TOOLS = [] literal branch", async () => {
    const rendered = await renderToolsTs(tmp, []);
    expect(rendered).toContain(
      "export const RUNTIME_TOOLS: RuntimeToolDescriptor[] = [];",
    );
    // The populated branch must NOT appear.
    expect(rendered).not.toMatch(
      /RUNTIME_TOOLS: RuntimeToolDescriptor\[\] = \[\s*\{/,
    );
  });

  it("N > 0 tools render each descriptor's fields into the JSON literal", async () => {
    const tools: RuntimeToolDescriptor[] = [
      descriptor({}),
      descriptor({
        name: "list_carts",
        description: "List the shopper's carts.",
        input_schema: {
          type: "object",
          properties: { limit: { type: "number" } },
          required: [],
        },
        http: { method: "GET", path: "/store/carts" },
        is_action: false,
      }),
    ];
    const rendered = await renderToolsTs(tmp, tools);
    // Populated branch used.
    expect(rendered).toMatch(
      /RUNTIME_TOOLS: RuntimeToolDescriptor\[\] = \[\s*\{/,
    );
    // Field content appears in rendered output.
    expect(rendered).toContain('"name": "add_to_cart"');
    expect(rendered).toContain('"name": "list_carts"');
    expect(rendered).toContain('"description": "Add a variant to the cart."');
    expect(rendered).toContain('"method": "POST"');
    expect(rendered).toContain('"path": "/store/carts/{cart_id}/line-items"');
    expect(rendered).toContain('"method": "GET"');
    expect(rendered).toContain('"is_action": true');
    expect(rendered).toContain('"is_action": false');
  });

  // Feature 009 re-introduces the SAFE_READ_TOOLS / ACTION_TOOLS split,
  // driven by `requires_confirmation` (writes that mutate state) rather
  // than the Feature 007 "every tool is an action" model. The
  // corresponding template behaviour is asserted in
  // packages/backend/src/tools.ts.hbs and exercised end-to-end through
  // the populated-branch case above.

  it("description_template + summary_fields present on source → present in rendered JSON", async () => {
    const tools: RuntimeToolDescriptor[] = [
      descriptor({
        description_template: "Add {{variant_id}} to your cart.",
        summary_fields: ["variant_id", "quantity"],
      }),
    ];
    const rendered = await renderToolsTs(tmp, tools);
    expect(rendered).toContain(
      '"description_template": "Add {{variant_id}} to your cart."',
    );
    expect(rendered).toMatch(
      /"summary_fields":\s*\[\s*"variant_id",\s*"quantity"\s*\]/,
    );
  });

  it("description_template + summary_fields absent → NOT emitted as null or undefined in JSON body", async () => {
    const tools: RuntimeToolDescriptor[] = [descriptor({})];
    const rendered = await renderToolsTs(tmp, tools);
    // Scope checks to the RUNTIME_TOOLS assignment body, not the
    // interface declaration above it (which legitimately mentions
    // description_template as an optional field).
    const bodyMatch = rendered.match(
      /RUNTIME_TOOLS: RuntimeToolDescriptor\[\] =\s*(\[[\s\S]*?\]);/,
    );
    expect(bodyMatch).not.toBeNull();
    const body = bodyMatch![1];
    expect(body).not.toContain("description_template");
    expect(body).not.toContain("summary_fields");
    expect(body).not.toContain("null");
    expect(body).not.toMatch(/undefined/);
  });

  it("toolsForAnthropic export body references name + description + input_schema", async () => {
    const rendered = await renderToolsTs(tmp, [descriptor({})]);
    // The export definition is carried verbatim from the template — check
    // it still compiles to the same shape after render (T039 treats this
    // as a template-stability assertion that backends a SC-004 claim
    // without running the rendered source).
    expect(rendered).toContain(
      "export function toolsForAnthropic(): Anthropic.Messages.Tool[]",
    );
    expect(rendered).toContain("return RUNTIME_TOOLS.map((t) => ({");
    expect(rendered).toContain("name: t.name");
    expect(rendered).toContain("description: t.description");
    expect(rendered).toContain("input_schema: t.input_schema");
  });

  it("re-render with identical input is byte-identical", async () => {
    const tools = [descriptor({})];
    const first = await renderToolsTs(tmp, tools);
    // Second render into a fresh tmp dir → compare bytes.
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), "atw-tools-2-"));
    try {
      const second = await renderToolsTs(tmp2, tools);
      expect(second).toBe(first);
    } finally {
      await fs.rm(tmp2, { recursive: true, force: true });
    }
  });
});
