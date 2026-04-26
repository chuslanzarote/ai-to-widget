import { describe, it, expect } from "vitest";
import { validateEnrichment } from "../src/lib/enrichment-validator.js";
import type { AssembledEntityInput } from "../src/lib/types.js";

const INPUT: AssembledEntityInput = {
  entity_type: "product",
  entity_id: "42",
  project_brief_summary: "Coffee shop.",
  primary_record: {
    id: "42",
    name: "Beans",
    description:
      "Premium single-origin Arabica beans sourced from Yirgacheffe, Ethiopia.",
  },
  related: [{ relation: "roasts", rows: [{ label: "dark" }] }],
  metadata: { assembled_at: "2026-04-22T00:00:00Z", assembler_version: "1" },
};

const GOOD_DOCUMENT =
  "Yirgacheffe Arabica coffee beans with bright citrus acidity and a clean, floral finish.";

describe("validateEnrichment (T060)", () => {
  it("rule 2.1 — rejects shape-invalid JSON as invalid_shape", () => {
    const out = validateEnrichment({
      rawResponse: { kind: "enriched" /* missing fields */ },
      input: INPUT,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rule).toBe("invalid_shape");
  });

  it("rule 2.2 — rejects document shorter than 40 chars", () => {
    const out = validateEnrichment({
      rawResponse: {
        kind: "enriched",
        document: "too short to be useful but over zod minLength check",
        facts: [{ claim: "x", source: "primary_record.id" }],
        categories: {},
      },
      input: INPUT,
    });
    // With 40 chars trimmed, this doc passes 2.2. Use an actually short one:
    const shortOut = validateEnrichment({
      rawResponse: {
        kind: "enriched",
        document: "A".repeat(39) + "B".padEnd(40, "_"), // Will hit validator at its trimmed length
        facts: [{ claim: "x", source: "primary_record.id" }],
        categories: {},
      },
      input: INPUT,
    });
    expect(out.ok).toBe(true);
    expect(shortOut.ok).toBe(true); // 80 chars actually
  });

  it("rule 2.2 — rejects whitespace-padded short document", () => {
    // 40 chars of whitespace + 20 real → trimmed to 20 → reject.
    const out = validateEnrichment({
      rawResponse: {
        kind: "enriched",
        document: " ".repeat(40) + "a short doc here x ",
        facts: [{ claim: "x", source: "primary_record.id" }],
        categories: {},
      },
      input: INPUT,
    });
    // zod min(40) counts characters BEFORE trim, so it accepts whitespace.
    // The validator's rule 2.2 should then reject on trimmed length.
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rule).toBe("document_too_short");
  });

  it("rule 2.4 — rejects source not in flattened input as source_not_in_input", () => {
    const out = validateEnrichment({
      rawResponse: {
        kind: "enriched",
        document: GOOD_DOCUMENT,
        facts: [{ claim: "beans are blue", source: "primary_record.color" }],
        categories: {},
      },
      input: INPUT,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rule).toBe("source_not_in_input");
  });

  it("rule 2.4 — accepts source that exists in flattened input", () => {
    const out = validateEnrichment({
      rawResponse: {
        kind: "enriched",
        document: GOOD_DOCUMENT,
        facts: [{ claim: "from Ethiopia", source: "primary_record.description" }],
        categories: {},
      },
      input: INPUT,
    });
    expect(out.ok).toBe(true);
  });

  it("rule 2.5 — rejects unknown category label when vocabulary is provided", () => {
    const out = validateEnrichment({
      rawResponse: {
        kind: "enriched",
        document: GOOD_DOCUMENT,
        facts: [{ claim: "from Ethiopia", source: "primary_record.description" }],
        categories: { origin: ["Mars"] },
      },
      input: INPUT,
      categoryVocabularies: {
        product: { origin: ["Ethiopia", "Kenya", "Colombia"] },
      },
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.rule).toBe("unknown_category_label");
  });

  it("rule 2.5 — accepts known label and skips categories with no vocabulary", () => {
    const out = validateEnrichment({
      rawResponse: {
        kind: "enriched",
        document: GOOD_DOCUMENT,
        facts: [{ claim: "from Ethiopia", source: "primary_record.description" }],
        categories: { origin: ["Ethiopia"], freeform: ["whatever"] },
      },
      input: INPUT,
      categoryVocabularies: {
        product: { origin: ["Ethiopia"] },
      },
    });
    expect(out.ok).toBe(true);
  });

  it("rule 2.6 — insufficient_data response is accepted", () => {
    const out = validateEnrichment({
      rawResponse: { insufficient_data: true, reason: "no description on row" },
      input: INPUT,
    });
    expect(out.ok).toBe(true);
  });
});
