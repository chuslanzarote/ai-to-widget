/**
 * @vitest-environment jsdom
 *
 * T056 — Credential sovereignty integration test (SC-003, Principle I).
 *
 * Structural proof that when the widget executes an action via the
 * action-executors catalog:
 *  - the fetch targets the HOST (apiBaseUrl/*) — never the ATW backend
 *    (backendUrl/*).
 *  - the fetch carries `credentials: "include"` so the shopper's
 *    host-domain cookie attaches (at the browser level — mocked here).
 *  - follow-up traffic to the ATW backend (postActionFollowUp)
 *    contains ZERO occurrences of the shopper's cookie, the
 *    `Cookie` header, or any Authorization / X-*-Token / X-*-Session
 *    header.
 *
 * Principle I red-line: credentials MUST NEVER transit atw_backend.
 * That invariant is enforced by (a) the widget's build-time catalog
 * schema refusing credential-class headers, (b) `credentials: "omit"`
 * on follow-up calls, and (c) the backend's credential-strip
 * `onRequest` hook from Feature 003. This test pins (a) + (b) at the
 * widget level; the backend-side (c) is covered by the Docker-gated
 * runtime-credential-sovereignty.test.ts.
 *
 * Why structural, not Docker: the leak would be a code-path change in
 * the widget, not a network config drift, so a fast unit-grade test is
 * the right tripwire.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { executeAction } from "../../packages/widget/src/api-client-action.js";
import { __setLoadedCatalogForTest } from "../../packages/widget/src/action-executors.js";
import type { WidgetConfig } from "../../packages/widget/src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorsCatalog } from "@atw/scripts/dist/lib/action-executors-types.js";

const BACKEND = "https://backend.atw.example";
const HOST = "https://shop.example";
const SHOPPER_COOKIE_VALUE = "shopper_session=st_e2e_deadbeef";

function cfg(): WidgetConfig {
  return {
    backendUrl: BACKEND,
    apiBaseUrl: HOST,
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
    actionExecutorsUrl: `${HOST}/atw/action-executors.json`,
  };
}

function intent(): ActionIntent {
  return {
    id: "act-sovereignty-1",
    tool: "add_to_cart",
    arguments: { cart_id: "c1", variant_id: "var_X", quantity: 1 },
    description: "Add 1 × variant-X",
    confirmation_required: true,
    http: { method: "POST", path: "/store/carts/c1/line-items" },
    summary: { variant: "var_X", quantity: "1" },
  };
}

const CATALOG: ActionExecutorsCatalog = {
  version: 1,
  credentialMode: "same-origin-cookies",
  actions: [
    {
      tool: "add_to_cart",
      method: "POST",
      pathTemplate: "/store/carts/{cart_id}/line-items",
      substitution: {
        path: { cart_id: "arguments.cart_id" },
        body: {
          variant_id: "arguments.variant_id",
          quantity: "arguments.quantity",
        },
        query: {},
      },
      headers: { "content-type": "application/json" },
      responseHandling: {
        successStatuses: [200, 201, 204],
        summaryTemplate: "Added {quantity} × {variant_id}.",
        summaryFields: [],
      },
    },
  ],
};

interface RecordedCall {
  url: string;
  init: RequestInit;
}

describe("credential sovereignty (T056 / SC-003, Principle I)", () => {
  let calls: RecordedCall[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __setLoadedCatalogForTest(CATALOG);
    calls = [];
    fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      // Respond 201 for host API, 202 for backend follow-ups; either way
      // we just capture headers.
      return {
        ok: true,
        status: url.startsWith(HOST) ? 201 : 202,
        text: async () =>
          JSON.stringify({ cart: { total: 3980, items: 1 } }),
      } as unknown as Response;
    });
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
    // Pin window.location to the HOST origin so the widget's runtime
    // cross-origin guard (api-client-action.ts) treats apiBaseUrl as
    // same-origin. In production the widget ships inside the host page,
    // so this matches reality; jsdom defaults to http://localhost:3000,
    // which would otherwise trip the guard before any fetch fires.
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL(HOST + "/"),
    });
    // Simulate a same-origin cookie being set on document; browsers
    // include it automatically on `credentials: "include"`. jsdom does
    // not attach it to the mocked fetch — the test only asserts the
    // structural `credentials: "include"` flag.
    Object.defineProperty(document, "cookie", {
      value: SHOPPER_COOKIE_VALUE,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    __setLoadedCatalogForTest(null);
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("executeAction fires fetch against HOST, not the ATW backend", async () => {
    const out = await executeAction(intent(), cfg());
    expect(out.ok).toBe(true);

    const hostCalls = calls.filter((c) => c.url.startsWith(HOST));
    const backendCalls = calls.filter((c) => c.url.startsWith(BACKEND));

    expect(hostCalls.length).toBeGreaterThanOrEqual(1);
    // There may be 0 or 1 backend calls from the follow-up ping
    // (postActionFollowUp). Either way the HOST call is where the
    // shopper's credentials attach, NOT the backend.
    const actionCall = hostCalls.find((c) =>
      c.url.includes("/store/carts/c1/line-items"),
    );
    expect(actionCall).toBeDefined();
  });

  it("host-bound fetch uses credentials: 'omit' (Feature 007 — widget never auto-attaches cookies)", async () => {
    // Feature 007 changed the contract: the widget always sends
    // `credentials: "omit"` and lets the manifest's credentialSource
    // block declare any explicit auth header. The host-domain cookie
    // never piggybacks on widget traffic — all credentialed flows go
    // through an explicit declaration.
    await executeAction(intent(), cfg());
    const actionCall = calls.find((c) =>
      c.url.startsWith(HOST) && c.url.includes("/line-items"),
    );
    expect(actionCall).toBeDefined();
    expect(actionCall!.init.credentials).toBe("omit");
  });

  it("host-bound fetch carries no Authorization / Cookie headers (browser attaches cookie, not widget)", async () => {
    await executeAction(intent(), cfg());
    const actionCall = calls.find((c) =>
      c.url.startsWith(HOST) && c.url.includes("/line-items"),
    );
    const headers = (actionCall!.init.headers ?? {}) as Record<string, string>;
    for (const k of Object.keys(headers)) {
      expect(
        k.toLowerCase(),
        `widget must not template credential-class header "${k}"`,
      ).not.toMatch(
        /^(authorization|cookie|x-.*-(token|auth|session))$/,
      );
    }
  });

  it("backend-bound follow-up traffic contains ZERO shopper cookie value", async () => {
    await executeAction(intent(), cfg());
    const backendCalls = calls.filter((c) => c.url.startsWith(BACKEND));
    // There may be 0 or 1 follow-up pings; whichever the widget emits,
    // it MUST NOT leak the shopper cookie.
    for (const c of backendCalls) {
      const serialised = JSON.stringify(c.init);
      expect(serialised).not.toContain("st_e2e_deadbeef");
      expect(serialised).not.toContain("shopper_session");
      const headers = (c.init.headers ?? {}) as Record<string, string>;
      for (const [k, v] of Object.entries(headers)) {
        expect(
          k.toLowerCase(),
          `backend call must not carry credential-class header "${k}"`,
        ).not.toMatch(/^(authorization|cookie|x-.*-(token|auth|session))$/);
        expect(
          String(v),
          `backend header "${k}" leaks shopper cookie value`,
        ).not.toContain("st_e2e_deadbeef");
      }
    }
  });

  it("backend-bound follow-up (if any) uses credentials: 'omit' or 'same-origin', never 'include'", async () => {
    await executeAction(intent(), cfg());
    const backendCalls = calls.filter((c) => c.url.startsWith(BACKEND));
    for (const c of backendCalls) {
      // If explicit, it must be one of the non-include modes.
      if (c.init.credentials) {
        expect(c.init.credentials).not.toBe("include");
      }
    }
  });
});
