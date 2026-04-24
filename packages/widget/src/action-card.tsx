/** @jsxImportSource preact */
/**
 * FR-009a invariant: every host-derived string (intent.description,
 * intent.summary values, outcome.summary, outcome.message, error body
 * fields) MUST reach the DOM as a JSX text child so Preact auto-escapes
 * it. No dangerouslySetInnerHTML, no innerHTML assignment, no template
 * strings into element.textContent-then-HTML-parsing.
 *
 * Structural guarantee: packages/widget/test/action-card.interpreter-safety.contract.test.ts
 * static-greps this file for banned constructs on every CI run.
 */
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { WidgetConfig } from "./config.js";
import { pendingAction, isSending } from "./state.js";
import { executeIntentForLoop } from "./chat-action-runner.js";
import { continueLoopFromToolResult } from "./loop-driver.js";

export type CardStatus = "idle" | "executing" | "succeeded" | "failed";

/**
 * Confirmation card. Contract:
 * specs/003-runtime/contracts/widget-config.md §4 + FR-040.
 * Executes the action only on primary-button click; nothing about this
 * component may bypass the gate.
 *
 * Feature 007 (US4): on confirm the card executes the write, then
 * posts the resulting `tool_result` back to `/v1/chat` via
 * `continueLoopFromToolResult` so Opus composes a grounded
 * conversational wrap-up. On cancel, the card posts a synthetic
 * tool_result with content `"declined by shopper"` so Opus can
 * acknowledge the cancellation instead of leaving the turn dangling.
 */
export function ActionCard(props: {
  intent: ActionIntent;
  config: WidgetConfig;
}): JSX.Element {
  const [status, setStatus] = useState<CardStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    if (status !== "idle") return;
    setStatus("executing");
    setError(null);
    isSending.value = true;
    try {
      const exec = await executeIntentForLoop(props.intent, props.config);
      if (exec.ok) {
        setStatus("succeeded");
      } else {
        setStatus("failed");
        setError(exec.payload.content);
      }
      pendingAction.value = null;
      await continueLoopFromToolResult(exec.payload, props.config);
    } finally {
      isSending.value = false;
    }
  }

  async function onCancel() {
    pendingAction.value = null;
    isSending.value = true;
    try {
      await continueLoopFromToolResult(
        {
          tool_use_id: props.intent.id,
          content: "declined by shopper",
          is_error: false,
          status: 0,
          truncated: false,
        },
        props.config,
      );
    } finally {
      isSending.value = false;
    }
  }

  const summary = props.intent.summary ?? {};
  const summaryKeys = Object.keys(summary);

  return (
    <div class="atw-action-card" role="group" aria-label="Action confirmation">
      <div class="atw-action-card__title">{props.intent.description}</div>
      {summaryKeys.length > 0 ? (
        <div class="atw-action-card__summary">
          {summaryKeys.map((k) => (
            <>
              <div class="atw-action-card__summary-key">{k}</div>
              <div class="atw-action-card__summary-val">{summary[k]}</div>
            </>
          ))}
        </div>
      ) : null}
      {status === "failed" && error ? (
        <div class="atw-error" role="alert">
          {error}
          {props.config.loginUrl ? (
            <>
              {" "}
              <a href={props.config.loginUrl}>Log in</a>
            </>
          ) : null}
        </div>
      ) : null}
      {status === "succeeded" ? (
        <div class="atw-action-card__done">Done.</div>
      ) : (
        <div class="atw-action-card__actions">
          <button
            type="button"
            class="atw-action-card__cancel"
            onClick={onCancel}
            disabled={status === "executing"}
          >
            Cancel
          </button>
          <button
            type="button"
            class="atw-action-card__confirm"
            onClick={onConfirm}
            disabled={status === "executing"}
          >
            {status === "executing" ? "Working…" : "Confirm"}
          </button>
        </div>
      )}
    </div>
  );
}
