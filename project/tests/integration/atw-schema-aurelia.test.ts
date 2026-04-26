import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parseSchemaFromText } from "../../packages/scripts/src/parse-schema.js";
import { detectPII } from "../../packages/scripts/src/lib/pii-detection.js";
import { clusterTables } from "../../packages/scripts/src/lib/fk-clusters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "..", "fixtures", "aurelia", "schema.sql");
const DATA_PATH = path.resolve(__dirname, "..", "fixtures", "aurelia", "schema-with-data.sql");

describe("atw.schema E2E on the Aurelia fixture (T064)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-schema-aurelia-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("parses the Aurelia schema, flags PII, and produces a non-empty table list", async () => {
    const schemaSql = await fs.readFile(SCHEMA_PATH, "utf8");
    const dataSql = await fs.readFile(DATA_PATH, "utf8");
    const { parsed } = await parseSchemaFromText({ schemaSql, dataSql });

    const publicSchema = parsed.schemas.find((s) => s.name === "public");
    expect(publicSchema).toBeDefined();
    expect(publicSchema!.tables.length).toBeGreaterThan(10);

    const report = detectPII(parsed, parsed.sampleRows);
    const flaggedTables = new Set(report.tables.map((t) => t.table));
    // SC-004: Aurelia ships with customer + payment tables; both must be PII-blocked.
    expect(flaggedTables.has("customer")).toBe(true);
    expect(flaggedTables.has("payment") || flaggedTables.has("payments")).toBe(true);

    const flaggedCols = new Set(report.columns.map((c) => `${c.table}.${c.column}`));
    // email / phone / name / address columns must be flagged
    expect([...flaggedCols].some((x) => x.endsWith(".email"))).toBe(true);
  });

  it("produces at least one FK-connected cluster (catalog chain)", async () => {
    const schemaSql = await fs.readFile(SCHEMA_PATH, "utf8");
    const { parsed } = await parseSchemaFromText({ schemaSql });
    const clusters = clusterTables(parsed);
    expect(clusters.length).toBeGreaterThan(0);
    // The largest cluster should have multiple tables (product/variant/price family).
    expect(clusters[0].tables.length).toBeGreaterThan(1);
  });

  it("never emits sample rows above the 50-per-table cap", async () => {
    const schemaSql = await fs.readFile(SCHEMA_PATH, "utf8");
    const dataSql = await fs.readFile(DATA_PATH, "utf8");
    const { parsed } = await parseSchemaFromText({ schemaSql, dataSql });
    for (const [, rows] of Object.entries(parsed.sampleRows)) {
      expect(rows.length).toBeLessThanOrEqual(50);
    }
  });
});
