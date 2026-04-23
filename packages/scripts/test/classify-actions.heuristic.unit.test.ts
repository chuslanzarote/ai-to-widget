/**
 * T025 — Stage 1 heuristic unit tests.
 *
 * Covers each of the five rules in contracts/classifier-contract.md §2:
 *   1. admin-prefix
 *   2. non-cookie-security (oauth2 / bearer-JWT / apiKey-in-header)
 *   3. missing-request-schema
 *   4. destructive-unowned
 *   5. OPTIONS/HEAD silent skip
 *
 * Also verifies rule-order precedence: rule 1 wins when rules 1 and 3
 * would both match.
 */
import { describe, it, expect } from "vitest";

import { stage1Heuristic } from "../src/classify-actions.js";
import type {
  ParsedOpenAPI,
  ParsedOpenAPIOperation,
} from "../src/lib/types.js";

function buildOp(overrides: Partial<ParsedOpenAPIOperation>): ParsedOpenAPIOperation {
  return {
    id: "test_op",
    method: "post",
    path: "/default",
    tag: null,
    summary: null,
    description: null,
    security: [],
    parameters: [],
    requestBody: null,
    responses: [],
    ...overrides,
  };
}

function buildParsed(ops: ParsedOpenAPIOperation[]): ParsedOpenAPI {
  return {
    version: 1,
    sourceVersion: "3.0",
    sourceUrl: null,
    title: "test",
    apiDescription: null,
    servers: [],
    tags: [],
    operations: ops,
  };
}

const objectBody = {
  contentType: "application/json",
  schema: {
    type: "object",
    properties: { foo: { type: "string" } },
    required: ["foo"],
  },
};

describe("stage1Heuristic — rule 1 (admin-prefix)", () => {
  it("excludes operations on /admin/* paths", () => {
    const op = buildOp({
      id: "adminCreateUser",
      method: "post",
      path: "/admin/users",
      requestBody: objectBody,
    });
    const { candidateIncluded, excluded } = stage1Heuristic(buildParsed([op]));
    expect(candidateIncluded).toHaveLength(0);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]).toMatchObject({
      method: "POST",
      path: "/admin/users",
      reason: "admin-prefix",
    });
  });

  it("excludes operations whose tag begins with admin", () => {
    const op = buildOp({
      id: "resetUser",
      method: "post",
      path: "/users/{id}/reset",
      tag: "admin.users",
      requestBody: objectBody,
    });
    const { excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded[0]?.reason).toBe("admin-prefix");
  });
});

describe("stage1Heuristic — rule 2 (non-cookie-security)", () => {
  const rawDocWithSchemes = (schemes: Record<string, unknown>) => ({
    openapi: "3.0.0",
    paths: {},
    components: { securitySchemes: schemes },
  });

  it("excludes oauth2-secured operations", () => {
    const op = buildOp({
      id: "oauthOp",
      method: "post",
      path: "/widget/action",
      security: [{ scheme: "oauthAuth", scopes: ["shop"] }],
      requestBody: objectBody,
    });
    const { excluded } = stage1Heuristic(
      buildParsed([op]),
      rawDocWithSchemes({ oauthAuth: { type: "oauth2", flows: {} } }),
    );
    expect(excluded[0]?.reason).toBe("non-cookie-security");
  });

  it("excludes bearer-JWT operations", () => {
    const op = buildOp({
      id: "bearerOp",
      method: "post",
      path: "/widget/action",
      security: [{ scheme: "bearerAuth", scopes: [] }],
      requestBody: objectBody,
    });
    const { excluded } = stage1Heuristic(
      buildParsed([op]),
      rawDocWithSchemes({
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      }),
    );
    expect(excluded[0]?.reason).toBe("non-cookie-security");
  });

  it("excludes apiKey-in-header operations", () => {
    const op = buildOp({
      id: "apiKeyOp",
      method: "post",
      path: "/widget/action",
      security: [{ scheme: "apiKeyAuth", scopes: [] }],
      requestBody: objectBody,
    });
    const { excluded } = stage1Heuristic(
      buildParsed([op]),
      rawDocWithSchemes({
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
      }),
    );
    expect(excluded[0]?.reason).toBe("non-cookie-security");
  });

  it("does NOT exclude cookie-based apiKey operations", () => {
    const op = buildOp({
      id: "cookieOp",
      method: "post",
      path: "/widget/action",
      security: [{ scheme: "cookieAuth", scopes: [] }],
      requestBody: objectBody,
    });
    const { candidateIncluded, excluded } = stage1Heuristic(
      buildParsed([op]),
      rawDocWithSchemes({
        cookieAuth: { type: "apiKey", in: "cookie", name: "session_id" },
      }),
    );
    expect(excluded).toHaveLength(0);
    expect(candidateIncluded).toHaveLength(1);
  });
});

describe("stage1Heuristic — rule 3 (missing-request-schema)", () => {
  it("excludes POST/PUT/PATCH without a requestBody", () => {
    for (const method of ["post", "put", "patch"] as const) {
      const op = buildOp({
        id: `op_${method}`,
        method,
        path: "/widget/action",
        requestBody: null,
      });
      const { excluded } = stage1Heuristic(buildParsed([op]));
      expect(excluded[0]?.reason).toBe("missing-request-schema");
      expect(excluded[0]?.method).toBe(method.toUpperCase());
    }
  });

  it("excludes POST with a primitive (non-object) requestBody schema", () => {
    const op = buildOp({
      id: "scalarBodyOp",
      method: "post",
      path: "/widget/action",
      requestBody: {
        contentType: "text/plain",
        schema: { type: "string" },
      },
    });
    const { excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded[0]?.reason).toBe("missing-request-schema");
  });

  it("does NOT exclude DELETE without body (rule 3 only applies to write methods)", () => {
    const op = buildOp({
      id: "deleteWidget",
      method: "delete",
      path: "/store/cart/{id}",
      requestBody: null,
    });
    const { candidateIncluded, excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded).toHaveLength(0);
    expect(candidateIncluded).toHaveLength(1);
  });
});

describe("stage1Heuristic — rule 4 (destructive-unowned)", () => {
  it("excludes DELETE on a non-shopper-owned resource", () => {
    const op = buildOp({
      id: "deleteProduct",
      method: "delete",
      path: "/products/{id}",
    });
    const { excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded[0]?.reason).toBe("destructive-unowned");
  });

  it("does NOT exclude DELETE on a shopper-owned resource (cart)", () => {
    const op = buildOp({
      id: "deleteCartItem",
      method: "delete",
      path: "/store/carts/{cart_id}/line-items/{id}",
    });
    const { candidateIncluded, excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded).toHaveLength(0);
    expect(candidateIncluded).toHaveLength(1);
  });

  it("does NOT exclude DELETE on a shopper-owned resource (wishlist)", () => {
    const op = buildOp({
      id: "removeFromWishlist",
      method: "delete",
      path: "/wishlist/{id}",
    });
    const { candidateIncluded, excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded).toHaveLength(0);
    expect(candidateIncluded).toHaveLength(1);
  });

  it("excludes POST with destructive operationId verb on non-owned path", () => {
    const op = buildOp({
      id: "purgeInventory",
      method: "post",
      path: "/inventory/{id}/purge",
      requestBody: objectBody,
    });
    const { excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded[0]?.reason).toBe("destructive-unowned");
  });
});

describe("stage1Heuristic — rule 5 (OPTIONS/HEAD silent skip)", () => {
  it("OPTIONS operations are skipped without landing in excluded[]", () => {
    const op = buildOp({ id: "opsPing", method: "options", path: "/widget" });
    const { candidateIncluded, excluded } = stage1Heuristic(buildParsed([op]));
    expect(candidateIncluded).toHaveLength(0);
    expect(excluded).toHaveLength(0);
  });

  it("HEAD operations are skipped without landing in excluded[]", () => {
    const op = buildOp({ id: "headPing", method: "head", path: "/widget" });
    const { candidateIncluded, excluded } = stage1Heuristic(buildParsed([op]));
    expect(candidateIncluded).toHaveLength(0);
    expect(excluded).toHaveLength(0);
  });
});

describe("stage1Heuristic — rule-order precedence", () => {
  it("rule 1 (admin) wins over rule 3 (missing-request-schema) when both match", () => {
    const op = buildOp({
      id: "adminOp",
      method: "post",
      path: "/admin/anything",
      requestBody: null, // would trip rule 3 too
    });
    const { excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded).toHaveLength(1);
    expect(excluded[0]?.reason).toBe("admin-prefix");
  });

  it("rule 1 wins over rule 4 (destructive-unowned)", () => {
    const op = buildOp({
      id: "adminDeleteProduct",
      method: "delete",
      path: "/admin/products/{id}",
    });
    const { excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded[0]?.reason).toBe("admin-prefix");
  });
});

describe("stage1Heuristic — happy path (all rules pass)", () => {
  it("shopper-owned POST with valid object body lands in candidateIncluded", () => {
    const op = buildOp({
      id: "addLineItem",
      method: "post",
      path: "/store/carts/{cart_id}/line-items",
      requestBody: objectBody,
    });
    const { candidateIncluded, excluded } = stage1Heuristic(buildParsed([op]));
    expect(excluded).toHaveLength(0);
    expect(candidateIncluded).toHaveLength(1);
    expect(candidateIncluded[0]?.id).toBe("addLineItem");
  });
});
