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
  trimHistoryForRequest,
} from "./state.js";
import { MessageList, attachCitationsToLastAssistantTurn } from "./message-list.js";
import { ChatInput } from "./input.js";
import { postChat } from "./api-client.js";
import { ActionCard } from "./action-card.js";
import type { WidgetConfig } from "./config.js";

/**
 * The chat panel Preact component. Focus-trap on open; closes on Esc.
 * Contract: specs/003-runtime/contracts/widget-config.md §2, §8.
 */
export function ChatPanel(props: { config: WidgetConfig }): JSX.Element | null {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const trapRef = useRef<FocusTrap | null>(null);

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
      appendTurn({
        role: "assistant",
        content: result.response.message,
        timestamp: new Date().toISOString(),
      });
      attachCitationsToLastAssistantTurn(result.response.citations);
      // Surface the first pending action (V1 renders one at a time).
      if (result.response.actions.length > 0) {
        pendingAction.value = result.response.actions[0];
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
      {pendingAction.value ? (
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
