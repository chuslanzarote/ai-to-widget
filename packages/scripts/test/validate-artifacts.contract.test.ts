import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  validateArtifacts,
  runValidateArtifacts,
} from "../src/validate-artifacts.js";
import {
  ArtifactConsistencyReportSchema,
  InconsistencyKindSchema,
} from "../src/lib/types.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-validate-"));
  await fs.mkdir(path.join(tmpRoot, "config"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "artifacts"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function writeValid(root: string, kind: "project" | "brief" | "schema-map" | "action-manifest", body: string) {
  const rel = {
    project: "config/project.md",
    brief: "config/brief.md",
    "schema-map": "artifacts/schema-map.md",
    "action-manifest": "artifacts/action-manifest.md",
  }[kind];
  await fs.writeFile(path.join(root, rel), body, "utf8");
}

const MINIMAL_PROJECT = `---
name: demo
languages:
  - English
deploymentType: customer-facing-widget
createdAt: "2026-04-22T00:00:00Z"
---

# Project

- **Name**: demo
- **Languages**: English
- **Deployment type**: customer-facing-widget
- **Created at**: 2026-04-22T00:00:00Z
`;

const MINIMAL_BRIEF = `# Brief

## Business scope
A coffee shop selling beans and brewing gear.

## Customers
Home-brew enthusiasts.

## Agent's allowed actions
- Help users find products.

## Agent's forbidden actions
- Never offer refunds without human approval.

## Tone
Friendly and knowledgeable.

## Primary use cases
- Product discovery.
- Brewing advice.

## Business vocabulary
- **product**: A coffee bean or piece of equipment offered for sale.
`;

const MINIMAL_SCHEMA_MAP = `# Schema map

## Summary
One indexable entity (product).

## Entity: product

Classification: indexable
Source tables: public.product
Joined references: (none)

### Columns

- name — index
- description — index

### Evidence

Seen in brief vocabulary.

## Reference tables

- (none)

## Infrastructure / ignored

- (none)

## PII-excluded

- (none)
`;

const MINIMAL_ACTION_MANIFEST = `# Action manifest

## Summary
One tool across one entity.

## Tools: product

### list_products

Description: List products.

Parameters:

\`\`\`json
{ "type": "object" }
\`\`\`

requires_confirmation: false
Source: GET /products
Parameter sources: user message

## Excluded

- (none)

## Runtime system prompt block

You help users find coffee.
`;

describe("validate-artifacts contract (T084 / FR-034, FR-038)", () => {
  it("ArtifactConsistencyReport shape validates", async () => {
    await writeValid(tmpRoot, "project", MINIMAL_PROJECT);
    await writeValid(tmpRoot, "brief", MINIMAL_BRIEF);
    await writeValid(tmpRoot, "schema-map", MINIMAL_SCHEMA_MAP);
    await writeValid(tmpRoot, "action-manifest", MINIMAL_ACTION_MANIFEST);

    const report = await validateArtifacts({ root: tmpRoot });
    expect(() => ArtifactConsistencyReportSchema.parse(report)).not.toThrow();
    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.inconsistencies).toEqual([]);
  });

  it("reports missing artifact with expectedPath", async () => {
    await writeValid(tmpRoot, "project", MINIMAL_PROJECT);
    await writeValid(tmpRoot, "brief", MINIMAL_BRIEF);
    await writeValid(tmpRoot, "schema-map", MINIMAL_SCHEMA_MAP);
    // action-manifest missing

    const report = await validateArtifacts({ root: tmpRoot });
    expect(report.ok).toBe(false);
    expect(report.missing).toHaveLength(1);
    expect(report.missing[0].kind).toBe("action-manifest");
    expect(report.missing[0].expectedPath).toContain("action-manifest.md");
  });

  it("surfaces action-references-excluded-entity inconsistency", async () => {
    await writeValid(tmpRoot, "project", MINIMAL_PROJECT);
    await writeValid(tmpRoot, "brief", MINIMAL_BRIEF);
    await writeValid(tmpRoot, "schema-map", MINIMAL_SCHEMA_MAP);
    // Action manifest references a "ghost" entity that isn't in schema-map
    const ghost = MINIMAL_ACTION_MANIFEST.replace("## Tools: product", "## Tools: ghost_entity");
    await writeValid(tmpRoot, "action-manifest", ghost);

    const report = await validateArtifacts({ root: tmpRoot });
    expect(report.ok).toBe(false);
    const kinds = new Set(report.inconsistencies.map((i) => i.kind));
    expect(kinds.has("action-references-excluded-entity")).toBe(true);
  });

  it("recognises all four inconsistency kinds in its enum", () => {
    const expected = [
      "action-references-excluded-entity",
      "brief-references-missing-vocabulary",
      "schema-map-references-missing-brief-section",
      "plan-references-missing-upstream",
    ];
    for (const k of expected) {
      expect(() => InconsistencyKindSchema.parse(k)).not.toThrow();
    }
    expect(() => InconsistencyKindSchema.parse("bogus-kind")).toThrow();
  });

  it("CLI exit 3 when --root is missing", async () => {
    const exit = await runValidateArtifacts([]);
    expect(exit).toBe(3);
  });

  it("CLI exit 2 when artifacts are missing", async () => {
    const exit = await runValidateArtifacts(["--root", tmpRoot]);
    expect(exit).toBe(2);
  });

  it("CLI exit 0 when everything validates", async () => {
    await writeValid(tmpRoot, "project", MINIMAL_PROJECT);
    await writeValid(tmpRoot, "brief", MINIMAL_BRIEF);
    await writeValid(tmpRoot, "schema-map", MINIMAL_SCHEMA_MAP);
    await writeValid(tmpRoot, "action-manifest", MINIMAL_ACTION_MANIFEST);
    const exit = await runValidateArtifacts(["--root", tmpRoot]);
    expect(exit).toBe(0);
  });

  it("CLI exit 1 when inconsistencies found", async () => {
    await writeValid(tmpRoot, "project", MINIMAL_PROJECT);
    await writeValid(tmpRoot, "brief", MINIMAL_BRIEF);
    await writeValid(tmpRoot, "schema-map", MINIMAL_SCHEMA_MAP);
    const ghost = MINIMAL_ACTION_MANIFEST.replace("## Tools: product", "## Tools: ghost_entity");
    await writeValid(tmpRoot, "action-manifest", ghost);
    const exit = await runValidateArtifacts(["--root", tmpRoot]);
    expect(exit).toBe(1);
  });
});
