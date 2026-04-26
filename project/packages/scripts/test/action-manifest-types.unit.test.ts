import { describe, it, expect } from "vitest";
import {
  ActionManifestEntrySchema,
  ActionManifestSchema,
  ExcludedEntrySchema,
  OrphanedEntrySchema,
  ToolNameCollisionError,
} from "../src/lib/action-manifest-types.js";

describe("ActionManifest Zod schemas (T011, data-model.md §2)", () => {
  const validEntry = {
    toolName: "add_to_cart",
    description: "Add a variant to the cart.",
    parameters: {
      type: "object" as const,
      properties: {
        cart_id: { type: "string" },
        variant_id: { type: "string" },
        quantity: { type: "integer" },
      },
      required: ["cart_id", "variant_id", "quantity"],
    },
    requiresConfirmation: true,
    isAction: true,
    source: {
      method: "POST" as const,
      path: "/store/carts/{cart_id}/line-items",
      operationId: "addLineItem",
    },
  };

  it("accepts a minimal valid entry", () => {
    const parsed = ActionManifestEntrySchema.parse(validEntry);
    expect(parsed.toolName).toBe("add_to_cart");
    expect(parsed.source.method).toBe("POST");
  });

  it("rejects toolName that starts with a digit or uppercase", () => {
    expect(() =>
      ActionManifestEntrySchema.parse({ ...validEntry, toolName: "1bad" }),
    ).toThrow(/toolName/);
    expect(() =>
      ActionManifestEntrySchema.parse({ ...validEntry, toolName: "BadName" }),
    ).toThrow(/toolName/);
  });

  it("rejects a source path that does not start with /", () => {
    expect(() =>
      ActionManifestEntrySchema.parse({
        ...validEntry,
        source: { ...validEntry.source, path: "store/carts" },
      }),
    ).toThrow();
  });

  it("rejects an unknown HTTP method", () => {
    expect(() =>
      ActionManifestEntrySchema.parse({
        ...validEntry,
        source: { ...validEntry.source, method: "CONNECT" as unknown as "POST" },
      }),
    ).toThrow();
  });

  it("accepts every declared HTTP method including PUT", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      const parsed = ActionManifestEntrySchema.parse({
        ...validEntry,
        source: { ...validEntry.source, method },
      });
      expect(parsed.source.method).toBe(method);
    }
  });

  it("fails when a required field is missing", () => {
    const incomplete = { ...validEntry } as Record<string, unknown>;
    delete incomplete.requiresConfirmation;
    expect(() => ActionManifestEntrySchema.parse(incomplete)).toThrow();
  });

  it("ExcludedEntrySchema requires a non-empty reason", () => {
    expect(() =>
      ExcludedEntrySchema.parse({
        method: "POST",
        path: "/admin/users",
        operationId: "adminCreateUser",
        reason: "",
      }),
    ).toThrow();
  });

  it("OrphanedEntrySchema requires a non-empty previousToolName", () => {
    expect(() =>
      OrphanedEntrySchema.parse({
        method: "DELETE",
        path: "/store/removed",
        previousToolName: "",
      }),
    ).toThrow();
  });

  it("ActionManifestSchema validates provenance sha256 shape", () => {
    const wellFormed = {
      provenance: {
        openapiSha256:
          "sha256:" + "a".repeat(64),
        classifierModel: "claude-opus-4-7 (2026-04-23)",
        classifiedAt: "2026-04-23T10:00:00Z",
      },
      summary: "a manifest",
      included: [validEntry],
      excluded: [],
    };
    const parsed = ActionManifestSchema.parse(wellFormed);
    expect(parsed.orphaned).toEqual([]);
  });

  it("ActionManifestSchema rejects malformed sha256 prefix", () => {
    const bad = {
      provenance: {
        openapiSha256: "sha256:notHex",
        classifierModel: "claude-opus-4-7",
        classifiedAt: "2026-04-23T10:00:00Z",
      },
      summary: "",
      included: [],
      excluded: [],
    };
    expect(() => ActionManifestSchema.parse(bad)).toThrow(/openapiSha256/);
  });

  it("ToolNameCollisionError exposes .code and .toolName", () => {
    const err = new ToolNameCollisionError(
      "add_to_cart",
      "duplicate tool_name",
    );
    expect(err.code).toBe("TOOL_NAME_COLLISION");
    expect(err.toolName).toBe("add_to_cart");
    expect(err).toBeInstanceOf(Error);
  });
});
