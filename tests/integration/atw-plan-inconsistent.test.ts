import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { validateArtifacts } from "../../packages/scripts/src/validate-artifacts.js";
import {
  writeAureliaArtifacts,
  ACTION_MANIFEST_MD,
} from "./fixtures/aurelia-artifacts.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-plan-inconsistent-"));
  await writeAureliaArtifacts(tmpRoot);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("atw.plan cross-artifact inconsistency (T087 / FR-038)", () => {
  it("surfaces action-manifest tool group that points at an entity absent from schema-map", async () => {
    // Swap the "product" group for a non-existent "ghost_entity" group.
    const tampered = ACTION_MANIFEST_MD.replace("## Tools: product", "## Tools: ghost_entity");
    await fs.writeFile(
      path.join(tmpRoot, "artifacts", "action-manifest.md"),
      tampered,
      "utf8",
    );

    const report = await validateArtifacts({ root: tmpRoot });
    expect(report.ok).toBe(false);
    expect(report.missing).toEqual([]);

    const kinds = new Set(report.inconsistencies.map((i) => i.kind));
    expect(kinds.has("action-references-excluded-entity")).toBe(true);

    const match = report.inconsistencies.find((i) => i.detail.includes("ghost_entity"));
    expect(match).toBeDefined();
    expect(match!.leftPath).toContain("action-manifest.md");
    expect(match!.rightPath).toContain("schema-map.md");
  });

  it("stays silent when every tool group maps to a real entity", async () => {
    // Untampered Aurelia fixture already satisfies the cross-reference.
    const report = await validateArtifacts({ root: tmpRoot });
    expect(report.ok).toBe(true);
    expect(
      report.inconsistencies.filter((i) => i.kind === "action-references-excluded-entity"),
    ).toEqual([]);
  });

  it("surfaces an action pointing at a PII-excluded table as excluded-entity", async () => {
    // Craft an action group targeting the "customer" table — which is listed
    // under PII-excluded in the schema-map. This must flag as
    // action-references-excluded-entity because the entity is excluded, not
    // indexable.
    const tampered = ACTION_MANIFEST_MD.replace(
      "## Tools: product",
      "## Tools: customer\n\n### list_customers\n\nDescription: Fetch customer rows.\n\nParameters:\n\n```json\n{ \"type\": \"object\" }\n```\n\nrequires_confirmation: false\nSource: GET /admin/customers\nParameter sources: user message\n\n## Tools: product",
    );
    await fs.writeFile(
      path.join(tmpRoot, "artifacts", "action-manifest.md"),
      tampered,
      "utf8",
    );

    const report = await validateArtifacts({ root: tmpRoot });
    expect(report.ok).toBe(false);
    expect(
      report.inconsistencies.some(
        (i) =>
          i.kind === "action-references-excluded-entity" && i.detail.toLowerCase().includes("customer"),
      ),
    ).toBe(true);
  });

  it("command markdown requests resolution before LLM call (FR-038)", async () => {
    const cmd = await fs.readFile(
      path.resolve(__dirname, "..", "..", "commands", "atw.plan.md"),
      "utf8",
    );
    expect(cmd).toMatch(/inconsisten/i);
    expect(cmd).toMatch(/No LLM call/);
  });
});
