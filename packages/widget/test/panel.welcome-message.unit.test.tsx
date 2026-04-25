/** @jsxImportSource preact */
/**
 * Feature 008 / T062 / FR-025 — welcome-message rendering.
 *
 * (a) When `config.welcomeMessage` is set, the widget renders that
 *     string as the first assistant-role transcript row.
 * (b) When unset, it falls back to the sane default
 *     (`DEFAULT_WELCOME_MESSAGE`).
 * (c) No hard-coded greeting is rendered in place of the configured
 *     value.
 *
 * Contract: specs/008-atw-hardening/spec.md §FR-025.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import { h } from "preact";
import { ChatPanel, DEFAULT_WELCOME_MESSAGE } from "../src/panel.js";
import {
  open,
  turns,
  sessionId,
  actionCapable,
  pendingAction,
  thinking,
} from "../src/state.js";
import type { WidgetConfig } from "../src/config.js";

function cfg(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "http://shop.local",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
    ...overrides,
  };
}

describe("welcome message (T062 / FR-025)", () => {
  beforeEach(() => {
    open.value = true;
    turns.value = [];
    sessionId.value = "t062-session";
    pendingAction.value = null;
    actionCapable.value = false;
    thinking.value = false;
  });

  afterEach(() => {
    cleanup();
    open.value = false;
    turns.value = [];
  });

  it("renders config.welcomeMessage as the first assistant-role transcript row", async () => {
    render(
      h(ChatPanel, {
        config: cfg({ welcomeMessage: "Welcome to Acme Coffee. Ask me anything." }),
      }),
    );
    // Signal-driven state is populated in the mount useEffect.
    await new Promise((r) => setTimeout(r, 0));
    const first = turns.value[0];
    expect(first).toBeDefined();
    expect(first.role).toBe("assistant");
    expect(first.content).toBe("Welcome to Acme Coffee. Ask me anything.");
  });

  it("falls back to DEFAULT_WELCOME_MESSAGE when welcomeMessage is unset", async () => {
    render(h(ChatPanel, { config: cfg() }));
    await new Promise((r) => setTimeout(r, 0));
    const first = turns.value[0];
    expect(first).toBeDefined();
    expect(first.role).toBe("assistant");
    expect(first.content).toBe(DEFAULT_WELCOME_MESSAGE);
  });

  it("does not seed a greeting when the transcript already has turns", async () => {
    turns.value = [
      { role: "user", content: "hi there", timestamp: "2026-04-24T00:00:00Z" },
    ];
    render(h(ChatPanel, { config: cfg({ welcomeMessage: "Welcome!" }) }));
    await new Promise((r) => setTimeout(r, 0));
    // First turn unchanged, no synthetic welcome injected in front of it.
    expect(turns.value[0].role).toBe("user");
    expect(turns.value[0].content).toBe("hi there");
    expect(
      turns.value.some((t) => t.role === "assistant" && t.content === "Welcome!"),
    ).toBe(false);
  });
});
