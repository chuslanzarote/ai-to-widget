import { describe, it, expect } from "vitest";
import { enrichEntity, type OpusClient } from "../src/enrich-entity.js";
import type { AssembledEntityInput } from "../src/lib/types.js";

const INPUT: AssembledEntityInput = {
  entity_type: "product",
  entity_id: "7",
  project_brief_summary: "Coffee shop.",
  primary_record: {
    id: "7",
    name: "Yirgacheffe",
    description:
      "Premium single-origin Arabica beans from the Yirgacheffe region of Ethiopia.",
  },
  related: [],
  metadata: { assembled_at: "2026-04-22T00:00:00Z", assembler_version: "1" },
};

const OK_DOCUMENT =
  "Yirgacheffe is a premium single-origin Arabica coffee from Ethiopia with bright floral notes.";

function scriptedClient(responses: Array<string>): OpusClient {
  let i = 0;
  return {
    async createMessage() {
      const contentText = responses[Math.min(i, responses.length - 1)];
      i += 1;
      return {
        contentText,
        usage: { input_tokens: 5000, output_tokens: 1000 },
      };
    },
  };
}

describe("enrichEntity retry logic (T061)", () => {
  it("first rejection → sharpen → accept: returns response with rejectedRules=[rule]", async () => {
    const bad = JSON.stringify({
      kind: "enriched",
      document: OK_DOCUMENT,
      facts: [{ claim: "from Mars", source: "primary_record.planet" }], // source not in input
      categories: {},
    });
    const good = JSON.stringify({
      kind: "enriched",
      document: OK_DOCUMENT,
      facts: [{ claim: "from Ethiopia", source: "primary_record.description" }],
      categories: {},
    });
    const client = scriptedClient([bad, good]);

    const result = await enrichEntity({ input: INPUT, opusClient: client });
    expect(result.validationFailedTwice).toBeUndefined();
    expect(result.rejectedRules).toEqual(["source_not_in_input"]);
    expect("kind" in result.response && result.response.kind).toBe("enriched");
    // Accumulated tokens across both calls:
    expect(result.tokens.input_tokens).toBe(10000);
    expect(result.tokens.output_tokens).toBe(2000);
  });

  it("first rejection → sharpen → second rejection: flagged validation_failed_twice", async () => {
    const bad = JSON.stringify({
      kind: "enriched",
      document: OK_DOCUMENT,
      facts: [{ claim: "from Mars", source: "primary_record.planet" }],
      categories: {},
    });
    const client = scriptedClient([bad, bad]);
    const result = await enrichEntity({ input: INPUT, opusClient: client });
    expect(result.validationFailedTwice).toBe(true);
    expect(result.rejectedRules).toHaveLength(2);
    expect(result.rejectedRules?.[0]).toBe("source_not_in_input");
    expect(result.rejectedRules?.[1]).toBe("source_not_in_input");
    // Response is a placeholder insufficient_data so orchestrator can pattern-match
    expect("insufficient_data" in result.response).toBe(true);
  });

  it("first call accepts: no retry, rejectedRules undefined", async () => {
    const good = JSON.stringify({
      kind: "enriched",
      document: OK_DOCUMENT,
      facts: [{ claim: "from Ethiopia", source: "primary_record.description" }],
      categories: {},
    });
    const client = scriptedClient([good]);
    const result = await enrichEntity({ input: INPUT, opusClient: client });
    expect(result.rejectedRules).toBeUndefined();
    expect(result.validationFailedTwice).toBeUndefined();
    expect(result.tokens.input_tokens).toBe(5000);
  });

  it("invalid_shape first, well-shaped second: retry succeeds", async () => {
    const bad = JSON.stringify({ kind: "enriched" }); // missing document+facts+categories
    const good = JSON.stringify({
      kind: "enriched",
      document: OK_DOCUMENT,
      facts: [{ claim: "from Ethiopia", source: "primary_record.description" }],
      categories: {},
    });
    const client = scriptedClient([bad, good]);
    const result = await enrichEntity({ input: INPUT, opusClient: client });
    expect(result.rejectedRules?.[0]).toBe("invalid_shape");
    expect("kind" in result.response && result.response.kind).toBe("enriched");
  });

  it("non-JSON first call throws OPUS_INVALID_JSON (no retry for pure parse failure)", async () => {
    const client = scriptedClient(["not json at all"]);
    await expect(enrichEntity({ input: INPUT, opusClient: client })).rejects.toMatchObject({
      code: "OPUS_INVALID_JSON",
    });
  });
});
