import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  assertToolAllowed,
  executeAction,
  ToolNotAllowedError,
} from "../src/api-client-action.js";
import { renderActionTitle } from "../src/action-card.js";
import { __setLoadedCatalogForTest } from "../src/action-executors.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorsCatalog } from "@atw/scripts/dist/lib/action-executors-types.js";

function seedCatalog(): void {
  const catalog: ActionExecutorsCatalog = {
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
          summaryTemplate: "Add {quantity} × product-{product_id}",
          summaryFields: [],
        },
      },
    ],
  };
  __setLoadedCatalogForTest(catalog);
}

function cfg(allowed: string[], authMode: WidgetConfig["authMode"] = "cookie"): WidgetConfig {
  return {
    backendUrl: "http://backend.local",
    // Same-origin so the Feature 006 cross-origin guard inside
    // executeAction does not short-circuit before fetch is issued.
    apiBaseUrl: "",
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
    seedCatalog();
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

  it("Feature 007: never auto-attaches cookies — credentials='omit', no Authorization header without credentialSource", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "{}",
    } as unknown as Response);
    await executeAction(intent("add_to_cart"), cfg(["add_to_cart"], "cookie"));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("omit");
    const hdr = init.headers as Record<string, string>;
    expect(hdr["Authorization"]).toBeUndefined();
    expect(hdr["Cookie"]).toBeUndefined();
  });
});

describe("renderActionTitle (T022 / FR-022)", () => {
  it("substitutes every placeholder when all args resolve", () => {
    const i: ActionIntent = {
      id: "act-1",
      tool: "add_to_cart",
      arguments: { product_name: "Widget Pro", quantity: 3 },
      description: "fallback",
      summary_template: "Add {{ quantity }} × {{ product_name }} to your cart",
      confirmation_required: true,
      http: { method: "POST", path: "/cart/items" },
    };
    expect(renderActionTitle(i)).toBe("Add 3 × Widget Pro to your cart");
  });

  it("falls back to deterministic name+args when a placeholder is missing", () => {
    const i: ActionIntent = {
      id: "act-2",
      tool: "add_to_cart",
      arguments: { product_id: "p1" },
      description: "vague Opus narration that must not be used",
      summary_template: "Add {{ quantity }} × {{ product_name }} to your cart",
      confirmation_required: true,
      http: { method: "POST", path: "/cart/items" },
    };
    const out = renderActionTitle(i);
    expect(out).toContain("add_to_cart");
    expect(out).toContain("product_id");
    // Critically: no naked tool-name fallback and no Opus description.
    expect(out).not.toBe("add_to_cart");
    expect(out).not.toBe(i.description);
  });
});
