/**
 * T041 — Contract test for `actionEntryToDescriptor()` mapping.
 *
 * Per contracts/render-tools-context.md §3:
 *   - name ← toolName
 *   - description ← description
 *   - input_schema ← parameters
 *   - http.method ← source.method (uppercase)
 *   - http.path ← source.path (starts with /)
 *   - is_action ← isAction
 *   - description_template ← descriptionTemplate when present
 *   - summary_fields ← summaryFields when present
 *   - optional fields OMITTED (not null / undefined) when absent
 */
import { describe, it, expect } from "vitest";

import { actionEntryToDescriptor } from "../src/parse-action-manifest.js";
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

describe("actionEntryToDescriptor (T041)", () => {
  it("maps toolName → name", () => {
    const d = actionEntryToDescriptor(entry({ toolName: "custom_tool" }));
    expect(d.name).toBe("custom_tool");
  });

  it("maps description → description", () => {
    const d = actionEntryToDescriptor(entry({ description: "do the thing" }));
    expect(d.description).toBe("do the thing");
  });

  it("maps parameters → input_schema (object preserved)", () => {
    const params = {
      type: "object" as const,
      properties: {
        foo: { type: "string" },
        bar: { type: "number" },
      },
      required: ["foo"],
    };
    const d = actionEntryToDescriptor(entry({ parameters: params }));
    expect(d.input_schema).toEqual(params);
    expect((d.input_schema as { type: string }).type).toBe("object");
  });

  it("maps source.method → http.method (upper-case preserved)", () => {
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      const d = actionEntryToDescriptor(
        entry({ source: { method: m, path: "/x", operationId: "op" } }),
      );
      expect(d.http.method).toBe(m);
    }
  });

  it("maps source.path → http.path (starts with /)", () => {
    const d = actionEntryToDescriptor(
      entry({
        source: {
          method: "POST",
          path: "/store/carts/{cart_id}/line-items",
          operationId: "addLineItem",
        },
      }),
    );
    expect(d.http.path).toBe("/store/carts/{cart_id}/line-items");
    expect(d.http.path.startsWith("/")).toBe(true);
  });

  it("maps isAction → is_action (true)", () => {
    const d = actionEntryToDescriptor(entry({ isAction: true }));
    expect(d.is_action).toBe(true);
  });

  it("maps isAction → is_action (false)", () => {
    const d = actionEntryToDescriptor(entry({ isAction: false }));
    expect(d.is_action).toBe(false);
  });

  it("includes description_template when entry has descriptionTemplate", () => {
    const d = actionEntryToDescriptor(
      entry({ descriptionTemplate: "Add {{variant_id}} to your cart." }),
    );
    expect(d.description_template).toBe("Add {{variant_id}} to your cart.");
  });

  it("includes summary_fields when entry has summaryFields", () => {
    const d = actionEntryToDescriptor(
      entry({ summaryFields: ["variant_id", "quantity"] }),
    );
    expect(d.summary_fields).toEqual(["variant_id", "quantity"]);
  });

  it("OMITS description_template entirely when absent (not null/undefined)", () => {
    const d = actionEntryToDescriptor(entry({}));
    expect("description_template" in d).toBe(false);
  });

  it("OMITS summary_fields entirely when absent (not null/undefined)", () => {
    const d = actionEntryToDescriptor(entry({}));
    expect("summary_fields" in d).toBe(false);
  });

  it("preserves declaration key order of RuntimeToolDescriptor", () => {
    const d = actionEntryToDescriptor(
      entry({
        descriptionTemplate: "Add X",
        summaryFields: ["a", "b"],
      }),
    );
    const keys = Object.keys(d);
    expect(keys).toEqual([
      "name",
      "description",
      "input_schema",
      "http",
      "is_action",
      "description_template",
      "summary_fields",
    ]);
  });
});
