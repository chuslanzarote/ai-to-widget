import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { postChat } from "../src/api-client.js";
import type { WidgetConfig } from "../src/config.js";
import type { ChatRequest } from "@atw/scripts/dist/lib/types.js";

function cfg(): WidgetConfig {
  return {
    backendUrl: "http://backend.local",
    apiBaseUrl: "http://host.local",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: [],
  };
}

const baseRequest: ChatRequest = {
  message: "hi",
  history: [],
  context: { locale: "en-US" },
};

function mockFetch(
  handler: (
    url: string,
    init: RequestInit,
  ) => { status: number; body: unknown; ok?: boolean },
): ReturnType<typeof vi.fn> {
  const m = vi.fn(async (url: string, init: RequestInit) => {
    const { status, body } = handler(url, init);
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => text,
    } as unknown as Response;
  });
  (globalThis as unknown as { fetch: typeof fetch }).fetch = m as unknown as typeof fetch;
  return m;
}

describe("postChat (T042 / Principle I)", () => {
  beforeEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });
  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("attaches X-Atw-Session-Id and no Authorization/Cookie headers", async () => {
    const calls: Array<{ init: RequestInit }> = [];
    mockFetch((_u, init) => {
      calls.push({ init });
      return {
        status: 200,
        body: {
          message: "hi there",
          citations: [],
          actions: [],
          request_id: "r1",
        },
      };
    });
    const res = await postChat(baseRequest, cfg(), "sid-99");
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
    const hdr = calls[0].init.headers as Record<string, string>;
    expect(hdr["X-Atw-Session-Id"]).toBe("sid-99");
    expect(hdr["Content-Type"]).toBe("application/json");
    expect(Object.keys(hdr).map((k) => k.toLowerCase())).not.toContain("authorization");
    expect(Object.keys(hdr).map((k) => k.toLowerCase())).not.toContain("cookie");
    // Important: never include credentials for the backend URL.
    expect(calls[0].init.credentials).not.toBe("include");
  });

  it("surfaces backend error_code on non-2xx", async () => {
    mockFetch(() => ({
      status: 429,
      body: {
        error_code: "rate_limited",
        message: "slow down",
        request_id: "r2",
        retry_after_seconds: 30,
      },
    }));
    const res = await postChat(baseRequest, cfg(), "sid");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(429);
      expect(res.error_code).toBe("rate_limited");
      expect(res.retry_after_seconds).toBe(30);
    }
  });

  it("rejects structurally-invalid 200 body with a friendly error", async () => {
    mockFetch(() => ({
      status: 200,
      body: { not_a_chat_response: true },
    }));
    const res = await postChat(baseRequest, cfg(), "sid");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toMatch(/unexpected shape/i);
    }
  });

  it("surfaces a network error without throwing", async () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = (async () => {
      throw new TypeError("network down");
    }) as unknown as typeof fetch;
    const res = await postChat(baseRequest, cfg(), "sid");
    expect(res.ok).toBe(false);
  });
});
