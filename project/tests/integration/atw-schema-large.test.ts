import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSchemaFromText } from "../../packages/scripts/src/parse-schema.js";
import { clusterTables } from "../../packages/scripts/src/lib/fk-clusters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LARGE_SCHEMA = path.resolve(__dirname, "..", "fixtures", "large-schema.sql");

describe("atw.schema on a >100-table schema (T065 / FR-024)", () => {
  it("returns multiple clusters and hits the size threshold for chunking", async () => {
    const sql = await fs.readFile(LARGE_SCHEMA, "utf8");
    const { parsed } = await parseSchemaFromText({ schemaSql: sql });

    const allTables = parsed.schemas.flatMap((s) => s.tables);
    expect(allTables.length).toBeGreaterThan(100);

    const clusters = clusterTables(parsed);
    expect(clusters.length).toBeGreaterThan(1);

    // Clusters are sorted largest-first; chunking logic in /atw.schema walks
    // in that order. The largest cluster must not swallow every table.
    expect(clusters[0].tables.length).toBeLessThan(allTables.length);
  });

  it("preserves all FK edges inside their cluster (no orphan breakage)", async () => {
    const sql = await fs.readFile(LARGE_SCHEMA, "utf8");
    const { parsed } = await parseSchemaFromText({ schemaSql: sql });
    const clusters = clusterTables(parsed);
    const clusterOf = new Map<string, number>();
    for (const c of clusters) for (const t of c.tables) clusterOf.set(t, c.id);

    for (const s of parsed.schemas) {
      for (const t of s.tables) {
        const from = `${s.name}.${t.name}`;
        for (const fk of t.foreignKeys) {
          const to = `${fk.referenceSchema}.${fk.referenceTable}`;
          if (!clusterOf.has(to)) continue; // external reference, ignored
          expect(clusterOf.get(from)).toBe(clusterOf.get(to));
        }
      }
    }
  });
});
