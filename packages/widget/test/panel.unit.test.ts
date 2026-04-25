/** @jsxImportSource preact */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import { h } from "preact";
import { ChatPanel } from "../src/panel.js";
import { open, sessionId, turns } from "../src/state.js";
import type { WidgetConfig } from "../src/config.js";

/**
 * Panel accessibility + host-page click-through (FR-027).
 *
 * The panel renders a `role="dialog"` with a close button. Per FR-027 the
 * panel does NOT trap focus globally and does NOT intercept events
 * outside its bounding rect — clicks on the host page must dispatch to
 * host-page listeners normally.
 */
function cfg(): WidgetConfig {
  return {
    backendUrl: "http://backend.local",
    apiBaseUrl: "http://host.local",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
  };
}

describe("ChatPanel accessibility", () => {
  beforeEach(() => {
    open.value = true;
    turns.value = [];
    sessionId.value = "test-session";
  });
  afterEach(() => {
    cleanup();
    open.value = false;
    turns.value = [];
  });

  it("renders as role=dialog with aria-label and a close button", async () => {
    const { container, getByLabelText } = render(h(ChatPanel, { config: cfg() }));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-label")).toBe("Chat assistant");
    // FR-027: panel is not a modal — no aria-modal, no focus trap.
    expect(dialog?.getAttribute("aria-modal")).toBeNull();
    const close = getByLabelText("Close chat");
    expect(close).toBeTruthy();
  });

  it("clicking close sets open signal to false", async () => {
    open.value = true;
    const { getByLabelText } = render(h(ChatPanel, { config: cfg() }));
    const closeBtn = getByLabelText("Close chat") as HTMLButtonElement;
    closeBtn.click();
    expect(open.value).toBe(false);
  });

  it("clicks on document.body outside the panel reach host-page listeners (FR-027)", async () => {
    open.value = true;
    render(h(ChatPanel, { config: cfg() }));
    let hostClicks = 0;
    const onBodyClick = () => {
      hostClicks += 1;
    };
    document.body.addEventListener("click", onBodyClick);
    try {
      // Synthesise a click on the body at coordinates outside the panel.
      const evt = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: 0,
        clientY: 0,
      });
      document.body.dispatchEvent(evt);
      expect(hostClicks).toBe(1);
    } finally {
      document.body.removeEventListener("click", onBodyClick);
    }
  });
});
