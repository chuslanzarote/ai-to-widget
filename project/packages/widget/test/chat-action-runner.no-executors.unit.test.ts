/** @jsxImportSource preact */
/**
 * Feature 008 / T054 / FR-023 — D-NOEXECUTORS rendering.
 *
 * When the widget is in chat-only mode (`actionCapable === false`) and
 * the backend returns an `action_intent`, the panel's `onSend` path
 * must render the D-NOEXECUTORS transcript row — not a silent
 * console.warn + generic assistant fallback. Contract:
 * specs/008-atw-hardening/contracts/builder-diagnostics.md.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent } from "@testing-library/preact";
import { h } from "preact";
import { ChatPanel } from "../src/panel.js";
import * as apiClient from "../src/api-client.js";
import {
  open,
  turns,
  sessionId,
  actionCapable,
  pendingAction,
} from "../src/state.js";
import type { WidgetConfig } from "../src/config.js";

function cfg(): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "http://shop.local",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
  };
}

describe("D-NOEXECUTORS (FR-023)", () => {
  let postChatSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    open.value = true;
    turns.value = [];
    sessionId.value = "t054-session";
    pendingAction.value = null;
    actionCapable.value = false;
  });

  afterEach(() => {
    open.value = false;
    turns.value = [];
    actionCapable.value = false;
    postChatSpy?.mockRestore();
  });

  it("renders the D-NOEXECUTORS transcript row verbatim when actionCapable=false and backend emits an action_intent", async () => {
    postChatSpy = vi.spyOn(apiClient, "postChat").mockResolvedValue({
      ok: true,
      response: {
        message: "",
        actions: [],
        citations: [],
        action_intent: {
          id: "intent-1",
          tool: "add_to_cart",
          arguments: { product_id: "p_1" },
          description: "Add product to cart.",
          confirmation_required: false,
          http: { method: "POST", path: "/cart" },
        },
        tool_call_budget_remaining: 4,
        pending_turn_id: "turn-abc",
      },
    } as Awaited<ReturnType<typeof apiClient.postChat>>);

    const { getByLabelText, container } = render(h(ChatPanel, { config: cfg() }));
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    textarea.value = "I want to buy something";
    const sendBtn = getByLabelText("Send message") as HTMLButtonElement;
    fireEvent.click(sendBtn);

    const expectedDiagnostic =
      'The widget\'s action catalog is missing or empty, so tool "add_to_cart" cannot run.\n' +
      "Ask the Builder to copy `.atw/artifacts/action-executors.json` into the host's\n" +
      "public assets (see /atw.embed output).";
    await vi.waitFor(() => {
      const match = turns.value.find(
        (t) => t.role === "assistant" && t.content === expectedDiagnostic,
      );
      expect(match).toBeDefined();
    });
    // Sanity: the generic backend message must NOT be what got rendered
    // for the action_intent turn. We look at the last assistant row.
    const assistantRows = turns.value.filter((t) => t.role === "assistant");
    expect(assistantRows[assistantRows.length - 1].content).toBe(expectedDiagnostic);
    expect(container).toBeTruthy();
  });
});
