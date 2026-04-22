import { describe, it, expect } from "vitest";
import { detectPII } from "../src/lib/pii-detection.js";
import type { ParsedSQLSchema } from "../src/lib/types.js";

function schemaOf(tables: { name: string; columns: { name: string; dataType?: string }[] }[]): ParsedSQLSchema {
  return {
    version: 1,
    dialect: "postgres",
    schemas: [
      {
        name: "public",
        tables: tables.map((t) => ({
          schema: "public",
          name: t.name,
          columns: t.columns.map((c) => ({
            name: c.name,
            dataType: c.dataType ?? "text",
            nullable: true,
            default: null,
            isPrimaryKey: false,
            comment: null,
          })),
          primaryKey: [],
          foreignKeys: [],
          uniqueConstraints: [],
          indexes: [],
          inherits: null,
          comment: null,
        })),
        enums: [],
        extensions: [],
      },
    ],
    sampleRows: {},
    parseErrors: [],
  };
}

describe("pii-detection (T061)", () => {
  it("flags email/phone/name columns by name", () => {
    const report = detectPII(
      schemaOf([
        {
          name: "profile",
          columns: [
            { name: "id" },
            { name: "email" },
            { name: "phone_number" },
            { name: "first_name" },
            { name: "last_name" },
            { name: "bio" },
          ],
        },
      ]),
    );
    const classes = new Set(report.columns.map((c) => c.piiClass));
    expect(classes.has("email")).toBe(true);
    expect(classes.has("phone")).toBe(true);
    expect(classes.has("name")).toBe(true);
    expect(classes.has("free-text-bio")).toBe(true);
  });

  it("flags payment + gov-id column names", () => {
    const report = detectPII(
      schemaOf([
        {
          name: "billing",
          columns: [
            { name: "card_number" },
            { name: "card_last_four" },
            { name: "iban" },
            { name: "ssn" },
            { name: "passport" },
          ],
        },
      ]),
    );
    const byName = Object.fromEntries(report.columns.map((c) => [c.column, c.piiClass]));
    expect(byName["card_number"]).toBe("payment");
    expect(byName["card_last_four"]).toBe("payment");
    expect(byName["iban"]).toBe("payment");
    expect(byName["ssn"]).toBe("gov-id");
    expect(byName["passport"]).toBe("gov-id");
  });

  it("falls back to sample-value detection when column name is opaque", () => {
    const schema = schemaOf([{ name: "messages", columns: [{ name: "blob" }] }]);
    const samples = {
      "public.messages": [{ blob: "alice@example.com" }, { blob: "bob@example.com" }],
    };
    const report = detectPII(schema, samples);
    const hit = report.columns.find((c) => c.column === "blob");
    expect(hit?.piiClass).toBe("email");
    expect(hit?.evidence).toMatch(/sample values/);
  });

  it("flags customer and payment tables at table level (FR-022)", () => {
    const report = detectPII(
      schemaOf([
        { name: "customer", columns: [{ name: "id" }] },
        { name: "customer_address", columns: [{ name: "id" }] },
        { name: "payments", columns: [{ name: "id" }] },
        { name: "product", columns: [{ name: "id" }] },
      ]),
    );
    const flagged = new Set(report.tables.map((t) => t.table));
    expect(flagged.has("customer")).toBe(true);
    expect(flagged.has("customer_address")).toBe(true);
    expect(flagged.has("payments")).toBe(true);
    expect(flagged.has("product")).toBe(false);
  });

  it("does not flag innocuous columns", () => {
    const report = detectPII(
      schemaOf([
        {
          name: "product",
          columns: [
            { name: "id" },
            { name: "title" },
            { name: "price_cents" },
            { name: "created_at" },
          ],
        },
      ]),
    );
    expect(report.columns).toHaveLength(0);
  });
});
