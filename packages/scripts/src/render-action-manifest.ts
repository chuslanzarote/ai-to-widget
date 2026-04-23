/**
 * Feature 006 — Serialise an `ActionManifest` back to markdown per
 * contracts/action-manifest.schema.md.
 *
 * Round-trip invariant (tested in parse-action-manifest.unit.test.ts):
 *   renderActionManifest(parseActionManifestText(text)) === text
 * for any canonical input produced by this function.
 *
 * Ordering rules:
 *   - Groups sorted alphabetically.
 *   - Tools within a group sorted alphabetically by toolName.
 *   - Excluded sorted by path, then method.
 */
import type {
  ActionManifest,
  ActionManifestEntry,
} from "./lib/action-manifest-types.js";

export interface RenderActionManifestOptions {
  /** Override the `## Tools: <group>` bucket for each entry. Default: infer from path. */
  groupFor?: (entry: ActionManifestEntry) => string;
  /** Append a carried-over runtime system prompt block from brief.md. */
  runtimeSystemPromptBlock?: string;
}

/**
 * Render an `ActionManifest` to canonical markdown bytes. LF line
 * endings, trailing newline at EOF.
 */
export function renderActionManifest(
  manifest: ActionManifest,
  opts: RenderActionManifestOptions = {},
): string {
  const parts: string[] = [];
  parts.push("# Action manifest", "");
  parts.push(...renderProvenance(manifest));
  parts.push("", ...renderSummary(manifest));
  const toolsBlocks = renderToolsSections(manifest, opts.groupFor);
  for (const block of toolsBlocks) {
    parts.push("", ...block);
  }
  parts.push("", ...renderExcluded(manifest));
  if (manifest.orphaned.length > 0) {
    parts.push("", ...renderOrphaned(manifest));
  }
  if (opts.runtimeSystemPromptBlock && opts.runtimeSystemPromptBlock.trim().length > 0) {
    parts.push("", "## Runtime system prompt block", "");
    parts.push(opts.runtimeSystemPromptBlock.trim());
  }
  // Join + ensure trailing newline (exactly one).
  const joined = parts.join("\n").replace(/\n+$/, "") + "\n";
  return joined;
}

function renderProvenance(manifest: ActionManifest): string[] {
  return [
    "## Provenance",
    "",
    `- OpenAPI snapshot: ${manifest.provenance.openapiSha256}`,
    `- Classifier model: ${manifest.provenance.classifierModel}`,
    `- Classified at: ${manifest.provenance.classifiedAt}`,
  ];
}

function renderSummary(manifest: ActionManifest): string[] {
  return ["## Summary", "", manifest.summary.trim()];
}

function renderToolsSections(
  manifest: ActionManifest,
  groupFor?: (entry: ActionManifestEntry) => string,
): string[][] {
  const pickGroup = groupFor ?? defaultGroupFor;
  const grouped = new Map<string, ActionManifestEntry[]>();
  for (const entry of manifest.included) {
    const g = pickGroup(entry);
    const arr = grouped.get(g) ?? [];
    arr.push(entry);
    grouped.set(g, arr);
  }
  const groupNames = Array.from(grouped.keys()).sort();
  const blocks: string[][] = [];
  for (const group of groupNames) {
    const entries = (grouped.get(group) ?? []).slice().sort((a, b) =>
      a.toolName < b.toolName ? -1 : a.toolName > b.toolName ? 1 : 0,
    );
    const section: string[] = [`## Tools: ${group}`];
    for (const entry of entries) {
      section.push("", ...renderToolBlock(entry));
    }
    blocks.push(section);
  }
  return blocks;
}

function defaultGroupFor(entry: ActionManifestEntry): string {
  // Heuristic: first non-empty path segment that is not a placeholder.
  const segments = entry.source.path.split("/").filter((s) => s.length > 0);
  for (const s of segments) {
    if (s.startsWith("{")) continue;
    if (s === "store" || s === "api" || s === "v1" || s === "v2") continue;
    return s;
  }
  return "general";
}

function renderToolBlock(entry: ActionManifestEntry): string[] {
  const lines: string[] = [];
  lines.push(`### ${entry.toolName}`);
  lines.push("");
  lines.push(`Description: ${entry.description}`);
  if (entry.descriptionTemplate !== undefined) {
    lines.push(`description_template: "${escapeQuotes(entry.descriptionTemplate)}"`);
  }
  if (entry.summaryFields !== undefined) {
    lines.push(`summary_fields: ${JSON.stringify(entry.summaryFields)}`);
  }
  lines.push("");
  lines.push("Parameters:");
  lines.push("");
  lines.push("```json");
  lines.push(stringifyParameters(entry.parameters));
  lines.push("```");
  lines.push("");
  lines.push(`requires_confirmation: ${entry.requiresConfirmation}`);
  lines.push(`is_action: ${entry.isAction}`);
  lines.push(`Source: ${entry.source.method} ${entry.source.path}`);
  if (entry.parameterSources !== undefined) {
    lines.push(`Parameter sources: ${entry.parameterSources}`);
  }
  return lines;
}

function escapeQuotes(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function stringifyParameters(parameters: ActionManifestEntry["parameters"]): string {
  // Preserve declared key order for stability: type → required → properties.
  const ordered = {
    type: parameters.type,
    required: parameters.required,
    properties: parameters.properties,
  };
  return JSON.stringify(ordered, null, 2);
}

function renderExcluded(manifest: ActionManifest): string[] {
  const lines: string[] = ["## Excluded", ""];
  const sorted = manifest.excluded.slice().sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    return a.method < b.method ? -1 : a.method > b.method ? 1 : 0;
  });
  for (const e of sorted) {
    lines.push(`- ${e.method} ${e.path} — ${e.reason}`);
  }
  return lines;
}

function renderOrphaned(manifest: ActionManifest): string[] {
  const lines: string[] = ["## Orphaned (operation removed from OpenAPI)", ""];
  const sorted = manifest.orphaned.slice().sort((a, b) => {
    if (a.path !== b.path) return a.path < b.path ? -1 : 1;
    return a.method < b.method ? -1 : a.method > b.method ? 1 : 0;
  });
  for (const e of sorted) {
    lines.push(`- ${e.method} ${e.path} — previously: ${e.previousToolName}`);
  }
  return lines;
}
