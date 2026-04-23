import { HostApiError } from "./errors.js";
import type { RuntimeToolDescriptor } from "../tools.js";

/**
 * Safe-read tool executor. Runs server-side against the host API with
 * `HOST_API_KEY` (or no credentials when unset) — NEVER with shopper
 * credentials. Contract: specs/003-runtime/contracts/chat-endpoint.md §5.
 *
 * Body is truncated to 4 KB before being returned as tool_result so a
 * chatty host API cannot blow up the Opus context window.
 */
const BODY_LIMIT = 4 * 1024;
const TIMEOUT_MS = 8_000;

export interface SafeReadRequest {
  tool: RuntimeToolDescriptor;
  resolvedPath: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  hostApiBaseUrl: string;
  hostApiKey: string | null;
}

export interface SafeReadResult {
  status: number;
  body: string;
  truncated: boolean;
}

export async function executeSafeRead(
  req: SafeReadRequest,
): Promise<SafeReadResult> {
  if (!req.hostApiBaseUrl) throw new HostApiError();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (req.body) headers["Content-Type"] = "application/json";
  if (req.hostApiKey) headers["Authorization"] = `Bearer ${req.hostApiKey}`;
  const url = req.hostApiBaseUrl.replace(/\/$/, "") + "/" + req.resolvedPath.replace(/^\//, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    const truncated = text.length > BODY_LIMIT;
    return {
      status: res.status,
      body: truncated ? text.slice(0, BODY_LIMIT) : text,
      truncated,
    };
  } catch (err) {
    throw new HostApiError();
  } finally {
    clearTimeout(timer);
  }
}
