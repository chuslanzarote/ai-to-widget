/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useRef } from "preact/hooks";
import { canSend, isSending } from "./state.js";

/**
 * Text input + send. Enter sends, Shift+Enter inserts a newline.
 * Contract: specs/003-runtime/contracts/widget-config.md §3.
 */
export function ChatInput(props: {
  onSend: (text: string) => void;
}): JSX.Element {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function submit() {
    if (!canSend.value) return;
    const value = ref.current?.value?.trim();
    if (!value || !ref.current) return;
    props.onSend(value);
    ref.current.value = "";
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div class="atw-input-row">
      <label class="atw-visually-hidden" htmlFor="atw-input">
        Message
      </label>
      <textarea
        id="atw-input"
        ref={ref}
        class="atw-input"
        rows={1}
        placeholder="Ask something…"
        onKeyDown={onKeyDown}
        disabled={isSending.value}
      />
      <button
        type="button"
        class="atw-send"
        onClick={submit}
        disabled={isSending.value}
        aria-label="Send message"
      >
        {isSending.value ? "…" : "Send"}
      </button>
    </div>
  );
}
