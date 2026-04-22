/** @jsxImportSource preact */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/preact";
import { h } from "preact";
import { ChatPanel } from "../src/panel.js";
import { open, sessionId, turns } from "../src/state.js";
import type { WidgetConfig } from "../src/config.js";

/**
 * T112 — focus-trap integration smoke test.
 * We verify the panel renders a dialog with `aria-modal="true"` and a
 * close button with the right accessible name. Deep focus-trap semantics
 * are exercised by the library itself; we just check it is wired.
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

describe("ChatPanel accessibility (T112)", () => {
  beforeEach(() => {
    open.value = true;
    turns.value = [];
    sessionId.value = "test-session";
  });
  afterEach(() => {
    open.value = false;
    turns.value = [];
  });

  it("renders as role=dialog with aria-modal and a close button", async () => {
    const { container, getByLabelText } = render(h(ChatPanel, { config: cfg() }));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBe("Chat assistant");
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
});
