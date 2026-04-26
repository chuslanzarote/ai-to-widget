/** @jsxImportSource preact */
/**
 * T074 / US6 — Chat-only boot fallback (FR-014, SC-005).
 *
 * Pins that when `actionExecutorsUrl` returns 404 (or any non-2xx):
 *
 *   1. `loadExecutorsCatalog` resolves without throwing and logs a
 *      warning — the fire-and-forget call in index.ts's `init()` must
 *      NEVER bubble a rejection out of the bootstrap.
 *   2. The cached catalog is `null`, not a half-parsed value.
 *   3. The launcher button still mounts; the user sees the widget.
 *   4. The ChatPanel renders a dialog ready to accept chat messages.
 *   5. No action-confirmation card is visible in the DOM — there is no
 *      pending ActionIntent, and the widget has no catalog to execute
 *      against anyway.
 *
 * `loadExecutorsCatalog` already has a dedicated contract test
 * (action-executors-loader.unit.test.ts) that covers its internal
 * error paths exhaustively. T074 complements that by asserting the
 * *boot path as a whole* survives the failure — i.e. the integration
 * of loader + launcher + panel is chat-only-safe when the catalog is
 * absent. This is the unit-level twin of T073 (scripts-side empty
 * manifest) and of T069 (live docker e2e).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/preact";
import { h } from "preact";

import {
  loadExecutorsCatalog,
  getLoadedCatalog,
  __setLoadedCatalogForTest,
} from "../src/action-executors.js";
import { mountLauncher } from "../src/launcher.js";
import { ChatPanel } from "../src/panel.js";
import { open, sessionId, turns, actionCapable } from "../src/state.js";
import type { WidgetConfig } from "../src/config.js";

function cfg(overrides: Partial<WidgetConfig> = {}): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "https://shop.example.com",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
    actionExecutorsUrl: "https://shop.example.com/action-executors.json",
    ...overrides,
  };
}

describe("widget chat-only fallback (T074 / US6, FR-014, SC-005)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __setLoadedCatalogForTest(null);
    actionCapable.value = false;
    open.value = false;
    turns.value = [];
    sessionId.value = "t074-session";

    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    __setLoadedCatalogForTest(null);
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
    warnSpy.mockRestore();
    open.value = false;
    turns.value = [];
    // Purge any DOM the launcher mounted so the next test starts clean.
    document.body.innerHTML = "";
  });

  it("catalog 404 → loader never throws, warns, catalog stays null", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    });

    // The fire-and-forget call in index.ts must not reject. Calling it
    // explicitly here covers the same surface without re-importing
    // index.ts (which auto-runs `init()` at module-load time).
    await expect(loadExecutorsCatalog(cfg())).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getLoadedCatalog()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("catalog 404 → launcher still mounts and ChatPanel renders", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    });

    await loadExecutorsCatalog(cfg());
    expect(getLoadedCatalog()).toBeNull();

    const launcher = mountLauncher(cfg(), document.body);
    expect(launcher).toBeInstanceOf(HTMLButtonElement);
    expect(launcher.classList.contains("atw-launcher")).toBe(true);
    expect(launcher.disabled).toBe(false);
    expect(document.body.contains(launcher)).toBe(true);

    // Open the panel so we can inspect its DOM shape.
    open.value = true;
    const { container } = render(h(ChatPanel, { config: cfg() }));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // Feature 009 / FR-027 — panel coexists with host-page interaction;
    // it is intentionally NOT aria-modal (no backdrop, no focus trap).
  });

  it("catalog 404 → no action-confirmation card renders (chat-only UI)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    });
    await loadExecutorsCatalog(cfg());

    open.value = true;
    const { container } = render(h(ChatPanel, { config: cfg() }));

    // No pending ActionIntent + no catalog entries → the action-card
    // element must not be in the DOM. A future refactor that mounts an
    // empty-state card by default fails this test.
    expect(container.querySelector(".atw-action-card")).toBeNull();
    expect(container.querySelector("[data-atw-action-confirm]")).toBeNull();
  });

  it("network error (fetch rejects) → same chat-only outcome", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(loadExecutorsCatalog(cfg())).resolves.toBeUndefined();
    expect(getLoadedCatalog()).toBeNull();
    expect(warnSpy).toHaveBeenCalled();

    const launcher = mountLauncher(cfg(), document.body);
    expect(launcher.disabled).toBe(false);
  });

  it("T076 — actionCapable signal stays false after 404", async () => {
    // Seed to a pathological true so the assertion proves the loader
    // actively cleared it (not just that it defaulted false).
    actionCapable.value = true;

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    });
    await loadExecutorsCatalog(cfg());
    expect(actionCapable.value).toBe(false);
  });

  it("T076 — actionCapable signal is false for a valid-but-empty catalog", async () => {
    // A `{actions: []}` catalog is valid — no retry, no warning —
    // but from the UI's perspective it is chat-only, so `actionCapable`
    // must be false. Downstream action-card gating reads this.
    actionCapable.value = true;
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
    expect(actionCapable.value).toBe(false);
  });

  it("T076 — actionCapable signal is true when catalog has ≥1 action", async () => {
    actionCapable.value = false;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        version: 1,
        credentialMode: "same-origin-cookies",
        actions: [
          {
            tool: "add_to_cart",
            method: "POST",
            pathTemplate: "/store/carts/{cart_id}/line-items",
            substitution: {
              path: { cart_id: "arguments.cart_id" },
              body: { variant_id: "arguments.variant_id" },
              query: {},
            },
            headers: { "content-type": "application/json" },
            responseHandling: {
              successStatuses: [200],
              summaryTemplate: "Added.",
              summaryFields: [],
            },
          },
        ],
      }),
    });
    await loadExecutorsCatalog(cfg());
    expect(actionCapable.value).toBe(true);
  });
});
