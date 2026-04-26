/** @jsxImportSource preact */
/**
 * T054 — HTML-escape invariant in the confirmation card.
 *
 * Covers contracts/widget-executor-engine.md §9 (FR-009a, SC-006).
 *
 * The confirmation card is the sole UI surface that renders
 * host-response-derived and intent-derived strings. ALL such strings
 * MUST render as JSX text children — never as `dangerouslySetInnerHTML`,
 * never via DOMParser, never via innerHTML assignment — so Preact's
 * default text-escape kicks in and attacker-controlled payloads
 * (`<script>alert(1)</script>`, `<img onerror=…>`) end up as literal
 * characters in the DOM, not as executable elements.
 *
 * This test is the positive-assertion half of the structural grep in
 * T055: it proves the escape actually fires in the real render.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/preact";
import { h } from "preact";
import { ActionCard } from "../src/action-card.js";
import { pendingAction, sessionId, turns } from "../src/state.js";
import {
  renderSummary,
  __setLoadedCatalogForTest,
} from "../src/action-executors.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorEntry } from "@atw/scripts/dist/lib/action-executors-types.js";

function cfg(): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "https://shop.example.com",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["add_to_cart"],
  };
}

function intent(
  overrides: Partial<ActionIntent> = {},
): ActionIntent {
  return {
    id: "act-1",
    tool: "add_to_cart",
    arguments: { variant_id: "v1", quantity: 1 },
    description: "Add 1 × v1",
    confirmation_required: true,
    http: { method: "POST", path: "/noop" },
    summary: { variant: "v1", quantity: "1" },
    ...overrides,
  };
}

describe("ActionCard HTML-escape — summary values (T054)", () => {
  beforeEach(() => {
    pendingAction.value = null;
    turns.value = [];
    sessionId.value = "test-session";
    __setLoadedCatalogForTest(null);
  });

  afterEach(() => {
    pendingAction.value = null;
    turns.value = [];
    __setLoadedCatalogForTest(null);
  });

  it("summary value `<script>alert(1)</script>` → no <script> element in DOM", () => {
    const payload = "<script>alert(1)</script>";
    const { container } = render(
      h(ActionCard, {
        intent: intent({ summary: { product: payload, quantity: "1" } }),
        config: cfg(),
      }),
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it("summary value `<img src=x onerror=...>` → no <img> element in DOM", () => {
    const payload = '<img src=x onerror="alert(1)">';
    const { container } = render(
      h(ActionCard, {
        intent: intent({ summary: { product: payload, quantity: "1" } }),
        config: cfg(),
      }),
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it("summary value `<b>bold</b>` → no <b> element in DOM, literal text", () => {
    const payload = "<b>bold</b>";
    const { container } = render(
      h(ActionCard, {
        intent: intent({ summary: { product: payload, quantity: "1" } }),
        config: cfg(),
      }),
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it("summary value `&amp;` stays literal (Preact does NOT double-unescape)", () => {
    const payload = "&amp;";
    const { container } = render(
      h(ActionCard, {
        intent: intent({ summary: { note: payload, quantity: "1" } }),
        config: cfg(),
      }),
    );
    // Raw HTML of the summary row contains the doubly-escaped form
    // because Preact escapes `&` → `&amp;`.
    const row = container.querySelector(".atw-action-card__summary-val");
    expect(row).not.toBeNull();
    // innerHTML doubly-escapes `&amp;` → `&amp;amp;`.
    expect(row!.innerHTML).toContain("&amp;amp;");
    // Displayed text (after parser unescape) is the literal `&amp;`.
    expect(row!.textContent).toBe(payload);
  });

  // Feature 009 / FR-022 removed `intent.description` from the title surface;
  // the title is now `summary_template` substitution or a deterministic
  // `tool_name (k=v, …)` fallback. Description-as-title HTML-escape is no
  // longer a real attack surface — there's nothing reading description into
  // the DOM. The remaining cases above pin escape on `summary` values, which
  // ARE still rendered.
});

describe("renderSummary placeholder resolution (T054)", () => {
  function entry(template: string): ActionExecutorEntry {
    return {
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
        summaryTemplate: template,
        summaryFields: [],
      },
    };
  }

  const baseIntent: ActionIntent = {
    id: "act-1",
    tool: "add_to_cart",
    arguments: {
      cart_id: "c1",
      variant_id: "Midnight Roast 1kg",
      quantity: 2,
    },
    description: "Add 2 × Midnight Roast 1kg",
    confirmation_required: true,
    http: { method: "POST", path: "/noop" },
    summary: {},
  };

  it("body value wins over arguments when both provide the field", () => {
    const summary = renderSummary(
      entry("Added {quantity} × {variant_id}."),
      baseIntent,
      { variant_id: "Midnight Roast 1kg (updated)", quantity: 2 },
    );
    expect(summary).toBe("Added 2 × Midnight Roast 1kg (updated).");
  });

  it("arguments provide the fallback when body lacks the field", () => {
    const summary = renderSummary(
      entry("Added {quantity} × {variant_id}."),
      baseIntent,
      { cart: { total: 3980 } }, // body has no variant_id / quantity
    );
    expect(summary).toBe("Added 2 × Midnight Roast 1kg.");
  });

  it("unresolved placeholder stays visible as literal {name}", () => {
    const summary = renderSummary(
      entry("Hello {missing_field}."),
      baseIntent,
      {},
    );
    expect(summary).toBe("Hello {missing_field}.");
  });

  it("template with no placeholders is returned verbatim", () => {
    const summary = renderSummary(entry("Done."), baseIntent, {});
    expect(summary).toBe("Done.");
  });

  it("summary output is a plain string — NOT rendered as HTML anywhere", () => {
    // The output of renderSummary will be dropped into a JSX text child
    // by ActionCard. Here we just assert the string type — the XSS proof
    // lives in the ActionCard render tests above.
    const summary = renderSummary(
      entry("Hello {variant_id}."),
      baseIntent,
      { variant_id: "<script>alert(1)</script>" },
    );
    expect(typeof summary).toBe("string");
    expect(summary).toBe("Hello <script>alert(1)</script>.");
  });
});
