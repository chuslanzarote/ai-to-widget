/**
 * T040 — Determinism integration test for `tools.ts`.
 *
 * Same manifest + same shared-lib snapshot rendered twice → byte-
 * identical output. Hashes asserted to be stable.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

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

const FIXED_TOOLS: RuntimeToolDescriptor[] = [
  {
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
  },
  {
    name: "list_regions",
    description: "List regions.",
    input_schema: { type: "object", properties: {}, required: [] },
    http: { method: "GET", path: "/store/regions" },
    is_action: false,
  },
];

async function copyToolsTemplate(tmp: string): Promise<string> {
  const srcTpl = path.join(defaultTemplatesDir(), "tools.ts.hbs");
  const templatesDir = path.join(tmp, "tpl");
  await fs.mkdir(templatesDir, { recursive: true });
  const src = await fs.readFile(srcTpl, "utf8");
  await fs.writeFile(path.join(templatesDir, "tools.ts.hbs"), src);
  return templatesDir;
}

async function renderOnce(
  tmp: string,
): Promise<{ bytes: Buffer; sha256: string }> {
  const templatesDir = await copyToolsTemplate(tmp);
  const outputDir = path.join(tmp, "out");
  await renderBackend({
    templatesDir,
    outputDir,
    context: {
      ...BASE_CONTEXT,
      tools: FIXED_TOOLS,
      toolsJson: JSON.stringify(FIXED_TOOLS, null, 2),
    },
  });
  const bytes = await fs.readFile(path.join(outputDir, "tools.ts"));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return { bytes, sha256 };
}

describe("render tools.ts — determinism (T040)", () => {
  let tmpA: string;
  let tmpB: string;

  beforeEach(async () => {
    tmpA = await fs.mkdtemp(path.join(os.tmpdir(), "atw-tools-det-a-"));
    tmpB = await fs.mkdtemp(path.join(os.tmpdir(), "atw-tools-det-b-"));
  });

  afterEach(async () => {
    await fs.rm(tmpA, { recursive: true, force: true });
    await fs.rm(tmpB, { recursive: true, force: true });
  });

  it("two renders with identical inputs in separate dirs → byte-identical + sha256 matches", async () => {
    const a = await renderOnce(tmpA);
    const b = await renderOnce(tmpB);
    expect(a.bytes.equals(b.bytes)).toBe(true);
    expect(a.sha256).toBe(b.sha256);
  });

  it("re-render in the same outputDir leaves bytes unchanged (idempotent)", async () => {
    const first = await renderOnce(tmpA);
    // Re-render into the same tmpA/out — renderBackend should detect
    // `unchanged` and not touch the file content.
    const templatesDir = path.join(tmpA, "tpl");
    const outputDir = path.join(tmpA, "out");
    const results = await renderBackend({
      templatesDir,
      outputDir,
      context: {
        ...BASE_CONTEXT,
        tools: FIXED_TOOLS,
        toolsJson: JSON.stringify(FIXED_TOOLS, null, 2),
      },
    });
    const toolsResult = results.find((r) => r.path.endsWith("tools.ts"));
    expect(toolsResult?.action).toBe("unchanged");
    const after = await fs.readFile(path.join(outputDir, "tools.ts"));
    expect(after.equals(first.bytes)).toBe(true);
  });
});
