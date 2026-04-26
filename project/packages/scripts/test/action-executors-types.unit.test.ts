import { describe, it, expect } from "vitest";
import {
  ActionExecutorEntrySchema,
  ActionExecutorsCatalogSchema,
  EMPTY_CATALOG,
  SubstitutionSourceSchema,
} from "../src/lib/action-executors-types.js";

describe("ActionExecutorsCatalog Zod schemas (T012, FR-009 + FR-010)", () => {
  const validEntry = {
    tool: "add_to_cart",
    method: "POST" as const,
    pathTemplate: "/store/carts/{cart_id}/line-items",
    substitution: {
      path: { cart_id: "arguments.cart_id" },
      body: {
        variant_id: "arguments.variant_id",
        quantity: "arguments.quantity",
      },
      query: {},
    },
    headers: { "content-type": "application/json" },
    responseHandling: {
      successStatuses: [200, 201],
      summaryTemplate: "Added {quantity} × {product_title}",
      summaryFields: ["quantity", "product_title"],
    },
  };

  describe("SubstitutionSourceSchema", () => {
    it("accepts arguments.<identifier>", () => {
      expect(SubstitutionSourceSchema.parse("arguments.valid_id")).toBe(
        "arguments.valid_id",
      );
      expect(SubstitutionSourceSchema.parse("arguments.x")).toBe("arguments.x");
      expect(
        SubstitutionSourceSchema.parse("arguments._underscore_first"),
      ).toBe("arguments._underscore_first");
    });

    it("rejects dotted paths", () => {
      expect(() => SubstitutionSourceSchema.parse("arguments.foo.bar")).toThrow(
        /substitution/,
      );
    });

    it("rejects bracket accessors", () => {
      expect(() => SubstitutionSourceSchema.parse("arguments[0]")).toThrow();
      expect(() =>
        SubstitutionSourceSchema.parse("arguments['cart_id']"),
      ).toThrow();
    });

    it("rejects raw identifiers without the arguments. prefix", () => {
      expect(() => SubstitutionSourceSchema.parse("cart_id")).toThrow();
    });

    it("rejects identifier starting with a digit", () => {
      expect(() => SubstitutionSourceSchema.parse("arguments.1bad")).toThrow();
    });
  });

  describe("credential-class header refinement (Principle I)", () => {
    const casings = ["Authorization", "authorization", "AUTHORIZATION"];
    for (const key of casings) {
      it(`rejects "${key}" regardless of case`, () => {
        expect(() =>
          ActionExecutorEntrySchema.parse({
            ...validEntry,
            headers: { ...validEntry.headers, [key]: "Bearer {token}" },
          }),
        ).toThrow(/credential-class/);
      });
    }

    it("rejects Cookie header", () => {
      expect(() =>
        ActionExecutorEntrySchema.parse({
          ...validEntry,
          headers: { Cookie: "session=123" },
        }),
      ).toThrow(/credential-class/);
    });

    it("rejects Set-Cookie header", () => {
      expect(() =>
        ActionExecutorEntrySchema.parse({
          ...validEntry,
          headers: { "set-cookie": "foo=bar" },
        }),
      ).toThrow(/credential-class/);
    });

    it("rejects X-*-Token, X-*-Auth, X-*-Session family", () => {
      for (const key of [
        "X-Foo-Token",
        "x-bar-auth",
        "X-Custom-Session",
      ]) {
        expect(() =>
          ActionExecutorEntrySchema.parse({
            ...validEntry,
            headers: { [key]: "value" },
          }),
        ).toThrow(/credential-class/);
      }
    });

    it("accepts benign headers (content-type, accept, x-trace-id)", () => {
      const parsed = ActionExecutorEntrySchema.parse({
        ...validEntry,
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-trace-id": "deterministic",
        },
      });
      expect(parsed.headers["content-type"]).toBe("application/json");
    });
  });

  describe("pathTemplate regex (R4 — relative URLs only)", () => {
    it("rejects absolute http URLs", () => {
      expect(() =>
        ActionExecutorEntrySchema.parse({
          ...validEntry,
          pathTemplate: "http://host.example/store/x",
        }),
      ).toThrow(/pathTemplate/);
    });

    it("rejects protocol-relative URLs", () => {
      expect(() =>
        ActionExecutorEntrySchema.parse({
          ...validEntry,
          pathTemplate: "//host/store/x",
        }),
      ).toThrow();
    });

    it("accepts a rooted path with {placeholder} segments", () => {
      const parsed = ActionExecutorEntrySchema.parse({
        ...validEntry,
        pathTemplate: "/store/carts/{cart_id}/line-items/{line_id}",
      });
      expect(parsed.pathTemplate).toContain("{cart_id}");
    });
  });

  describe("ActionExecutorsCatalogSchema", () => {
    it("accepts the EMPTY_CATALOG constant", () => {
      const parsed = ActionExecutorsCatalogSchema.parse(EMPTY_CATALOG);
      expect(parsed.actions).toEqual([]);
      expect(parsed.version).toBe(1);
    });

    it("rejects any version other than 1", () => {
      expect(() =>
        ActionExecutorsCatalogSchema.parse({
          ...EMPTY_CATALOG,
          version: 2 as unknown as 1,
        }),
      ).toThrow();
    });

    it("rejects any credentialMode other than same-origin-cookies", () => {
      expect(() =>
        ActionExecutorsCatalogSchema.parse({
          ...EMPTY_CATALOG,
          credentialMode: "bearer" as unknown as "same-origin-cookies",
        }),
      ).toThrow();
    });

    it("accepts a catalog with a fully valid action entry", () => {
      const parsed = ActionExecutorsCatalogSchema.parse({
        version: 1,
        credentialMode: "same-origin-cookies",
        actions: [validEntry],
      });
      expect(parsed.actions[0].tool).toBe("add_to_cart");
    });
  });
});
