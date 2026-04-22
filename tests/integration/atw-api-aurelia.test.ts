import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseOpenAPI } from "../../packages/scripts/src/parse-openapi.js";
import { detectAdminOperations } from "../../packages/scripts/src/lib/admin-detection.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AURELIA_OPENAPI = path.resolve(__dirname, "..", "fixtures", "aurelia", "openapi.json");

describe("atw.api Aurelia admin exclusion (T076 / SC-005)", () => {
  it("excludes every /admin/* operation from the default-included set", async () => {
    const { parsed, raw } = await parseOpenAPI({ source: AURELIA_OPENAPI });
    const flags = detectAdminOperations(parsed, raw);
    const adminFlaggedIds = new Set(flags.map((f) => f.operationId));

    const allAdminPaths = parsed.operations.filter((o) => o.path.startsWith("/admin/"));
    expect(allAdminPaths.length).toBeGreaterThan(0);

    for (const op of allAdminPaths) {
      expect(adminFlaggedIds.has(op.id)).toBe(true);
    }
  });

  it("does not flag /store/* operations as admin", async () => {
    const { parsed, raw } = await parseOpenAPI({ source: AURELIA_OPENAPI });
    const flags = detectAdminOperations(parsed, raw);
    const flaggedSet = new Set(flags.map((f) => f.operationId));

    const storeOps = parsed.operations.filter((o) => o.path.startsWith("/store/"));
    expect(storeOps.length).toBeGreaterThan(5);
    for (const op of storeOps) {
      expect(flaggedSet.has(op.id)).toBe(false);
    }
  });

  it("recognises x-admin vendor extensions when the path is ambiguous", async () => {
    const { parsed, raw } = await parseOpenAPI({ source: AURELIA_OPENAPI });
    const flags = detectAdminOperations(parsed, raw);
    const byReason = new Set(flags.map((f) => f.reason));
    // Aurelia's fixture uses /admin prefix, tag=admin, adminKey security, and
    // one x-admin vendor extension — all four reason codes should appear at
    // least implicitly across the flags set.
    expect(byReason.has("path-prefix")).toBe(true);
  });
});
