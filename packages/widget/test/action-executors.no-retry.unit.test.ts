/**
 * T053 — No-retry invariant (FR-015a).
 *
 * Covers contracts/widget-executor-engine.md §8.
 *
 * Under every failure mode — 5xx, 4xx, network reset, timeout — the
 * widget MUST issue exactly ONE fetch per executeAction call. The
 * shopper's recourse is to send a new chat message (which yields a
 * new ActionIntent), NOT a retry of the original request.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeAction } from "../src/api-client-action.js";
import { __setLoadedCatalogForTest } from "../src/action-executors.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorsCatalog } from "@atw/scripts/dist/lib/action-executors-types.js";

// jsdom defaults window.location to http://localhost:3000; the runtime
// cross-origin guard (api-client-action.ts) fires when apiBaseUrl doesn't
// match, so tests that are not about the guard itself MUST stay
// same-origin. Cross-origin behaviour is pinned by the integration test
// at tests/integration/credentials-sovereignty.integration.test.ts.
function cfg(): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "http://localhost:3000",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
    actionExecutorsUrl: "http://localhost:3000/atw/action-executors.json",
  };
}

function intent(): ActionIntent {
  return {
    id: "act-1",
    tool: "add_to_cart",
    arguments: { cart_id: "c1", variant_id: "v1", quantity: 1 },
    description: "Add 1 × v1",
    confirmation_required: true,
    http: { method: "POST", path: "/store/carts/c1/line-items" },
    summary: { product: "v1", quantity: "1" },
  };
}

const CATALOG: ActionExecutorsCatalog = {
  version: 1,
  credentialMode: "same-origin-cookies",
  actions: [
    {
      tool: "add_to_cart",
      method: "POST",
      pathTemplate: "/store/carts/{cart_id}/line-items",
      substitution: {
        path: { cart_id: "arguments.cart_id" },
        body: {
          variant_id: "arguments.variant_id",
          quantity: "arguments.quantity",
        },
        query: {},
      },
      headers: { "content-type": "application/json" },
      responseHandling: {
        successStatuses: [200, 201, 204],
        summaryTemplate: "Added {quantity} × {variant_id}.",
        summaryFields: [],
      },
    },
  ],
};

describe("executeAction — no retry (T053 / FR-015a)", () => {
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

  for (const status of [500, 502, 503, 504] as const) {
    it(`HTTP ${status} → exactly one fetch call, outcome ok: false`, async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status,
        text: async () => JSON.stringify({ message: "server error" }),
      } as unknown as Response);

      const out = await executeAction(intent(), cfg());

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(out.ok).toBe(false);
      if (!out.ok) expect(out.status).toBe(status);
    });
  }

  it("HTTP 400 → exactly one fetch call, outcome ok: false", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: "bad request" }),
    } as unknown as Response);

    const out = await executeAction(intent(), cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
  });

  it("network reset (fetch rejects TypeError) → exactly one fetch call", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const out = await executeAction(intent(), cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(0);
      expect(out.message.toLowerCase()).toMatch(/host|reach|try again/);
    }
  });

  it("DNS-like error (generic Error) → exactly one fetch call", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const out = await executeAction(intent(), cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
  });

  it("timeout (AbortError) → exactly one fetch call, status: 0", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          (err as Error).name = "AbortError";
          reject(err);
        });
      });
    });

    const pending = executeAction(intent(), cfg());
    await vi.advanceTimersByTimeAsync(15_000);
    const out = await pending;
    vi.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(0);
  });

  it("after any failure, no subsequent fetches fire (no retry loop)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "{}",
    } as unknown as Response);

    await executeAction(intent(), cfg());

    // Give any hypothetical retry a window to fire — zero real timers
    // are advancing here, but if the impl scheduled a Promise.then that
    // re-issues fetch, microtasks would flush it.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
