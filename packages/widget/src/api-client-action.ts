import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { WidgetConfig } from "./config.js";
import {
  ACTION_FETCH_TIMEOUT_MS,
  buildRequestFromEntry,
  getLoadedCatalog,
  handleResponse,
} from "./action-executors.js";

/**
 * Execute a confirmed action against the host API. The execution
 * model is Feature 006: the `ActionIntent` is resolved through the
 * declarative `action-executors.json` catalog (loaded at boot by
 * `loadExecutorsCatalog`), NOT through `intent.http` any more — so
 * `tool-use` descriptors cannot smuggle a request shape the Builder
 * did not approve at build time.
 *
 * Contract:
 *   specs/006-openapi-action-catalog/contracts/widget-executor-engine.md §2
 *   specs/003-runtime/contracts/widget-config.md §4  (confirmation card)
 *
 * Red-line invariants enforced here:
 *   - FR-015a : exactly one fetch per call, under every failure mode.
 *   - FR-021  : 15 s AbortController wrapping the fetch.
 *   - FR-016  : runtime cross-origin guard against a bad catalog.
 *   - Tool allowlist (Feature 003): refuses any tool not in
 *     `config.allowedTools`.
 */
export interface ExecuteActionSuccess {
  ok: true;
  status: number;
  summary?: string;
  body?: unknown;
}
export interface ExecuteActionFailure {
  ok: false;
  status: number;
  message: string;
  body?: unknown;
}
export type ExecuteActionOutcome = ExecuteActionSuccess | ExecuteActionFailure;

export class ToolNotAllowedError extends Error {
  readonly code = "ATW_TOOL_NOT_ALLOWED" as const;
  constructor(public readonly tool: string) {
    super(`Tool "${tool}" is not in the widget allowlist`);
  }
}

export function assertToolAllowed(
  tool: string,
  config: WidgetConfig,
): void {
  if (!config.allowedTools.includes(tool)) {
    throw new ToolNotAllowedError(tool);
  }
}

export async function executeAction(
  intent: ActionIntent,
  config: WidgetConfig,
): Promise<ExecuteActionOutcome> {
  assertToolAllowed(intent.tool, config);

  const catalog = getLoadedCatalog();
  if (!catalog) {
    return {
      ok: false,
      status: 0,
      message: "Actions are temporarily unavailable in this session.",
    };
  }
  const entry = catalog.actions.find((a) => a.tool === intent.tool);
  if (!entry) {
    return {
      ok: false,
      status: 0,
      message: `No executor for tool "${intent.tool}".`,
    };
  }

  const built = buildRequestFromEntry(entry, intent, config);
  if (built.validationError) {
    return { ok: false, status: 0, message: built.validationError };
  }

  // FR-016 — runtime cross-origin guard.  The build-time half lives
  // in render-executors.ts; this tripwire fires if a hostile or
  // misconfigured catalog somehow slips past Zod at load time.
  if (typeof window !== "undefined") {
    const actionUrl = new URL(built.url, window.location.href);
    if (
      actionUrl.origin !== window.location.origin &&
      catalog.credentialMode === "same-origin-cookies"
    ) {
      return {
        ok: false,
        status: 0,
        message: "This action is misconfigured for cross-origin use.",
      };
    }
  }

  // FR-021 — 15 s AbortController on every fetch.  Fixed, not
  // configurable via catalog or config.
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

  // FR-015a — single fetch, no retry loop.
  let res: Response;
  try {
    res = await fetch(built.url, built.init);
  } catch (err) {
    clearTimer(timeoutHandle as Parameters<typeof clearTimer>[0]);
    if ((err as Error).name === "AbortError") {
      return {
        ok: false,
        status: 0,
        message: "The action timed out. Try asking again.",
      };
    }
    return {
      ok: false,
      status: 0,
      message: "Can't reach the host right now. Please try again.",
    };
  }
  clearTimer(timeoutHandle as Parameters<typeof clearTimer>[0]);

  return handleResponse(entry, intent, res);
}
