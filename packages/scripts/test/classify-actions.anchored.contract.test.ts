/**
 * T026 — Stage 2 anchored-generation contract tests.
 *
 * Per contracts/classifier-contract.md §3 and §8, the classifier:
 *   1. Rejects Opus responses containing operationIds not in the Stage 1
 *      candidate list → throws `ANCHORED_GENERATION_VIOLATION` (Principle V
 *      red line, FR-004).
 *   2. Passes candidates through unchanged when Opus returns the full list.
 *   3. Narrows to a subset, marking the removed entries as `opus-narrowed`.
 *   4. Accepts an empty response, producing empty `included[]`.
 *   5. Rejects malformed JSON responses → `OPUS_RESPONSE_INVALID`.
 */
import { describe, it, expect } from "vitest";

import {
  classifyActions,
  ClassifierError,
} from "../src/classify-actions.js";
import type {
  ParsedOpenAPI,
  ParsedOpenAPIOperation,
} from "../src/lib/types.js";
import type { OpusClient } from "../src/enrich-entity.js";

const SHA = "sha256:" + "0".repeat(64);
const MODEL = "claude-opus-4-7";
const CLASSIFIED_AT = "2026-04-23T10:00:00Z";

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
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        properties: { foo: { type: "string" } },
        required: ["foo"],
      },
    },
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

function scriptedOpus(contentText: string): OpusClient {
  return {
    async createMessage() {
      return {
        contentText,
        usage: { input_tokens: 100, output_tokens: 10 },
      };
    },
  };
}

/**
 * Two shopper-owned candidates + one admin (auto-excluded in stage 1) so
 * stage1.candidateIncluded is exactly ["addLineItem", "removeFromWishlist"].
 */
function scenarioOps(): ParsedOpenAPIOperation[] {
  return [
    buildOp({
      id: "addLineItem",
      method: "post",
      path: "/store/carts/{cart_id}/line-items",
    }),
    buildOp({
      id: "removeFromWishlist",
      method: "delete",
      path: "/store/wishlist/{variant_id}",
      requestBody: null,
    }),
    buildOp({
      id: "adminCreateUser",
      method: "post",
      path: "/admin/users",
    }),
  ];
}

describe("classifyActions — anchored-generation contract (T026)", () => {
  it("throws ANCHORED_GENERATION_VIOLATION when Opus returns a fabricated operationId", async () => {
    const parsed = buildParsed(scenarioOps());
    const opus = scriptedOpus(JSON.stringify(["addLineItem", "notInCandidateList"]));

    await expect(
      classifyActions({
        parsed,
        openapiSha256: SHA,
        modelSnapshot: MODEL,
        classifiedAt: CLASSIFIED_AT,
        opusClient: opus,
      }),
    ).rejects.toMatchObject({
      code: "ANCHORED_GENERATION_VIOLATION",
    });
  });

  it("diagnostic names the fabricated operationId", async () => {
    const parsed = buildParsed(scenarioOps());
    const opus = scriptedOpus(JSON.stringify(["addLineItem", "fakeBogusId"]));

    await expect(
      classifyActions({
        parsed,
        openapiSha256: SHA,
        modelSnapshot: MODEL,
        classifiedAt: CLASSIFIED_AT,
        opusClient: opus,
      }),
    ).rejects.toThrow(/fakeBogusId/);
  });

  it("returns full candidate set when Opus echoes the candidate list", async () => {
    const parsed = buildParsed(scenarioOps());
    const opus = scriptedOpus(
      JSON.stringify(["addLineItem", "removeFromWishlist"]),
    );

    const { manifest } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      opusClient: opus,
    });

    expect(manifest.included).toHaveLength(2);
    const opIds = manifest.included.map((e) => e.source.operationId).sort();
    expect(opIds).toEqual(["addLineItem", "removeFromWishlist"]);
    // admin is excluded via stage 1; no opus-narrowed excluded here.
    expect(manifest.excluded.some((e) => e.reason === "opus-narrowed")).toBe(false);
  });

  it("produces opus-narrowed excluded entries when Opus returns a strict subset", async () => {
    const parsed = buildParsed(scenarioOps());
    const opus = scriptedOpus(JSON.stringify(["addLineItem"]));

    const { manifest } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      opusClient: opus,
    });

    expect(manifest.included.map((e) => e.source.operationId)).toEqual([
      "addLineItem",
    ]);
    const narrowed = manifest.excluded.filter((e) => e.reason === "opus-narrowed");
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0]?.operationId).toBe("removeFromWishlist");
  });

  it("accepts an empty narrowing response → empty included[]", async () => {
    const parsed = buildParsed(scenarioOps());
    const opus = scriptedOpus("[]");

    const { manifest } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      opusClient: opus,
    });

    expect(manifest.included).toHaveLength(0);
    // both candidates are now opus-narrowed.
    const narrowed = manifest.excluded.filter((e) => e.reason === "opus-narrowed");
    expect(narrowed).toHaveLength(2);
  });

  it("throws OPUS_RESPONSE_INVALID on non-JSON content", async () => {
    const parsed = buildParsed(scenarioOps());
    const opus = scriptedOpus("this is not json at all");

    await expect(
      classifyActions({
        parsed,
        openapiSha256: SHA,
        modelSnapshot: MODEL,
        classifiedAt: CLASSIFIED_AT,
        opusClient: opus,
      }),
    ).rejects.toMatchObject({ code: "OPUS_RESPONSE_INVALID" });
  });

  it("throws OPUS_RESPONSE_INVALID when response is not an array of strings", async () => {
    const parsed = buildParsed(scenarioOps());
    const opus = scriptedOpus(JSON.stringify({ operationIds: ["addLineItem"] }));

    await expect(
      classifyActions({
        parsed,
        openapiSha256: SHA,
        modelSnapshot: MODEL,
        classifiedAt: CLASSIFIED_AT,
        opusClient: opus,
      }),
    ).rejects.toMatchObject({ code: "OPUS_RESPONSE_INVALID" });
  });

  it("anchored-generation violation exposes ClassifierError instance", async () => {
    const parsed = buildParsed(scenarioOps());
    const opus = scriptedOpus(JSON.stringify(["hallucinated"]));

    try {
      await classifyActions({
        parsed,
        openapiSha256: SHA,
        modelSnapshot: MODEL,
        classifiedAt: CLASSIFIED_AT,
        opusClient: opus,
      });
      expect.fail("expected classifyActions to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ClassifierError);
      expect((err as ClassifierError).code).toBe("ANCHORED_GENERATION_VIOLATION");
    }
  });
});
