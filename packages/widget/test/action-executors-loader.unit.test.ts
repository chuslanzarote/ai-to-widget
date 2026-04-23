/**
 * T049 — Widget unit test for the action-executors catalog loader.
 *
 * Covers contracts/widget-executor-engine.md §1:
 *  - valid JSON + Zod-valid body → catalog cached in memory.
 *  - malformed body, version !== 1, network error → null; warning logged.
 *  - fetch is called with `credentials: "omit"` (R5: the catalog is a
 *    public artefact — never a credentialed call).
 *  - NO automatic retry: exactly one fetch per loader invocation, under
 *    every failure mode. (FR-015a)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { WidgetConfig } from "../src/config.js";
import {
  loadExecutorsCatalog,
  getLoadedCatalog,
  __setLoadedCatalogForTest,
} from "../src/action-executors.js";

function cfg(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "https://shop.example.com",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
    actionExecutorsUrl: "https://shop.example.com/atw/action-executors.json",
    ...overrides,
  };
}

const VALID_CATALOG = {
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
        summaryTemplate: "Added {quantity} × {variant_id} to cart.",
        summaryFields: [],
      },
    },
  ],
};

describe("loadExecutorsCatalog (T049)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __setLoadedCatalogForTest(null);
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    __setLoadedCatalogForTest(null);
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
    warnSpy.mockRestore();
  });

  it("valid JSON + Zod-valid body → catalog cached, version 1, 1 action", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => VALID_CATALOG,
    });

    await loadExecutorsCatalog(cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const got = getLoadedCatalog();
    expect(got).not.toBeNull();
    expect(got!.version).toBe(1);
    expect(got!.credentialMode).toBe("same-origin-cookies");
    expect(got!.actions).toHaveLength(1);
    expect(got!.actions[0].tool).toBe("add_to_cart");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("fetch passes credentials: 'omit' (R5: public artefact)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => VALID_CATALOG,
    });

    await loadExecutorsCatalog(cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe("omit");
  });

  it("fetches from config.actionExecutorsUrl verbatim", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => VALID_CATALOG,
    });

    await loadExecutorsCatalog(
      cfg({
        actionExecutorsUrl: "https://shop.example.com/static/action-executors.json",
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://shop.example.com/static/action-executors.json",
      expect.objectContaining({ credentials: "omit" }),
    );
  });

  it("malformed JSON (SyntaxError) → catalog null, warning logged, no retry", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("unexpected token < in JSON");
      },
    });

    await loadExecutorsCatalog(cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getLoadedCatalog()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("version !== 1 → catalog null, warning logged, no retry", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ...VALID_CATALOG, version: 2 }),
    });

    await loadExecutorsCatalog(cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getLoadedCatalog()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("Zod-invalid shape (wrong credentialMode) → catalog null, warning", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        version: 1,
        credentialMode: "some-other-mode",
        actions: [],
      }),
    });

    await loadExecutorsCatalog(cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getLoadedCatalog()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("Zod-invalid action entry (forbidden Authorization header) → null", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        version: 1,
        credentialMode: "same-origin-cookies",
        actions: [
          {
            ...VALID_CATALOG.actions[0],
            headers: { Authorization: "Bearer leaked-token" },
          },
        ],
      }),
    });

    await loadExecutorsCatalog(cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getLoadedCatalog()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("non-2xx HTTP response → catalog null, warning, no retry", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    });

    await loadExecutorsCatalog(cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getLoadedCatalog()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("network error (fetch rejects) → catalog null, warning, no retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await loadExecutorsCatalog(cfg());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getLoadedCatalog()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("empty catalog (actions: []) → loads successfully as chat-only baseline", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        version: 1,
        credentialMode: "same-origin-cookies",
        actions: [],
      }),
    });

    await loadExecutorsCatalog(cfg());

    const got = getLoadedCatalog();
    expect(got).not.toBeNull();
    expect(got!.actions).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
