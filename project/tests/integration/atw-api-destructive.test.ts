import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseOpenAPI } from "../../packages/scripts/src/parse-openapi.js";
import { detectDestructiveOperations } from "../../packages/scripts/src/lib/destructive-detection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AURELIA_OPENAPI = path.resolve(__dirname, "..", "fixtures", "aurelia", "openapi.json");

describe("atw.api destructive-op confirmation (T077 / FR-031)", () => {
  it("flags every DELETE verb in the Aurelia fixture", async () => {
    const { parsed } = await parseOpenAPI({ source: AURELIA_OPENAPI });
    const flags = detectDestructiveOperations(parsed);
    const flaggedIds = new Set(flags.map((f) => f.operationId));
    for (const op of parsed.operations) {
      if (op.method === "delete") expect(flaggedIds.has(op.id)).toBe(true);
    }
  });

  it("flags /orders/{id}/cancel via operation-id or path-suffix", async () => {
    const { parsed } = await parseOpenAPI({ source: AURELIA_OPENAPI });
    const flags = detectDestructiveOperations(parsed);
    const flagged = flags.find((f) => f.path.endsWith("/cancel"));
    expect(flagged).toBeDefined();
    expect(["operation-id-verb", "path-suffix-verb"]).toContain(flagged!.reason);
  });

  it("flags refund operations", async () => {
    const { parsed } = await parseOpenAPI({ source: AURELIA_OPENAPI });
    const flags = detectDestructiveOperations(parsed);
    expect(flags.some((f) => f.operationId.toLowerCase().includes("refund"))).toBe(true);
  });

  it("does NOT flag read-only GET operations", async () => {
    const { parsed } = await parseOpenAPI({ source: AURELIA_OPENAPI });
    const flags = detectDestructiveOperations(parsed);
    const flaggedIds = new Set(flags.map((f) => f.operationId));
    const readOnly = parsed.operations.filter((o) => o.method === "get");
    expect(readOnly.length).toBeGreaterThan(0);
    for (const op of readOnly) {
      expect(flaggedIds.has(op.id)).toBe(false);
    }
  });
});
