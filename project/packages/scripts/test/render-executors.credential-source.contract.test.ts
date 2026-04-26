/**
 * T039 — contract test for Feature 007's `credentialSource` emission.
 *
 * Pipeline under test: the builder walks an action-manifest and, for
 * each entry whose `source.security` array contains `"bearerAuth"`,
 * emits a `credentialSource` block on the rendered
 * `action-executors.json` entry pinned to `{type: "bearer-localstorage",
 * key: "shop_auth_token", header: "Authorization", scheme: "Bearer"}`.
 *
 * Public-read operations (no security entry) MUST NOT emit a
 * `credentialSource` block so the widget fetches them anonymously.
 *
 * Contract: specs/007-widget-tool-loop/contracts/action-catalog-v2.md #1.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { renderExecutors } from "../src/render-executors.js";
import type {
  ActionManifest,
  ActionManifestEntry,
} from "../src/lib/action-manifest-types.js";

const BASE_PROVENANCE = {
  openapiSha256: "sha256:" + "a".repeat(64),
  classifierModel: "claude-opus-4-7",
  classifiedAt: "2026-04-23T00:00:00Z",
};

function ordersEntry(): ActionManifestEntry {
  return {
    toolName: "list_my_orders",
    description: "List the signed-in shopper's orders.",
    parameters: { type: "object", properties: {}, required: [] },
    requiresConfirmation: false,
    isAction: false,
    source: {
      method: "GET",
      path: "/orders",
      operationId: "listMyOrders",
      security: ["bearerAuth"],
    },
  };
}

function productsEntry(): ActionManifestEntry {
  return {
    toolName: "list_products",
    description: "Browse the public catalogue.",
    parameters: {
      type: "object",
      properties: { q: { type: "string" } },
      required: [],
    },
    requiresConfirmation: false,
    isAction: false,
    source: {
      method: "GET",
      path: "/products",
      operationId: "listProducts",
    },
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
  tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "atw-render-executors-cred-"),
  );
  outPath = path.join(tmpDir, "action-executors.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("renderExecutors — credentialSource emission (Feature 007 T039)", () => {
  it("bearerAuth operation emits the pinned credentialSource block", async () => {
    const manifest = manifestWith([ordersEntry()]);
    await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const body = JSON.parse(await fs.readFile(outPath, "utf8")) as {
      actions: Array<{
        tool: string;
        credentialSource?: Record<string, string>;
      }>;
    };
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].tool).toBe("list_my_orders");
    expect(body.actions[0].credentialSource).toEqual({
      type: "bearer-localstorage",
      key: "shop_auth_token",
      header: "Authorization",
      scheme: "Bearer",
    });
  });

  it("unauthenticated operation omits credentialSource entirely", async () => {
    const manifest = manifestWith([productsEntry()]);
    await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const body = JSON.parse(await fs.readFile(outPath, "utf8")) as {
      actions: Array<{ tool: string; credentialSource?: unknown }>;
    };
    expect(body.actions).toHaveLength(1);
    expect(body.actions[0].tool).toBe("list_products");
    expect(body.actions[0].credentialSource).toBeUndefined();
  });

  it("mixed manifest emits credentialSource only on bearer entries", async () => {
    const manifest = manifestWith([ordersEntry(), productsEntry()]);
    await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const body = JSON.parse(await fs.readFile(outPath, "utf8")) as {
      actions: Array<{ tool: string; credentialSource?: unknown }>;
    };
    const byTool = new Map(body.actions.map((a) => [a.tool, a]));
    expect(byTool.get("list_my_orders")?.credentialSource).toBeDefined();
    expect(byTool.get("list_products")?.credentialSource).toBeUndefined();
  });
});
