/**
 * T014 — `(runtime-only)` flag on `## Tools: <group>` headings.
 *
 * (a) Without the flag, a tool group referencing an excluded entity fails
 *     with D-RUNTIMEONLY (action-references-excluded-entity).
 * (b) With the flag, the group passes the cross-check.
 * (c) The flag round-trips into `action-executors.json` as
 *     `runtimeOnly: true` on every rendered executor.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

import { validateArtifacts } from "../src/validate-artifacts.js";
import { renderExecutors } from "../src/render-executors.js";
import type { ActionManifest } from "../src/lib/action-manifest-types.js";

const PROJECT_MD = `---
name: demo
languages:
  - English
deploymentType: customer-facing-widget
createdAt: "2026-04-22T00:00:00Z"
storefrontOrigins:
  - "http://localhost:5173"
---

# Project

- **Name**: demo
`;

const BRIEF_MD = `# Brief

## Business scope
Sells coffee.

## Customers
Enthusiasts.

## Agent's allowed actions
- Find items.

## Agent's forbidden actions
- No refunds.

## Tone
Friendly.

## Primary use cases
- Discovery.

## Business vocabulary
- **product**: A thing.
`;

const SCHEMA_MAP = `# Schema map

## Summary
One indexable entity.

## Entity: Product

Classification: indexable
Source tables: public.product
Joined references: (none)

### Columns

- name — index

### Evidence

Seen.

## Reference tables

- (none)

## Infrastructure / ignored

- (none)

## PII-excluded

- (none)
`;

function manifest(groupHeading: string): string {
  return `# Action manifest

## Summary
One tool.

## Tools: ${groupHeading}

### list_ghosts

Description: List ghosts.

Parameters:

\`\`\`json
{ "type": "object" }
\`\`\`

requires_confirmation: false
Source: GET /ghosts
Parameter sources: user message

## Excluded

- (none)

## Runtime system prompt block

Help shoppers.
`;
}

describe("validate-artifacts — runtime-only flag (T014 / FR-012)", () => {
  it("(a) without the flag, an entity with no schema-map match fails", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-ro-"));
    try {
      await fs.mkdir(path.join(tmp, "config"), { recursive: true });
      await fs.mkdir(path.join(tmp, "artifacts"), { recursive: true });
      await fs.writeFile(path.join(tmp, "config/project.md"), PROJECT_MD);
      await fs.writeFile(path.join(tmp, "config/brief.md"), BRIEF_MD);
      await fs.writeFile(path.join(tmp, "artifacts/schema-map.md"), SCHEMA_MAP);
      await fs.writeFile(
        path.join(tmp, "artifacts/action-manifest.md"),
        manifest("ghosts"),
      );
      const report = await validateArtifacts({ root: tmp });
      const kinds = report.inconsistencies.map((i) => i.kind);
      expect(kinds).toContain("action-references-excluded-entity");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("(b) with `(runtime-only)`, the group passes the cross-check", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-ro-"));
    try {
      await fs.mkdir(path.join(tmp, "config"), { recursive: true });
      await fs.mkdir(path.join(tmp, "artifacts"), { recursive: true });
      await fs.writeFile(path.join(tmp, "config/project.md"), PROJECT_MD);
      await fs.writeFile(path.join(tmp, "config/brief.md"), BRIEF_MD);
      await fs.writeFile(path.join(tmp, "artifacts/schema-map.md"), SCHEMA_MAP);
      await fs.writeFile(
        path.join(tmp, "artifacts/action-manifest.md"),
        manifest("ghosts (runtime-only)"),
      );
      const report = await validateArtifacts({ root: tmp });
      const kinds = report.inconsistencies.map((i) => i.kind);
      expect(kinds).not.toContain("action-references-excluded-entity");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("(c) runtimeOnly round-trips into action-executors.json", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-ro-"));
    try {
      const m: ActionManifest = {
        provenance: {
          openapiSha256:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000",
          classifierModel: "claude-opus-4-7",
          classifiedAt: "2026-04-22T00:00:00.000Z",
        },
        summary: "one",
        included: [
          {
            toolName: "list_ghosts",
            description: "List ghosts.",
            parameters: { type: "object", properties: {}, required: [] },
            requiresConfirmation: false,
            isAction: false,
            source: {
              method: "GET",
              path: "/ghosts",
              operationId: "listGhosts",
            },
            parameterSources: "user message",
            runtimeOnly: true,
          },
        ],
        excluded: [],
        orphaned: [],
      };
      const out = path.join(tmp, "action-executors.json");
      await renderExecutors(m, {
        outputPath: out,
        hostOrigin: "http://localhost:9000",
        widgetOrigin: "http://localhost:9000",
      });
      const text = await fs.readFile(out, "utf8");
      const json = JSON.parse(text) as {
        actions: Array<{ tool: string; runtimeOnly?: boolean }>;
      };
      expect(json.actions[0]?.tool).toBe("list_ghosts");
      expect(json.actions[0]?.runtimeOnly).toBe(true);
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
