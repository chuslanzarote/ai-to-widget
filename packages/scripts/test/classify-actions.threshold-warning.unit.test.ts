/**
 * T029 — FR-019 >20 threshold warning unit test.
 *
 * Contract (spec.md FR-019): when the classifier keeps more than 20
 * actions, one warning must be emitted for each entry over the threshold
 * so the Builder owner can audit Opus's tool-selection accuracy.
 */
import { describe, it, expect } from "vitest";

import { classifyActions } from "../src/classify-actions.js";
import type {
  ParsedOpenAPI,
  ParsedOpenAPIOperation,
} from "../src/lib/types.js";
import type { OpusClient } from "../src/enrich-entity.js";

const SHA = "sha256:" + "0".repeat(64);
const MODEL = "claude-opus-4-7";
const CLASSIFIED_AT = "2026-04-23T10:00:00Z";

function buildOps(n: number): ParsedOpenAPIOperation[] {
  const ops: ParsedOpenAPIOperation[] = [];
  for (let i = 1; i <= n; i++) {
    ops.push({
      id: `shopperAction${i}`,
      method: "post",
      // "cart" segment ensures path is classified as shopper-owned so the
      // heuristic does not exclude these ops before Opus sees them.
      path: `/store/cart/line-items/action-${i}`,
      tag: null,
      summary: null,
      description: null,
      security: [],
      parameters: [],
      requestBody: {
        contentType: "application/json",
        schema: {
          type: "object",
          properties: { note: { type: "string" } },
          required: ["note"],
        },
      },
      responses: [],
    });
  }
  return ops;
}

function buildParsed(ops: ParsedOpenAPIOperation[]): ParsedOpenAPI {
  return {
    version: 1,
    sourceVersion: "3.0",
    sourceUrl: null,
    title: "threshold-test",
    apiDescription: null,
    servers: [],
    tags: [],
    operations: ops,
  };
}

function opusReturning(ids: string[]): OpusClient {
  return {
    async createMessage() {
      return {
        contentText: JSON.stringify(ids),
        usage: { input_tokens: 50, output_tokens: 10 },
      };
    },
  };
}

describe("classifyActions — FR-019 threshold warning (T029)", () => {
  it("emits one warning per action over 20 and references FR-019", async () => {
    const ops = buildOps(25);
    const parsed = buildParsed(ops);
    const opus = opusReturning(ops.map((o) => o.id));

    const { manifest, warnings } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      opusClient: opus,
    });

    expect(manifest.included).toHaveLength(25);
    const thresholdWarnings = warnings.filter((w) => w.includes("FR-019"));
    expect(thresholdWarnings).toHaveLength(5);
    for (const w of thresholdWarnings) {
      expect(w).toMatch(/FR-019/);
      expect(w).toMatch(/threshold of 20/);
      expect(w).toMatch(/tool-selection accuracy/);
    }
  });

  it("emits no threshold warnings at exactly 20 kept actions", async () => {
    const ops = buildOps(20);
    const parsed = buildParsed(ops);
    const opus = opusReturning(ops.map((o) => o.id));

    const { manifest, warnings } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      opusClient: opus,
    });

    expect(manifest.included).toHaveLength(20);
    expect(warnings.filter((w) => w.includes("FR-019"))).toHaveLength(0);
  });

  it("emits no threshold warnings under 20 kept actions", async () => {
    const ops = buildOps(5);
    const parsed = buildParsed(ops);
    const opus = opusReturning(ops.map((o) => o.id));

    const { warnings } = await classifyActions({
      parsed,
      openapiSha256: SHA,
      modelSnapshot: MODEL,
      classifiedAt: CLASSIFIED_AT,
      opusClient: opus,
    });

    expect(warnings.filter((w) => w.includes("FR-019"))).toHaveLength(0);
  });
});
