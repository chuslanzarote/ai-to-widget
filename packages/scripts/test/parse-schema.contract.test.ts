import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseSchemaFromText,
  extractSampleRows,
  runParseSchema,
  ParseSchemaError,
  CredentialRejectionError,
} from "../src/parse-schema.js";
import { ParsedSQLSchemaSchema } from "../src/lib/types.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const AURELIA_SCHEMA = path.join(REPO_ROOT, "tests", "fixtures", "aurelia", "schema.sql");
const AURELIA_DATA = path.join(REPO_ROOT, "tests", "fixtures", "aurelia", "schema-with-data.sql");
const MALFORMED = path.join(REPO_ROOT, "tests", "fixtures", "malformed", "broken.sql");

describe("parse-schema contract (T060)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-parse-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("emits a ParsedSQLSchema that validates against the zod contract", async () => {
    const sql = await fs.readFile(AURELIA_SCHEMA, "utf8");
    const { parsed } = await parseSchemaFromText({ schemaSql: sql });
    const validation = ParsedSQLSchemaSchema.safeParse(parsed);
    expect(validation.success).toBe(true);
    expect(parsed.version).toBe(1);
    expect(parsed.dialect).toBe("postgres");
    const publicSchema = parsed.schemas.find((s) => s.name === "public");
    expect(publicSchema).toBeDefined();
    expect(publicSchema!.tables.length).toBeGreaterThan(10);
  });

  it("caps sample rows at 50 per table (FR-016)", () => {
    const rows: string[] = [];
    for (let i = 0; i < 120; i++) {
      rows.push(`(${i}, 'name-${i}')`);
    }
    const dataSql = `INSERT INTO public.thing (id, name) VALUES ${rows.join(", ")};`;
    const samples = extractSampleRows(dataSql, 50);
    expect(samples["public.thing"]).toHaveLength(50);
  });

  it("refuses connection strings with exit code 4 (FR-018)", async () => {
    const target = path.join(tmp, "creds.sql");
    await fs.writeFile(target, "-- pulled from postgres://user:secret@db.example.com/app\nCREATE TABLE x (id int);\n");
    const exit = await runParseSchema(["--schema", target]);
    expect(exit).toBe(4);
  });

  it("returns exit 1 on a parse error", async () => {
    const exit = await runParseSchema(["--schema", MALFORMED]);
    expect(exit).toBe(1);
  });

  it("returns exit 1 when the schema file is missing", async () => {
    const exit = await runParseSchema(["--schema", path.join(tmp, "does-not-exist.sql")]);
    expect(exit).toBe(1);
  });

  it("returns exit 3 on missing --schema argument", async () => {
    const exit = await runParseSchema([]);
    expect(exit).toBe(3);
  });

  it("returns exit 0 and writes a parsed JSON artifact to --out", async () => {
    const out = path.join(tmp, "schema.json");
    const exit = await runParseSchema(["--schema", AURELIA_SCHEMA, "--data", AURELIA_DATA, "--out", out]);
    expect(exit).toBe(0);
    const written = JSON.parse(await fs.readFile(out, "utf8"));
    expect(ParsedSQLSchemaSchema.safeParse(written).success).toBe(true);
  });

  it("surfaces CredentialRejectionError from the programmatic entry point", async () => {
    await expect(
      parseSchemaFromText({ schemaSql: "host=db password=secret user=bob dbname=app\n" }),
    ).rejects.toBeInstanceOf(CredentialRejectionError);
  });

  it("surfaces ParseSchemaError from the programmatic entry point", async () => {
    const bad = await fs.readFile(MALFORMED, "utf8");
    await expect(parseSchemaFromText({ schemaSql: bad })).rejects.toBeInstanceOf(ParseSchemaError);
  });
});
