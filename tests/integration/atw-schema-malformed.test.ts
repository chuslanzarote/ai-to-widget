import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { runParseSchema, ParseSchemaError, parseSchemaFromText } from "../../packages/scripts/src/parse-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MALFORMED = path.resolve(__dirname, "..", "fixtures", "malformed", "broken.sql");

describe("atw.schema on malformed SQL (T066)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-schema-bad-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("CLI exits with code 1 and does not write an artifact", async () => {
    const out = path.join(tmp, "schema.json");
    const exit = await runParseSchema(["--schema", MALFORMED, "--out", out]);
    expect(exit).toBe(1);
    await expect(fs.stat(out)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("programmatic entry throws ParseSchemaError with line/column", async () => {
    const sql = await fs.readFile(MALFORMED, "utf8");
    try {
      await parseSchemaFromText({ schemaSql: sql });
      expect.fail("expected parse to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ParseSchemaError);
      const e = err as ParseSchemaError;
      expect(typeof e.line).toBe("number");
      expect(typeof e.column).toBe("number");
      expect(e.message.length).toBeGreaterThan(0);
    }
  });
});
