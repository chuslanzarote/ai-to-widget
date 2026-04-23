/**
 * T048 — Determinism integration test for `renderExecutors`.
 *
 * Locks in Principle VIII: identical manifest input + identical options
 * produce a byte-identical `action-executors.json`, the second run
 * returns `action: "unchanged"`, and the file's mtime does not advance
 * (no disk write). Cross-platform sha256 match is asserted at the
 * structural level so a CI matrix row on Linux can compare with one on
 * Windows and surface any platform-specific drift.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

import { renderExecutors } from "../src/render-executors.js";
import type {
  ActionManifest,
  ActionManifestEntry,
} from "../src/lib/action-manifest-types.js";

const BASE_PROVENANCE = {
  openapiSha256: "sha256:" + "a".repeat(64),
  classifierModel: "claude-opus-4-7",
  classifiedAt: "2026-04-23T00:00:00Z",
};

function entry(
  overrides: Partial<ActionManifestEntry> = {},
): ActionManifestEntry {
  return {
    toolName: "add_to_cart",
    description: "Add a variant to the cart.",
    parameters: {
      type: "object",
      properties: {
        cart_id: { type: "string" },
        variant_id: { type: "string" },
        quantity: { type: "number" },
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

function manifestWith(entries: ActionManifestEntry[]): ActionManifest {
  return {
    provenance: BASE_PROVENANCE,
    summary: "test",
    included: entries,
    excluded: [],
    orphaned: [],
  };
}

let tmpDir: string;
let outPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "atw-render-executors-det-"),
  );
  outPath = path.join(tmpDir, "action-executors.json");
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("renderExecutors determinism (T048)", () => {
  it("re-run with identical manifest → sha256 matches, action unchanged, mtime unchanged", async () => {
    const manifest = manifestWith([
      entry(),
      entry({
        toolName: "list_carts",
        description: "List carts.",
        parameters: {
          type: "object",
          properties: { limit: { type: "number" } },
          required: [],
        },
        source: {
          method: "GET",
          path: "/store/carts",
          operationId: "listCarts",
        },
        isAction: false,
        requiresConfirmation: false,
      }),
    ]);
    const first = await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    expect(first.action).toBe("created");
    const firstStat = await fs.stat(outPath);

    // Second run — same inputs, same shape.
    const second = await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    expect(second.action).toBe("unchanged");
    expect(second.sha256).toBe(first.sha256);
    expect(second.bytes).toBe(first.bytes);

    const secondStat = await fs.stat(outPath);
    // mtime identity is the disk-write proof: an "unchanged" action
    // must never touch the file.
    expect(secondStat.mtimeMs).toBe(firstStat.mtimeMs);
  });

  it("property-ordering drift in manifest doesn't change catalog sha256", async () => {
    // Shuffled property key order in the input manifest; the canonical
    // renderer sorts deep so the output must be identical.
    const manifestA = manifestWith([
      entry({
        parameters: {
          type: "object",
          properties: {
            cart_id: { type: "string" },
            variant_id: { type: "string" },
            quantity: { type: "number" },
          },
          required: ["cart_id", "variant_id"],
        },
      }),
    ]);
    const manifestB = manifestWith([
      entry({
        parameters: {
          type: "object",
          properties: {
            // Shuffled order — quantity first, cart_id last.
            quantity: { type: "number" },
            variant_id: { type: "string" },
            cart_id: { type: "string" },
          },
          required: ["variant_id", "cart_id"],
        },
      }),
    ]);

    const outA = path.join(tmpDir, "a.json");
    const outB = path.join(tmpDir, "b.json");
    const rA = await renderExecutors(manifestA, {
      outputPath: outA,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const rB = await renderExecutors(manifestB, {
      outputPath: outB,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    expect(rA.sha256).toBe(rB.sha256);

    // sanity: bytes-level identity
    const [a, b] = await Promise.all([
      fs.readFile(outA, "utf8"),
      fs.readFile(outB, "utf8"),
    ]);
    expect(a).toBe(b);
  });

  it("sha256 is computable from disk bytes independently", async () => {
    const manifest = manifestWith([entry()]);
    const res = await renderExecutors(manifest, {
      outputPath: outPath,
      hostOrigin: "https://shop.example.com",
      widgetOrigin: "https://shop.example.com",
    });
    const bytes = await fs.readFile(outPath);
    const recomputed = createHash("sha256").update(bytes).digest("hex");
    expect(recomputed).toBe(res.sha256);
  });
});
