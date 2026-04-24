import { signal, computed } from "@preact/signals";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";

/**
 * Reactive conversation store backed by @preact/signals.
 * Contract: specs/003-runtime/data-model.md §3.2.
 */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// The widget's pending action is exactly the backend's ActionIntent. Re-export
// under the historical name so existing imports keep working.
export type PendingAction = ActionIntent;

export const MAX_CONVERSATION_TURNS = 20;

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "atw-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadOrCreateSessionId(): string {
  try {
    const existing =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("atw.session_id")
        : null;
    if (existing && existing.length > 0) return existing;
  } catch {
    // sessionStorage can throw in privacy mode; fall through.
  }
  const fresh = generateSessionId();
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("atw.session_id", fresh);
    }
  } catch {
    // ignore
  }
  return fresh;
}

export const turns = signal<ConversationTurn[]>([]);
export const isSending = signal<boolean>(false);
export const open = signal<boolean>(false);
export const pendingAction = signal<PendingAction | null>(null);
export const lastError = signal<string | null>(null);
export const lastRequestId = signal<string | null>(null);
export const sessionId = signal<string>(loadOrCreateSessionId());

/**
 * Feature 007 — transient progress placeholder rendered while the
 * widget is fetching the shop / waiting for Opus's composition pass.
 *
 * The two literal Spanish strings are pinned by FR-010: the UI swaps
 * from `"Obteniendo datos…"` to `"Datos obtenidos, interpretando…"`
 * in place so the shopper sees the loop make progress. Cleared when
 * the turn settles.
 */
export const progressPlaceholder = signal<string | null>(null);

/**
 * Feature 007 — loop-suspension state for the ActionCard confirmation
 * path (US4). When `driveLoop` hits `confirmation_required: true`, it
 * parks `tool_call_budget_remaining` and `pending_turn_id` here so the
 * card's onConfirm/onCancel handlers can resume the Opus loop by
 * posting a `tool_result` back.
 */
export const pendingLoopBudget = signal<number>(0);
export const pendingLoopTurnId = signal<string | null>(null);

// T076 / FR-014 — true only when a valid executors catalog loaded with
// at least one action. Downstream UI (action card, confirmation flow)
// reads this to stay hidden in chat-only mode.
export const actionCapable = signal<boolean>(false);

export const canSend = computed(() => !isSending.value);

export function appendTurn(turn: ConversationTurn): void {
  const next = [...turns.value, turn];
  if (next.length > MAX_CONVERSATION_TURNS) {
    turns.value = next.slice(next.length - MAX_CONVERSATION_TURNS);
  } else {
    turns.value = next;
  }
}

export function trimHistoryForRequest(
  history: ConversationTurn[],
): ConversationTurn[] {
  if (history.length <= MAX_CONVERSATION_TURNS) return history;
  return history.slice(history.length - MAX_CONVERSATION_TURNS);
}

export function resetConversation(): void {
  turns.value = [];
  pendingAction.value = null;
  lastError.value = null;
  lastRequestId.value = null;
}
