import { describe, it, expect } from "vitest";
import {
  canonicalJson,
  computeSourceHash,
  stripMetadataForHash,
} from "../src/lib/source-hash.js";

describe("canonicalJson", () => {
  it("sorts keys alphabetically", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("emits no whitespace", () => {
    expect(canonicalJson({ a: [1, 2], b: { c: 3 } })).toBe(
      '{"a":[1,2],"b":{"c":3}}',
    );
  });

  it("is stable for structurally equal inputs regardless of key order", () => {
    const a = canonicalJson({ x: 1, y: { b: 2, a: 3 } });
    const b = canonicalJson({ y: { a: 3, b: 2 }, x: 1 });
    expect(a).toBe(b);
  });

  it("refuses undefined", () => {
    expect(() => canonicalJson({ a: undefined })).toThrow();
  });

  it("refuses NaN / Infinity", () => {
    expect(() => canonicalJson(NaN)).toThrow();
    expect(() => canonicalJson(Infinity)).toThrow();
  });
});

describe("computeSourceHash", () => {
  const input = { entity_type: "product", primary_record: { title: "Eau" } };

  it("returns a sha256:<hex> prefixed string", () => {
    const h = computeSourceHash({
      assembledWithoutMetadata: input,
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("is bit-identical across two invocations", () => {
    const h1 = computeSourceHash({
      assembledWithoutMetadata: input,
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const h2 = computeSourceHash({
      assembledWithoutMetadata: input,
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    expect(h1).toBe(h2);
  });

  it("changes when the prompt template version changes", () => {
    const h1 = computeSourceHash({
      assembledWithoutMetadata: input,
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const h2 = computeSourceHash({
      assembledWithoutMetadata: input,
      promptTemplateVersion: "enrich-v2",
      modelId: "claude-opus-4-7",
    });
    expect(h1).not.toBe(h2);
  });

  it("changes when the model id changes", () => {
    const h1 = computeSourceHash({
      assembledWithoutMetadata: input,
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const h2 = computeSourceHash({
      assembledWithoutMetadata: input,
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-sonnet-4-6",
    });
    expect(h1).not.toBe(h2);
  });

  it("is identical for structurally equal inputs with different key order", () => {
    const a = { x: 1, y: 2 };
    const b = { y: 2, x: 1 };
    const h1 = computeSourceHash({
      assembledWithoutMetadata: a,
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const h2 = computeSourceHash({
      assembledWithoutMetadata: b,
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    expect(h1).toBe(h2);
  });
});

describe("stripMetadataForHash", () => {
  it("removes the metadata field", () => {
    const input = {
      entity_id: "x",
      primary_record: { a: 1 },
      metadata: { assembled_at: "2026-04-22T00:00:00Z", assembler_version: "1" },
    };
    const stripped = stripMetadataForHash(input);
    expect(stripped).not.toHaveProperty("metadata");
    expect(stripped).toHaveProperty("entity_id", "x");
  });

  it("guarantees hash stability across assemble_at drift", () => {
    const inputA = {
      entity_id: "x",
      primary_record: { a: 1 },
      metadata: { assembled_at: "2026-04-22T00:00:00Z", assembler_version: "1" },
    };
    const inputB = {
      entity_id: "x",
      primary_record: { a: 1 },
      metadata: { assembled_at: "2026-04-23T12:34:56Z", assembler_version: "1" },
    };
    const h1 = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(inputA),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const h2 = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(inputB),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    expect(h1).toBe(h2);
  });
});
