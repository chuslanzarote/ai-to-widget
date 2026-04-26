/**
 * T013 — singular/plural normalisation for cross-artifact validation.
 *
 * The classifier tags tool groups with plural English nouns derived from
 * OpenAPI path prefixes (`products`, `orders`, `customers`), while the
 * schema-map canonically names entities in the singular (`Product`,
 * `Order`, `Customer`). The pre-008 exact-match lowercasing compare in
 * `validate-artifacts.ts` produced spurious
 * `action-references-excluded-entity` inconsistencies.
 *
 * `normaliseName` collapses the two sides so `"products"` and `"Product"`
 * compare equal (FR-011 / research.md R9).
 */
import { describe, it, expect } from "vitest";

import { validateArtifacts } from "../src/validate-artifacts.js";
import { normaliseName } from "../src/lib/singular-plural.js";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

const MINIMAL_PROJECT = `---
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
- **Languages**: English
- **Deployment type**: customer-facing-widget
- **Created at**: 2026-04-22T00:00:00Z
`;

const MINIMAL_BRIEF = `# Brief

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

// Schema-map uses SINGULAR entity name "Product".
const SINGULAR_SCHEMA_MAP = `# Schema map

## Summary
One indexable entity.

## Entity: Product

Classification: indexable
Source tables: public.product
Joined references: (none)

### Columns

- name — index

### Evidence

Seen in vocabulary.

## Reference tables

- (none)

## Infrastructure / ignored

- (none)

## PII-excluded

- (none)
`;

// Action manifest uses PLURAL classifier tag "products" — this is the
// shape the classifier emits.
const PLURAL_ACTION_MANIFEST = `# Action manifest

## Summary
One tool.

## Tools: products

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

Help shoppers.
`;

describe("cross-validate singular/plural (T013 / FR-011)", () => {
  it("normaliseName maps plural classifier tag to singular entity name", () => {
    expect(normaliseName("products")).toBe(normaliseName("Product"));
    expect(normaliseName("orders")).toBe(normaliseName("Order"));
    expect(normaliseName("customers")).toBe(normaliseName("Customer"));
    expect(normaliseName("categories")).toBe(normaliseName("Category"));
  });

  it("validate-artifacts accepts plural tool group against singular schema-map entity", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-xvalidate-"));
    try {
      await fs.mkdir(path.join(tmp, "config"), { recursive: true });
      await fs.mkdir(path.join(tmp, "artifacts"), { recursive: true });
      await fs.writeFile(path.join(tmp, "config/project.md"), MINIMAL_PROJECT);
      await fs.writeFile(path.join(tmp, "config/brief.md"), MINIMAL_BRIEF);
      await fs.writeFile(
        path.join(tmp, "artifacts/schema-map.md"),
        SINGULAR_SCHEMA_MAP,
      );
      await fs.writeFile(
        path.join(tmp, "artifacts/action-manifest.md"),
        PLURAL_ACTION_MANIFEST,
      );

      const report = await validateArtifacts({ root: tmp });
      const kinds = report.inconsistencies.map((i) => i.kind);
      expect(kinds).not.toContain("action-references-excluded-entity");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
