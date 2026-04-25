/**
 * T032 / Feature 008 FR-020a — widget fallback-rendering contract.
 *
 * On receipt of the v3 discriminator
 *   { response_generation_failed: true, action_succeeded: true,
 *     pending_turn_id: null }
 * the widget's loop driver MUST:
 *   - append the pinned fallback string as an assistant-role transcript
 *     row (no generic error toast);
 *   - clear `pendingLoopBudget` and `pendingLoopTurnId`;
 *   - leave `lastError` untouched.
 *
 * Contract: specs/008-atw-hardening/contracts/chat-endpoint-v3.md
 *   §Response shape / §Response invariants.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  continueLoopFromToolResult,
  RESPONSE_GENERATION_FAILED_FALLBACK,
} from "../src/loop-driver.js";
import * as apiClient from "../src/api-client.js";
import {
  turns,
  lastError,
  pendingLoopBudget,
  pendingLoopTurnId,
  progressPlaceholder,
} from "../src/state.js";
import type { WidgetConfig } from "../src/config.js";
import type { ToolResultPayload } from "../src/action-executors.js";

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

function payload(): ToolResultPayload {
  return {
    tool_use_id: "toolu_1",
    tool_name: "addCartItem",
    tool_input: { product_id: "p_1", quantity: 1 },
    content: '{"ok":true}',
    is_error: false,
    status: 201,
    truncated: false,
  };
}

describe("continueLoopFromToolResult — response_generation_failed fallback (T032)", () => {
  let postChatToolResultSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    turns.value = [];
    lastError.value = null;
    pendingLoopBudget.value = 4;
    pendingLoopTurnId.value = "turn-1";
    progressPlaceholder.value = null;
  });

  afterEach(() => {
    postChatToolResultSpy?.mockRestore();
  });

  it("renders the pinned fallback string as an assistant turn", async () => {
    postChatToolResultSpy = vi
      .spyOn(apiClient, "postChatToolResult")
      .mockResolvedValue({
        ok: true,
        response: {
          response_generation_failed: true,
          action_succeeded: true,
          pending_turn_id: null,
        },
      });

    await continueLoopFromToolResult(payload(), cfg());

    const last = turns.value[turns.value.length - 1];
    expect(last).toBeDefined();
    expect(last?.role).toBe("assistant");
    expect(last?.content).toBe(RESPONSE_GENERATION_FAILED_FALLBACK);
    expect(RESPONSE_GENERATION_FAILED_FALLBACK).toBe(
      "Action completed successfully. (Response generation failed — please refresh.)",
    );
  });

  it("clears pendingLoopBudget, pendingLoopTurnId, and progressPlaceholder", async () => {
    postChatToolResultSpy = vi
      .spyOn(apiClient, "postChatToolResult")
      .mockResolvedValue({
        ok: true,
        response: {
          response_generation_failed: true,
          action_succeeded: true,
          pending_turn_id: null,
        },
      });

    await continueLoopFromToolResult(payload(), cfg());

    expect(pendingLoopBudget.value).toBe(0);
    expect(pendingLoopTurnId.value).toBeNull();
    expect(progressPlaceholder.value).toBeNull();
  });

  it("does NOT set lastError (no generic error toast on fallback)", async () => {
    postChatToolResultSpy = vi
      .spyOn(apiClient, "postChatToolResult")
      .mockResolvedValue({
        ok: true,
        response: {
          response_generation_failed: true,
          action_succeeded: true,
          pending_turn_id: null,
        },
      });

    lastError.value = null;
    await continueLoopFromToolResult(payload(), cfg());
    expect(lastError.value).toBeNull();
  });

  it("normal text responses are rendered via the existing code path (regression guard)", async () => {
    postChatToolResultSpy = vi
      .spyOn(apiClient, "postChatToolResult")
      .mockResolvedValue({
        ok: true,
        response: {
          message: "Your espresso is on the way.",
          citations: [],
          actions: [],
          pending_turn_id: null,
          request_id: "req-1",
        },
      });

    await continueLoopFromToolResult(payload(), cfg());

    const last = turns.value[turns.value.length - 1];
    expect(last?.content).toBe("Your espresso is on the way.");
    expect(last?.content).not.toBe(RESPONSE_GENERATION_FAILED_FALLBACK);
  });
});
