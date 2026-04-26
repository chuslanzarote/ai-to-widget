/**
 * Feature 008 / T053 / FR-022 — D-TOOLNOTALLOWED rendering.
 *
 * Guards the behavior contract specified in
 * specs/008-atw-hardening/contracts/builder-diagnostics.md:
 *
 *   1. When the backend emits a `tool_use` whose tool is not in
 *      `config.allowedTools`, the widget renders the D-TOOLNOTALLOWED
 *      transcript row with the exact diagnostic text.
 *   2. NO synthetic `is_error` tool-result is pushed back into
 *      Anthropic's message sequence — `executeIntentForLoop` returns a
 *      `{stop: true}` outcome, not an `ExecuteIntentResult`.
 *   3. `pending_turn_id` and the loop budget are cleared so the next
 *      shopper turn starts from a clean slate.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  executeIntentForLoop,
  isStopOutcome,
} from "../src/chat-action-runner.js";
import { __setLoadedCatalogForTest } from "../src/action-executors.js";
import {
  pendingLoopBudget,
  pendingLoopTurnId,
  progressPlaceholder,
  turns,
} from "../src/state.js";
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
    allowedTools: ["list_my_orders"],
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

const DISALLOWED_INTENT: ActionIntent = {
  id: "act-zz",
  tool: "delete_everything",
  arguments: {},
  description: "Delete everything.",
  confirmation_required: false,
  http: { method: "DELETE", path: "/everything" },
};

describe("D-TOOLNOTALLOWED (FR-022)", () => {
  beforeEach(() => {
    __setLoadedCatalogForTest(CATALOG);
    turns.value = [];
    pendingLoopBudget.value = 5;
    pendingLoopTurnId.value = "pending-turn-123";
    progressPlaceholder.value = "Obteniendo datos…";
  });

  it("returns a stop outcome (no synthetic payload is posted to the backend)", async () => {
    const outcome = await executeIntentForLoop(DISALLOWED_INTENT, cfg());
    expect(isStopOutcome(outcome)).toBe(true);
  });

  it("renders the D-TOOLNOTALLOWED transcript row verbatim", async () => {
    await executeIntentForLoop(DISALLOWED_INTENT, cfg());
    expect(turns.value).toHaveLength(1);
    const row = turns.value[0];
    expect(row.role).toBe("assistant");
    expect(row.content).toBe(
      'This conversation tried to use tool "delete_everything" which is not in the widget\'s\n' +
        "allow-list. Ask the Builder to include this tool in /atw.embed's data-allowed-tools.",
    );
  });

  it("clears pending_turn_id, loop budget, and progress placeholder", async () => {
    await executeIntentForLoop(DISALLOWED_INTENT, cfg());
    expect(pendingLoopTurnId.value).toBeNull();
    expect(pendingLoopBudget.value).toBe(0);
    expect(progressPlaceholder.value).toBeNull();
  });
});
