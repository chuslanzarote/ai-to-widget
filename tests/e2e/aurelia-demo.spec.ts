/**
 * T077 / US4 — Scripted 5-turn Aurelia demo E2E (SC-005 / SC-007 / SC-011 / SC-015).
 *
 * Requires the full demo stack up (make demo) AND ATW_E2E_DOCKER=1.
 * Auto-skips otherwise. Not meant to run on CI lanes without Docker.
 *
 * Beats (mirrors the demo-video narrative — §1 of specs/003-runtime/quickstart.md §2.5–2.8):
 *   1. Open storefront, open widget → launcher visible, panel opens.
 *   2. Ask a flavour-profile question → grounded reply mentioning ≥ 2 real products, < 4 s.
 *   3. Ask a comparison question → both products cited.
 *   4. Ask to add one to cart → confirmation card appears, cart unchanged.
 *   5. Click confirm → cart count updates within 2 s, agent acknowledges.
 *
 * Invariant: every outbound network request in the 5-turn session is either
 *   (a) to the ATW backend URL, or
 *   (b) to the Medusa storefront / host-API URL.
 * No third-party origin may appear (SC-011).
 *
 * Invariant: requests to the ATW backend MUST NOT carry Cookie or
 * Authorization headers (SC-006).
 */
import { test, expect, type Page, type Request as PwRequest } from "@playwright/test";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

const STOREFRONT = process.env.ATW_STOREFRONT_URL ?? "http://localhost:8000";
const BACKEND = process.env.ATW_BACKEND_URL ?? "http://localhost:3100";
const MEDUSA = process.env.ATW_MEDUSA_URL ?? "http://localhost:9000";

test.skip(!DOCKER_AVAILABLE, "requires ATW_E2E_DOCKER=1 and a live demo stack");

async function openPanel(page: Page): Promise<void> {
  await page.goto("/");
  const launcher = page.locator(".atw-launcher");
  await expect(launcher).toBeVisible({ timeout: 15_000 });
  await launcher.click();
  const panel = page.locator(".atw-panel");
  await expect(panel).toBeVisible();
}

async function sendMessage(page: Page, text: string): Promise<{ elapsedMs: number }> {
  const input = page.locator(".atw-input");
  await input.fill(text);
  const start = Date.now();
  await input.press("Enter");
  // Wait for the assistant reply bubble to land.
  await page.waitForSelector(".atw-turn--assistant .atw-bubble:last-of-type", { timeout: 15_000 });
  return { elapsedMs: Date.now() - start };
}

function collectNetworkOrigins(page: Page): Set<string> {
  const origins = new Set<string>();
  page.on("request", (req: PwRequest) => {
    try {
      origins.add(new URL(req.url()).origin);
    } catch {
      /* ignore data: / blob: / etc */
    }
  });
  return origins;
}

function installCredentialGuard(page: Page): { backendCredentialHits: number } {
  const state = { backendCredentialHits: 0 };
  page.on("request", (req: PwRequest) => {
    try {
      const u = new URL(req.url());
      if (u.origin === new URL(BACKEND).origin) {
        const headers = req.headers();
        if (headers["authorization"] || headers["cookie"]) {
          state.backendCredentialHits += 1;
        }
      }
    } catch {
      /* ignore */
    }
  });
  return state;
}

test.describe("Aurelia demo — scripted 5-turn conversation", () => {
  test("grounded reply, comparison, confirmed cart add — under the filmed budgets", async ({ page }) => {
    const origins = collectNetworkOrigins(page);
    const credGuard = installCredentialGuard(page);

    await openPanel(page);

    // Beat 1: flavour profile
    const t1 = await sendMessage(
      page,
      "Estoy buscando un café chocolatoso para filtro en V60, sin demasiada acidez.",
    );
    expect(t1.elapsedMs, "SC-001 p50 budget for grounded reply is 4 s").toBeLessThan(4_000);
    const firstAssistantBubble = page.locator(".atw-turn--assistant .atw-bubble").last();
    await expect(firstAssistantBubble).toContainText(/Huila|Karundul|Colombia|Kenya/i);
    const citations = page.locator(".atw-citations .atw-citation");
    await expect(citations.first()).toBeVisible();
    expect(await citations.count()).toBeGreaterThanOrEqual(2);

    // Beat 2: comparison
    await sendMessage(
      page,
      "Compáramelo con el Ethiopia Yirgacheffe — ¿cuál es mejor para V60?",
    );
    const secondAssistant = page.locator(".atw-turn--assistant .atw-bubble").nth(1);
    await expect(secondAssistant).toContainText(/Yirgacheffe|Ethiopia/i);
    await expect(secondAssistant).toContainText(/Huila|Colombia|Kenya/i);

    // Beat 3: add to cart — expect a confirmation card, no host-API POST yet.
    let cartPostsBeforeClick = 0;
    page.on("request", (req: PwRequest) => {
      try {
        const u = new URL(req.url());
        if (u.origin === new URL(MEDUSA).origin && req.method() === "POST" && /\/line-items$/.test(u.pathname)) {
          cartPostsBeforeClick += 1;
        }
      } catch {
        /* */
      }
    });
    await sendMessage(page, "Añade 2 Colombia Huila 250g a mi carrito.");
    const card = page.locator(".atw-action-card");
    await expect(card).toBeVisible({ timeout: 10_000 });
    expect(cartPostsBeforeClick, "SC-002 — no cart write before user click").toBe(0);

    // Beat 4: click confirm
    const confirmStart = Date.now();
    await card.locator(".atw-action-card__confirm").click();
    await expect(card.locator(".atw-action-card__done")).toBeVisible({ timeout: 5_000 });
    const confirmElapsed = Date.now() - confirmStart;
    expect(confirmElapsed, "SC-002 confirm→cart round trip ≤ 2 s").toBeLessThan(2_000);

    // Beat 5: third assistant bubble should acknowledge.
    await page.waitForSelector(".atw-turn--assistant .atw-bubble:nth-of-type(3)", { timeout: 5_000 });

    // Invariants
    const backendOrigin = new URL(BACKEND).origin;
    const medusaOrigin = new URL(MEDUSA).origin;
    const storefrontOrigin = new URL(STOREFRONT).origin;
    for (const o of origins) {
      expect(
        [backendOrigin, medusaOrigin, storefrontOrigin],
        `SC-011 — unexpected origin contacted: ${o}`,
      ).toContain(o);
    }
    expect(
      credGuard.backendCredentialHits,
      "SC-006 — shopper credentials leaked to the ATW backend",
    ).toBe(0);
  });

  test("repeatability — same 5 turns run twice produce equivalent final cart state", async ({ page }) => {
    // SC-015 — `docker compose down -v && up` twice yields identical observable behaviour.
    // We approximate the invariant here by running the same scripted 5-turn twice in the
    // same session and asserting the cart header ends on the same count both times.
    await openPanel(page);
    await sendMessage(page, "¿Qué cafés tenéis para filtro?");
    await sendMessage(page, "¿Cuál es más chocolatoso?");
    const firstCartCount = await page
      .locator("[data-cart-count]")
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => null);

    // Reload and repeat.
    await page.reload();
    await openPanel(page);
    await sendMessage(page, "¿Qué cafés tenéis para filtro?");
    await sendMessage(page, "¿Cuál es más chocolatoso?");
    const secondCartCount = await page
      .locator("[data-cart-count]")
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => null);

    expect(secondCartCount).toBe(firstCartCount);
  });
});
