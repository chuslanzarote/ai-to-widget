import { clearToken, getToken } from "../auth/token";

const API_PREFIX = "/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(
      typeof (body as { error?: string })?.error === "string"
        ? ((body as { error?: string }).error as string)
        : `HTTP ${status}`,
    );
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token && token.length > 0) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(API_PREFIX + path, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  const ct = res.headers.get("content-type") ?? "";
  const parsed = ct.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401) {
      clearToken();
      if (typeof window !== "undefined" && !window.location.pathname.endsWith("/login")) {
        window.location.assign("/login");
      }
    }
    throw new ApiError(res.status, parsed);
  }
  return parsed as T;
}
