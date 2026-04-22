/** @jsxImportSource preact */
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { WidgetConfig } from "./config.js";
import { pendingAction, appendTurn, sessionId } from "./state.js";
import { executeAction, type ExecuteActionOutcome } from "./api-client-action.js";
import { postActionFollowUp } from "./api-client.js";

export type CardStatus = "idle" | "executing" | "succeeded" | "failed";

/**
 * Confirmation card. Contract:
 * specs/003-runtime/contracts/widget-config.md §4 + FR-040.
 * Executes the action only on primary-button click; nothing about this
 * component may bypass the gate.
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
    let outcome: ExecuteActionOutcome;
    try {
      outcome = await executeAction(props.intent, props.config);
    } catch (err) {
      const message =
        (err as Error).message || "Something went wrong running that action.";
      setStatus("failed");
      setError(message);
      void postActionFollowUp(
        props.intent.id,
        "failed",
        props.config,
        sessionId.value,
        { error: { message } },
      );
      return;
    }
    if (outcome.ok) {
      setStatus("succeeded");
      pendingAction.value = null;
      appendTurn({
        role: "assistant",
        content: outcome.summary ?? "Done.",
        timestamp: new Date().toISOString(),
      });
      void postActionFollowUp(
        props.intent.id,
        "succeeded",
        props.config,
        sessionId.value,
        { hostResponseSummary: outcome.summary },
      );
    } else {
      setStatus("failed");
      setError(outcome.message);
      if (outcome.status === 401 || outcome.status === 403) {
        // Anonymous-fallback / US7 surface
        setError(outcome.message);
      }
      void postActionFollowUp(
        props.intent.id,
        "failed",
        props.config,
        sessionId.value,
        { error: { status: outcome.status, message: outcome.message } },
      );
    }
  }

  function onCancel() {
    pendingAction.value = null;
    void postActionFollowUp(
      props.intent.id,
      "cancelled",
      props.config,
      sessionId.value,
    );
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
