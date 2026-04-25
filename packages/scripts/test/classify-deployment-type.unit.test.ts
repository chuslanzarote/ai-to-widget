/**
 * T012 — deploymentType gating for Stage 1 rule 2 (non-cookie-security).
 *
 * When `project.md#deploymentType === "customer-facing-widget"`, shopper-
 * scoped bearer-JWT operations MUST be accepted into the catalog (they
 * travel with a localStorage-token credential source). When the flag is
 * absent, the pre-008 rejection rule is preserved and a D-CLASSIFYAUTH
 * warning is emitted.
 */
import { describe, it, expect } from "vitest";

import { stage1Heuristic } from "../src/classify-actions.js";
import type {
  ParsedOpenAPI,
  ParsedOpenAPIOperation,
} from "../src/lib/types.js";

function buildOp(
  overrides: Partial<ParsedOpenAPIOperation>,
): ParsedOpenAPIOperation {
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

const rawDocBearerJwt = {
  openapi: "3.0.0",
  paths: {},
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};

function shopperBearerJwtOp(): ParsedOpenAPIOperation {
  return buildOp({
    id: "addCartItem",
    method: "post",
    path: "/store/carts/{cart_id}/line-items",
    security: [{ scheme: "bearerAuth", scopes: [] }],
    requestBody: objectBody,
  });
}

describe("stage1Heuristic — deploymentType gating (T012 / FR-010)", () => {
  it("accepts shopper-scoped bearer-JWT op when deploymentType is 'customer-facing-widget'", () => {
    const op = shopperBearerJwtOp();
    const { candidateIncluded, excluded, warnings } = stage1Heuristic(
      buildParsed([op]),
      rawDocBearerJwt,
      { deploymentType: "customer-facing-widget" },
    );
    expect(excluded).toHaveLength(0);
    expect(candidateIncluded).toHaveLength(1);
    expect(candidateIncluded[0]?.id).toBe("addCartItem");
    expect(warnings ?? []).toEqual([]);
  });

  it("excludes the same op when deploymentType is absent (pre-008 behaviour)", () => {
    const op = shopperBearerJwtOp();
    const { candidateIncluded, excluded } = stage1Heuristic(
      buildParsed([op]),
      rawDocBearerJwt,
    );
    expect(candidateIncluded).toHaveLength(0);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]?.reason).toBe("non-cookie-security");
  });

  it("emits D-CLASSIFYAUTH warning only when flag is absent AND a bearer-JWT shopper op is rejected", () => {
    const op = shopperBearerJwtOp();
    const resultUnset = stage1Heuristic(
      buildParsed([op]),
      rawDocBearerJwt,
    );
    expect(resultUnset.warnings ?? []).toHaveLength(1);
    expect(resultUnset.warnings?.[0] ?? "").toMatch(/bearerFormat: "JWT"/);
    expect(resultUnset.warnings?.[0] ?? "").toMatch(/customer-facing-widget/);
    expect(resultUnset.warnings?.[0] ?? "").toMatch(/POST \/store\/carts/);

    const resultFlagged = stage1Heuristic(
      buildParsed([op]),
      rawDocBearerJwt,
      { deploymentType: "customer-facing-widget" },
    );
    expect(resultFlagged.warnings ?? []).toEqual([]);
  });

  it("deploymentType flag does NOT rescue non-shopper-scoped bearer-JWT ops", () => {
    const op = buildOp({
      id: "adminThing",
      method: "post",
      path: "/internal/thing",
      security: [{ scheme: "bearerAuth", scopes: [] }],
      requestBody: objectBody,
    });
    const { candidateIncluded, excluded } = stage1Heuristic(
      buildParsed([op]),
      rawDocBearerJwt,
      { deploymentType: "customer-facing-widget" },
    );
    expect(candidateIncluded).toHaveLength(0);
    expect(excluded).toHaveLength(1);
    expect(excluded[0]?.reason).toBe("non-cookie-security");
  });
});
