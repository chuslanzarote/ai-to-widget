import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { validateArtifacts } from "../../packages/scripts/src/validate-artifacts.js";
import { writeAureliaArtifacts } from "./fixtures/aurelia-artifacts.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-plan-missing-"));
  await writeAureliaArtifacts(tmpRoot);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("atw.plan missing-upstream halt (T086 / FR-037)", () => {
  it("halts with a missing entry naming schema-map when schema-map.md is deleted", async () => {
    await fs.rm(path.join(tmpRoot, "artifacts", "schema-map.md"));
    const report = await validateArtifacts({ root: tmpRoot });

    expect(report.ok).toBe(false);
    expect(report.missing).toHaveLength(1);
    expect(report.missing[0].kind).toBe("schema-map");
    expect(report.missing[0].expectedPath).toContain("schema-map.md");
  });

  it("signals brief absence separately from schema-map absence", async () => {
    await fs.rm(path.join(tmpRoot, "config", "brief.md"));
    const report = await validateArtifacts({ root: tmpRoot });

    expect(report.ok).toBe(false);
    expect(report.missing.map((m) => m.kind)).toEqual(["brief"]);
  });

  it("lists all missing artifacts when multiple upstream files absent", async () => {
    await fs.rm(path.join(tmpRoot, "artifacts", "schema-map.md"));
    await fs.rm(path.join(tmpRoot, "artifacts", "action-manifest.md"));
    const report = await validateArtifacts({ root: tmpRoot });

    const kinds = new Set(report.missing.map((m) => m.kind));
    expect(kinds.has("schema-map")).toBe(true);
    expect(kinds.has("action-manifest")).toBe(true);
  });

  it("command markdown names the next command to run (FR-037)", async () => {
    // commands/atw.plan.md must mention the prior commands by name so the
    // Builder sees actionable guidance, not a generic error.
    const cmd = await fs.readFile(
      path.resolve(__dirname, "..", "..", "commands", "atw.plan.md"),
      "utf8",
    );
    expect(cmd).toContain("/atw.schema");
    expect(cmd).toMatch(/Missing `schema-map\.md`/);
  });
});
