import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseMarkdown, serializeMarkdown } from "../src/lib/markdown.js";

describe("serializeMarkdown — quoted ISO-8601 timestamps (FR-008 / R16)", () => {
  it("wraps createdAt and updatedAt values in double quotes", () => {
    const out = serializeMarkdown(
      {
        name: "demo",
        createdAt: "2026-04-24T15:42:00Z",
        updatedAt: "2026-04-24T15:42:01.123Z",
      },
      "# Project\n",
    );
    expect(out).toContain('createdAt: "2026-04-24T15:42:00Z"');
    expect(out).toContain('updatedAt: "2026-04-24T15:42:01.123Z"');
  });

  it("round-trips through parseMarkdown as z.string().datetime() for every timestamp", () => {
    const ts = "2026-04-24T15:42:00Z";
    const out = serializeMarkdown(
      { createdAt: ts, updatedAt: ts },
      "# Project\n",
    );
    const parsed = parseMarkdown(out);
    const schema = z.object({
      createdAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
    });
    expect(() => schema.parse(parsed.frontmatter)).not.toThrow();
  });

  it("does not re-quote values that were already quoted", () => {
    const out = serializeMarkdown(
      { createdAt: "2026-04-24T15:42:00Z" },
      "# Project\n",
    );
    // Only one pair of surrounding quotes
    const match = out.match(/createdAt:\s*(.+)/);
    expect(match?.[1]).toMatch(/^"2026-04-24T15:42:00Z"/);
  });

  it("leaves non-timestamp string heuristics unchanged", () => {
    const out = serializeMarkdown(
      { name: "demo-shop", deploymentType: "customer-facing-widget" },
      "# Project\n",
    );
    expect(out).toContain("name: demo-shop");
    expect(out).toContain("deploymentType: customer-facing-widget");
  });

  it("handles offset-qualified timestamps (e.g. +02:00)", () => {
    const out = serializeMarkdown(
      { createdAt: "2026-04-24T15:42:00+02:00" },
      "# Project\n",
    );
    expect(out).toContain('createdAt: "2026-04-24T15:42:00+02:00"');
  });
});
