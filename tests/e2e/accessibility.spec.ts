/**
 * T109 / Polish — WCAG 2.1 AA basic accessibility scan (SC-013).
 *
 * Uses axe-core via @axe-core/playwright. Opens the widget panel on the
 * Aurelia demo storefront and asserts zero serious or critical
 * violations. Gated by ATW_E2E_DOCKER=1.
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";
test.skip(!DOCKER_AVAILABLE, "requires ATW_E2E_DOCKER=1 and a live demo stack");

test.describe("widget accessibility (T109 / SC-013)", () => {
  test("open panel has zero serious/critical WCAG 2.1 AA violations", async ({ page }) => {
    await page.goto("/");
    await page.locator(".atw-launcher").click();
    await expect(page.locator(".atw-panel")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include(".atw-panel")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();

    const highImpact = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(
      highImpact,
      "serious/critical WCAG violations:\n" +
        highImpact.map((v) => `  - ${v.id}: ${v.description}`).join("\n"),
    ).toHaveLength(0);
  });
});
