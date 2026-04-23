/**
 * Unit test — canonicaliseOpenAPI() (T019).
 *
 * Enforces contracts/atw-api-command.md §6 and data-model.md §1:
 *   - Recursive alphabetical key sort.
 *   - 2-space indent, trailing newline.
 *   - Array order preserved (paths[*].parameters, responses).
 *   - Idempotent.
 */
import { describe, it, expect } from "vitest";
import { canonicaliseOpenAPI } from "../src/atw-api.js";

describe("canonicaliseOpenAPI (T019)", () => {
  it("sorts keys at every nesting level alphabetically", () => {
    const doc = {
      z: 1,
      a: { y: 2, b: 3 },
      m: [{ n: 1, a: 2 }, { z: 3, b: 4 }],
    };
    const out = canonicaliseOpenAPI(doc);
    // First top-level keys in order should be `a`, `m`, `z`.
    const indexA = out.indexOf('"a"');
    const indexM = out.indexOf('"m"');
    const indexZ = out.indexOf('"z"');
    expect(indexA).toBeGreaterThan(0);
    expect(indexA).toBeLessThan(indexM);
    expect(indexM).toBeLessThan(indexZ);
  });

  it("produces the same bytes for differently-ordered input keys", () => {
    const a = canonicaliseOpenAPI({ a: 1, b: 2, c: 3 });
    const b = canonicaliseOpenAPI({ c: 3, a: 1, b: 2 });
    const c = canonicaliseOpenAPI({ b: 2, c: 3, a: 1 });
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("is idempotent: canonicaliseOpenAPI(canonicaliseOpenAPI(x)) === canonicaliseOpenAPI(x)", () => {
    const doc = { foo: [1, 2, 3], bar: { nested: { a: "x", b: "y" } } };
    const once = canonicaliseOpenAPI(doc);
    const twice = canonicaliseOpenAPI(JSON.parse(once));
    expect(twice).toBe(once);
  });

  it("uses 2-space indent", () => {
    const out = canonicaliseOpenAPI({ a: { b: 1 } });
    // `\n  "a":` — two spaces after newline.
    expect(out).toMatch(/\n {2}"a": \{\n {4}"b": 1\n {2}\}\n\}\n$/);
  });

  it("ends with exactly one trailing newline", () => {
    const out = canonicaliseOpenAPI({ a: 1 });
    expect(out.endsWith("\n")).toBe(true);
    expect(out.endsWith("\n\n")).toBe(false);
  });

  it("preserves array order (order is semantically significant in OpenAPI parameters/responses)", () => {
    const doc = {
      paths: {
        "/x": {
          get: {
            parameters: [
              { name: "zulu", in: "query" },
              { name: "alpha", in: "query" },
              { name: "mike", in: "query" },
            ],
          },
        },
      },
    };
    const out = canonicaliseOpenAPI(doc);
    const zuluIdx = out.indexOf('"zulu"');
    const alphaIdx = out.indexOf('"alpha"');
    const mikeIdx = out.indexOf('"mike"');
    expect(zuluIdx).toBeLessThan(alphaIdx);
    expect(alphaIdx).toBeLessThan(mikeIdx);
  });

  it("keeps primitive values intact", () => {
    const out = canonicaliseOpenAPI({
      num: 42,
      neg: -3.14,
      bool: true,
      nil: null,
      str: "hello",
    });
    const parsed = JSON.parse(out) as Record<string, unknown>;
    expect(parsed).toEqual({
      bool: true,
      neg: -3.14,
      nil: null,
      num: 42,
      str: "hello",
    });
  });

  it("passes non-ASCII characters through verbatim (no escape unless JSON requires it)", () => {
    const out = canonicaliseOpenAPI({ name: "Café" });
    expect(out).toContain("Café");
  });
});
