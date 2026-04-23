/**
 * T042 — Canonical `toolsJson` unit test.
 *
 * Per contracts/render-tools-context.md §4:
 *   - Top-level descriptor key order: name, description, input_schema,
 *     http, is_action, description_template, summary_fields.
 *   - input_schema sub-keys: alphabetical (recursive) via
 *     canonicaliseInputSchema.
 *   - summary_fields preserves manifest order.
 *   - No trailing whitespace on any line.
 *   - 2-space indent.
 */
import { describe, it, expect } from "vitest";

import {
  actionEntryToDescriptor,
  canonicaliseInputSchema,
} from "../src/parse-action-manifest.js";
import { serialiseTools } from "../src/render-backend.js";
import type { ActionManifestEntry } from "../src/lib/action-manifest-types.js";

function entry(overrides: Partial<ActionManifestEntry> = {}): ActionManifestEntry {
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

describe("toolsJson canonicalisation (T042)", () => {
  it("descriptor key order in serialised JSON matches declaration", () => {
    const e = entry({
      descriptionTemplate: "Add X",
      summaryFields: ["b", "a"],
    });
    const d = actionEntryToDescriptor(e);
    d.input_schema = canonicaliseInputSchema(
      d.input_schema as Record<string, unknown>,
    );
    const json = serialiseTools([d]);
    // Match top-level key order per FR-012. Use a regex that threads
    // through each expected key in order without matching any key
    // between them.
    const orderRx =
      /"name":[\s\S]*?"description":[\s\S]*?"input_schema":[\s\S]*?"http":[\s\S]*?"is_action":[\s\S]*?"description_template":[\s\S]*?"summary_fields":/;
    expect(json).toMatch(orderRx);
  });

  it("input_schema sub-keys are alphabetically sorted (recursively)", () => {
    // Deliberately shuffled input order.
    const e = entry({
      parameters: {
        type: "object",
        properties: {
          zeta: { type: "number" },
          alpha: {
            type: "object",
            properties: { y: { type: "string" }, a: { type: "string" } },
            required: [],
          },
          middle: { type: "string" },
        },
        required: ["zeta"],
      },
    });
    const d = actionEntryToDescriptor(e);
    d.input_schema = canonicaliseInputSchema(
      d.input_schema as Record<string, unknown>,
    );
    const json = serialiseTools([d]);
    // Top-level properties ordered alphabetically: alpha < middle < zeta.
    const topOrder = /"alpha"[\s\S]*?"middle"[\s\S]*?"zeta"/;
    expect(json).toMatch(topOrder);
    // Nested under alpha.properties: a < y.
    const nestedOrder = /"a":\s*\{\s*"type":\s*"string"\s*\}[\s\S]*?"y":/;
    expect(json).toMatch(nestedOrder);
  });

  it("summary_fields preserves manifest order (NOT alphabetised)", () => {
    const e = entry({ summaryFields: ["zeta", "alpha", "middle"] });
    const d = actionEntryToDescriptor(e);
    d.input_schema = canonicaliseInputSchema(
      d.input_schema as Record<string, unknown>,
    );
    const json = serialiseTools([d]);
    // zeta before alpha before middle → sort-order preservation proof.
    expect(json).toMatch(/"zeta"[\s\S]*?"alpha"[\s\S]*?"middle"/);
  });

  it("JSON uses 2-space indent and no trailing whitespace on any line", () => {
    const e = entry({ summaryFields: ["a", "b"] });
    const d = actionEntryToDescriptor(e);
    d.input_schema = canonicaliseInputSchema(
      d.input_schema as Record<string, unknown>,
    );
    const json = serialiseTools([d]);
    const lines = json.split("\n");
    // The array contains `  {` at column 2 (2-space indent) and each
    // descriptor key is at column 4 (`    "name": ...`).
    expect(lines.some((l) => /^  \{$/.test(l))).toBe(true);
    expect(lines.some((l) => /^    "name":/.test(l))).toBe(true);
    // No line may end in whitespace.
    for (const line of lines) {
      expect(line).not.toMatch(/\s+$/);
    }
  });

  it("canonicaliseInputSchema on a flat object sorts keys", () => {
    const out = canonicaliseInputSchema({
      type: "object",
      properties: { gamma: {}, alpha: {}, beta: {} },
      required: [],
    });
    expect(Object.keys(out)).toEqual(["properties", "required", "type"]);
    const props = out.properties as Record<string, unknown>;
    expect(Object.keys(props)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("canonicaliseInputSchema leaves arrays alone (does not sort)", () => {
    const out = canonicaliseInputSchema({
      type: "object",
      properties: {},
      required: ["zeta", "alpha", "middle"],
    });
    expect(out.required).toEqual(["zeta", "alpha", "middle"]);
  });
});
