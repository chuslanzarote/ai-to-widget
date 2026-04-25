/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { createFocusTrap, type FocusTrap } from "focus-trap";
import {
  open,
  turns,
  isSending,
  lastError,
  appendTurn,
  sessionId,
  pendingAction,
  actionCapable,
  progressPlaceholder,
  thinking,
  trimHistoryForRequest,
} from "./state.js";
import { MessageList, attachCitationsToLastAssistantTurn } from "./message-list.js";
import { ChatInput } from "./input.js";
import { postChat } from "./api-client.js";
import { ActionCard } from "./action-card.js";
import {
  driveLoopFromIntent,
  RESPONSE_GENERATION_FAILED_FALLBACK,
} from "./loop-driver.js";
import { isResponseGenerationFailed } from "@atw/scripts/dist/lib/types.js";
import type { WidgetConfig } from "./config.js";
import { renderNoExecutorsDiagnostic } from "./diagnostics-text.js";

/**
 * Feature 008 / FR-025 — sane default welcome greeting used when the
 * Builder did not capture a `welcomeMessage` in `/atw.init`.
 */
export const DEFAULT_WELCOME_MESSAGE = "Hi! How can I help you today?";

/**
 * The chat panel Preact component. Focus-trap on open; closes on Esc.
 *
 * Feature 007 drives the tool-use loop from here: when the backend
 * returns an `action_intent` with `confirmation_required: false`, the
 * widget auto-executes the shop fetch, shows progress placeholders,
 * and posts the tool result back. Writes with `confirmation_required:
 * true` still surface the confirmation card (Feature 006); the card
 * then re-enters the loop via `continueLoopFromToolResult` so Opus
 * can compose a grounded conversational wrap-up.
 *
 * Contract: specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md.
 */
export function ChatPanel(props: { config: WidgetConfig }): JSX.Element | null {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trapRef = useRef<FocusTrap | null>(null);

  // Feature 008 / FR-025 — seed the transcript with the Builder-
  // configured welcome message (or the sane default) on first render
  // with an empty transcript. Runs once per empty-transcript entry.
  useEffect(() => {
    if (!open.value) return;
    if (turns.value.length > 0) return;
    const greeting = props.config.welcomeMessage || DEFAULT_WELCOME_MESSAGE;
    appendTurn({
      role: "assistant",
      content: greeting,
      timestamp: new Date().toISOString(),
    });
  }, [open.value, props.config.welcomeMessage]);

  useEffect(() => {
    if (!open.value || !rootRef.current) return;
    const trap = createFocusTrap(rootRef.current, {
      escapeDeactivates: true,
      clickOutsideDeactivates: false,
      fallbackFocus: rootRef.current,
      returnFocusOnDeactivate: true,
      tabbableOptions: { displayCheck: "none" },
      onDeactivate: () => {
        open.value = false;
      },
    });
    trap.activate();
    trapRef.current = trap;
    return () => {
      trap.deactivate();
      trapRef.current = null;
    };
  }, [open.value]);

  if (!open.value) return null;

  async function onSend(text: string) {
    if (isSending.value) return;
    lastError.value = null;
    appendTurn({
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    });
    isSending.value = true;
    // Feature 008 / FR-024 — render the thinking indicator in the same
    // synchronous state update that schedules the POST so the shopper
    // sees activity instantly (no delay threshold — see research.md R10).
    thinking.value = true;
    try {
      const history = trimHistoryForRequest(turns.value.slice(0, -1));
      const result = await postChat(
        {
          message: text,
          history,
          context: { locale: props.config.locale },
        },
        props.config,
        sessionId.value,
      );
      if (!result.ok) {
        lastError.value = result.message;
        appendTurn({
          role: "assistant",
          content: result.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      // FR-020a fallback — only arrives on `tool_result`-bearing posts;
      // defensive branch in case the discriminator leaks through here.
      if (isResponseGenerationFailed(result.response)) {
        appendTurn({
          role: "assistant",
          content: RESPONSE_GENERATION_FAILED_FALLBACK,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const firstIntent =
        result.response.action_intent ?? result.response.actions[0] ?? null;
      if (firstIntent) {
        if (!actionCapable.value) {
          // Feature 008 / FR-023 — D-NOEXECUTORS. The backend asked for
          // a tool but the widget loaded an empty/missing catalog; the
          // shopper sees the diagnostic inline instead of a silent
          // console.warn + generic assistant turn.
          appendTurn({
            role: "assistant",
            content: renderNoExecutorsDiagnostic(firstIntent.tool),
            timestamp: new Date().toISOString(),
          });
          return;
        }
        await driveLoopFromIntent(
          firstIntent,
          result.response.tool_call_budget_remaining ?? 0,
          result.response.pending_turn_id ?? null,
          props.config,
        );
        return;
      }
      appendTurn({
        role: "assistant",
        content: result.response.message,
        timestamp: new Date().toISOString(),
      });
      attachCitationsToLastAssistantTurn(result.response.citations);
    } finally {
      isSending.value = false;
      progressPlaceholder.value = null;
      // Clear the thinking indicator on every exit path — whether a
      // reply arrived, the backend errored, or the tool loop handed off
      // to driveLoopFromIntent (which owns its own progress placeholder).
      thinking.value = false;
    }
  }

  return (
    <div
      ref={rootRef}
      class="atw-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Chat assistant"
    >
      <header class="atw-panel__header">
        <span class="atw-panel__title">{props.config.introLine ? "Chat" : "Ask me"}</span>
        <button
          type="button"
          class="atw-close"
          aria-label="Close chat"
          onClick={() => (open.value = false)}
        >
          ✕
        </button>
      </header>
      <MessageList config={props.config} intro={props.config.introLine} />
      {progressPlaceholder.value ? (
        <div class="atw-progress" role="status" aria-live="polite">
          {progressPlaceholder.value}
        </div>
      ) : null}
      {pendingAction.value && actionCapable.value ? (
        <ActionCard intent={pendingAction.value} config={props.config} />
      ) : null}
      {lastError.value ? (
        <div class="atw-error" role="alert">
          {lastError.value}
        </div>
      ) : null}
      <ChatInput onSend={onSend} />
    </div>
  );
}
