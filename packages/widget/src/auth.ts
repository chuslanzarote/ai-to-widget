import type { WidgetConfig } from "./config.js";

/**
 * Widget authentication header builder. Source:
 * specs/003-runtime/contracts/widget-config.md §5.
 *
 * Invariant: auth headers are produced ONLY for calls targeting the host
 * API (`apiBaseUrl`). Calls to the ATW backend (`backendUrl`) never carry
 * shopper credentials; use `buildBackendHeaders(config, sessionId)` for
 * those — it intentionally does not read `auth.ts`.
 */
export type AuthProvider = () => Promise<Record<string, string>>;

declare global {
  interface Window {
    AtwAuthProvider?: AuthProvider;
  }
}

export interface HostRequestInit {
  headers: Record<string, string>;
  fetchInit: RequestInit;
}

export async function buildHostApiRequest(
  config: WidgetConfig,
  init: { body?: BodyInit; method?: string; contentType?: string } = {},
): Promise<HostRequestInit> {
  const headers: Record<string, string> = {};
  if (init.contentType) headers["Content-Type"] = init.contentType;
  const fetchInit: RequestInit = {
    method: init.method ?? "GET",
    body: init.body,
    credentials: "omit",
  };
  if (config.authMode === "cookie") {
    fetchInit.credentials = "include";
  } else if (config.authMode === "bearer") {
    const key = config.authTokenKey;
    if (key && typeof window !== "undefined") {
      const token = window.localStorage.getItem(key);
      if (token && token.length > 0) headers["Authorization"] = `Bearer ${token}`;
    }
  } else {
    // custom
    const provider = typeof window !== "undefined" ? window.AtwAuthProvider : undefined;
    if (typeof provider !== "function") {
      const err = new Error(
        "AtwAuthProvider is not defined. data-auth-mode=custom requires window.AtwAuthProvider to be set before any action executes.",
      );
      (err as { code?: string }).code = "ATW_AUTH_PROVIDER_MISSING";
      throw err;
    }
    const extra = await provider();
    for (const [k, v] of Object.entries(extra)) headers[k] = v;
  }
  fetchInit.headers = headers;
  return { headers, fetchInit };
}

export function buildBackendHeaders(
  sessionId: string,
  extra?: Record<string, string>,
): Record<string, string> {
  // Structural guarantee: NO Authorization / Cookie header ever in here.
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Atw-Session-Id": sessionId,
  };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      const lower = k.toLowerCase();
      if (lower === "authorization" || lower === "cookie") continue;
      base[k] = v;
    }
  }
  return base;
}
