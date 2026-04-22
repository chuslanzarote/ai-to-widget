/**
 * T103 / US9 — Theming integration (SC-012).
 *
 * Mounts the Aurelia storefront, overrides `--atw-primary-color` at the
 * host level, reloads, and asserts the widget's primary button's
 * computed colour changes. Runs on chromium / firefox / webkit via
 * playwright.config.ts projects.
 *
 * Gated by ATW_E2E_DOCKER=1 (needs the demo stack up).
 */
import { test, expect } from "@playwright/test";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

test.skip(!DOCKER_AVAILABLE, "requires ATW_E2E_DOCKER=1 and a live demo stack");

test.describe("widget theming (T103 / SC-012)", () => {
  test("overriding --atw-primary-color changes the launcher background", async ({ page }) => {
    await page.goto("/");
    const launcher = page.locator(".atw-launcher");
    await expect(launcher).toBeVisible();

    const baselineColor = await launcher.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );

    // Inject a CSS override that changes the Aurelia primary colour.
    await page.addStyleTag({
      content: ":root { --atw-primary-color: rgb(10, 20, 200); }",
    });
    // Give the style a frame to apply.
    await page.waitForTimeout(100);
    const newColor = await launcher.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    expect(newColor).not.toBe(baselineColor);
    expect(newColor).toBe("rgb(10, 20, 200)");
  });
});
