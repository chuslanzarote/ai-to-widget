/**
 * T068 — unit tests for orchestrator's US3 skip logic (source-hash path).
 *
 * The orchestrator's decision "skip this entity because it's already
 * enriched" is a pure-function invariant on top of `computeSourceHash` +
 * `stripMetadataForHash`: if the hash we compute for the freshly-assembled
 * input matches the hash the prior run persisted into `atw_documents`,
 * then (and only then) it is safe to skip the Opus call.
 *
 * Rather than spinning up Postgres + Docker, this file exercises the four
 * invariants that decision rests on:
 *
 *   1. Same input + same prompt-version + same model → same hash
 *      (so a re-run finds the DB row and skips).
 *   2. metadata.assembled_at is excluded from the hash
 *      (so re-assembling the same entity doesn't force re-enrichment).
 *   3. Any change to primary_record / related changes the hash
 *      (so stale documents are detected and re-enriched).
 *   4. Changing prompt_template_version OR model_id changes the hash
 *      (so upgrading the template re-enriches everything).
 *
 * The integration test at tests/integration/build-resumability.test.ts
 * (T069) exercises the full DB-backed skip path end-to-end.
 */
import { describe, it, expect } from "vitest";
import {
  computeSourceHash,
  stripMetadataForHash,
} from "../src/lib/source-hash.js";
import type { AssembledEntityInput } from "../src/lib/types.js";

const BASE_INPUT: AssembledEntityInput = {
  entity_type: "product",
  entity_id: "7",
  project_brief_summary: "coffee shop",
  primary_record: {
    id: "7",
    name: "Yirgacheffe",
    description: "Premium single-origin Arabica.",
  },
  related: [],
  metadata: {
    assembled_at: "2026-04-22T00:00:00Z",
    assembler_version: "1",
  },
};

describe("orchestrator skip-logic invariants (T068)", () => {
  it("same input → same hash (skip path is valid)", () => {
    const a = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const b = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    expect(a).toEqual(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("metadata.assembled_at does not affect the hash", () => {
    const later: AssembledEntityInput = {
      ...BASE_INPUT,
      metadata: {
        assembled_at: "2099-01-01T00:00:00Z",
        assembler_version: "1",
      },
    };
    const a = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const b = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(later),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    expect(a).toEqual(b);
  });

  it("changing primary_record forces a new hash (re-enrich needed)", () => {
    const edited: AssembledEntityInput = {
      ...BASE_INPUT,
      primary_record: {
        ...(BASE_INPUT.primary_record as Record<string, unknown>),
        description: "Premium single-origin Arabica — 2026 harvest.",
      },
    };
    const original = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const next = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(edited),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    expect(original).not.toEqual(next);
  });

  it("changing prompt_template_version forces a new hash", () => {
    const v1 = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const v2 = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v2",
      modelId: "claude-opus-4-7",
    });
    expect(v1).not.toEqual(v2);
  });

  it("changing model_id forces a new hash", () => {
    const opus = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const sonnet = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-sonnet-4-6",
    });
    expect(opus).not.toEqual(sonnet);
  });

  it("skip decision: exact prior == expected → skippable; anything else → re-enrich", () => {
    const expected = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    // Simulate the orchestrator's decision for each possible prior-run state.
    const decide = (priorHash: string | null, force: boolean): "skip" | "enrich" => {
      if (force) return "enrich";
      if (priorHash === null) return "enrich";
      return priorHash === expected ? "skip" : "enrich";
    };
    expect(decide(expected, false)).toBe("skip");
    expect(decide("sha256:0000", false)).toBe("enrich");
    expect(decide(null, false)).toBe("enrich");
    // --force bypasses the skip even when the hash matches.
    expect(decide(expected, true)).toBe("enrich");
  });

  it("permuting object keys in primary_record does not change the hash (canonical JSON)", () => {
    const permuted: AssembledEntityInput = {
      ...BASE_INPUT,
      primary_record: {
        description: "Premium single-origin Arabica.",
        id: "7",
        name: "Yirgacheffe",
      },
    };
    const a = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(BASE_INPUT),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    const b = computeSourceHash({
      assembledWithoutMetadata: stripMetadataForHash(permuted),
      promptTemplateVersion: "enrich-v1",
      modelId: "claude-opus-4-7",
    });
    expect(a).toEqual(b);
  });
});
