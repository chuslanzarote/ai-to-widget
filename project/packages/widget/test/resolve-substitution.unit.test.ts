/**
 * T050 — Unit test for `resolveSubstitutionSource`.
 *
 * Covers contracts/widget-executor-engine.md §4.
 *
 * Safety posture (SC-006 static-verifiable): this function is the
 * ONLY code path that reads a catalog-derived substitution string.
 * Its body MUST be exactly a regex guard + `slice` + property lookup
 * on `intent.arguments` — no dotted-path traversal, no bracket
 * expressions, no eval / new Function. The Zod schema rejects
 * malformed substitutions at load time; this runtime guard is
 * belt-and-braces only.
 */
import { describe, it, expect } from "vitest";
import { resolveSubstitutionSource } from "../src/action-executors.js";
import type { ActionIntent } from "@atw/scripts/dist/lib/types.js";

function intent(args: Record<string, unknown>): ActionIntent {
  return {
    id: "act-1",
    tool: "add_to_cart",
    arguments: args,
    description: "Add a line item",
    confirmation_required: true,
    http: { method: "POST", path: "/noop" },
    summary: {},
  };
}

describe("resolveSubstitutionSource (T050)", () => {
  it("'arguments.cart_id' returns intent.arguments.cart_id", () => {
    const i = intent({ cart_id: "cart_01ABC", variant_id: "var_X" });
    expect(resolveSubstitutionSource("arguments.cart_id", i)).toBe("cart_01ABC");
  });

  it("'arguments.quantity' returns the numeric value verbatim", () => {
    const i = intent({ cart_id: "c1", quantity: 3 });
    expect(resolveSubstitutionSource("arguments.quantity", i)).toBe(3);
  });

  it("'arguments.flag' returns a boolean value verbatim", () => {
    const i = intent({ flag: false });
    expect(resolveSubstitutionSource("arguments.flag", i)).toBe(false);
  });

  it("missing key returns undefined (interpreter refuses elsewhere)", () => {
    const i = intent({ cart_id: "c1" });
    expect(resolveSubstitutionSource("arguments.variant_id", i)).toBeUndefined();
  });

  it("intent with no arguments returns undefined", () => {
    const i: ActionIntent = {
      id: "act-1",
      tool: "add_to_cart",
      arguments: {},
      description: "",
      confirmation_required: true,
      http: { method: "POST", path: "/noop" },
      summary: {},
    };
    expect(resolveSubstitutionSource("arguments.cart_id", i)).toBeUndefined();
  });

  // The regex guard is a runtime belt-and-braces check against a
  // catalog the loader somehow accepted despite Zod. It MUST throw,
  // not silently no-op, so a broken catalog fails loudly.
  it("throws on dotted path ('arguments.user.id' → escape)", () => {
    const i = intent({ user: { id: "u1" } });
    expect(() =>
      resolveSubstitutionSource("arguments.user.id", i),
    ).toThrow(/invalid substitution source/);
  });

  it("throws on bracket expression ('arguments[\"cart_id\"]')", () => {
    const i = intent({ cart_id: "c1" });
    expect(() =>
      resolveSubstitutionSource('arguments["cart_id"]', i),
    ).toThrow(/invalid substitution source/);
  });

  it("throws on wrong prefix ('context.cart_id')", () => {
    const i = intent({ cart_id: "c1" });
    expect(() =>
      resolveSubstitutionSource("context.cart_id", i),
    ).toThrow(/invalid substitution source/);
  });

  it("throws on empty tail ('arguments.')", () => {
    const i = intent({});
    expect(() => resolveSubstitutionSource("arguments.", i)).toThrow(
      /invalid substitution source/,
    );
  });

  it("throws on leading-digit identifier ('arguments.1bad')", () => {
    const i = intent({ "1bad": "x" });
    expect(() =>
      resolveSubstitutionSource("arguments.1bad", i),
    ).toThrow(/invalid substitution source/);
  });

  it("throws on empty string", () => {
    const i = intent({});
    expect(() => resolveSubstitutionSource("", i)).toThrow(
      /invalid substitution source/,
    );
  });

  it("does not call any method on intent.arguments beyond property access", () => {
    // Proxy that throws if anything other than `get` is used — proves
    // the implementation is a single property lookup, not a traversal.
    const tripwire = new Proxy(
      { cart_id: "c1" },
      {
        get(target, prop) {
          return (target as Record<string, unknown>)[prop as string];
        },
        set() {
          throw new Error("unexpected set");
        },
        deleteProperty() {
          throw new Error("unexpected delete");
        },
        apply() {
          throw new Error("unexpected apply");
        },
      },
    );
    const i: ActionIntent = {
      id: "act-1",
      tool: "add_to_cart",
      arguments: tripwire as Record<string, unknown>,
      description: "",
      confirmation_required: true,
      http: { method: "POST", path: "/noop" },
      summary: {},
    };
    expect(resolveSubstitutionSource("arguments.cart_id", i)).toBe("c1");
  });
});
