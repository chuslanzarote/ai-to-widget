/**
 * T028 / Feature 008 FR-021 — CORS preflight contract test.
 *
 * The shop backend MUST answer an `OPTIONS /cart/items` preflight from
 * the storefront dev origin (`http://localhost:5173`) with the
 * `Access-Control-Allow-Origin` and `Access-Control-Allow-Headers`
 * required for the widget's `Authorization`-bearing fetch to proceed.
 *
 * Contract: specs/008-atw-hardening/contracts/host-requirements.md;
 * plan.md Testing item l; SC-007.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

async function boot(env: {
  allowedOrigins?: string;
} = {}): Promise<FastifyInstance> {
  process.env.JWT_SECRET ??= "test_jwt_secret_at_least_sixteen_chars";
  process.env.DATABASE_URL ??=
    "postgres://shop:shop_local@localhost:5434/shop";
  if (env.allowedOrigins !== undefined) {
    process.env.ALLOWED_ORIGINS = env.allowedOrigins;
  } else {
    delete process.env.ALLOWED_ORIGINS;
  }
  const { buildApp } = await import("../src/index.js");
  const app = await buildApp();
  await app.ready();
  return app;
}

describe("shop backend CORS preflight (T028 / FR-021)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await boot();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("defaults ALLOWED_ORIGINS to http://localhost:5173 and echoes it on preflight", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/cart/items",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(200);
    expect(res.statusCode).toBeLessThan(300);
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    const allowHeaders = String(
      res.headers["access-control-allow-headers"] ?? "",
    ).toLowerCase();
    expect(allowHeaders).toContain("authorization");
    expect(allowHeaders).toContain("content-type");
    const allowMethods = String(
      res.headers["access-control-allow-methods"] ?? "",
    ).toUpperCase();
    expect(allowMethods).toContain("POST");
  });

  it("rejects (drops CORS headers for) an origin that is not on the allow-list", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/cart/items",
      headers: {
        origin: "https://evil.example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization",
      },
    });
    // @fastify/cors silently omits the allow-origin header when the
    // origin is not on the list. The preflight still returns a status
    // — assert only that the origin is NOT echoed.
    expect(res.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.example.com",
    );
  });
});

describe("shop backend CORS — comma-separated override (T028)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await boot({
      allowedOrigins: "http://localhost:5173,https://shop.example.com",
    });
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.ALLOWED_ORIGINS;
  });

  it("echoes each comma-separated origin back on preflight", async () => {
    for (const origin of [
      "http://localhost:5173",
      "https://shop.example.com",
    ]) {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/cart/items",
        headers: {
          origin,
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization",
        },
      });
      expect(res.headers["access-control-allow-origin"]).toBe(origin);
    }
  });
});
