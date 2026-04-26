/**
 * T075 — Graceful-degradation unit tests for `executeIntentForLoop`.
 *
 * Feature 007 FR-019 / FR-020: every failure mode must collapse into a
 * well-formed `ToolResultPayload` the backend can forward verbatim to
 * Opus so the assistant composes a plain-language explanation rather
 * than hanging. The three paths covered here are:
 *
 *   1. AbortController timeout (8 000 ms) → synthetic timeout payload.
 *   2. Non-2xx response → real status, body truncated, `is_error: true`.
 *   3. Unresolved tool (not in catalog) → synthetic "tool not found".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeIntentForLoop } from "../src/chat-action-runner.js";
import {
  __setLoadedCatalogForTest,
} from "../src/action-executors.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorsCatalog } from "@atw/scripts/dist/lib/action-executors-types.js";

function cfg(): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "http://localhost:3000",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["list_my_orders", "add_to_cart"],
    actionExecutorsUrl: "http://localhost:3000/atw/action-executors.json",
  };
}

function readIntent(): ActionIntent {
  return {
    id: "act-1",
    tool: "list_my_orders",
    arguments: {},
    description: "List the shopper's orders.",
    confirmation_required: false,
    http: { method: "GET", path: "/orders" },
  };
}

const CATALOG: ActionExecutorsCatalog = {
  version: 1,
  credentialMode: "bearer-localstorage",
  actions: [
    {
      tool: "list_my_orders",
      method: "GET",
      pathTemplate: "/orders",
      substitution: { path: {}, body: {}, query: {} },
      headers: {},
      responseHandling: {
        successStatuses: [200],
        summaryTemplate: "Listed orders.",
        summaryFields: [],
      },
    },
  ],
};

describe("executeIntentForLoop — graceful degradation (T075 / FR-019, FR-020)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __setLoadedCatalogForTest(CATALOG);
    vi.useFakeTimers();
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    __setLoadedCatalogForTest(null);
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("timeout at 8000 ms → synthetic is_error payload with status 0", async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          (err as Error).name = "AbortError";
          reject(err);
        });
      });
    });
    const pending = executeIntentForLoop(readIntent(), cfg());
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await pending;
    if ("stop" in result) throw new Error("expected payload, got stop outcome");
    expect(result.ok).toBe(false);
    expect(result.payload.is_error).toBe(true);
    expect(result.payload.status).toBe(0);
    expect(result.payload.content).toMatch(/time.?d? out/i);
    expect(result.payload.tool_use_id).toBe("act-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("non-2xx response → is_error true, real status, body verbatim", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '{"error":"kaboom"}',
    } as unknown as Response);
    const result = await executeIntentForLoop(readIntent(), cfg());
    if ("stop" in result) throw new Error("expected payload, got stop outcome");
    expect(result.ok).toBe(false);
    expect(result.payload.is_error).toBe(true);
    expect(result.payload.status).toBe(500);
    expect(result.payload.content).toBe('{"error":"kaboom"}');
    expect(result.payload.truncated).toBe(false);
  });

  it("tool not in catalog → synthetic 'tool not found' payload, no fetch", async () => {
    const unknownIntent: ActionIntent = {
      ...readIntent(),
      tool: "nonexistent_tool",
    };
    // Must also extend the allowlist so the tool-allow guard doesn't fire
    // first and mask the catalog-miss branch.
    const widgetCfg = cfg();
    widgetCfg.allowedTools = [...widgetCfg.allowedTools, "nonexistent_tool"];
    const result = await executeIntentForLoop(unknownIntent, widgetCfg);
    // Tool-not-in-catalog still returns an ExecuteIntentResult (synthetic
    // is_error → backend forwards to Opus). The T053 allow-list path is
    // different: it renders a transcript row and stops. See
    // chat-action-runner.tool-not-allowed.test.ts.
    if ("stop" in result) throw new Error("expected payload, got stop outcome");
    expect(result.ok).toBe(false);
    expect(result.payload.is_error).toBe(true);
    expect(result.payload.status).toBe(0);
    expect(result.payload.content).toContain("not found in widget catalog");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
