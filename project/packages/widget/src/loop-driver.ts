/**
 * Feature 007 — shared Opus tool-loop driver.
 *
 * Both the chat-panel's `onSend` path (auto-executed reads) and the
 * ActionCard's `onConfirm`/`onCancel` path (confirmed writes) funnel
 * through here. Having one driver guarantees the two code paths agree
 * on the budget arithmetic, progress-placeholder semantics, and the
 * final-message rendering.
 *
 * Contracts:
 *   - specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md
 *   - FR-010 (Spanish placeholders), FR-015 (budget), FR-019 (graceful
 *     degradation).
 */
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import { isResponseGenerationFailed } from "@atw/scripts/dist/lib/types.js";
import type { WidgetConfig } from "./config.js";
import { postChatToolResult } from "./api-client.js";
import { executeIntentForLoop, isStopOutcome } from "./chat-action-runner.js";
import type { ToolResultPayload } from "./action-executors.js";
import {
  appendTurn,
  lastError,
  pendingAction,
  pendingLoopBudget,
  pendingLoopTurnId,
  progressPlaceholder,
  sessionId,
  trimHistoryForRequest,
  turns,
} from "./state.js";

const FETCHING_PLACEHOLDER = "Obteniendo datos…";
const INTERPRETING_PLACEHOLDER = "Datos obtenidos, interpretando…";
/**
 * Feature 008 / FR-020a — the pinned fallback string the widget
 * renders when the backend exhausts its post-`tool_result` retry
 * budget. Kept as a module constant so the diagnostics-text test
 * (T055) can import it by name.
 */
export const RESPONSE_GENERATION_FAILED_FALLBACK =
  "Action completed successfully. (Response generation failed — please refresh.)";

interface NextStep {
  intent: ActionIntent;
  budget: number;
  pendingTurnId: string | null;
}

export async function driveLoopFromIntent(
  initialIntent: ActionIntent,
  initialBudget: number,
  initialPendingTurnId: string | null,
  config: WidgetConfig,
): Promise<void> {
  let intent: ActionIntent | null = initialIntent;
  let budget = initialBudget;
  let pendingTurnId = initialPendingTurnId;

  while (intent) {
    if (intent.confirmation_required) {
      pendingAction.value = intent;
      pendingLoopBudget.value = budget;
      pendingLoopTurnId.value = pendingTurnId;
      return;
    }

    progressPlaceholder.value = FETCHING_PLACEHOLDER;
    const exec = await executeIntentForLoop(intent, config);
    if (isStopOutcome(exec)) {
      // Feature 008 / FR-022 — D-TOOLNOTALLOWED path already rendered
      // the transcript row and cleared pending state; no tool_result
      // is posted so the next shopper turn starts from a clean slate.
      return;
    }
    const next = await postToolResultAndGetNext(
      exec.payload,
      budget,
      pendingTurnId,
      config,
    );
    if (!next) return;
    intent = next.intent;
    budget = next.budget;
    pendingTurnId = next.pendingTurnId;
  }
}

export async function continueLoopFromToolResult(
  payload: ToolResultPayload,
  config: WidgetConfig,
): Promise<void> {
  const budget = pendingLoopBudget.value;
  const pendingTurnId = pendingLoopTurnId.value;
  pendingLoopBudget.value = 0;
  pendingLoopTurnId.value = null;

  const next = await postToolResultAndGetNext(
    payload,
    budget,
    pendingTurnId,
    config,
  );
  if (!next) return;
  return driveLoopFromIntent(next.intent, next.budget, next.pendingTurnId, config);
}

async function postToolResultAndGetNext(
  payload: ToolResultPayload,
  budget: number,
  pendingTurnId: string | null,
  config: WidgetConfig,
): Promise<NextStep | null> {
  progressPlaceholder.value = INTERPRETING_PLACEHOLDER;
  const history = trimHistoryForRequest(turns.value);
  const result = await postChatToolResult(
    {
      history,
      context: { locale: config.locale },
      toolResult: payload,
      pendingTurnId,
      budgetRemaining: budget,
    },
    config,
    sessionId.value,
  );
  if (!result.ok) {
    lastError.value = result.message;
    progressPlaceholder.value = null;
    appendTurn({
      role: "assistant",
      content: result.message,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
  // Feature 008 / FR-020a — action succeeded but the second Opus
  // call exhausted its retry budget. Render the pinned fallback
  // string, clear pending state, and do NOT surface the generic
  // error toast.
  if (isResponseGenerationFailed(result.response)) {
    progressPlaceholder.value = null;
    pendingLoopBudget.value = 0;
    pendingLoopTurnId.value = null;
    appendTurn({
      role: "assistant",
      content: RESPONSE_GENERATION_FAILED_FALLBACK,
      timestamp: new Date().toISOString(),
    });
    return null;
  }
  const next = result.response.action_intent ?? null;
  if (next) {
    return {
      intent: next,
      budget:
        result.response.tool_call_budget_remaining ?? Math.max(0, budget - 1),
      pendingTurnId: result.response.pending_turn_id ?? pendingTurnId,
    };
  }
  progressPlaceholder.value = null;
  appendTurn({
    role: "assistant",
    content: result.response.message,
    timestamp: new Date().toISOString(),
  });
  return null;
}
