/**
 * Feature 006 — `action-manifest.md` parser.
 *
 * Reads the committed manifest and produces a Zod-validated
 * `ActionManifest`. Enforces every rule in
 * contracts/action-manifest.schema.md §§2–7 and maps violations to
 * `ManifestFormatError`, `ProvenanceFormatError`, `ToolNameCollisionError`,
 * or `ManifestValidationError`.
 *
 * FR-004 — cross-validates every `included[*].source` triple against
 * the ingested `openapi.json` (second enforcement point for anchored-
 * generation).
 */
import { promises as fs } from "node:fs";
import path from "node:path";

import {
  ActionManifestSchema,
  type ActionManifest,
  type ActionManifestEntry,
  type ExcludedEntry,
  type OrphanedEntry,
  ToolNameCollisionError,
} from "./lib/action-manifest-types.js";

/* ============================================================================
 * Error classes
 * ========================================================================= */

export class ManifestFormatError extends Error {
  readonly code = "MANIFEST_FORMAT" as const;
}

export class ProvenanceFormatError extends Error {
  readonly code = "PROVENANCE_FORMAT" as const;
}

export class ManifestValidationError extends Error {
  readonly code = "MANIFEST_VALIDATION" as const;
}

/* ============================================================================
 * Public API
 * ========================================================================= */

export interface ParseActionManifestOptions {
  /** Absolute path to the `action-manifest.md` file to parse. */
  manifestPath: string;
  /** Optional path to the ingested `openapi.json` for the FR-004 cross-check. */
  openapiPath?: string;
}

export async function parseActionManifest(
  opts: ParseActionManifestOptions,
): Promise<ActionManifest> {
  const text = await fs.readFile(opts.manifestPath, "utf8");
  const manifest = parseActionManifestText(text);

  if (opts.openapiPath) {
    await crossValidateAgainstOpenAPI(manifest, opts.openapiPath);
  }

  return manifest;
}

/**
 * Core text-in → manifest-out (no filesystem). Callers that don't need
 * OpenAPI cross-validation (e.g. the render step when the manifest was
 * just written by the classifier) use this directly.
 */
export function parseActionManifestText(text: string): ActionManifest {
  // Normalise to LF for deterministic splitting.
  const content = text.replace(/\r\n/g, "\n");
  const sections = splitTopLevelSections(content);
  assertSectionOrder(sections);

  const provenance = parseProvenance(sections.get("## Provenance") ?? "");
  const summary = parseSummary(sections.get("## Summary") ?? "");
  const { included } = parseTools(sections);
  const excluded = parseExcluded(sections.get("## Excluded") ?? "");
  const orphaned = parseOrphaned(
    sections.get("## Orphaned (operation removed from OpenAPI)") ?? "",
  );

  const manifest = {
    provenance,
    summary,
    included,
    excluded,
    orphaned,
  };

  const parsed = ActionManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    throw new ManifestFormatError(
      `manifest failed schema validation: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }
  return parsed.data;
}

/* ============================================================================
 * Top-level section splitter
 * ========================================================================= */

const ALLOWED_HEADINGS = new Set([
  "# Action manifest",
  "## Provenance",
  "## Summary",
  "## Excluded",
  "## Orphaned (operation removed from OpenAPI)",
  "## Runtime system prompt block",
]);

/**
 * Splits the manifest text into a Map<heading, body>. A heading is any
 * line that begins with `## ` (top-level) or `# ` (document title).
 * Sub-headings (`### ...`) are kept inside their parent section body.
 *
 * Bodies are trimmed of surrounding whitespace-only lines but interior
 * whitespace is preserved.
 */
function splitTopLevelSections(text: string): Map<string, string> {
  const lines = text.split("\n");
  const map = new Map<string, string>();
  let current: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (current !== null) {
      map.set(current, trimBlankLines(buf.join("\n")));
    }
  };
  for (const line of lines) {
    if (line.startsWith("# ")) {
      flush();
      current = line.trim();
      buf = [];
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      current = line.trim();
      buf = [];
      continue;
    }
    buf.push(line);
  }
  flush();
  return map;
}

function trimBlankLines(s: string): string {
  return s.replace(/^\n+/, "").replace(/\n+$/, "");
}

function assertSectionOrder(sections: Map<string, string>): void {
  const titles = Array.from(sections.keys());
  if (!titles.includes("# Action manifest")) {
    throw new ManifestFormatError(
      "missing top-level heading `# Action manifest`",
    );
  }
  if (!titles.includes("## Provenance")) {
    throw new ProvenanceFormatError(
      "missing required section `## Provenance`",
    );
  }
  if (!titles.includes("## Summary")) {
    throw new ManifestFormatError(
      "missing required section `## Summary`",
    );
  }
  if (!titles.includes("## Excluded")) {
    throw new ManifestFormatError(
      "missing required section `## Excluded`",
    );
  }
  for (const t of titles) {
    if (t.startsWith("## ") && !isAllowedSectionHeading(t)) {
      throw new ManifestFormatError(
        `unknown top-level heading: "${t}" (parser rejects unknown sections per contracts/action-manifest.schema.md §2)`,
      );
    }
  }
}

function isAllowedSectionHeading(heading: string): boolean {
  if (ALLOWED_HEADINGS.has(heading)) return true;
  if (heading.startsWith("## Tools:")) return true;
  return false;
}

/* ============================================================================
 * Provenance
 * ========================================================================= */

function parseProvenance(body: string): ActionManifest["provenance"] {
  const shaMatch = body.match(/^-\s+OpenAPI snapshot:\s+(sha256:[0-9a-f]{64})\s*$/m);
  if (!shaMatch) {
    throw new ProvenanceFormatError(
      "missing or malformed `- OpenAPI snapshot: sha256:<64 hex>` bullet",
    );
  }
  const modelMatch = body.match(/^-\s+Classifier model:\s+(.+?)\s*$/m);
  if (!modelMatch) {
    throw new ProvenanceFormatError(
      "missing or malformed `- Classifier model: <model-id>` bullet",
    );
  }
  const tsMatch = body.match(/^-\s+Classified at:\s+(.+?)\s*$/m);
  if (!tsMatch) {
    throw new ProvenanceFormatError(
      "missing or malformed `- Classified at: <ISO-8601>` bullet",
    );
  }
  const classifiedAt = tsMatch[1].trim();
  if (!isIsoTimestamp(classifiedAt)) {
    throw new ProvenanceFormatError(
      `Classified at is not ISO-8601: "${classifiedAt}"`,
    );
  }
  return {
    openapiSha256: shaMatch[1],
    classifierModel: modelMatch[1].trim(),
    classifiedAt,
  };
}

function isIsoTimestamp(s: string): boolean {
  if (isNaN(Date.parse(s))) return false;
  // Zod's z.string().datetime() requires full ISO-8601 (with T + Z).
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s);
}

/* ============================================================================
 * Summary
 * ========================================================================= */

function parseSummary(body: string): string {
  return body.trim();
}

/* ============================================================================
 * Tools sections
 * ========================================================================= */

function parseTools(
  sections: Map<string, string>,
): { included: ActionManifestEntry[] } {
  const entries: ActionManifestEntry[] = [];
  const toolNameSeen = new Map<string, { line: number }>();

  const toolsSections = Array.from(sections.entries())
    .filter(([h]) => h.startsWith("## Tools:"))
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  for (const [, body] of toolsSections) {
    const blocks = splitToolBlocks(body);
    for (const block of blocks) {
      const entry = parseSingleToolBlock(block);
      const prior = toolNameSeen.get(entry.toolName);
      if (prior) {
        throw new ToolNameCollisionError(
          entry.toolName,
          `duplicate tool_name "${entry.toolName}" — appeared at block line ${prior.line} and reappeared`,
        );
      }
      toolNameSeen.set(entry.toolName, { line: 0 });
      entries.push(entry);
    }
  }

  return { included: entries };
}

function splitToolBlocks(body: string): string[] {
  const lines = body.split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    if (line.startsWith("### ")) {
      if (inBlock) {
        blocks.push(cur.join("\n"));
      }
      cur = [line];
      inBlock = true;
      continue;
    }
    if (inBlock) cur.push(line);
  }
  if (inBlock) blocks.push(cur.join("\n"));
  return blocks;
}

function parseSingleToolBlock(block: string): ActionManifestEntry {
  const headingMatch = block.match(/^### (.+?)\s*$/m);
  if (!headingMatch) {
    throw new ManifestFormatError(
      `tool block missing \`### <tool_name>\` heading: ${block.slice(0, 60)}`,
    );
  }
  const toolName = headingMatch[1].trim();

  const description = extractSingleLineField(block, "Description") ?? "";
  if (description.length === 0) {
    throw new ManifestFormatError(
      `tool "${toolName}" has empty Description`,
    );
  }

  const descriptionTemplate = extractQuotedField(block, "description_template");
  const summaryFieldsRaw = extractSingleLineField(block, "summary_fields");
  let summaryFields: string[] | undefined;
  if (summaryFieldsRaw) {
    try {
      const v = JSON.parse(summaryFieldsRaw);
      if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
        summaryFields = v;
      } else {
        throw new ManifestFormatError(
          `tool "${toolName}": summary_fields must be a JSON array of strings`,
        );
      }
    } catch (err) {
      if (err instanceof ManifestFormatError) throw err;
      throw new ManifestFormatError(
        `tool "${toolName}": summary_fields is not valid JSON — ${(err as Error).message}`,
      );
    }
  }

  const parameters = extractFencedJson(block, toolName);
  const requiresConfirmation = extractBoolField(
    block,
    "requires_confirmation",
    toolName,
  );
  const isAction = extractBoolField(block, "is_action", toolName);
  const sourceLine = extractSingleLineField(block, "Source");
  if (!sourceLine) {
    throw new ManifestFormatError(
      `tool "${toolName}": missing required \`Source:\` line`,
    );
  }
  const source = parseSourceLine(sourceLine, toolName);
  const parameterSources = extractSingleLineField(block, "Parameter sources");

  const entry: ActionManifestEntry = {
    toolName,
    description,
    ...(descriptionTemplate ? { descriptionTemplate } : {}),
    ...(summaryFields ? { summaryFields } : {}),
    parameters,
    requiresConfirmation,
    isAction,
    source,
    ...(parameterSources ? { parameterSources } : {}),
  };
  return entry;
}

function extractSingleLineField(block: string, key: string): string | null {
  const rx = new RegExp(`^${escapeRegExp(key)}:\\s+(.+?)\\s*$`, "m");
  const m = block.match(rx);
  return m ? m[1] : null;
}

function extractQuotedField(block: string, key: string): string | undefined {
  const rx = new RegExp(`^${escapeRegExp(key)}:\\s+"((?:\\\\.|[^"\\\\])*)"\\s*$`, "m");
  const m = block.match(rx);
  return m ? m[1] : undefined;
}

function extractBoolField(block: string, key: string, toolName: string): boolean {
  const raw = extractSingleLineField(block, key);
  if (raw === null) {
    throw new ManifestFormatError(
      `tool "${toolName}": missing required \`${key}:\` line`,
    );
  }
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new ManifestFormatError(
    `tool "${toolName}": ${key} must be \`true\` or \`false\`, got "${raw}"`,
  );
}

function extractFencedJson(
  block: string,
  toolName: string,
): ActionManifestEntry["parameters"] {
  const rx = /Parameters:\s*\n+```json\n([\s\S]*?)\n```/;
  const m = block.match(rx);
  if (!m) {
    throw new ManifestFormatError(
      `tool "${toolName}": missing \`Parameters:\` fenced JSON block`,
    );
  }
  let obj: unknown;
  try {
    obj = JSON.parse(m[1]);
  } catch (err) {
    throw new ManifestFormatError(
      `tool "${toolName}": Parameters JSON is malformed — ${(err as Error).message}`,
    );
  }
  if (!obj || typeof obj !== "object") {
    throw new ManifestFormatError(
      `tool "${toolName}": Parameters must be a JSON object`,
    );
  }
  const parsed = obj as {
    type?: unknown;
    properties?: unknown;
    required?: unknown;
  };
  if (parsed.type !== "object") {
    throw new ManifestFormatError(
      `tool "${toolName}": Parameters.type must be "object"`,
    );
  }
  const properties =
    parsed.properties && typeof parsed.properties === "object"
      ? (parsed.properties as Record<string, unknown>)
      : {};
  const required = Array.isArray(parsed.required)
    ? (parsed.required as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return { type: "object" as const, properties, required };
}

function parseSourceLine(
  line: string,
  toolName: string,
): ActionManifestEntry["source"] {
  const m = line.match(
    /^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*?)(?:\s+\(([^)]+)\))?\s*$/,
  );
  if (!m) {
    throw new ManifestFormatError(
      `tool "${toolName}": Source line must be \`<METHOD> <path>\` — got "${line}"`,
    );
  }
  // operationId is derived from OpenAPI cross-reference when available;
  // otherwise we seed it with toolName so the Zod schema still validates.
  // The caller's crossValidateAgainstOpenAPI replaces with the true id.
  const security = m[3]
    ? m[3]
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : undefined;
  return {
    method: m[1] as ActionManifestEntry["source"]["method"],
    path: m[2],
    operationId: toolName,
    ...(security && security.length > 0 ? { security } : {}),
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ============================================================================
 * Excluded
 * ========================================================================= */

function parseExcluded(body: string): ExcludedEntry[] {
  const out: ExcludedEntry[] = [];
  const lines = body.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("- ")) continue;
    const payload = line.slice(2);
    const m = payload.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)\s+—\s+(.+?)\s*$/);
    if (!m) {
      throw new ManifestFormatError(
        `Excluded bullet is not \`<METHOD> <path> — <reason>\`: "${line}"`,
      );
    }
    const method = m[1] as ExcludedEntry["method"];
    const pth = m[2];
    const reason = m[3].trim();
    // operationId is derived from OpenAPI cross-reference when available;
    // placeholder `<METHOD> <path>` passes the Zod non-empty check.
    out.push({ method, path: pth, operationId: `${method} ${pth}`, reason });
  }
  return out;
}

/* ============================================================================
 * Orphaned
 * ========================================================================= */

function parseOrphaned(body: string): OrphanedEntry[] {
  const out: OrphanedEntry[] = [];
  const lines = body.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("- ")) continue;
    const payload = line.slice(2);
    const m = payload.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)\s+—\s+previously:\s+(.+?)\s*$/);
    if (!m) {
      throw new ManifestFormatError(
        `Orphaned bullet is not \`<METHOD> <path> — previously: <tool_name>\`: "${line}"`,
      );
    }
    out.push({
      method: m[1] as OrphanedEntry["method"],
      path: m[2],
      previousToolName: m[3].trim(),
    });
  }
  return out;
}

/* ============================================================================
 * OpenAPI cross-validation (FR-004)
 * ========================================================================= */

async function crossValidateAgainstOpenAPI(
  manifest: ActionManifest,
  openapiPath: string,
): Promise<void> {
  const openapiText = await fs.readFile(openapiPath, "utf8");
  const doc = JSON.parse(openapiText) as {
    paths?: Record<string, Record<string, { operationId?: string }>>;
  };
  const opIdByPair = new Map<string, string>();
  for (const [p, item] of Object.entries(doc.paths ?? {})) {
    for (const [method, op] of Object.entries(item)) {
      const opId = op?.operationId;
      if (typeof opId === "string" && opId.length > 0) {
        opIdByPair.set(pairKey(method.toUpperCase(), p), opId);
      }
    }
  }
  for (const entry of manifest.included) {
    const known = opIdByPair.get(pairKey(entry.source.method, entry.source.path));
    if (!known) {
      throw new ManifestValidationError(
        `manifest entry "${entry.toolName}" references (${entry.source.method} ${entry.source.path}) which does not exist in ${path.basename(openapiPath)} — anchored-generation invariant (Principle V, FR-004) violated.`,
      );
    }
    entry.source.operationId = known;
  }
  for (const entry of manifest.excluded) {
    const known = opIdByPair.get(pairKey(entry.method, entry.path));
    if (known) entry.operationId = known;
  }
}

function pairKey(method: string, p: string): string {
  return `${method} ${p}`;
}

/* ============================================================================
 * Manifest entry → RuntimeToolDescriptor (T043, T044)
 * ========================================================================= */

export interface RuntimeToolDescriptorLike {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  http: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string };
  is_action: boolean;
  description_template?: string;
  summary_fields?: string[];
}

/**
 * Convert a single ActionManifestEntry to the RuntimeToolDescriptor
 * shape consumed by `tools.ts.hbs` / `renderBackend()`. Declaration
 * key order is preserved by fresh-literal construction so the
 * subsequent JSON.stringify emits keys in the order declared by the
 * `RuntimeToolDescriptor` interface (contracts/render-tools-context.md §4).
 *
 * Optional fields are OMITTED (not set to null/undefined) when the
 * source entry lacks them, so the rendered JSON stays clean.
 */
export function actionEntryToDescriptor(
  entry: ActionManifestEntry,
): RuntimeToolDescriptorLike {
  const base: RuntimeToolDescriptorLike = {
    name: entry.toolName,
    description: entry.description,
    input_schema: entry.parameters as unknown as Record<string, unknown>,
    http: { method: entry.source.method, path: entry.source.path },
    is_action: entry.isAction,
  };
  if (entry.descriptionTemplate !== undefined) {
    base.description_template = entry.descriptionTemplate;
  }
  if (entry.summaryFields !== undefined) {
    base.summary_fields = entry.summaryFields;
  }
  return base;
}

/**
 * Recursively sort object keys alphabetically so `JSON.stringify`
 * emits a canonical form. Arrays are left alone (order is meaningful —
 * e.g. `required`, `summary_fields`). Primitives pass through.
 */
export function canonicaliseInputSchema(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return canonicaliseValue(schema) as Record<string, unknown>;
}

function canonicaliseValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicaliseValue);
  }
  if (value !== null && typeof value === "object") {
    const src = value as Record<string, unknown>;
    const sortedKeys = Object.keys(src).sort();
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) out[k] = canonicaliseValue(src[k]);
    return out;
  }
  return value;
}

/* ============================================================================
 * Convenience re-exports
 * ========================================================================= */

export { ToolNameCollisionError } from "./lib/action-manifest-types.js";
