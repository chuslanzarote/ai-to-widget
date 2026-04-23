/**
 * T052 — 15 s AbortController test (FR-021, FR-015a).
 *
 * Covers contracts/widget-executor-engine.md §7.
 *
 *  - At 14 999 ms the fetch is NOT yet aborted.
 *  - At 15 000 ms the AbortController fires; executeAction resolves with
 *    a timeout failure (status: 0, timeout message).
 *  - ACTION_FETCH_TIMEOUT_MS is a fixed module constant, NOT read from
 *    config, NOT read from the catalog. (Spec: 15 s fixed in v1.)
 *  - No retry: exactly one fetch invocation under the timeout path.
 *    (FR-015a)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeAction } from "../src/api-client-action.js";
import {
  ACTION_FETCH_TIMEOUT_MS,
  __setLoadedCatalogForTest,
} from "../src/action-executors.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorsCatalog } from "@atw/scripts/dist/lib/action-executors-types.js";

// Same-origin on jsdom default (http://localhost:3000) so the runtime
// cross-origin guard doesn't short-circuit before the AbortController
// even arms. The guard itself is covered by the credentials-sovereignty
// integration test.
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
    description: "Add 1 × v1 to cart",
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

describe("executeAction timeout (T052 / FR-021)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    __setLoadedCatalogForTest(CATALOG);
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    __setLoadedCatalogForTest(null);
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("ACTION_FETCH_TIMEOUT_MS is exactly 15000 (fixed, not configurable)", () => {
    expect(ACTION_FETCH_TIMEOUT_MS).toBe(15000);
  });

  it("fetch hangs → at 14999 ms not yet aborted; at 15000 ms timeout fires", async () => {
    // fetch that honours the AbortSignal: stays pending until aborted.
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

    // 14 999 ms: not yet aborted.
    await vi.advanceTimersByTimeAsync(14_999);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    // Let microtasks flush so we can tell if it resolved.
    await Promise.resolve();
    expect(settled).toBe(false);

    // Advance 1 more ms → reach exactly 15 000 ms → abort fires.
    await vi.advanceTimersByTimeAsync(1);

    const out = await pending;
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.status).toBe(0);
      expect(out.message.toLowerCase()).toMatch(/time ?d? ?out|timed out/);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fetch resolves at 200 ms → timeout does NOT fire", async () => {
    fetchMock.mockImplementation((_url: string, _init: RequestInit) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            text: async () =>
              JSON.stringify({ cart: { total: 3980, items: 1 } }),
          } as unknown as Response);
        }, 200);
      });
    });

    const pending = executeAction(intent(), cfg());

    // 200 ms resolves the fetch; advance timers to let fetch + any
    // pending microtasks complete.
    await vi.advanceTimersByTimeAsync(200);
    const out = await pending;
    expect(out.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no retry after timeout: fetch mock count remains 1 even past 30 s", async () => {
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
    await pending;
    // Simulate wall-clock drift past 30 s; no retry scheduled.
    await vi.advanceTimersByTimeAsync(15_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
