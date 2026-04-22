import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runAssembleEntityInput } from "../src/assemble-entity-input.js";

describe("atw-assemble-entity-input contract (T042)", () => {
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

  it("exit 0 on --help", async () => {
    const code = await runAssembleEntityInput(["--help"]);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toContain("--entity-type");
    expect(out).toContain("--entity-id");
    expect(out).toContain("--schema-map");
    expect(out).toContain("--brief");
  });

  it("exit 0 on --version", async () => {
    const code = await runAssembleEntityInput(["--version"]);
    expect(code).toBe(0);
  });

  it("exit 3 when --entity-type missing", async () => {
    const code = await runAssembleEntityInput([
      "--entity-id",
      "1",
      "--schema-map",
      "x",
      "--brief",
      "y",
    ]);
    expect(code).toBe(3);
  });

  it("exit 3 when --entity-id missing", async () => {
    const code = await runAssembleEntityInput([
      "--entity-type",
      "product",
      "--schema-map",
      "x",
      "--brief",
      "y",
    ]);
    expect(code).toBe(3);
  });

  it("exit 3 when --schema-map missing", async () => {
    const code = await runAssembleEntityInput([
      "--entity-type",
      "product",
      "--entity-id",
      "1",
      "--brief",
      "y",
    ]);
    expect(code).toBe(3);
  });

  it("exit 3 when --brief missing", async () => {
    const code = await runAssembleEntityInput([
      "--entity-type",
      "product",
      "--entity-id",
      "1",
      "--schema-map",
      "x",
    ]);
    expect(code).toBe(3);
  });
});
