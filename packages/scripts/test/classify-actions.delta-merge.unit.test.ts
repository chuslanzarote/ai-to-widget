/**
 * T027 — Delta-merge unit tests (R7, contracts/classifier-contract.md §5).
 *
 * Invariants:
 *   - Builder edits to `prior.included` survive re-classify.
 *   - `prior.included` entries whose OpenAPI op disappeared → `orphaned[]`.
 *   - New OpenAPI ops not in `prior` run through Stage 1 + Opus and merge in.
 *   - With an identical op set (no new candidates), rendered manifest is
 *     byte-identical to what `render(prior)` would have produced.
 */
import { describe, it, expect } from "vitest";

import { classifyActions } from "../src/classify-actions.js";
import { renderActionManifest } from "../src/render-action-manifest.js";
import { parseActionManifestText } from "../src/parse-action-manifest.js";
import type {
  ActionManifest,
  ActionManifestEntry,
} from "../src/lib/action-manifest-types.js";
import type {
  ParsedOpenAPI,
  ParsedOpenAPIOperation,
} from "../src/lib/types.js";
import type { OpusClient } from "../src/enrich-entity.js";

const SHA = "sha256:" + "0".repeat(64);
const MODEL = "claude-opus-4-7 (2026-04-23)";
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
        usage: { input_tokens: 50, output_tokens: 10 },
      };
    },
  };
}

const throwingOpus: OpusClient = {
  async createMessage() {
    throw new Error("opusClient should not be called when newCandidates is empty");
  },
};

function addToCartEntry(overrides: Partial<ActionManifestEntry> = {}): ActionManifestEntry {
  return {
    toolName: "add_to_cart",
    description: "Add a variant to the cart.",
    parameters: {
      type: "object",
      properties: {
        cart_id: { type: "string" },
        variant_id: { type: "string" },
      },
      required: ["cart_id", "variant_id"],
    },
    requiresConfirmation: true,
    isAction: true,
    source: {
      method: "POST",
      path: "/store/carts/{cart_id}/line-items",
      operationId: "addLineItem",
    },
    ...overrides,
  };
}

describe("classifyActions — delta-merge (T027)", () => {
  it("preserves a Builder-flipped requiresConfirmation=false across re-classify", async () => {
    // Prior: Builder manually flipped confirmation to false.
    const prior: ActionManifest = {
      provenance: {
        openapiSha256: SHA,
        classifierModel: MODEL,
        classifiedAt: "2026-04-23T09:00:00Z",
      },
      summary: "prior summary",
      included: [addToCartEntry({ requiresConfirmation: false })],
      excluded: [],
      orphaned: [],
    };

    const parsed = buildParsed([
      buildOp({
        id: "addLineItem",
        method: "post",
        path: "/store/carts/{cart_id}/line-items",
      }),
    ]);

    const { manifest } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      prior,
      opusClient: throwingOpus,
    });

    expect(manifest.included).toHaveLength(1);
    expect(manifest.included[0]?.requiresConfirmation).toBe(false);
    expect(manifest.included[0]?.toolName).toBe("add_to_cart");
  });

  it("moves a prior-included entry to orphaned[] when its OpenAPI op disappeared", async () => {
    const prior: ActionManifest = {
      provenance: {
        openapiSha256: SHA,
        classifierModel: MODEL,
        classifiedAt: "2026-04-23T09:00:00Z",
      },
      summary: "prior summary",
      included: [addToCartEntry()],
      excluded: [],
      orphaned: [],
    };

    // Current OpenAPI no longer contains addLineItem.
    const parsed = buildParsed([
      buildOp({
        id: "someOtherOp",
        method: "post",
        path: "/store/carts/{cart_id}/promotions",
      }),
    ]);

    const { manifest } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      prior,
      opusClient: scriptedOpus(JSON.stringify(["someOtherOp"])),
    });

    expect(manifest.orphaned).toHaveLength(1);
    expect(manifest.orphaned[0]).toMatchObject({
      method: "POST",
      path: "/store/carts/{cart_id}/line-items",
      previousToolName: "add_to_cart",
    });
    // add_to_cart is NOT in included anymore.
    expect(manifest.included.some((e) => e.toolName === "add_to_cart")).toBe(false);
  });

  it("merges a new OpenAPI op through heuristic+Opus alongside preserved prior entries", async () => {
    const prior: ActionManifest = {
      provenance: {
        openapiSha256: SHA,
        classifierModel: MODEL,
        classifiedAt: "2026-04-23T09:00:00Z",
      },
      summary: "prior summary",
      included: [addToCartEntry()],
      excluded: [],
      orphaned: [],
    };

    const parsed = buildParsed([
      buildOp({
        id: "addLineItem",
        method: "post",
        path: "/store/carts/{cart_id}/line-items",
      }),
      buildOp({
        id: "addToWishlist",
        method: "post",
        path: "/store/wishlist/items",
      }),
    ]);

    // Opus returns the new op (existing one is already preserved, not sent).
    const { manifest } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      prior,
      opusClient: scriptedOpus(JSON.stringify(["addToWishlist"])),
    });

    const opIds = manifest.included.map((e) => e.source.operationId).sort();
    expect(opIds).toEqual(["addLineItem", "addToWishlist"]);
    // prior add_to_cart entry preserved verbatim (same toolName, same descr).
    const addToCart = manifest.included.find((e) => e.toolName === "add_to_cart");
    expect(addToCart?.description).toBe("Add a variant to the cart.");
  });

  it("byte-identical re-classify when the op set is unchanged", async () => {
    // Construct an in-memory manifest, render it, parse it as prior, and
    // re-classify against the same OpenAPI. The second render MUST match
    // the first render exactly (Principle VIII — reproducibility).
    const initial: ActionManifest = {
      provenance: {
        openapiSha256: SHA,
        classifierModel: MODEL,
        classifiedAt: CLASSIFIED_AT,
      },
      summary: "A tiny byte-identical fixture.",
      included: [addToCartEntry()],
      excluded: [],
      orphaned: [],
    };

    const text1 = renderActionManifest(initial);
    const priorParsed = parseActionManifestText(text1);
    // parseActionManifestText seeds source.operationId from toolName; in
    // production parseActionManifest runs crossValidateAgainstOpenAPI which
    // replaces it with the true op id from the OpenAPI doc. Simulate that
    // here so deltaMerge's opsById lookup matches.
    for (const e of priorParsed.included) {
      if (e.toolName === "add_to_cart") e.source.operationId = "addLineItem";
    }

    const parsed = buildParsed([
      buildOp({
        id: "addLineItem",
        method: "post",
        path: "/store/carts/{cart_id}/line-items",
      }),
    ]);

    const { manifest } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      prior: priorParsed,
      summary: initial.summary,
      opusClient: throwingOpus,
    });

    const text2 = renderActionManifest(manifest);
    expect(text2).toBe(text1);
  });
});
