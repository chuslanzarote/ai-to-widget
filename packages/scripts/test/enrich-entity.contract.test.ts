import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enrichEntity, runEnrichEntity, type OpusClient } from "../src/enrich-entity.js";
import type { AssembledEntityInput } from "../src/lib/types.js";

const MINIMAL_INPUT: AssembledEntityInput = {
  entity_type: "product",
  entity_id: "1",
  project_brief_summary: "Coffee shop.",
  primary_record: { id: "1", name: "Beans", description: "Premium single-origin Arabica beans from Ethiopia." },
  related: [],
  metadata: { assembled_at: "2026-04-22T00:00:00Z", assembler_version: "1" },
};

function makeStubClient(contentText: string, usage = { input_tokens: 5000, output_tokens: 1000 }): OpusClient {
  return {
    async createMessage() {
      return { contentText, usage };
    },
  };
}

describe("atw-enrich-entity contract (T044)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("CLI exit 0 on --help", async () => {
    const code = await runEnrichEntity(["--help"]);
    expect(code).toBe(0);
  });

  it("CLI exit 0 on --version", async () => {
    const code = await runEnrichEntity(["--version"]);
    expect(code).toBe(0);
  });

  it("CLI exit 3 on unknown flag", async () => {
    const code = await runEnrichEntity(["--bogus"]);
    expect(code).toBe(3);
  });

  it("library: returns enriched shape, tokens, cost on valid JSON response", async () => {
    const opusClient = makeStubClient(
      JSON.stringify({
        kind: "enriched",
        document:
          "Premium Ethiopian Arabica coffee beans sold whole and ground with tasting notes of chocolate and berry.",
        facts: [
          { claim: "origin is Ethiopia", source: "primary_record.description" },
        ],
        categories: { origin: ["Ethiopia"] },
      }),
    );
    const result = await enrichEntity({ input: MINIMAL_INPUT, opusClient });
    expect(result.response).toHaveProperty("kind", "enriched");
    expect(result.tokens.input_tokens).toBe(5000);
    expect(result.tokens.output_tokens).toBe(1000);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.promptTemplateVersion).toBe("enrich-v1");
  });

  it("library: returns insufficient_data shape unchanged", async () => {
    const opusClient = makeStubClient(
      JSON.stringify({ insufficient_data: true, reason: "no description" }),
    );
    const result = await enrichEntity({ input: MINIMAL_INPUT, opusClient });
    expect("insufficient_data" in result.response).toBe(true);
  });

  it("library: throws OPUS_INVALID_JSON on non-JSON content (exit 11 maps here)", async () => {
    const opusClient = makeStubClient("not valid json at all");
    // MVP path: no sharpening retry; non-JSON propagates as OPUS_INVALID_JSON.
    await expect(
      enrichEntity({ input: MINIMAL_INPUT, opusClient, anchorValidation: false }),
    ).rejects.toMatchObject({ code: "OPUS_INVALID_JSON" });
  });

  it("library: throws VALIDATION_FAILED on shape-invalid JSON in MVP path (exit 11 maps here)", async () => {
    const opusClient = makeStubClient(JSON.stringify({ kind: "enriched" })); // missing document+facts+categories
    await expect(
      enrichEntity({ input: MINIMAL_INPUT, opusClient, anchorValidation: false }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});
