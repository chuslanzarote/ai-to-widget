/**
 * T028 — Parser unit tests for `parse-action-manifest.ts`.
 *
 * Every case from contracts/action-manifest.schema.md §11:
 *   - Minimal valid manifest with one tool and one excluded → parses.
 *   - Empty included (only excluded) → parses with included: [].
 *   - Missing Provenance → ProvenanceFormatError.
 *   - Missing requires_confirmation line → ManifestFormatError.
 *   - Malformed Parameters JSON → ManifestFormatError.
 *   - source triple not in OpenAPI → ManifestValidationError.
 *   - Duplicate tool name → ToolNameCollisionError.
 *   - Builder-flipped requires_confirmation: false → round-trips.
 *   - Non-canonical reason token → accepted verbatim.
 *   - Unknown ## heading → ManifestFormatError.
 *   - Round-trip parse → re-render byte-identical.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  parseActionManifest,
  parseActionManifestText,
  ManifestFormatError,
  ManifestValidationError,
  ProvenanceFormatError,
  ToolNameCollisionError,
} from "../src/parse-action-manifest.js";
import { renderActionManifest } from "../src/render-action-manifest.js";
import type {
  ActionManifest,
  ActionManifestEntry,
} from "../src/lib/action-manifest-types.js";

const SHA = "sha256:" + "0".repeat(64);

const PROVENANCE_BLOCK = `## Provenance

- OpenAPI snapshot: ${SHA}
- Classifier model: claude-opus-4-7 (2026-04-23)
- Classified at: 2026-04-23T10:00:00Z`;

function tool(block: {
  name: string;
  path: string;
  method?: string;
  requiresConfirmation?: boolean;
  isAction?: boolean;
  omitRequiresConfirmation?: boolean;
  malformedJson?: boolean;
}): string {
  const method = block.method ?? "POST";
  const requiresConfirmationLine = block.omitRequiresConfirmation
    ? ""
    : `requires_confirmation: ${block.requiresConfirmation ?? true}\n`;
  const jsonBody = block.malformedJson
    ? `{ "type": "object", "required": [\n}`
    : `{
  "type": "object",
  "properties": {
    "foo": { "type": "string" }
  }
}`;
  return `### ${block.name}

Description: Test tool.

Parameters:

\`\`\`json
${jsonBody}
\`\`\`

${requiresConfirmationLine}is_action: ${block.isAction ?? true}
Source: ${method} ${block.path}
`;
}

function buildManifestText(opts: {
  provenance?: string;
  summary?: string;
  toolsSection?: string;
  excluded?: string;
  extraSection?: string;
}): string {
  const parts = ["# Action manifest", ""];
  parts.push(opts.provenance ?? PROVENANCE_BLOCK);
  parts.push("");
  parts.push(`## Summary\n\n${opts.summary ?? "Test manifest."}`);
  if (opts.toolsSection !== undefined) {
    parts.push("");
    parts.push(opts.toolsSection);
  }
  parts.push("");
  parts.push(`## Excluded\n\n${opts.excluded ?? ""}`.trimEnd());
  if (opts.extraSection) {
    parts.push("");
    parts.push(opts.extraSection);
  }
  return parts.join("\n") + "\n";
}

describe("parseActionManifestText — minimal valid (T028)", () => {
  it("parses a manifest with one tool and one excluded", () => {
    const text = buildManifestText({
      toolsSection: `## Tools: widget\n\n${tool({ name: "post_widget_demo", path: "/widget/demo" })}`,
      excluded: "- POST /admin/users — admin-prefix\n",
    });
    const manifest = parseActionManifestText(text);
    expect(manifest.included).toHaveLength(1);
    expect(manifest.included[0]?.toolName).toBe("post_widget_demo");
    expect(manifest.included[0]?.source.method).toBe("POST");
    expect(manifest.included[0]?.source.path).toBe("/widget/demo");
    expect(manifest.excluded).toHaveLength(1);
    expect(manifest.excluded[0]?.reason).toBe("admin-prefix");
  });
});

describe("parseActionManifestText — empty included", () => {
  it("parses a manifest with no Tools sections as included: []", () => {
    const text = buildManifestText({
      excluded: "- POST /admin/users — admin-prefix\n",
    });
    const manifest = parseActionManifestText(text);
    expect(manifest.included).toHaveLength(0);
    expect(manifest.excluded).toHaveLength(1);
  });
});

describe("parseActionManifestText — provenance errors", () => {
  it("throws ProvenanceFormatError when ## Provenance is missing", () => {
    const text = [
      "# Action manifest",
      "",
      "## Summary",
      "",
      "no provenance above.",
      "",
      "## Excluded",
      "",
      "",
    ].join("\n");
    expect(() => parseActionManifestText(text)).toThrow(ProvenanceFormatError);
  });

  it("throws ProvenanceFormatError when a provenance bullet is malformed", () => {
    const text = buildManifestText({
      provenance: [
        "## Provenance",
        "",
        "- OpenAPI snapshot: not-a-sha",
        "- Classifier model: claude-opus-4-7",
        "- Classified at: 2026-04-23T10:00:00Z",
      ].join("\n"),
      excluded: "",
    });
    expect(() => parseActionManifestText(text)).toThrow(ProvenanceFormatError);
  });

  it("throws ProvenanceFormatError when classifiedAt is not ISO-8601", () => {
    const text = buildManifestText({
      provenance: [
        "## Provenance",
        "",
        `- OpenAPI snapshot: ${SHA}`,
        "- Classifier model: claude-opus-4-7",
        "- Classified at: yesterday",
      ].join("\n"),
      excluded: "",
    });
    expect(() => parseActionManifestText(text)).toThrow(ProvenanceFormatError);
  });
});

describe("parseActionManifestText — tool block errors", () => {
  it("throws ManifestFormatError when requires_confirmation is missing", () => {
    const text = buildManifestText({
      toolsSection: `## Tools: widget\n\n${tool({
        name: "broken_tool",
        path: "/widget/demo",
        omitRequiresConfirmation: true,
      })}`,
    });
    expect(() => parseActionManifestText(text)).toThrow(ManifestFormatError);
  });

  it("throws ManifestFormatError when Parameters JSON is malformed", () => {
    const text = buildManifestText({
      toolsSection: `## Tools: widget\n\n${tool({
        name: "broken_json",
        path: "/widget/demo",
        malformedJson: true,
      })}`,
    });
    expect(() => parseActionManifestText(text)).toThrow(ManifestFormatError);
  });

  it("throws ToolNameCollisionError on duplicate ### headings", () => {
    const toolBlock = tool({ name: "dup_tool", path: "/widget/demo" });
    const text = buildManifestText({
      toolsSection: `## Tools: widget\n\n${toolBlock}\n\n${toolBlock}`,
    });
    expect(() => parseActionManifestText(text)).toThrow(ToolNameCollisionError);
  });
});

describe("parseActionManifestText — unknown section", () => {
  it("throws ManifestFormatError on an unknown ## heading", () => {
    const text = buildManifestText({
      excluded: "",
      extraSection: "## Notes\n\nsome unexpected section",
    });
    expect(() => parseActionManifestText(text)).toThrow(ManifestFormatError);
  });
});

describe("parseActionManifestText — non-canonical reason accepted verbatim", () => {
  it("preserves an unknown reason token in the excluded bullet", () => {
    const text = buildManifestText({
      excluded: "- POST /store/experimental — out-of-scope: experimental endpoint\n",
    });
    const manifest = parseActionManifestText(text);
    expect(manifest.excluded[0]?.reason).toBe(
      "out-of-scope: experimental endpoint",
    );
  });
});

describe("parseActionManifest — OpenAPI cross-validation (FR-004)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "parse-action-manifest-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("throws ManifestValidationError when source triple is not in OpenAPI", async () => {
    const manifestPath = path.join(tmp, "action-manifest.md");
    const openapiPath = path.join(tmp, "openapi.json");
    await fs.writeFile(
      manifestPath,
      buildManifestText({
        toolsSection: `## Tools: widget\n\n${tool({
          name: "ghost_tool",
          path: "/widget/ghost",
          method: "POST",
        })}`,
      }),
    );
    await fs.writeFile(
      openapiPath,
      JSON.stringify({
        openapi: "3.0.0",
        info: { title: "t", version: "1" },
        paths: {
          "/widget/demo": {
            post: { operationId: "postWidgetDemo", responses: { 200: { description: "ok" } } },
          },
        },
      }),
    );

    await expect(
      parseActionManifest({ manifestPath, openapiPath }),
    ).rejects.toBeInstanceOf(ManifestValidationError);
  });

  it("populates operationId from OpenAPI on successful cross-validation", async () => {
    const manifestPath = path.join(tmp, "action-manifest.md");
    const openapiPath = path.join(tmp, "openapi.json");
    await fs.writeFile(
      manifestPath,
      buildManifestText({
        toolsSection: `## Tools: widget\n\n${tool({
          name: "post_widget_demo",
          path: "/widget/demo",
          method: "POST",
        })}`,
      }),
    );
    await fs.writeFile(
      openapiPath,
      JSON.stringify({
        openapi: "3.0.0",
        info: { title: "t", version: "1" },
        paths: {
          "/widget/demo": {
            post: { operationId: "postWidgetDemo", responses: { 200: { description: "ok" } } },
          },
        },
      }),
    );
    const manifest = await parseActionManifest({ manifestPath, openapiPath });
    expect(manifest.included[0]?.source.operationId).toBe("postWidgetDemo");
  });
});

describe("round-trip render(parse(render(m))) === render(m)", () => {
  function entry(overrides: Partial<ActionManifestEntry> = {}): ActionManifestEntry {
    return {
      toolName: "add_to_cart",
      description: "Add a variant to the cart.",
      parameters: {
        type: "object",
        properties: {
          cart_id: { type: "string" },
          variant_id: { type: "string" },
        },
        required: ["cart_id", "variant_id"],
      },
      requiresConfirmation: true,
      isAction: true,
      source: {
        method: "POST",
        path: "/store/carts/{cart_id}/line-items",
        operationId: "addLineItem",
      },
      ...overrides,
    };
  }

  it("preserves a Builder-flipped requires_confirmation: false byte-for-byte", () => {
    const manifest: ActionManifest = {
      provenance: {
        openapiSha256: SHA,
        classifierModel: "claude-opus-4-7",
        classifiedAt: "2026-04-23T10:00:00Z",
      },
      summary: "byte-identical test.",
      included: [entry({ requiresConfirmation: false })],
      excluded: [],
      orphaned: [],
    };
    const text1 = renderActionManifest(manifest);
    const parsed = parseActionManifestText(text1);
    const text2 = renderActionManifest(parsed);
    expect(text2).toBe(text1);
    expect(parsed.included[0]?.requiresConfirmation).toBe(false);
  });

  it("round-trips a manifest with descriptionTemplate + summaryFields", () => {
    const manifest: ActionManifest = {
      provenance: {
        openapiSha256: SHA,
        classifierModel: "claude-opus-4-7",
        classifiedAt: "2026-04-23T10:00:00Z",
      },
      summary: "round-trip.",
      included: [
        entry({
          descriptionTemplate: "Add {quantity} × {product_title} to cart",
          summaryFields: ["product_title", "quantity"],
        }),
      ],
      excluded: [
        {
          method: "POST",
          path: "/admin/users",
          operationId: "POST /admin/users",
          reason: "admin-prefix",
        },
      ],
      orphaned: [],
    };
    const text1 = renderActionManifest(manifest);
    const parsed = parseActionManifestText(text1);
    const text2 = renderActionManifest(parsed);
    expect(text2).toBe(text1);
  });

  it("round-trips an orphaned section", () => {
    const manifest: ActionManifest = {
      provenance: {
        openapiSha256: SHA,
        classifierModel: "claude-opus-4-7",
        classifiedAt: "2026-04-23T10:00:00Z",
      },
      summary: "orphan test.",
      included: [entry()],
      excluded: [],
      orphaned: [
        {
          method: "DELETE",
          path: "/store/gone",
          previousToolName: "delete_gone",
        },
      ],
    };
    const text1 = renderActionManifest(manifest);
    const parsed = parseActionManifestText(text1);
    const text2 = renderActionManifest(parsed);
    expect(text2).toBe(text1);
    expect(parsed.orphaned).toHaveLength(1);
    expect(parsed.orphaned[0]?.previousToolName).toBe("delete_gone");
  });
});
