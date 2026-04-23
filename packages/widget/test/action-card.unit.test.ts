import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  assertToolAllowed,
  executeAction,
  ToolNotAllowedError,
} from "../src/api-client-action.js";
import { __setLoadedCatalogForTest } from "../src/action-executors.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorsCatalog } from "@atw/scripts/dist/lib/action-executors-types.js";

// Same-origin on jsdom default so the runtime cross-origin guard does
// not short-circuit these structural tests.
function cfg(allowed: string[], authMode: WidgetConfig["authMode"] = "cookie"): WidgetConfig {
  return {
    backendUrl: "http://backend.local",
    apiBaseUrl: "http://localhost:3000",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode,
    locale: "en-US",
    allowedTools: allowed,
  };
}

function intent(tool: string): ActionIntent {
  return {
    id: "act-1",
    tool,
    arguments: { product_id: "p1", quantity: 2 },
    description: "Add 2 × product-1 to cart",
    confirmation_required: true,
    http: { method: "POST", path: "store/carts/c1/line-items" },
    summary: { product: "product-1", quantity: "2" },
  };
}

// Minimal catalog entry for add_to_cart — the Feature 006 executor
// engine replaces the old intent.http path with a declarative recipe.
const CATALOG: ActionExecutorsCatalog = {
  version: 1,
  credentialMode: "same-origin-cookies",
  actions: [
    {
      tool: "add_to_cart",
      method: "POST",
      pathTemplate: "/store/carts/c1/line-items",
      substitution: {
        path: {},
        body: {
          product_id: "arguments.product_id",
          quantity: "arguments.quantity",
        },
        query: {},
      },
      headers: { "content-type": "application/json" },
      responseHandling: {
        successStatuses: [200, 201, 204],
        summaryTemplate: "Add {quantity} × product-{product_id}.",
        summaryFields: [],
      },
    },
  ],
};

describe("assertToolAllowed (T053 / FR-021)", () => {
  it("allows tools present in the allowlist", () => {
    expect(() => assertToolAllowed("add_to_cart", cfg(["add_to_cart"]))).not.toThrow();
  });
  it("refuses tools absent from the allowlist with ATW_TOOL_NOT_ALLOWED", () => {
    try {
      assertToolAllowed("nuke_the_store", cfg(["add_to_cart"]));
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ToolNotAllowedError);
      expect((err as ToolNotAllowedError).code).toBe("ATW_TOOL_NOT_ALLOWED");
    }
  });
});

describe("executeAction (T053 / Principle I+IV structural)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __setLoadedCatalogForTest(CATALOG);
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    __setLoadedCatalogForTest(null);
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("issues exactly one fetch on the happy path", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ cart: { total: 3980, items: 2 } }),
    } as unknown as Response);
    const out = await executeAction(intent("add_to_cart"), cfg(["add_to_cart"]));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.summary).toMatch(/Add 2 × product-p1/);
  });

  it("refuses unknown tool names and issues zero fetches", async () => {
    await expect(
      executeAction(intent("nuke_the_store"), cfg(["add_to_cart"])),
    ).rejects.toMatchObject({ code: "ATW_TOOL_NOT_ALLOWED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces 401 as 'please log in first'", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: "unauthenticated" }),
    } as unknown as Response);
    const out = await executeAction(intent("add_to_cart"), cfg(["add_to_cart"]));
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(401);
      expect(out.message.toLowerCase()).toContain("log in");
    }
  });

  it("cookie-mode attaches credentials=include but no Authorization header", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    } as unknown as Response);
    await executeAction(intent("add_to_cart"), cfg(["add_to_cart"], "cookie"));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("include");
    const hdr = init.headers as Record<string, string>;
    expect(hdr["Authorization"]).toBeUndefined();
    expect(hdr["Cookie"]).toBeUndefined();
  });
});
