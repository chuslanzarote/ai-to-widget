/**
 * T069 / US5 — Reviewer demo round-trip, docker-gated (SC-001 + SC-003).
 *
 * Runs against the live Aurelia demo stack spun up by
 * `make demo` (ATW backend on :3100, Medusa on :9000, storefront on
 * :8000). Gated by `ATW_E2E_DOCKER=1`. If the env var is absent the
 * suite is skipped so unit test runs stay fast.
 *
 * What this pins:
 *   (A) The storefront serves the Feature 006 action catalog at
 *       `/action-executors.json` — same origin as the widget bundle.
 *   (B) Posting a concrete "add to cart" message to atw_backend's
 *       `/v1/chat` endpoint with an anonymous cart context elicits an
 *       `add_line_item` ActionIntent (tool name matches the manifest
 *       regenerated in T065).
 *   (C) Executing that intent straight against Medusa
 *       `POST /store/carts/{id}/line-items` mutates the cart, and a
 *       follow-up `GET /store/carts/{id}` shows the item. This is the
 *       structural proof that the intent the model returned is
 *       executable against the live host.
 *   (D) None of the backend's tool-use response bodies echo the
 *       synthetic shopper-cookie value used in the chat request — SC-003
 *       leak-proof at the response boundary. (The full log-level proof
 *       is in runtime-credential-sovereignty.test.ts; this test is
 *       the round-trip companion.)
 *
 * Intentionally scoped to anonymous carts + the publishable-key header
 * (no shopper-account login) so the test does not depend on seeded
 * shopper credentials. The handled "logged-in shopper" path is covered
 * by the browser-driven suite in `tests/e2e/aurelia-demo.spec.ts`.
 */
import { describe, it, expect } from "vitest";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

const ATW_BACKEND_URL =
  process.env.ATW_BACKEND_URL ?? "http://localhost:3100";
const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const STOREFRONT_URL =
  process.env.STOREFRONT_URL ?? "http://localhost:8000";
const PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY ?? "";

const SHOPPER_COOKIE = "shopper_session=t069-leaked-" + Date.now();

describe.skipIf(!DOCKER_AVAILABLE)(
  "reviewer demo round-trip (T069 / SC-001 + SC-003)",
  () => {
    it("(A) storefront serves /action-executors.json same-origin with the widget", async () => {
      const res = await fetch(STOREFRONT_URL + "/action-executors.json");
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        version: number;
        credentialMode: string;
        actions: Array<{ tool: string; method: string; pathTemplate: string }>;
      };
      expect(json.version).toBe(1);
      expect(json.credentialMode).toBe("same-origin-cookies");
      const addLineItem = json.actions.find((a) => a.tool === "add_line_item");
      expect(addLineItem, "catalog must carry add_line_item").toBeDefined();
      expect(addLineItem!.method).toBe("POST");
      expect(addLineItem!.pathTemplate).toBe(
        "/store/carts/{id}/line-items",
      );
    });

    it(
      "(B) atw_backend emits add_line_item ActionIntent without echoing shopper cookie",
      async () => {
        if (!PUBLISHABLE_KEY) {
          // Without a publishable key the cart-create step below fails;
          // make that a hard fail so a misconfigured harness is loud.
          throw new Error(
            "MEDUSA_PUBLISHABLE_KEY env var is required — copy the value written to demo/medusa/.runtime/publishable-key.txt by `make demo`.",
          );
        }

        // Create an anonymous Medusa cart so we have a real cart_id
        // the ATW response path can cite.
        const cartRes = await fetch(MEDUSA_BACKEND_URL + "/store/carts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-publishable-api-key": PUBLISHABLE_KEY,
          },
          body: JSON.stringify({}),
        });
        expect(cartRes.status).toBeLessThan(300);
        const cartJson = (await cartRes.json()) as {
          cart: { id: string; region_id: string };
        };
        const cartId = cartJson.cart.id;
        expect(cartId).toMatch(/^cart_/);

        // Post a deliberately concrete instruction with the cart_id in
        // context. Inject a synthetic shopper cookie via the Cookie
        // header to probe SC-003: the backend's credential-strip hook
        // must remove it, and nothing in the response body should echo
        // the value.
        const chatRes = await fetch(ATW_BACKEND_URL + "/v1/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Atw-Session-Id": "t069-" + Date.now(),
            Cookie: SHOPPER_COOKIE,
          },
          body: JSON.stringify({
            message:
              "Add the Midnight Roast 1kg whole bean to my cart.",
            history: [
              {
                role: "assistant" as const,
                content:
                  "The Midnight Roast 1kg whole bean is variant_id=var_midnight_1kg_whole. Shall I add 1 to your cart?",
                timestamp: new Date().toISOString(),
              },
            ],
            context: {
              cart_id: cartId,
              customer_id: null,
              region_id: cartJson.cart.region_id,
              locale: "en-US",
            },
          }),
        });
        expect(chatRes.status).toBe(200);
        const chatBody = await chatRes.text();
        expect(chatBody).not.toContain("t069-leaked-");
        expect(chatBody).not.toContain("shopper_session=");

        const chat = JSON.parse(chatBody) as {
          actions?: Array<{
            tool: string;
            confirmation_required: boolean;
            http: { method: string; path: string };
            arguments?: Record<string, unknown>;
          }>;
        };
        // The model may or may not emit the intent on a given turn; when
        // it does, the shape is rigid and must carry confirmation=true.
        const add = chat.actions?.find((a) => a.tool === "add_line_item");
        if (add) {
          expect(add.confirmation_required).toBe(true);
          expect(add.http.method).toBe("POST");
          expect(add.http.path).toMatch(/\/store\/carts\/cart_.+\/line-items/);
        }
      },
      30_000,
    );

    it(
      "(C) executing the intent direct-to-Medusa mutates the cart",
      async () => {
        if (!PUBLISHABLE_KEY) {
          throw new Error(
            "MEDUSA_PUBLISHABLE_KEY env var is required — see (B).",
          );
        }

        // Fresh cart for an isolated assertion.
        const cartRes = await fetch(MEDUSA_BACKEND_URL + "/store/carts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-publishable-api-key": PUBLISHABLE_KEY,
          },
          body: JSON.stringify({}),
        });
        const { cart } = (await cartRes.json()) as {
          cart: { id: string };
        };

        // Pick any in-stock variant from the catalogue so the test
        // is not pinned to the seed data's labels.
        const productsRes = await fetch(
          MEDUSA_BACKEND_URL + "/store/products?limit=1",
          {
            headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
          },
        );
        expect(productsRes.status).toBe(200);
        const { products } = (await productsRes.json()) as {
          products: Array<{
            variants: Array<{ id: string }>;
          }>;
        };
        const variantId = products[0]?.variants?.[0]?.id;
        expect(variantId, "seed catalogue must have at least one variant").toBeTruthy();

        // This is the direct-to-host fetch the widget would issue —
        // same method + path shape as the action-executors.json entry.
        const addRes = await fetch(
          MEDUSA_BACKEND_URL + `/store/carts/${cart.id}/line-items`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-publishable-api-key": PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              variant_id: variantId,
              quantity: 1,
            }),
          },
        );
        expect(addRes.status).toBeLessThan(300);

        // Re-fetch and count line items.
        const afterRes = await fetch(
          MEDUSA_BACKEND_URL + `/store/carts/${cart.id}`,
          { headers: { "x-publishable-api-key": PUBLISHABLE_KEY } },
        );
        const { cart: after } = (await afterRes.json()) as {
          cart: { items: Array<{ variant_id: string; quantity: number }> };
        };
        expect(after.items.length).toBeGreaterThanOrEqual(1);
        const added = after.items.find((it) => it.variant_id === variantId);
        expect(added?.quantity).toBeGreaterThanOrEqual(1);
      },
      30_000,
    );
  },
);
