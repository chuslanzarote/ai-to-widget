import { describe, expect, it } from "vitest";
import {
  parseMarkdown,
  parseArtifactFromMarkdown,
  SchemaMapZeroEntityError,
} from "../src/lib/markdown.js";

const HEADER = `# Schema Map\n\n## Summary\n\nA test schema.\n`;

function asSchemaMap(raw: string) {
  const parsed = parseMarkdown(raw);
  return parseArtifactFromMarkdown("schema-map", parsed);
}

describe("schema-map parser — D-ZEROENTITY (FR-009 / T011)", () => {
  it("variant A: throws when only H3 '### Entity:' headings are present", () => {
    const raw = `${HEADER}\n### Entity: Product\n\n- Classification: indexable\n`;
    expect(() => asSchemaMap(raw)).toThrowError(SchemaMapZeroEntityError);
    try {
      asSchemaMap(raw);
    } catch (err) {
      expect((err as SchemaMapZeroEntityError).variant).toBe("A");
      expect((err as Error).message).toMatch(/H3 "### Entity:" headings/);
    }
  });

  it("variant B: throws when no 'Entity:' headings are present at all", () => {
    const raw = `${HEADER}\n## Reference tables\n\n- users\n`;
    expect(() => asSchemaMap(raw)).toThrowError(SchemaMapZeroEntityError);
    try {
      asSchemaMap(raw);
    } catch (err) {
      expect((err as SchemaMapZeroEntityError).variant).toBe("B");
      expect((err as Error).message).toMatch(/Expected H2 headings of the form/);
    }
  });

  it("parses successfully when at least one H2 '## Entity:' section is present", () => {
    const raw = `${HEADER}
## Entity: Product

- Classification: indexable
- Source tables: products

### Columns

- \`id\`: reference
- \`title\`: index

### Evidence

Products are the main catalog entity.
`;
    const result = asSchemaMap(raw);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].name).toBe("Product");
    expect(result.entities[0].classification).toBe("indexable");
  });
});
