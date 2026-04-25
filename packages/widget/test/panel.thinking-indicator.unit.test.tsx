/** @jsxImportSource preact */
/**
 * Feature 008 / T061 / FR-024 — thinking-indicator render timing.
 *
 * The widget's panel MUST:
 *   (a) append a synthetic `thinking` transcript row in the same
 *       synchronous state update that schedules the POST /v1/chat,
 *   (b) remove the row in the same update that appends the first
 *       streamed delta / final response / error,
 *   (c) render the row INSIDE the transcript (not a toast/overlay) so
 *       screen readers announce it in conversation flow.
 *
 * Contract: specs/008-atw-hardening/research.md §R10.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { h } from "preact";
import { ChatPanel } from "../src/panel.js";
import * as apiClient from "../src/api-client.js";
import {
  open,
  turns,
  isSending,
  sessionId,
  actionCapable,
  pendingAction,
  thinking,
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

describe("thinking indicator (T061 / FR-024)", () => {
  let postChatSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    open.value = true;
    turns.value = [];
    sessionId.value = "t061-session";
    pendingAction.value = null;
    actionCapable.value = false;
    thinking.value = false;
    isSending.value = false;
  });

  afterEach(() => {
    cleanup();
    open.value = false;
    turns.value = [];
    thinking.value = false;
    isSending.value = false;
    postChatSpy?.mockRestore();
  });

  it("appears synchronously on Send click (same state update as POST /v1/chat)", async () => {
    // postChat hangs forever so we can observe the pre-reply state.
    let resolver: (value: unknown) => void = () => {};
    postChatSpy = vi.spyOn(apiClient, "postChat").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    const { getByLabelText, container } = render(h(ChatPanel, { config: cfg() }));
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "hello";
    const sendBtn = getByLabelText("Send message") as HTMLButtonElement;
    fireEvent.click(sendBtn);
    // Thinking flag MUST be true before the microtask boundary that
    // postChat would otherwise resolve on.
    expect(thinking.value).toBe(true);
    // Indicator row sits inside the transcript (not a toast).
    const transcript = container.querySelector(".atw-messages");
    expect(transcript).not.toBeNull();
    const indicator = transcript!.querySelector(".atw-thinking");
    expect(indicator).not.toBeNull();
    // Cleanup: resolve the hanging promise so afterEach is happy.
    resolver({ ok: true, response: { message: "done", actions: [], citations: [] } });
    await new Promise((r) => setTimeout(r, 0));
  });

  it("clears when the backend response arrives", async () => {
    postChatSpy = vi.spyOn(apiClient, "postChat").mockResolvedValue({
      ok: true,
      response: {
        message: "Hello, shopper!",
        actions: [],
        citations: [],
      },
    } as Awaited<ReturnType<typeof apiClient.postChat>>);
    const { getByLabelText, container } = render(h(ChatPanel, { config: cfg() }));
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "hi";
    const sendBtn = getByLabelText("Send message") as HTMLButtonElement;
    fireEvent.click(sendBtn);
    await vi.waitFor(() => {
      expect(thinking.value).toBe(false);
    });
    // And the assistant reply is now visible.
    const assistant = turns.value.find((t) => t.role === "assistant" && t.content === "Hello, shopper!");
    expect(assistant).toBeDefined();
  });

  it("renders the thinking row as a child of the transcript (.atw-messages), not a floating toast", () => {
    thinking.value = true;
    turns.value = [
      { role: "user", content: "hello", timestamp: "2026-04-24T00:00:00Z" },
    ];
    const { container } = render(h(ChatPanel, { config: cfg() }));
    const transcript = container.querySelector(".atw-messages");
    const indicator = container.querySelector(".atw-thinking");
    expect(transcript).not.toBeNull();
    expect(indicator).not.toBeNull();
    // Indicator must be a descendant of the transcript container.
    expect(transcript!.contains(indicator)).toBe(true);
  });
});
