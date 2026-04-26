import { describe, it, expect } from "vitest";
import { flattenKeys } from "../src/lib/flatten-keys.js";

describe("flattenKeys (T059)", () => {
  it("flattens a nested object with dotted paths", () => {
    const keys = flattenKeys({
      primary_record: { id: "1", title: "Eau de Parfum" },
    });
    expect(keys.has("primary_record")).toBe(true);
    expect(keys.has("primary_record.id")).toBe(true);
    expect(keys.has("primary_record.title")).toBe(true);
  });

  it("flattens arrays using [n] notation", () => {
    const keys = flattenKeys({
      related: [
        { relation: "variants", rows: [{ sku: "A-1" }, { sku: "A-2" }] },
      ],
    });
    expect(keys.has("related")).toBe(true);
    expect(keys.has("related[0]")).toBe(true);
    expect(keys.has("related[0].relation")).toBe(true);
    expect(keys.has("related[0].rows")).toBe(true);
    expect(keys.has("related[0].rows[0]")).toBe(true);
    expect(keys.has("related[0].rows[0].sku")).toBe(true);
    expect(keys.has("related[0].rows[1].sku")).toBe(true);
  });

  it("handles mixed object + array structures", () => {
    const keys = flattenKeys({
      a: { b: [{ c: { d: 1 } }] },
    });
    expect(keys.has("a.b[0].c.d")).toBe(true);
    expect(keys.has("a.b[0].c")).toBe(true);
    expect(keys.has("a.b[0]")).toBe(true);
    expect(keys.has("a.b")).toBe(true);
    expect(keys.has("a")).toBe(true);
  });

  it("skips null/undefined leaves (but records their containing path)", () => {
    const keys = flattenKeys({ x: null, y: undefined, z: 3 });
    expect(keys.has("x")).toBe(true);
    expect(keys.has("y")).toBe(true);
    expect(keys.has("z")).toBe(true);
  });

  it("does not expose a top-level empty-string key", () => {
    const keys = flattenKeys({ a: 1 });
    expect(keys.has("")).toBe(false);
    expect(keys.has("a")).toBe(true);
  });

  it("emits indexed paths for array-of-primitives", () => {
    const keys = flattenKeys({ tags: ["new", "sale"] });
    expect(keys.has("tags[0]")).toBe(true);
    expect(keys.has("tags[1]")).toBe(true);
  });
});
