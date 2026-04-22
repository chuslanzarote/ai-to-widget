/**
 * T089 / US7 — Anonymous fallback integration (SC-004).
 *
 * Gated by ATW_E2E_DOCKER=1. An unauthenticated shopper asks a
 * personalised question ("what did I order last time?") — the action
 * runs client-side (widget + shopper creds = none), the host API
 * returns 401, and the widget surfaces a friendly "please log in first"
 * reply with a login link built from `data-login-url`.
 *
 * This harness exercises the backend side: it verifies the `list_my_orders`
 * action emits as an action intent (confirmation required), which is the
 * hand-off point to the widget. The widget-side surface is covered by
 * `packages/widget/test/action-card.unit.test.ts`.
 */
import { describe, it, expect } from "vitest";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

describe.skipIf(!DOCKER_AVAILABLE)("anonymous fallback (T089 / SC-004)", () => {
  it("emits list_my_orders as an action intent for the widget to handle", async () => {
    const backendUrl = process.env.ATW_BACKEND_URL ?? "http://localhost:3100";
    const res = await fetch(backendUrl + "/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atw-Session-Id": "t089-" + Date.now(),
      },
      body: JSON.stringify({
        message: "What did I order last time?",
        history: [],
        context: { locale: "en-US" },
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      message: string;
      actions: Array<{
        tool: string;
        confirmation_required: boolean;
      }>;
    };

    // Either the model narrated a "please log in" reply outright (no
    // action intent needed), or it emitted list_my_orders as an action
    // tool for the widget to execute with the shopper's credentials
    // (which will 401 for an anonymous shopper and trigger the widget
    // login surface). Both are acceptable; the test asserts the
    // non-fabrication invariant.
    const maybeLogin = json.message.toLowerCase();
    const hasLoginText = /log in|sign in|inicia sesión|inicia sesion/.test(maybeLogin);
    const hasAction = json.actions.some(
      (a) => a.tool === "list_my_orders" && a.confirmation_required === true,
    );
    expect(hasLoginText || hasAction).toBe(true);

    // Invariant: nothing here fabricates concrete orders. If the reply
    // contains specific order numbers or dates, that is a fabrication
    // (no retrieval context for orders — they come from host API).
    expect(json.message).not.toMatch(/order\s*#\s*\d{4,}/i);
  }, 20_000);
});
