import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  assertToolAllowed,
  executeAction,
  ToolNotAllowedError,
} from "../src/api-client-action.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";

function cfg(allowed: string[], authMode: WidgetConfig["authMode"] = "cookie"): WidgetConfig {
  return {
    backendUrl: "http://backend.local",
    apiBaseUrl: "http://host.local",
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
    (globalThis as unknown as { window?: unknown }).window = {
      localStorage: {
        _m: new Map<string, string>(),
        getItem(k: string) {
          return (this as unknown as { _m: Map<string, string> })._m.get(k) ?? null;
        },
        setItem(k: string, v: string) {
          (this as unknown as { _m: Map<string, string> })._m.set(k, v);
        },
        removeItem() {},
        clear() {},
        key() {
          return null;
        },
        length: 0,
      } as unknown as Storage,
    } as unknown as Window;
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
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
    if (out.ok) expect(out.summary).toMatch(/Add 2 × product-1/);
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
