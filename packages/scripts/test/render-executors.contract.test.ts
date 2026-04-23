/**
 * T047 — Contract test for `render-executors.ts`. Covers every case
 * listed in contracts/action-executors.schema.md §8.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  renderExecutors,
  InvalidSubstitutionError,
} from "../src/render-executors.js";
import type {
  ActionManifest,
  ActionManifestEntry,
} from "../src/lib/action-manifest-types.js";

const BASE_PROVENANCE = {
  openapiSha256: "sha256:" + "a".repeat(64),
  classifierModel: "claude-opus-4-7",
  classifiedAt: "2026-04-23T00:00:00Z",
};

function addToCartEntry(
  overrides: Partial<ActionManifestEntry> = {},
): ActionManifestEntry {
  return {
    toolName: "add_to_cart",
    description: "Add a variant to the cart.",
    parameters: {
      type: "object",
      properties: {
        cart_id: { type: "string" },
        variant_id: { type: "string" },
        quantity: { type: "number" },
      },
      required: ["cart_id", "variant_id"],
    },
    requiresConfirmation: true,
    isAction: true,
    source: {
      method: "POST",
      path: "/store/carts/{cart_id}/line-items",
      operationId: "addLineItem",
    },
    ...overrides,
  };
}

function listCartsEntry(
  overrides: Partial<ActionManifestEntry> = {},
): ActionManifestEntry {
  return {
    toolName: "list_carts",
    description: "List the shopper's carts.",
    parameters: {
      type: "object",
      properties: { limit: { type: "number" } },
      required: [],
    },
    requiresConfirmation: false,
    isAction: false,
    source: {
      method: "GET",
      path: "/store/carts",
      operationId: "listCarts",
    },
    ...overrides,
  };
}

function manifestWith(entries: ActionManifestEntry[]): ActionManifest {
  return {
    provenance: BASE_PROVENANCE,
    summary: "test",
    included: entries,
    excluded: [],
    orphaned: [],
  };
}

let tmpDir: string;
let outPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "atw-render-executors-"));
  outPath = path.join(tmpDir, "action-executors.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("renderExecutors — contract (T047)", () => {
  it("single action produces one catalog entry with mapped fields", async () => {
    const manifest = manifestWith([addToCartEntry()]);
    const result = await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    expect(result.action).toBe("created");
    expect(result.warnings).toEqual([]);
    const body = JSON.parse(await fs.readFile(outPath, "utf8")) as {
      version: number;
      credentialMode: string;
      actions: Array<{
        tool: string;
        method: string;
        pathTemplate: string;
        substitution: {
          path: Record<string, string>;
          body: Record<string, string>;
          query: Record<string, string>;
        };
        headers: Record<string, string>;
      }>;
    };
    expect(body.version).toBe(1);
    expect(body.credentialMode).toBe("same-origin-cookies");
    expect(body.actions).toHaveLength(1);
    const a = body.actions[0];
    expect(a.tool).toBe("add_to_cart");
    expect(a.method).toBe("POST");
    expect(a.pathTemplate).toBe("/store/carts/{cart_id}/line-items");
    expect(a.substitution.path).toEqual({ cart_id: "arguments.cart_id" });
    expect(a.substitution.body).toEqual({
      variant_id: "arguments.variant_id",
      quantity: "arguments.quantity",
    });
    expect(a.substitution.query).toEqual({});
    expect(a.headers).toEqual({ "content-type": "application/json" });
  });

  it("multiple actions sorted alphabetically by tool", async () => {
    const manifest = manifestWith([
      addToCartEntry({ toolName: "zeta_tool" }),
      addToCartEntry({ toolName: "alpha_tool" }),
      addToCartEntry({ toolName: "middle_tool" }),
    ]);
    await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const body = JSON.parse(await fs.readFile(outPath, "utf8")) as {
      actions: Array<{ tool: string }>;
    };
    expect(body.actions.map((a) => a.tool)).toEqual([
      "alpha_tool",
      "middle_tool",
      "zeta_tool",
    ]);
  });

  it("zero included → catalog has actions: [] with version + credentialMode intact", async () => {
    const manifest = manifestWith([]);
    await renderExecutors(manifest, {
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

  it("GET method preserves method and routes parameters to query", async () => {
    const manifest = manifestWith([listCartsEntry()]);
    await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const body = JSON.parse(await fs.readFile(outPath, "utf8")) as {
      actions: Array<{
        method: string;
        headers: Record<string, string>;
        substitution: {
          path: Record<string, string>;
          body: Record<string, string>;
          query: Record<string, string>;
        };
      }>;
    };
    const a = body.actions[0];
    expect(a.method).toBe("GET");
    expect(a.substitution.body).toEqual({});
    expect(a.substitution.query).toEqual({ limit: "arguments.limit" });
    expect(a.headers).toEqual({});
  });

  it("DELETE method preserved", async () => {
    const manifest = manifestWith([
      addToCartEntry({
        toolName: "delete_cart",
        description: "Delete a cart.",
        source: {
          method: "DELETE",
          path: "/store/carts/{cart_id}",
          operationId: "deleteCart",
        },
        parameters: {
          type: "object",
          properties: { cart_id: { type: "string" } },
          required: ["cart_id"],
        },
      }),
    ]);
    await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const body = JSON.parse(await fs.readFile(outPath, "utf8")) as {
      actions: Array<{ method: string; pathTemplate: string }>;
    };
    expect(body.actions[0].method).toBe("DELETE");
    expect(body.actions[0].pathTemplate).toBe("/store/carts/{cart_id}");
  });

  it("missing substitution variable throws InvalidSubstitutionError", async () => {
    const manifest = manifestWith([
      addToCartEntry({
        // Path declares {cart_id} but properties omits it.
        source: {
          method: "POST",
          path: "/store/carts/{cart_id}/line-items",
          operationId: "addLineItem",
        },
        parameters: {
          type: "object",
          properties: {
            variant_id: { type: "string" },
          },
          required: ["variant_id"],
        },
      }),
    ]);
    await expect(
      renderExecutors(manifest, {
        outputPath: outPath,
        hostOrigin: "https://shop.example.com",
        widgetOrigin: "https://shop.example.com",
      }),
    ).rejects.toBeInstanceOf(InvalidSubstitutionError);
  });

  it("cross-origin entry emits warning but catalog is still written", async () => {
    const manifest = manifestWith([addToCartEntry()]);
    const result = await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://api.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/cross-origin/);
    expect(result.warnings[0]).toContain("add_to_cart");
    // File still written.
    const body = JSON.parse(await fs.readFile(outPath, "utf8"));
    expect(body.actions).toHaveLength(1);
  });

  it("same-origin check on relative pathTemplate produces no cross-origin warning", async () => {
    const manifest = manifestWith([addToCartEntry()]);
    const result = await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    expect(result.warnings.filter((w) => w.startsWith("cross-origin"))).toEqual(
      [],
    );
  });

  it("determinism: re-run with identical manifest leaves file unchanged", async () => {
    const manifest = manifestWith([addToCartEntry()]);
    const first = await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    expect(first.action).toBe("created");
    const second = await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    expect(second.action).toBe("unchanged");
    expect(second.sha256).toBe(first.sha256);
  });

  it("JSON is 2-space indented and ends with a trailing newline", async () => {
    const manifest = manifestWith([addToCartEntry()]);
    await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const text = await fs.readFile(outPath, "utf8");
    expect(text.endsWith("\n")).toBe(true);
    // Nested indentation: "  \"version\": 1," (2-space indent under
    // the top-level object) and "    \"tool\": ..." inside an action
    // object.
    const lines = text.split("\n");
    expect(lines.some((l) => /^  "version":/.test(l))).toBe(true);
    expect(lines.some((l) => /^      "tool":/.test(l))).toBe(true);
  });

  it("alphabetical key ordering at every level", async () => {
    const manifest = manifestWith([addToCartEntry()]);
    await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const text = await fs.readFile(outPath, "utf8");
    // Top-level: actions < credentialMode < version.
    const aIdx = text.indexOf('"actions"');
    const cIdx = text.indexOf('"credentialMode"');
    const vIdx = text.indexOf('"version"');
    expect(aIdx).toBeGreaterThan(-1);
    expect(cIdx).toBeGreaterThan(aIdx);
    expect(vIdx).toBeGreaterThan(cIdx);
    // Action-level: headers < method < pathTemplate < responseHandling <
    // substitution < tool (alphabetical).
    const hIdx = text.indexOf('"headers"');
    const mIdx = text.indexOf('"method"');
    const pIdx = text.indexOf('"pathTemplate"');
    const rIdx = text.indexOf('"responseHandling"');
    const sIdx = text.indexOf('"substitution"');
    const tIdx = text.indexOf('"tool"');
    expect(hIdx < mIdx).toBe(true);
    expect(mIdx < pIdx).toBe(true);
    expect(pIdx < rIdx).toBe(true);
    expect(rIdx < sIdx).toBe(true);
    expect(sIdx < tIdx).toBe(true);
  });
});
