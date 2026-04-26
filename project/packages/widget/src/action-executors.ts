/**
 * Widget-side action-execution engine.
 *
 * Feature 007 rewires the engine to:
 *   - Inject credentials per-operation via `credentialSource` (bearer
 *     token read from `localStorage`), replacing the cookie-only mode.
 *   - Bound the fetch at 8 s (FR-015 Feature 007 — shorter than the
 *     legacy 15 s because the shopper is waiting inside the widget for
 *     Opus's next pass).
 *
 * Contracts:
 *   - specs/006-openapi-action-catalog/contracts/widget-executor-engine.md
 *   - specs/007-widget-tool-loop/contracts/action-catalog-v2.md
 */
import type { WidgetConfig } from "./config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ExecuteActionOutcome } from "./api-client-action.js";
import {
  ActionExecutorsCatalogSchema,
  type ActionExecutorsCatalog,
  type ActionExecutorEntry,
} from "@atw/scripts/dist/lib/action-executors-types.js";
import { resolveCredential } from "./auth/token-source.js";
import { actionCapable } from "./state.js";

/** Feature 007 — 8 s deadline on each shop fetch (spec FR-015). */
export const ACTION_FETCH_TIMEOUT_MS = 8_000;

/** Feature 007 — BODY_LIMIT on the `tool_result.content` the widget posts back. */
export const TOOL_RESULT_BODY_LIMIT_BYTES = 4096;

let executorsCatalog: ActionExecutorsCatalog | null = null;

export function getLoadedCatalog(): ActionExecutorsCatalog | null {
  return executorsCatalog;
}

/**
 * Test helper — direct state injection so contract/unit tests can
 * pre-seed a catalog without booting the full loader. Must not be
 * called from app code.
 */
export function __setLoadedCatalogForTest(
  c: ActionExecutorsCatalog | null,
): void {
  executorsCatalog = c;
  actionCapable.value = c !== null && c.actions.length > 0;
}

function widgetBundleOrigin(): string {
  if (typeof window !== "undefined" && window.location) {
    return window.location.origin;
  }
  return "";
}

export async function loadExecutorsCatalog(
  _config: WidgetConfig,
): Promise<void> {
  const url = `${widgetBundleOrigin()}/action-executors.json`;
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) {
      console.warn(
        `[atw] action-executors fetch returned HTTP ${res.status}; falling back to chat-only`,
      );
      executorsCatalog = null;
      actionCapable.value = false;
      return;
    }
    const body: unknown = await res.json();
    const parsed = ActionExecutorsCatalogSchema.safeParse(body);
    if (!parsed.success) {
      console.warn(
        "[atw] action-executors catalog is malformed; falling back to chat-only",
        parsed.error,
      );
      executorsCatalog = null;
      actionCapable.value = false;
      return;
    }
    if (parsed.data.version !== 1) {
      console.warn(
        `[atw] action-executors version ${parsed.data.version} unsupported; falling back to chat-only`,
      );
      executorsCatalog = null;
      actionCapable.value = false;
      return;
    }
    executorsCatalog = parsed.data;
    // T076 / FR-014 — a valid-but-empty catalog is still chat-only from
    // the UI's perspective. Downstream action-confirmation surfaces gate
    // on `actionCapable`, not on `executorsCatalog !== null`.
    actionCapable.value = parsed.data.actions.length > 0;
  } catch (err) {
    console.warn(
      "[atw] could not load action-executors; falling back to chat-only",
      err,
    );
    executorsCatalog = null;
    actionCapable.value = false;
  }
}

/**
 * Single code path that reads a catalog-derived substitution string.
 * Body is *exactly* a regex guard + `slice` + property lookup — any
 * dotted path or bracket expression is rejected. Loader Zod already
 * guarantees this shape; the guard here is belt-and-braces.
 */
export function resolveSubstitutionSource(
  src: string,
  intent: ActionIntent,
): unknown {
  if (!/^arguments\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(src)) {
    throw new Error(`invalid substitution source: ${src}`);
  }
  const key = src.slice("arguments.".length);
  return intent.arguments?.[key];
}

export interface BuildRequestResult {
  url: string;
  init: RequestInit;
  validationError?: string;
}

const PLACEHOLDER_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export function buildRequestFromEntry(
  entry: ActionExecutorEntry,
  intent: ActionIntent,
  config: WidgetConfig,
): BuildRequestResult {
  // 1. Path substitution.
  let resolvedPath = entry.pathTemplate;
  const placeholders: string[] = [];
  let match: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((match = PLACEHOLDER_RE.exec(entry.pathTemplate)) !== null) {
    placeholders.push(match[1]);
  }
  for (const id of placeholders) {
    const src = entry.substitution.path[id];
    if (!src) {
      return {
        url: "",
        init: {},
        validationError: `catalog missing path substitution for "${id}"`,
      };
    }
    const value = resolveSubstitutionSource(src, intent);
    if (value === undefined || value === null) {
      return {
        url: "",
        init: {},
        validationError: `missing required path argument "${id}"`,
      };
    }
    resolvedPath = resolvedPath.replace(
      `{${id}}`,
      encodeURIComponent(String(value)),
    );
  }

  // 2. Query substitution.
  const queryPairs: Array<[string, string]> = [];
  for (const [k, src] of Object.entries(entry.substitution.query)) {
    const v = resolveSubstitutionSource(src, intent);
    if (v === undefined || v === null) continue;
    queryPairs.push([k, String(v)]);
  }
  const queryString =
    queryPairs.length > 0
      ? "?" +
        queryPairs
          .map(
            ([k, v]) =>
              `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
          )
          .join("&")
      : "";

  // 3. Body substitution — skipped for GET/HEAD.
  const method = entry.method.toUpperCase();
  const isGetOrHead = method === "GET" || method === "HEAD";
  let bodyPayload: Record<string, unknown> | undefined;
  if (!isGetOrHead) {
    bodyPayload = {};
    for (const [k, src] of Object.entries(entry.substitution.body)) {
      const v = resolveSubstitutionSource(src, intent);
      if (v === undefined) continue;
      bodyPayload[k] = v;
    }
  }

  // 4. URL assembly.
  const base = config.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}${resolvedPath}${queryString}`;

  // 5. RequestInit assembly.
  const headers: Record<string, string> = { ...entry.headers };
  if (entry.credentialSource) {
    const resolved = resolveCredential(entry.credentialSource);
    if (!resolved) {
      return {
        url: "",
        init: {},
        validationError: "not authenticated",
      };
    }
    headers[resolved.header] = resolved.value;
  }
  const init: RequestInit = {
    method,
    headers,
    // Feature 007: never auto-attach cookies. Credentials flow only
    // through the explicit `credentialSource` block.
    credentials: "omit",
  };
  if (bodyPayload !== undefined) {
    init.body = JSON.stringify(bodyPayload);
  }

  return { url, init };
}

export function renderSummary(
  entry: ActionExecutorEntry,
  intent: ActionIntent,
  body: unknown,
): string {
  return entry.responseHandling.summaryTemplate.replace(
    /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
    (_match, name: string) => {
      const fromBody = isObject(body)
        ? (body as Record<string, unknown>)[name]
        : undefined;
      if (fromBody !== undefined) return String(fromBody);
      const fromArgs = intent.arguments?.[name];
      if (fromArgs !== undefined) return String(fromArgs);
      return `{${name}}`;
    },
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function handleResponse(
  entry: ActionExecutorEntry,
  intent: ActionIntent,
  res: Response,
): Promise<ExecuteActionOutcome> {
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text.length > 0 ? JSON.parse(text) : undefined;
  } catch {
    // keep raw string on parse failure
  }
  if (entry.responseHandling.successStatuses.includes(res.status)) {
    return {
      ok: true,
      status: res.status,
      summary: renderSummary(entry, intent, parsed),
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
  const errorField = entry.responseHandling.errorMessageField;
  if (
    errorField &&
    isObject(parsed) &&
    typeof (parsed as Record<string, unknown>)[errorField] === "string"
  ) {
    return {
      ok: false,
      status: res.status,
      message: (parsed as Record<string, unknown>)[errorField] as string,
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

/**
 * Feature 007 — payload shape posted back to `/v1/chat` in the
 * `tool_result` field. Mirrors the Anthropic `tool_result` block
 * shape so the backend can forward it verbatim.
 */
export interface ToolResultPayload {
  tool_use_id: string;
  /**
   * Feature 008 (v3) — the operationId the widget executed. Required
   * so the backend can synthesize the assistant tool_use turn it
   * never received (the widget's conversation is string-content only).
   */
  tool_name: string;
  /**
   * Feature 008 (v3) — the arguments the widget actually fetched with,
   * reflecting any shopper confirmation-card edits.
   */
  tool_input: Record<string, unknown>;
  content: string;
  is_error: boolean;
  status: number;
  truncated: boolean;
}

/**
 * Truncate an arbitrary string to the FR-015 body limit. Works in
 * bytes (UTF-8) rather than characters so the backend's 4 KiB cap is
 * respected even for non-ASCII payloads.
 */
export function truncateToBodyLimit(s: string): {
  content: string;
  truncated: boolean;
} {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(s);
  if (bytes.byteLength <= TOOL_RESULT_BODY_LIMIT_BYTES) {
    return { content: s, truncated: false };
  }
  // Binary search on code-unit boundary so we never split a UTF-16
  // surrogate pair at the cut.
  let lo = 0;
  let hi = s.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (encoder.encode(s.slice(0, mid)).byteLength <= TOOL_RESULT_BODY_LIMIT_BYTES) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return { content: s.slice(0, lo), truncated: true };
}

