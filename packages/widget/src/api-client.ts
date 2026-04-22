import { ChatResponseSchema, type ChatResponse, type ChatRequest } from "@atw/scripts/dist/lib/types.js";
import type { WidgetConfig } from "./config.js";
import { buildBackendHeaders } from "./auth.js";

/**
 * HTTP client for the ATW backend. Invariant per
 * specs/003-runtime/contracts/widget-config.md §5: no auth headers are
 * ever attached to backend calls, and `credentials` is not set to
 * `include`.
 */
export interface PostChatResult {
  ok: true;
  response: ChatResponse;
}

export interface PostChatFailure {
  ok: false;
  status: number;
  error_code?: string;
  message: string;
  request_id?: string;
  retry_after_seconds?: number;
}

export async function postChat(
  request: ChatRequest,
  config: WidgetConfig,
  sessionId: string,
): Promise<PostChatResult | PostChatFailure> {
  let res: Response;
  try {
    res = await fetch(config.backendUrl.replace(/\/$/, "") + "/v1/chat", {
      method: "POST",
      headers: buildBackendHeaders(sessionId),
      body: JSON.stringify(request),
      // NOTE: intentionally no `credentials: 'include'`. The backend
      // never sees shopper auth.
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message:
        "Can't reach the assistant right now. Check your connection and try again.",
    };
  }
  const rawBody = await res.text();
  let parsed: unknown;
  try {
    parsed = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    return {
      ok: false,
      status: res.status,
      message: "The assistant returned an unreadable response.",
    };
  }
  if (!res.ok) {
    const body = parsed as {
      error_code?: string;
      message?: string;
      request_id?: string;
      retry_after_seconds?: number;
    };
    return {
      ok: false,
      status: res.status,
      error_code: body.error_code,
      message: body.message ?? "The assistant is unavailable right now.",
      request_id: body.request_id,
      retry_after_seconds: body.retry_after_seconds,
    };
  }
  const zodRes = ChatResponseSchema.safeParse(parsed);
  if (!zodRes.success) {
    return {
      ok: false,
      status: res.status,
      message: "The assistant returned an unexpected shape.",
    };
  }
  return { ok: true, response: zodRes.data };
}

export async function postActionFollowUp(
  actionId: string,
  outcome: "succeeded" | "cancelled" | "failed",
  config: WidgetConfig,
  sessionId: string,
  extra?: { hostResponseSummary?: string; error?: { status?: number; message: string } },
): Promise<void> {
  const hiddenTurn = {
    action_id: actionId,
    outcome,
    ...(extra?.hostResponseSummary
      ? { host_response_summary: extra.hostResponseSummary }
      : {}),
    ...(extra?.error ? { error: extra.error } : {}),
  };
  const request = {
    message: "(atw:action_follow_up)",
    history: [],
    context: {
      locale: config.locale,
      page_context: { atw_action_follow_up: hiddenTurn },
    },
  };
  try {
    await fetch(config.backendUrl.replace(/\/$/, "") + "/v1/chat", {
      method: "POST",
      headers: buildBackendHeaders(sessionId),
      body: JSON.stringify(request),
    });
  } catch {
    // Follow-up is best-effort; its failure is not user-visible.
  }
}
