import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { parseSchemaFromText } from "../../packages/scripts/src/parse-schema.js";
import { parseOpenAPI } from "../../packages/scripts/src/parse-openapi.js";
import { diffByKey } from "../../packages/scripts/src/lib/structural-diff.js";
import type { ParsedSQLTable } from "../../packages/scripts/src/lib/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AURELIA_SQL = path.resolve(__dirname, "..", "fixtures", "aurelia", "schema.sql");
const AURELIA_OPENAPI = path.resolve(__dirname, "..", "fixtures", "aurelia", "openapi.json");

describe("structural-diff Level-2 delta (T093 / FR-049 L2)", () => {
  it("isolates three added tables when the schema is extended", async () => {
    const baseline = await fs.readFile(AURELIA_SQL, "utf8");
    const extra = `
CREATE TABLE public.loyalty_tier (id int PRIMARY KEY, name text, threshold int);
CREATE TABLE public.loyalty_member (id int PRIMARY KEY, customer_id int);
CREATE TABLE public.loyalty_reward (id int PRIMARY KEY, tier_id int);
`;
    const before = await parseSchemaFromText({ schemaSql: baseline });
    const after = await parseSchemaFromText({ schemaSql: baseline + extra });

    const beforeTables: ParsedSQLTable[] = before.parsed.schemas.flatMap((s) => s.tables);
    const afterTables: ParsedSQLTable[] = after.parsed.schemas.flatMap((s) => s.tables);

    const delta = diffByKey(beforeTables, afterTables, {
      keyFn: (t) => `${t.schema}.${t.name}`,
    });

    const addedNames = new Set(delta.added.map((t) => t.name));
    expect(addedNames.has("loyalty_tier")).toBe(true);
    expect(addedNames.has("loyalty_member")).toBe(true);
    expect(addedNames.has("loyalty_reward")).toBe(true);
    expect(delta.added).toHaveLength(3);
    expect(delta.removed).toHaveLength(0);
  });

  it("reports added operations as the only delta when one operation is appended to the OpenAPI spec", async () => {
    const raw = JSON.parse(await fs.readFile(AURELIA_OPENAPI, "utf8"));

    const before = await parseOpenAPI({ source: AURELIA_OPENAPI });

    const extendedRaw = JSON.parse(JSON.stringify(raw));
    extendedRaw.paths["/store/new-arrivals"] = {
      get: {
        operationId: "listNewArrivals",
        tags: ["product"],
        summary: "List new arrivals",
        responses: {
          "200": {
            description: "ok",
            content: { "application/json": { schema: { type: "array" } } },
          },
        },
      },
    };
    const after = await parseOpenAPI({
      source: "synthetic://extended",
      body: JSON.stringify(extendedRaw),
    });

    const delta = diffByKey(before.parsed.operations, after.parsed.operations, {
      keyFn: (op) => `${op.method} ${op.path}`,
    });
    expect(delta.added).toHaveLength(1);
    expect(delta.added[0].path).toBe("/store/new-arrivals");
    expect(delta.removed).toHaveLength(0);
  });

  it("commands/atw.schema.md and atw.api.md document Level-2 delta semantics (T097)", async () => {
    const commandsDir = path.resolve(__dirname, "..", "..", "commands");
    for (const name of ["atw.schema.md", "atw.api.md"]) {
      const body = await fs.readFile(path.join(commandsDir, name), "utf8");
      expect(body, `${name} must describe Level 2 diff`).toMatch(/Level 2/);
      expect(body, `${name} must reference structural diff or delta`).toMatch(/(delta|diff)/i);
    }
  });
});
