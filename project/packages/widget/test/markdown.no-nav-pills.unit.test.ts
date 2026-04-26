/**
 * Feature 008 / T064 / FR-027 — the widget must NOT surface
 * navigation-shape URLs (e.g. `http://host/Products/<id>`) as clickable
 * pills. Until a proper client-routing integration is designed, these
 * links remain plain markdown anchors — the underlying href may be
 * preserved, but the rendered DOM must NOT use a pill-specific class or
 * button-like affordance.
 *
 * Contract: specs/008-atw-hardening/spec.md §FR-027.
 */
import { describe, it, expect } from "vitest";
import { renderMarkdown } from "../src/markdown.js";

describe("markdown rendering — no navigation pills (T064 / FR-027)", () => {
  it("does NOT render nav-pill-shaped links with a pill class or data-pill attribute", () => {
    const src = "See the [Midnight Roast](http://shop.example.com/Products/prod_123) details.";
    const html = renderMarkdown(src);
    // A clickable pill implementation would typically surface one of
    // these markers; the regression guard pins their absence.
    expect(html).not.toMatch(/class="[^"]*\batw-pill\b/i);
    expect(html).not.toMatch(/class="[^"]*\bnav-pill\b/i);
    expect(html).not.toMatch(/data-pill=/i);
    expect(html).not.toMatch(/role="button"/i);
  });

  it("preserves the underlying markdown anchor so the text remains readable", () => {
    const src = "Open [Midnight Roast](http://shop.example.com/Products/prod_123).";
    const html = renderMarkdown(src);
    expect(html).toContain("Midnight Roast");
    expect(html).toMatch(/<a\s[^>]*href="http:\/\/shop\.example\.com\/Products\/prod_123"/);
  });

  it("does not render a clickable pill for bare navigation-shape URLs either", () => {
    const src = "Visit http://shop.example.com/Categories/coffee for more.";
    const html = renderMarkdown(src);
    expect(html).not.toMatch(/class="[^"]*\batw-pill\b/i);
    expect(html).not.toMatch(/class="[^"]*\bnav-pill\b/i);
    expect(html).not.toMatch(/data-pill=/i);
  });
});
