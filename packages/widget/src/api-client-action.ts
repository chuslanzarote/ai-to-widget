import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { WidgetConfig } from "./config.js";
import { buildHostApiRequest } from "./auth.js";

/**
 * Execute a confirmed action against the host API. Tool-name allowlist
 * is enforced here as a hard gate — any ActionIntent with an unknown
 * tool name throws ATW_TOOL_NOT_ALLOWED and does not fetch. Contract:
 * specs/003-runtime/contracts/widget-config.md §4 + FR-021, FR-040.
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

  const body = intent.http.method === "GET" ? undefined : JSON.stringify(intent.arguments);
  const req = await buildHostApiRequest(config, {
    method: intent.http.method,
    body,
    contentType: body ? "application/json" : undefined,
  });

  const url =
    config.apiBaseUrl.replace(/\/$/, "") + "/" + intent.http.path.replace(/^\//, "");

  let res: Response;
  try {
    res = await fetch(url, req.fetchInit);
  } catch (err) {
    return {
      ok: false,
      status: 0,
      message: "Can't reach the host right now. Please try again.",
    };
  }

  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    // leave as raw string
  }

  if (res.ok) {
    return {
      ok: true,
      status: res.status,
      summary: summarise(intent, parsed),
      body: parsed,
    };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      status: res.status,
      message: "Please log in first for this action.",
      body: parsed,
    };
  }

  return {
    ok: false,
    status: res.status,
    message: "Something went wrong executing that. Please try again.",
    body: parsed,
  };
}

function summarise(intent: ActionIntent, _body: unknown): string {
  if (intent.summary && Object.keys(intent.summary).length > 0) {
    const pairs = Object.entries(intent.summary)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    return `${intent.description} — ${pairs}.`;
  }
  return intent.description;
}
