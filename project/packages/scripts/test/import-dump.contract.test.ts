import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runImportDump, filterDump, sanitizePgDump17 } from "../src/import-dump.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("atw-import-dump contract (T041)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("exit 0 on --help mentions --dump and --schema-map", async () => {
    const code = await runImportDump(["--help"]);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toContain("--dump");
    expect(out).toContain("--schema-map");
  });

  it("exit 0 on --version", async () => {
    const code = await runImportDump(["--version"]);
    expect(code).toBe(0);
  });

  it("exit 3 when --dump missing", async () => {
    const code = await runImportDump(["--schema-map", "x"]);
    expect(code).toBe(3);
    const err = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(err).toContain("--dump");
  });

  it("exit 3 when --schema-map missing", async () => {
    const code = await runImportDump(["--dump", "x"]);
    expect(code).toBe(3);
    const err = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(err).toContain("--schema-map");
  });

  it("filterDump excludes PII-flagged CREATE TABLE and drops PII columns (pg_dump shape)", () => {
    const sql = [
      "CREATE TABLE public.product (id int, name text);",
      "CREATE TABLE public.customer (id int, email text);",
    ].join("\n");
    const out = filterDump(sql, {
      includedTables: ["product"],
      piiTables: ["customer"],
      piiColumns: [],
    });
    expect(out.imported).toContain("product");
    expect(out.excludedPiiTables).toContain("customer");
    expect(out.filteredSql).toContain("client_ref.product");
    // CREATE TABLE for customer is stripped entirely
    expect(out.filteredSql).not.toContain("CREATE TABLE client_ref.customer");
    expect(out.filteredSql).not.toContain("public.customer");
  });

  it("filterDump strips pg_dump 17/18 constructs and imports the rest (T059)", async () => {
    const fixture = await fs.readFile(
      path.join(__dirname, "fixtures", "pg_dump_17.sql"),
      "utf8",
    );
    const out = filterDump(fixture, {
      includedTables: ["product"],
      piiTables: [],
      piiColumns: [],
    });
    expect(out.imported).toContain("product");
    expect(out.filteredSql).not.toMatch(/transaction_timeout/i);
    expect(out.filteredSql).not.toMatch(/\\restrict/);
    expect(out.filteredSql).not.toMatch(/\\unrestrict/);
    expect(out.filteredSql).not.toMatch(/OWNER\s+TO/i);
    expect(out.filteredSql).toContain("client_ref.product");
    expect(out.filteredSql).toContain("Widget A");
  });

  it("sanitizePgDump17 leaves unrelated SETs and DDL untouched", () => {
    const sql = [
      "SET statement_timeout = 0;",
      "SET transaction_timeout = 0;",
      "\\restrict tok",
      "ALTER TABLE public.product OWNER TO atw;",
      "CREATE TABLE public.product (id int);",
      "\\unrestrict tok",
    ].join("\n");
    const out = sanitizePgDump17(sql);
    expect(out).toContain("SET statement_timeout = 0;");
    expect(out).toContain("CREATE TABLE public.product (id int);");
    expect(out).not.toMatch(/transaction_timeout/);
    expect(out).not.toMatch(/\\restrict/);
    expect(out).not.toMatch(/\\unrestrict/);
    expect(out).not.toMatch(/OWNER\s+TO/i);
  });

  it("filterDump drops PII-flagged columns from kept CREATE TABLE", () => {
    const sql = "CREATE TABLE public.product (id int, name text, ssn text);";
    const out = filterDump(sql, {
      includedTables: ["product"],
      piiTables: [],
      piiColumns: [{ table: "product", column: "ssn" }],
    });
    expect(out.imported).toContain("product");
    expect(out.droppedPiiColumns).toContainEqual(["product", "ssn"]);
    expect(out.filteredSql).not.toContain("ssn");
  });
});
