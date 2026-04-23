/**
 * T031 / US3 — unit test for `computeBackendSourceTree()`.
 *
 * Contract (contracts/build-manifest-extensions.md §backend_source_tree roll-up):
 *   - Same inputs → same hash (reproducibility).
 *   - Reordered inputs → same hash (sort-invariance).
 *   - Non-`backend/` entries are ignored (only files inside the backend
 *     tree affect the rollup).
 *   - Output shape is `sha256:<64-hex>`.
 */
import { describe, it, expect } from "vitest";
import { computeBackendSourceTree } from "../src/lib/input-hashes.js";

describe("computeBackendSourceTree (T031 / US3)", () => {
  const fixture = [
    { path: "backend/Dockerfile", sha256: "aa" },
    { path: "backend/src/index.ts", sha256: "bb" },
    { path: "backend/src/lib/cors.ts", sha256: "cc" },
  ];

  it("returns a sha256:<hex> string", () => {
    const h = computeBackendSourceTree(fixture);
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("identical inputs → identical hash", () => {
    const h1 = computeBackendSourceTree(fixture);
    const h2 = computeBackendSourceTree([...fixture]);
    expect(h1).toBe(h2);
  });

  it("reordered inputs → same hash (sort invariance)", () => {
    const reversed = [...fixture].reverse();
    const h1 = computeBackendSourceTree(fixture);
    const h2 = computeBackendSourceTree(reversed);
    expect(h1).toBe(h2);
  });

  it("changing any byte of any entry changes the hash", () => {
    const h1 = computeBackendSourceTree(fixture);
    const bumped = [
      ...fixture.slice(0, 2),
      { path: "backend/src/lib/cors.ts", sha256: "cd" },
    ];
    const h2 = computeBackendSourceTree(bumped);
    expect(h1).not.toBe(h2);
  });

  it("ignores entries outside the backend/ tree", () => {
    const h1 = computeBackendSourceTree(fixture);
    const withExtras = [
      ...fixture,
      { path: "dist/widget.js", sha256: "dd" },
      { path: ".atw/state/build-manifest.json", sha256: "ee" },
      { path: "README.md", sha256: "ff" },
    ];
    const h2 = computeBackendSourceTree(withExtras);
    expect(h1).toBe(h2);
  });

  it("empty tree produces a stable sentinel hash (no exception)", () => {
    const h = computeBackendSourceTree([]);
    expect(h).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
