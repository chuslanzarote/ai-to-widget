import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildBackendHeaders, buildHostApiRequest } from "../src/auth.js";
import type { WidgetConfig } from "../src/config.js";

function cfg(over: Partial<WidgetConfig>): WidgetConfig {
  return {
    backendUrl: "http://backend.local",
    apiBaseUrl: "http://host.local",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart", "list_products"],
    ...over,
  };
}

describe("buildBackendHeaders (T025 / Principle I structural)", () => {
  it("attaches only content-type and session id", () => {
    const h = buildBackendHeaders("sid-1");
    expect(h["X-Atw-Session-Id"]).toBe("sid-1");
    expect(h["Content-Type"]).toBe("application/json");
    expect(h["Authorization"]).toBeUndefined();
    expect(h["Cookie"]).toBeUndefined();
  });

  it("refuses extra Authorization / Cookie even when caller passes them", () => {
    const h = buildBackendHeaders("sid-2", {
      Authorization: "Bearer leaked",
      Cookie: "session=leaked",
      "X-Custom": "fine",
    });
    expect(h["Authorization"]).toBeUndefined();
    expect(h["Cookie"]).toBeUndefined();
    expect(h["X-Custom"]).toBe("fine");
  });
});

describe("buildHostApiRequest (T025 / FR-022)", () => {
  beforeEach(() => {
    (globalThis as unknown as { window: Window }).window = {
      localStorage: {
        _m: new Map<string, string>(),
        getItem(k: string) {
          return (this as unknown as { _m: Map<string, string> })._m.get(k) ?? null;
        },
        setItem(k: string, v: string) {
          (this as unknown as { _m: Map<string, string> })._m.set(k, v);
        },
        removeItem(k: string) {
          (this as unknown as { _m: Map<string, string> })._m.delete(k);
        },
        clear() {
          (this as unknown as { _m: Map<string, string> })._m.clear();
        },
        key() {
          return null;
        },
        length: 0,
      } as unknown as Storage,
    } as unknown as Window;
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("cookie mode sets credentials include and no Authorization header", async () => {
    const r = await buildHostApiRequest(cfg({ authMode: "cookie" }));
    expect(r.fetchInit.credentials).toBe("include");
    expect(r.headers["Authorization"]).toBeUndefined();
  });

  it("bearer mode attaches token from localStorage and re-reads on every call", async () => {
    const c = cfg({ authMode: "bearer", authTokenKey: "my.token" });
    (globalThis as unknown as { window: Window }).window.localStorage.setItem(
      "my.token",
      "tok-abc",
    );
    const r1 = await buildHostApiRequest(c);
    expect(r1.headers["Authorization"]).toBe("Bearer tok-abc");
    (globalThis as unknown as { window: Window }).window.localStorage.setItem(
      "my.token",
      "tok-def",
    );
    const r2 = await buildHostApiRequest(c);
    expect(r2.headers["Authorization"]).toBe("Bearer tok-def");
    expect(r1.fetchInit.credentials).toBe("omit");
  });

  it("bearer mode without a token produces no Authorization header", async () => {
    const r = await buildHostApiRequest(
      cfg({ authMode: "bearer", authTokenKey: "absent.token" }),
    );
    expect(r.headers["Authorization"]).toBeUndefined();
  });

  it("custom mode calls AtwAuthProvider and merges headers", async () => {
    const provider = vi.fn().mockResolvedValue({
      Authorization: "Bearer from-provider",
      "X-My": "val",
    });
    (globalThis as unknown as { window: Window & { AtwAuthProvider?: unknown } })
      .window.AtwAuthProvider = provider as unknown as () => Promise<
      Record<string, string>
    >;
    const r = await buildHostApiRequest(cfg({ authMode: "custom" }));
    expect(provider).toHaveBeenCalledTimes(1);
    expect(r.headers["Authorization"]).toBe("Bearer from-provider");
    expect(r.headers["X-My"]).toBe("val");
  });

  it("custom mode without provider throws ATW_AUTH_PROVIDER_MISSING", async () => {
    await expect(buildHostApiRequest(cfg({ authMode: "custom" }))).rejects.toMatchObject(
      { code: "ATW_AUTH_PROVIDER_MISSING" },
    );
  });
});
