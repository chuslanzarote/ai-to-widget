import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runImportDump, filterDump } from "../src/import-dump.js";

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
