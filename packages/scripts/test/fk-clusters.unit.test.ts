import { describe, it, expect } from "vitest";
import { clusterTables } from "../src/lib/fk-clusters.js";
import type { ParsedSQLSchema, ParsedSQLTable } from "../src/lib/types.js";

function table(name: string, fks: { ref: string }[] = []): ParsedSQLTable {
  return {
    schema: "public",
    name,
    columns: [],
    primaryKey: [],
    foreignKeys: fks.map((f) => ({
      columns: ["x"],
      referenceSchema: "public",
      referenceTable: f.ref,
      referenceColumns: ["id"],
      onDelete: null,
      onUpdate: null,
    })),
    uniqueConstraints: [],
    indexes: [],
    inherits: null,
    comment: null,
  };
}

function schemaOf(tables: ParsedSQLTable[]): ParsedSQLSchema {
  return {
    version: 1,
    dialect: "postgres",
    schemas: [{ name: "public", tables, enums: [], extensions: [] }],
    sampleRows: {},
    parseErrors: [],
  };
}

describe("fk-clusters (T062, FR-024)", () => {
  it("returns singletons when no FKs are present", () => {
    const clusters = clusterTables(schemaOf([table("a"), table("b"), table("c")]));
    expect(clusters).toHaveLength(3);
    expect(clusters.every((c) => c.tables.length === 1)).toBe(true);
  });

  it("unions tables connected by FKs", () => {
    const clusters = clusterTables(
      schemaOf([
        table("product"),
        table("variant", [{ ref: "product" }]),
        table("price", [{ ref: "variant" }]),
        table("unrelated"),
      ]),
    );
    const byRoot = clusters.map((c) => c.tables.sort());
    const big = byRoot.find((c) => c.includes("public.product"));
    expect(big).toEqual(["public.price", "public.product", "public.variant"]);
    expect(byRoot.some((c) => c.length === 1 && c[0] === "public.unrelated")).toBe(true);
  });

  it("orders clusters by size desc, then lex", () => {
    const clusters = clusterTables(
      schemaOf([
        table("a"),
        table("b", [{ ref: "a" }]),
        table("c", [{ ref: "b" }]),
        table("x"),
        table("y", [{ ref: "x" }]),
      ]),
    );
    expect(clusters[0].tables.length).toBeGreaterThanOrEqual(clusters[1].tables.length);
    expect(clusters[0].tables).toContain("public.a");
  });

  it("ignores FKs that point outside the parsed set", () => {
    const clusters = clusterTables(schemaOf([table("order_items", [{ ref: "order" }])]));
    expect(clusters).toHaveLength(1);
    expect(clusters[0].tables).toEqual(["public.order_items"]);
  });

  it("gives each cluster a distinct id", () => {
    const clusters = clusterTables(schemaOf([table("a"), table("b"), table("c")]));
    const ids = new Set(clusters.map((c) => c.id));
    expect(ids.size).toBe(clusters.length);
  });
});
