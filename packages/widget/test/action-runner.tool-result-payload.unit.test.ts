/**
 * T031 / Feature 008 (v3) — widget tool_result payload contract.
 *
 * The widget MUST populate `tool_result.tool_name` and
 * `tool_result.tool_input` on every post to `/v1/chat`. `tool_input`
 * MUST reflect the arguments actually executed against the host
 * (including any shopper edits a confirmation card may have applied
 * before the final `continueLoopFromToolResult` call) — not the
 * original Opus proposal.
 *
 * Contract: specs/008-atw-hardening/contracts/chat-endpoint-v3.md
 *   §ToolResultPayloadSchema + §Request-time invariants.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  executeIntentForLoop,
  isStopOutcome,
} from "../src/chat-action-runner.js";
import { __setLoadedCatalogForTest } from "../src/action-executors.js";
import { turns } from "../src/state.js";
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
    allowedTools: ["addCartItem"],
    actionExecutorsUrl: "http://localhost:3000/atw/action-executors.json",
  };
}

const CATALOG: ActionExecutorsCatalog = {
  version: 1,
  credentialMode: "bearer-localstorage",
  actions: [
    {
      tool: "addCartItem",
      method: "POST",
      pathTemplate: "/cart/items",
      substitution: {
        path: {},
        body: { product_id: "arguments.product_id", quantity: "arguments.quantity" },
        query: {},
      },
      headers: {},
      responseHandling: {
        successStatuses: [200, 201],
        summaryTemplate: "Added.",
        summaryFields: [],
      },
    },
  ],
};

describe("executeIntentForLoop — ToolResultPayload carries tool_name + tool_input (T031)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __setLoadedCatalogForTest(CATALOG);
    turns.value = [];
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    __setLoadedCatalogForTest(null);
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  function intent(args: Record<string, unknown>): ActionIntent {
    return {
      id: "toolu_abc",
      tool: "addCartItem",
      arguments: args,
      description: "Add an espresso to the cart.",
      confirmation_required: true,
      http: { method: "POST", path: "/cart/items" },
    };
  }

  it("happy path — tool_name and tool_input match the executed arguments verbatim", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => '{"cart":{"items":[{"id":"li_1"}]}}',
    } as unknown as Response);

    const executedArgs = { product_id: "prod_espresso", quantity: 2 };
    const res = await executeIntentForLoop(intent(executedArgs), cfg());

    if (isStopOutcome(res)) throw new Error("expected payload, got stop outcome");
    expect(res.ok).toBe(true);
    expect(res.payload.tool_use_id).toBe("toolu_abc");
    expect(res.payload.tool_name).toBe("addCartItem");
    expect(res.payload.tool_input).toEqual(executedArgs);
    expect(res.payload.is_error).toBe(false);
    expect(res.payload.status).toBe(201);
  });

  it("shopper-edited arguments (post-confirmation) propagate through tool_input", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => "{}",
    } as unknown as Response);

    // The shopper opened the confirmation card and changed quantity
    // 1 → 3 before confirming; the edited intent is what reaches the
    // runner, and tool_input must reflect that.
    const edited = { product_id: "prod_espresso", quantity: 3 };
    const res = await executeIntentForLoop(intent(edited), cfg());

    if (isStopOutcome(res)) throw new Error("expected payload, got stop outcome");
    expect(res.payload.tool_input).toEqual(edited);
    expect((res.payload.tool_input as { quantity: number }).quantity).toBe(3);
  });

  it("timeout path — synthetic payload still carries tool_name + tool_input", async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            (err as Error).name = "AbortError";
            reject(err);
          });
        });
      });
      const args = { product_id: "prod_espresso", quantity: 1 };
      const pending = executeIntentForLoop(intent(args), cfg());
      await vi.advanceTimersByTimeAsync(8_000);
      const res = await pending;
      if (isStopOutcome(res)) throw new Error("expected payload, got stop outcome");
      expect(res.payload.is_error).toBe(true);
      expect(res.payload.tool_name).toBe("addCartItem");
      expect(res.payload.tool_input).toEqual(args);
    } finally {
      vi.useRealTimers();
    }
  });

  it("non-2xx response — payload carries tool_name + tool_input alongside the real status", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":"unauthenticated"}',
    } as unknown as Response);
    const args = { product_id: "prod_x", quantity: 1 };
    const res = await executeIntentForLoop(intent(args), cfg());
    if (isStopOutcome(res)) throw new Error("expected payload, got stop outcome");
    expect(res.payload.is_error).toBe(true);
    expect(res.payload.status).toBe(401);
    expect(res.payload.tool_name).toBe("addCartItem");
    expect(res.payload.tool_input).toEqual(args);
  });

  it("catalog miss — synthetic payload carries tool_name + tool_input for the requested tool", async () => {
    const missing: ActionIntent = {
      id: "toolu_zzz",
      tool: "listMyOrders",
      arguments: { limit: 5 },
      description: "List.",
      confirmation_required: false,
      http: { method: "GET", path: "/orders" },
    };
    const widgetCfg = cfg();
    widgetCfg.allowedTools = [...widgetCfg.allowedTools, "listMyOrders"];
    const res = await executeIntentForLoop(missing, widgetCfg);
    if (isStopOutcome(res)) throw new Error("expected payload, got stop outcome");
    expect(res.ok).toBe(false);
    expect(res.payload.tool_use_id).toBe("toolu_zzz");
    expect(res.payload.tool_name).toBe("listMyOrders");
    expect(res.payload.tool_input).toEqual({ limit: 5 });
    expect(res.payload.content).toContain("not found in widget catalog");
  });

  it("tool-not-allowed — stops the loop without pushing a synthetic tool_result (Feature 008 / FR-022)", async () => {
    // Feature 008 replaced the synthetic-is_error path on blocked tools
    // with an in-transcript D-TOOLNOTALLOWED row. The blocked path no
    // longer carries a ToolResultPayload; the full rendering contract
    // is covered by chat-action-runner.tool-not-allowed.unit.test.ts.
    const bad: ActionIntent = {
      ...intent({ product_id: "p1", quantity: 1 }),
      tool: "wipeDatabase",
    };
    const res = await executeIntentForLoop(bad, cfg());
    expect(isStopOutcome(res)).toBe(true);
  });
});
