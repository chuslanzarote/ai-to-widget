/** @jsxImportSource preact */
/**
 * Feature 008 / T063 / FR-026 — ActionCard renders the catalog's
 * `summaryTemplate` (Handlebars-style `{{ name }}` substitution) as a
 * human-readable pre-execution summary. Raw JSON view is a fallback,
 * used when no template is present OR when a placeholder fails to
 * resolve.
 *
 * Contract: specs/008-atw-hardening/research.md §R11.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/preact";
import { h } from "preact";
import { ActionCard, renderSummaryTemplate } from "../src/action-card.js";
import { __setLoadedCatalogForTest } from "../src/action-executors.js";
import type { WidgetConfig } from "../src/config.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";
import type { ActionExecutorsCatalog } from "@atw/scripts/dist/lib/action-executors-types.js";

function cfg(): WidgetConfig {
  return {
    backendUrl: "https://backend.example.com",
    apiBaseUrl: "http://shop.local",
    theme: "default",
    launcherPosition: "bottom-right",
    authMode: "cookie",
    locale: "en-US",
    allowedTools: ["addToCart"],
  };
}

function entry(summaryTemplate?: string) {
  return {
    tool: "addToCart",
    method: "POST" as const,
    pathTemplate: "/cart/items",
    substitution: { path: {}, body: {}, query: {} },
    headers: {},
    responseHandling: {
      successStatuses: [200, 201],
      summaryTemplate: "Added.",
      summaryFields: [],
    },
    ...(summaryTemplate ? { summaryTemplate } : {}),
  };
}

function intent(args: Record<string, unknown>): ActionIntent {
  return {
    id: "tool_abc",
    tool: "addToCart",
    arguments: args,
    description: "Add an item to the cart.",
    confirmation_required: true,
    http: { method: "POST", path: "/cart/items" },
    summary: { product: "Espresso", quantity: "1" },
  };
}

describe("ActionCard summary template (T063 / FR-026)", () => {
  afterEach(() => {
    __setLoadedCatalogForTest(null);
  });

  describe("renderSummaryTemplate() pure function", () => {
    it("substitutes {{ name }} placeholders from the arguments map", () => {
      const out = renderSummaryTemplate(
        "Add {{ quantity }}× {{ product_name }} to your cart",
        { quantity: 1, product_name: "Espresso" },
      );
      expect(out).toBe("Add 1× Espresso to your cart");
    });

    it("returns null when any placeholder fails to resolve", () => {
      const out = renderSummaryTemplate(
        "Add {{ quantity }}× {{ product_name }} to your cart",
        { quantity: 1 }, // product_name missing
      );
      expect(out).toBeNull();
    });

    it("tolerates whitespace variations around the placeholder name", () => {
      expect(renderSummaryTemplate("X={{foo}}", { foo: "a" })).toBe("X=a");
      expect(renderSummaryTemplate("X={{ foo }}", { foo: "a" })).toBe("X=a");
      expect(renderSummaryTemplate("X={{  foo  }}", { foo: "a" })).toBe("X=a");
    });
  });

  describe("ActionCard rendering", () => {
    it("(a) renders the templated summary when the catalog entry carries a summaryTemplate", () => {
      const catalog: ActionExecutorsCatalog = {
        version: 1,
        credentialMode: "bearer-localstorage",
        actions: [entry("Add {{ quantity }}× {{ product_name }} to your cart")],
      };
      __setLoadedCatalogForTest(catalog);
      const { container } = render(
        h(ActionCard, {
          intent: intent({ quantity: 1, product_name: "Espresso" }),
          config: cfg(),
        }),
      );
      const text = container.querySelector(".atw-action-card__summary-text");
      expect(text).not.toBeNull();
      expect(text!.textContent).toBe("Add 1× Espresso to your cart");
      // Raw-JSON/key-value fallback must NOT render in this case.
      expect(container.querySelector(".atw-action-card__summary")).toBeNull();
    });

    it("(b) falls back to the raw summary view when a placeholder fails to resolve", () => {
      const catalog: ActionExecutorsCatalog = {
        version: 1,
        credentialMode: "bearer-localstorage",
        actions: [entry("Add {{ quantity }}× {{ product_name }} to your cart")],
      };
      __setLoadedCatalogForTest(catalog);
      const { container } = render(
        h(ActionCard, {
          // product_name missing from arguments → placeholder fails
          intent: intent({ quantity: 1 }),
          config: cfg(),
        }),
      );
      expect(container.querySelector(".atw-action-card__summary-text")).toBeNull();
      expect(container.querySelector(".atw-action-card__summary")).not.toBeNull();
    });

    it("(c) renders the raw summary view when the catalog entry has no summaryTemplate", () => {
      const catalog: ActionExecutorsCatalog = {
        version: 1,
        credentialMode: "bearer-localstorage",
        actions: [entry()],
      };
      __setLoadedCatalogForTest(catalog);
      const { container } = render(
        h(ActionCard, {
          intent: intent({ quantity: 1, product_name: "Espresso" }),
          config: cfg(),
        }),
      );
      expect(container.querySelector(".atw-action-card__summary-text")).toBeNull();
      expect(container.querySelector(".atw-action-card__summary")).not.toBeNull();
    });
  });
});
