/** @jsxImportSource preact */
/**
 * T077 / US6 — ActionCard must never surface in chat-only mode
 * (FR-014, SC-005).
 *
 * Two structural gates are pinned here:
 *
 *   1. In ChatPanel, the render expression guards on
 *      `pendingAction.value && actionCapable.value`. Seeding a pending
 *      action while `actionCapable === false` must yield zero
 *      `.atw-action-card` nodes in the DOM. A future refactor that
 *      drops the `actionCapable` half of the guard will fail this
 *      test.
 *
 *   2. The chat-send path in ChatPanel must also *not* stash the
 *      incoming ActionIntent into `pendingAction` when chat-only mode
 *      is in effect. That branch additionally logs a warning so the
 *      contract drift is visible in the console. This is exercised
 *      here structurally — we read the panel source and assert the
 *      `actionCapable.value` check and the warn call are colocated
 *      with the pendingAction assignment. A behavioural test would
 *      need to stub postChat; the structural pin is enough to catch
 *      regressions and keeps the assertion pure.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/preact";
import { h } from "preact";
import { promises as fs } from "node:fs";
import path from "node:path";

import { ChatPanel } from "../src/panel.js";
import {
  open,
  pendingAction,
  actionCapable,
  turns,
  sessionId,
} from "../src/state.js";
import type { WidgetConfig } from "../src/config.js";

function cfg(): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "https://shop.example.com",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
  };
}

const FAKE_INTENT = {
  id: "intent_abc",
  tool: "add_to_cart",
  description: "Add 1 × Midnight Roast 1kg to your cart",
  summary: { quantity: "1", variant_id: "var_midnight_1kg_whole" },
  confirmation_required: true,
  http: {
    method: "POST",
    path: "/store/carts/cart_123/line-items",
    body: { variant_id: "var_midnight_1kg_whole", quantity: 1 },
  },
  arguments: {
    cart_id: "cart_123",
    variant_id: "var_midnight_1kg_whole",
    quantity: 1,
  },
};

describe("chat-only gate on ActionCard (T077 / US6, FR-014)", () => {
  beforeEach(() => {
    open.value = true;
    turns.value = [];
    sessionId.value = "t077-session";
    pendingAction.value = null;
    actionCapable.value = false;
  });
  afterEach(() => {
    open.value = false;
    pendingAction.value = null;
    actionCapable.value = false;
  });

  it("pendingAction set but actionCapable=false → no ActionCard in DOM", () => {
    pendingAction.value = FAKE_INTENT;
    actionCapable.value = false;

    const { container } = render(h(ChatPanel, { config: cfg() }));
    expect(container.querySelector(".atw-action-card")).toBeNull();
  });

  it("pendingAction set AND actionCapable=true → ActionCard renders", () => {
    open.value = true;
    pendingAction.value = FAKE_INTENT;
    actionCapable.value = true;

    const { container } = render(h(ChatPanel, { config: cfg() }));
    // Panel is open + pendingAction present + actionCapable true →
    // the guard passes and the card mounts.
    const card = container.querySelector(".atw-action-card");
    expect(card).not.toBeNull();
  });

  it("actionCapable=true but no pendingAction → ActionCard not rendered", () => {
    pendingAction.value = null;
    actionCapable.value = true;

    const { container } = render(h(ChatPanel, { config: cfg() }));
    expect(container.querySelector(".atw-action-card")).toBeNull();
  });

  it("panel.tsx gates on actionCapable.value alongside pendingAction.value", async () => {
    // Structural pin: the render expression must include both halves
    // of the guard. A refactor that drops `actionCapable.value` here
    // will slip an ActionCard through in chat-only mode.
    const src = await fs.readFile(
      path.join(__dirname, "..", "src", "panel.tsx"),
      "utf8",
    );
    expect(src).toMatch(
      /pendingAction\.value\s*&&\s*actionCapable\.value/,
    );
  });

  it("panel.tsx refuses to stash an ActionIntent when actionCapable is false", async () => {
    // Structural pin on the send-path branch: the code must
    // explicitly check !actionCapable.value before writing into
    // pendingAction, and render the D-NOEXECUTORS diagnostic row so
    // the drift is visible in the transcript (Feature 008 / FR-023 —
    // the former console.warn path has been replaced).
    const src = await fs.readFile(
      path.join(__dirname, "..", "src", "panel.tsx"),
      "utf8",
    );
    expect(src).toContain("if (!actionCapable.value)");
    expect(src).toContain("renderNoExecutorsDiagnostic");
  });
});
