/**
 * Contract test — `GET /openapi.json` conforms to
 * specs/007-widget-tool-loop/contracts/shop-openapi.md.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";

// Lazily import so tests can run without compiled dist/.
async function boot(): Promise<FastifyInstance> {
  process.env.JWT_SECRET ??= "test_jwt_secret_at_least_sixteen_chars";
  process.env.DATABASE_URL ??=
    "postgres://shop:shop_local@localhost:5434/shop";
  const { buildApp } = await import("../src/index.js");
  const app = await buildApp();
  await app.ready();
  return app;
}

interface OpenApiDoc {
  info: { title: string; version: string };
  components: { securitySchemes?: Record<string, unknown> };
  paths: Record<string, Record<string, { operationId?: string; security?: unknown[] }>>;
}

describe("shop OpenAPI document", () => {
  let app: FastifyInstance;
  let doc: OpenApiDoc;

  beforeAll(async () => {
    app = await boot();
    const res = await app.inject({ method: "GET", url: "/openapi.json" });
    expect(res.statusCode).toBe(200);
    doc = JSON.parse(res.body) as OpenApiDoc;
  });

  afterAll(async () => {
    await app?.close();
  });

  it("declares the expected info.title", () => {
    expect(doc.info.title).toBe("ATW Reference Shop");
  });

  it("declares bearerAuth security scheme", () => {
    expect(doc.components.securitySchemes?.bearerAuth).toBeDefined();
  });

  const EXPECTED: Array<{ method: string; path: string; op: string; authed: boolean }> = [
    { method: "post", path: "/auth/login", op: "loginShopper", authed: false },
    { method: "get", path: "/products", op: "listProducts", authed: false },
    { method: "get", path: "/products/{id}", op: "getProduct", authed: false },
    { method: "get", path: "/cart", op: "getCart", authed: true },
    { method: "post", path: "/cart/items", op: "addCartItem", authed: true },
    {
      method: "patch",
      path: "/cart/items/{id}",
      op: "updateCartItem",
      authed: true,
    },
    {
      method: "delete",
      path: "/cart/items/{id}",
      op: "removeCartItem",
      authed: true,
    },
    { method: "post", path: "/orders", op: "placeOrder", authed: true },
    { method: "get", path: "/orders", op: "listMyOrders", authed: true },
    {
      method: "get",
      path: "/customers/me",
      op: "getMyProfile",
      authed: true,
    },
  ];

  for (const spec of EXPECTED) {
    it(`declares ${spec.method.toUpperCase()} ${spec.path} as ${spec.op}`, () => {
      const op = doc.paths[spec.path]?.[spec.method];
      expect(op, `missing ${spec.method} ${spec.path}`).toBeDefined();
      expect(op?.operationId).toBe(spec.op);
      if (spec.authed) {
        expect(op?.security).toEqual(
          expect.arrayContaining([{ bearerAuth: [] }]),
        );
      }
    });
  }
});
