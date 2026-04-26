/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import {
  open,
  turns,
  isSending,
  lastError,
  appendTurn,
  sessionId,
  pendingAction,
  actionCapable,
  trimHistoryForRequest,
} from "./state.js";
import { MessageList } from "./message-list.js";
import { ChatInput } from "./input.js";
import { postChat } from "./api-client.js";
import { ActionCard } from "./action-card.js";
import type { WidgetConfig } from "./config.js";
import { isResponseGenerationFailed } from "@atw/scripts/dist/lib/types.js";
import { RESPONSE_GENERATION_FAILED_FALLBACK } from "./loop-driver.js";
import { renderNoExecutorsDiagnostic } from "./diagnostics-text.js";

/**
 * The chat panel Preact component. Closes on Esc.
 *
 * Per FR-027 the panel is rendered inline-positioned (fixed) without a
 * modal backdrop and without a global focus trap, so the host page's
 * scroll/click/hover events outside the panel's bounding rect dispatch
 * normally. Esc-to-close is local to the panel.
 */
export function ChatPanel(props: { config: WidgetConfig }): JSX.Element | null {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open.value) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") open.value = false;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
      if (isResponseGenerationFailed(result.response)) {
        appendTurn({
          role: "assistant",
          content: RESPONSE_GENERATION_FAILED_FALLBACK,
          timestamp: new Date().toISOString(),
        });
      } else {
        if (result.response.message.length > 0) {
          appendTurn({
            role: "assistant",
            content: result.response.message,
            timestamp: new Date().toISOString(),
          });
        }
        // Surface the first pending action (V1 renders one at a time).
        const intent =
          result.response.actions[0] ?? result.response.action_intent;
        if (intent) {
          if (!actionCapable.value) {
            // FR-023 — D-NOEXECUTORS: chat-only widget cannot execute the
            // intent. Render the diagnostic into the transcript and do
            // NOT stash the intent into pendingAction.
            appendTurn({
              role: "assistant",
              content: renderNoExecutorsDiagnostic(intent.tool),
              timestamp: new Date().toISOString(),
            });
          } else {
            pendingAction.value = intent;
          }
        }
      }
    } finally {
      isSending.value = false;
    }
  }

  return (
    <div
      ref={rootRef}
      class="atw-panel"
      role="dialog"
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
