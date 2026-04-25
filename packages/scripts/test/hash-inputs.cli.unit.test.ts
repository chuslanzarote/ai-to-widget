import { describe, it, expect } from "vitest";
import { parseInputsPositional } from "../src/hash-inputs.js";

describe("atw-hash-inputs CLI argument parser (FR-007 / R15)", () => {
  it("parses `--inputs a.md b.md c.md` as three positional files", () => {
    const parsed = parseInputsPositional([
      "--root",
      "/tmp",
      "--inputs",
      "a.md",
      "b.md",
      "c.md",
    ]);
    expect(parsed.inputs).toEqual(["a.md", "b.md", "c.md"]);
    expect(parsed.root).toBe("/tmp");
  });

  it("accepts the legacy `--inputs a.md,b.md` comma form", () => {
    const parsed = parseInputsPositional([
      "--root",
      "/tmp",
      "--inputs",
      "a.md,b.md",
    ]);
    expect(parsed.inputs).toEqual(["a.md", "b.md"]);
  });

  it("both forms yield the same two-file list for `a.md` + `b.md`", () => {
    const a = parseInputsPositional(["--root", "/tmp", "--inputs", "a.md", "b.md"]);
    const b = parseInputsPositional(["--root", "/tmp", "--inputs", "a.md,b.md"]);
    expect(a.inputs).toEqual(b.inputs);
  });

  it("terminates `--inputs` collection at the next `--flag`", () => {
    const parsed = parseInputsPositional([
      "--root",
      "/tmp",
      "--inputs",
      "a.md",
      "b.md",
      "--update-state",
      "--verbose",
    ]);
    expect(parsed.inputs).toEqual(["a.md", "b.md"]);
    expect(parsed.updateState).toBe(true);
    expect(parsed.verbose).toBe(true);
  });

  it("accepts `--inputs` with a single file", () => {
    const parsed = parseInputsPositional([
      "--root",
      "/tmp",
      "--inputs",
      "only.md",
    ]);
    expect(parsed.inputs).toEqual(["only.md"]);
  });

  it("threads --prompt-template-version through", () => {
    const parsed = parseInputsPositional([
      "--root",
      "/tmp",
      "--inputs",
      "a.md",
      "--prompt-template-version",
      "v42",
    ]);
    expect(parsed.promptTemplateVersion).toBe("v42");
  });

  it("throws D-INPUTSARGS-shaped error on an unknown positional (no --inputs prefix)", () => {
    expect(() =>
      parseInputsPositional(["/tmp/some-random-positional.md"]),
    ).toThrow(/--inputs expected one or more file paths/);
  });
});
