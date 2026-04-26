import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { loadArtifactFromFile } from "../../packages/scripts/src/load-artifact.js";
import { validateArtifacts } from "../../packages/scripts/src/validate-artifacts.js";
import {
  writeAureliaArtifacts,
  SCHEMA_MAP_MD,
} from "./fixtures/aurelia-artifacts.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-builder-edit-"));
  await writeAureliaArtifacts(tmpRoot);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("builder edits respected on re-read (T092 / SC-007, FR-040)", () => {
  it("a hand-edited schema-map propagates to consumers via load-artifact", async () => {
    // Builder removes the "region" entity by excising its section.
    const edited = SCHEMA_MAP_MD.replace(
      /## Entity: region[\s\S]*?(?=## Reference tables)/,
      "",
    );
    await fs.writeFile(path.join(tmpRoot, "artifacts", "schema-map.md"), edited, "utf8");

    const loaded = await loadArtifactFromFile(
      "schema-map",
      path.join(tmpRoot, "artifacts", "schema-map.md"),
    );
    if (loaded.kind !== "schema-map") throw new Error("unexpected kind");
    const entityNames = loaded.content.entities.map((e) => e.name);
    expect(entityNames).not.toContain("region");
    expect(entityNames).toContain("product");
  });

  it("a Builder edit removing an entity surfaces action-references-excluded-entity against stale action-manifest", async () => {
    // Remove "region" from schema-map but leave the action-manifest that
    // references it. validate-artifacts must flag the stale cross-reference
    // rather than silently accepting it.
    const edited = SCHEMA_MAP_MD.replace(
      /## Entity: region[\s\S]*?(?=## Reference tables)/,
      "",
    );
    await fs.writeFile(path.join(tmpRoot, "artifacts", "schema-map.md"), edited, "utf8");

    const report = await validateArtifacts({ root: tmpRoot });
    expect(report.ok).toBe(false);
    const kinds = new Set(report.inconsistencies.map((i) => i.kind));
    expect(kinds.has("action-references-excluded-entity")).toBe(true);
    expect(
      report.inconsistencies.some((i) => i.detail.toLowerCase().includes("region")),
    ).toBe(true);
  });

  it("commands/atw.plan.md documents that Builder edits win over re-synthesis (FR-040)", async () => {
    const body = await fs.readFile(
      path.resolve(__dirname, "..", "..", "commands", "atw.plan.md"),
      "utf8",
    );
    expect(body).toMatch(/FR-040/);
    expect(body).toMatch(/preserve Builder hand-edits|hand-edits/i);
  });
});
