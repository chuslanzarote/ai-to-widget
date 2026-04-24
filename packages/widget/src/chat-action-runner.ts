/**
 * Feature 007 — widget-side tool-loop driver.
 *
 * Given an `ActionIntent` emitted by the backend, this module:
 *   1. Resolves it to an `ActionExecutorEntry` from the loaded catalog.
 *   2. Executes a single `fetch()` with an 8 s AbortController.
 *   3. Truncates the response body to BODY_LIMIT bytes.
 *   4. Returns a `ToolResultPayload` the caller posts back to
 *      `/v1/chat` to close the tool-use loop.
 *
 * Every failure mode (timeout, network error, non-JSON, missing
 * executor, missing credential) collapses into a well-formed
 * `ToolResultPayload` — the backend forwards it verbatim to Opus so
 * the assistant can compose a plain-language explanation rather than
 * stalling (FR-015, FR-019, FR-020).
 *
 * Contracts:
 *   - specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md
 *   - specs/007-widget-tool-loop/contracts/action-catalog-v2.md
 */
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { WidgetConfig } from "./config.js";
import {
  ACTION_FETCH_TIMEOUT_MS,
  buildRequestFromEntry,
  getLoadedCatalog,
  truncateToBodyLimit,
  type ToolResultPayload,
} from "./action-executors.js";
import { assertToolAllowed, ToolNotAllowedError } from "./api-client-action.js";

export interface ExecuteIntentResult {
  payload: ToolResultPayload;
  /** For UI hooks — whether the shop returned a success status. */
  ok: boolean;
}

export async function executeIntentForLoop(
  intent: ActionIntent,
  config: WidgetConfig,
): Promise<ExecuteIntentResult> {
  try {
    assertToolAllowed(intent.tool, config);
  } catch (err) {
    if (err instanceof ToolNotAllowedError) {
      return synthetic(intent.id, `tool "${intent.tool}" not allowed by widget`);
    }
    throw err;
  }

  const catalog = getLoadedCatalog();
  if (!catalog) {
    return synthetic(intent.id, "widget catalog not loaded");
  }
  const entry = catalog.actions.find((a) => a.tool === intent.tool);
  if (!entry) {
    return synthetic(
      intent.id,
      `tool "${intent.tool}" not found in widget catalog`,
    );
  }

  const built = buildRequestFromEntry(entry, intent, config);
  if (built.validationError) {
    const msg =
      built.validationError === "not authenticated"
        ? "not authenticated"
        : built.validationError;
    return synthetic(intent.id, msg);
  }

  const abort = new AbortController();
  const scheduleTimeout =
    typeof window !== "undefined" ? window.setTimeout : setTimeout;
  const clearTimer =
    typeof window !== "undefined" ? window.clearTimeout : clearTimeout;
  const timeoutHandle = scheduleTimeout(
    () => abort.abort(),
    ACTION_FETCH_TIMEOUT_MS,
  );
  built.init.signal = abort.signal;

  let res: Response;
  try {
    res = await fetch(built.url, built.init);
  } catch (err) {
    clearTimer(timeoutHandle as Parameters<typeof clearTimer>[0]);
    if ((err as Error).name === "AbortError") {
      return synthetic(
        intent.id,
        "shop request timed out after 8 seconds",
        0,
      );
    }
    return synthetic(intent.id, "could not reach the shop", 0);
  }
  clearTimer(timeoutHandle as Parameters<typeof clearTimer>[0]);

  const raw = await res.text();
  const { content, truncated } = truncateToBodyLimit(raw);
  const isError = !res.ok;
  return {
    ok: !isError,
    payload: {
      tool_use_id: intent.id,
      content,
      is_error: isError,
      status: res.status,
      truncated,
    },
  };
}

function synthetic(
  toolUseId: string,
  content: string,
  status = 0,
): ExecuteIntentResult {
  return {
    ok: false,
    payload: {
      tool_use_id: toolUseId,
      content,
      is_error: true,
      status,
      truncated: false,
    },
  };
}
