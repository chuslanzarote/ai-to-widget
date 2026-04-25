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
import { ActionManifestSchema, ToolNameCollisionError, } from "./lib/action-manifest-types.js";
/* ============================================================================
 * Error classes
 * ========================================================================= */
export class ManifestFormatError extends Error {
    code = "MANIFEST_FORMAT";
}
export class ProvenanceFormatError extends Error {
    code = "PROVENANCE_FORMAT";
}
export class ManifestValidationError extends Error {
    code = "MANIFEST_VALIDATION";
}
/**
 * Thrown by the FR-013 D-CREDSRC halt. Text matches
 * contracts/builder-diagnostics.md verbatim.
 */
export class MissingCredentialSourceError extends Error {
    code = "MISSING_CREDENTIAL_SOURCE";
    entries;
    constructor(entries) {
        super(formatMissingCredentialSourceMessage(entries));
        this.name = "MissingCredentialSourceError";
        this.entries = entries;
    }
}
function formatMissingCredentialSourceMessage(entries) {
    const bullets = entries
        .map((e) => `  • ${e.toolName}  (${e.method} ${e.path})`)
        .join("\n");
    return (`ERROR: The following tool(s) would ship without a credential source:\n\n` +
        `${bullets}\n\n` +
        `These operations need to declare bearer security in your OpenAPI document.\n\n` +
        `Add EITHER:\n\n` +
        `  (a) Per-operation security — on each affected operation:\n\n` +
        `      security:\n` +
        `        - bearerAuth: []\n\n` +
        `  (b) Global security — at the document root:\n\n` +
        `      security:\n` +
        `        - bearerAuth: []\n\n` +
        `      components:\n` +
        `        securitySchemes:\n` +
        `          bearerAuth:\n` +
        `            type: http\n` +
        `            scheme: bearer\n` +
        `            bearerFormat: JWT\n\n` +
        `See .atw/artifacts/host-requirements.md for the full host contract.\n\n` +
        `Build halted.`);
}
export async function parseActionManifest(opts) {
    const text = await fs.readFile(opts.manifestPath, "utf8");
    const manifest = parseActionManifestText(text);
    if (opts.openapiPath) {
        await crossValidateAgainstOpenAPI(manifest, opts.openapiPath, {
            deploymentType: opts.deploymentType,
        });
    }
    return manifest;
}
const SHOPPER_OWNED_TOKENS = new Set([
    "customer",
    "customers",
    "carts",
    "cart",
    "wishlist",
    "wishlists",
    "reviews",
    "review",
    "me",
    "account",
    "store",
]);
function looksShopperOwned(p) {
    return p
        .toLowerCase()
        .split("/")
        .some((seg) => SHOPPER_OWNED_TOKENS.has(seg));
}
/**
 * Core text-in → manifest-out (no filesystem). Callers that don't need
 * OpenAPI cross-validation (e.g. the render step when the manifest was
 * just written by the classifier) use this directly.
 */
export function parseActionManifestText(text) {
    // Normalise to LF for deterministic splitting.
    const content = text.replace(/\r\n/g, "\n");
    const sections = splitTopLevelSections(content);
    assertSectionOrder(sections);
    const provenance = parseProvenance(sections.get("## Provenance") ?? "");
    const summary = parseSummary(sections.get("## Summary") ?? "");
    const { included } = parseTools(sections);
    const excluded = parseExcluded(sections.get("## Excluded") ?? "");
    const orphaned = parseOrphaned(sections.get("## Orphaned (operation removed from OpenAPI)") ?? "");
    const manifest = {
        provenance,
        summary,
        included,
        excluded,
        orphaned,
    };
    const parsed = ActionManifestSchema.safeParse(manifest);
    if (!parsed.success) {
        throw new ManifestFormatError(`manifest failed schema validation: ${parsed.error.issues[0]?.message ?? "unknown"}`);
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
function splitTopLevelSections(text) {
    const lines = text.split("\n");
    const map = new Map();
    let current = null;
    let buf = [];
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
function trimBlankLines(s) {
    return s.replace(/^\n+/, "").replace(/\n+$/, "");
}
function assertSectionOrder(sections) {
    const titles = Array.from(sections.keys());
    if (!titles.includes("# Action manifest")) {
        throw new ManifestFormatError("missing top-level heading `# Action manifest`");
    }
    if (!titles.includes("## Provenance")) {
        throw new ProvenanceFormatError("missing required section `## Provenance`");
    }
    if (!titles.includes("## Summary")) {
        throw new ManifestFormatError("missing required section `## Summary`");
    }
    if (!titles.includes("## Excluded")) {
        throw new ManifestFormatError("missing required section `## Excluded`");
    }
    for (const t of titles) {
        if (t.startsWith("## ") && !isAllowedSectionHeading(t)) {
            throw new ManifestFormatError(`unknown top-level heading: "${t}" (parser rejects unknown sections per contracts/action-manifest.schema.md §2)`);
        }
    }
}
function isAllowedSectionHeading(heading) {
    if (ALLOWED_HEADINGS.has(heading))
        return true;
    if (heading.startsWith("## Tools:"))
        return true;
    return false;
}
/* ============================================================================
 * Provenance
 * ========================================================================= */
function parseProvenance(body) {
    const shaMatch = body.match(/^-\s+OpenAPI snapshot:\s+(sha256:[0-9a-f]{64})\s*$/m);
    if (!shaMatch) {
        throw new ProvenanceFormatError("missing or malformed `- OpenAPI snapshot: sha256:<64 hex>` bullet");
    }
    const modelMatch = body.match(/^-\s+Classifier model:\s+(.+?)\s*$/m);
    if (!modelMatch) {
        throw new ProvenanceFormatError("missing or malformed `- Classifier model: <model-id>` bullet");
    }
    const tsMatch = body.match(/^-\s+Classified at:\s+(.+?)\s*$/m);
    if (!tsMatch) {
        throw new ProvenanceFormatError("missing or malformed `- Classified at: <ISO-8601>` bullet");
    }
    const classifiedAt = tsMatch[1].trim();
    if (!isIsoTimestamp(classifiedAt)) {
        throw new ProvenanceFormatError(`Classified at is not ISO-8601: "${classifiedAt}"`);
    }
    return {
        openapiSha256: shaMatch[1],
        classifierModel: modelMatch[1].trim(),
        classifiedAt,
    };
}
function isIsoTimestamp(s) {
    if (isNaN(Date.parse(s)))
        return false;
    // Zod's z.string().datetime() requires full ISO-8601 (with T + Z).
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s);
}
/* ============================================================================
 * Summary
 * ========================================================================= */
function parseSummary(body) {
    return body.trim();
}
/* ============================================================================
 * Tools sections
 * ========================================================================= */
function parseTools(sections) {
    const entries = [];
    const toolNameSeen = new Map();
    const toolsSections = Array.from(sections.entries())
        .filter(([h]) => h.startsWith("## Tools:"))
        .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    for (const [heading, body] of toolsSections) {
        // FR-012: `## Tools: <group> (runtime-only)` flag propagates to every
        // entry in the group as `runtimeOnly: true`.
        const runtimeOnly = /\(runtime-only\)\s*$/i.test(heading);
        const blocks = splitToolBlocks(body);
        for (const block of blocks) {
            const entry = parseSingleToolBlock(block);
            const prior = toolNameSeen.get(entry.toolName);
            if (prior) {
                throw new ToolNameCollisionError(entry.toolName, `duplicate tool_name "${entry.toolName}" — appeared at block line ${prior.line} and reappeared`);
            }
            toolNameSeen.set(entry.toolName, { line: 0 });
            if (runtimeOnly)
                entry.runtimeOnly = true;
            entries.push(entry);
        }
    }
    return { included: entries };
}
function splitToolBlocks(body) {
    const lines = body.split("\n");
    const blocks = [];
    let cur = [];
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
        if (inBlock)
            cur.push(line);
    }
    if (inBlock)
        blocks.push(cur.join("\n"));
    return blocks;
}
function parseSingleToolBlock(block) {
    const headingMatch = block.match(/^### (.+?)\s*$/m);
    if (!headingMatch) {
        throw new ManifestFormatError(`tool block missing \`### <tool_name>\` heading: ${block.slice(0, 60)}`);
    }
    const toolName = headingMatch[1].trim();
    const description = extractSingleLineField(block, "Description") ?? "";
    if (description.length === 0) {
        throw new ManifestFormatError(`tool "${toolName}" has empty Description`);
    }
    const descriptionTemplate = extractQuotedField(block, "description_template");
    const summaryFieldsRaw = extractSingleLineField(block, "summary_fields");
    let summaryFields;
    if (summaryFieldsRaw) {
        try {
            const v = JSON.parse(summaryFieldsRaw);
            if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
                summaryFields = v;
            }
            else {
                throw new ManifestFormatError(`tool "${toolName}": summary_fields must be a JSON array of strings`);
            }
        }
        catch (err) {
            if (err instanceof ManifestFormatError)
                throw err;
            throw new ManifestFormatError(`tool "${toolName}": summary_fields is not valid JSON — ${err.message}`);
        }
    }
    const parameters = extractFencedJson(block, toolName);
    const requiresConfirmation = extractBoolField(block, "requires_confirmation", toolName);
    const isAction = extractBoolField(block, "is_action", toolName);
    const sourceLine = extractSingleLineField(block, "Source");
    if (!sourceLine) {
        throw new ManifestFormatError(`tool "${toolName}": missing required \`Source:\` line`);
    }
    const source = parseSourceLine(sourceLine, toolName);
    const parameterSources = extractSingleLineField(block, "Parameter sources");
    const entry = {
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
function extractSingleLineField(block, key) {
    const rx = new RegExp(`^${escapeRegExp(key)}:\\s+(.+?)\\s*$`, "m");
    const m = block.match(rx);
    return m ? m[1] : null;
}
function extractQuotedField(block, key) {
    const rx = new RegExp(`^${escapeRegExp(key)}:\\s+"((?:\\\\.|[^"\\\\])*)"\\s*$`, "m");
    const m = block.match(rx);
    return m ? m[1] : undefined;
}
function extractBoolField(block, key, toolName) {
    const raw = extractSingleLineField(block, key);
    if (raw === null) {
        throw new ManifestFormatError(`tool "${toolName}": missing required \`${key}:\` line`);
    }
    if (raw === "true")
        return true;
    if (raw === "false")
        return false;
    throw new ManifestFormatError(`tool "${toolName}": ${key} must be \`true\` or \`false\`, got "${raw}"`);
}
function extractFencedJson(block, toolName) {
    const rx = /Parameters:\s*\n+```json\n([\s\S]*?)\n```/;
    const m = block.match(rx);
    if (!m) {
        throw new ManifestFormatError(`tool "${toolName}": missing \`Parameters:\` fenced JSON block`);
    }
    let obj;
    try {
        obj = JSON.parse(m[1]);
    }
    catch (err) {
        throw new ManifestFormatError(`tool "${toolName}": Parameters JSON is malformed — ${err.message}`);
    }
    if (!obj || typeof obj !== "object") {
        throw new ManifestFormatError(`tool "${toolName}": Parameters must be a JSON object`);
    }
    const parsed = obj;
    if (parsed.type !== "object") {
        throw new ManifestFormatError(`tool "${toolName}": Parameters.type must be "object"`);
    }
    const properties = parsed.properties && typeof parsed.properties === "object"
        ? parsed.properties
        : {};
    const required = Array.isArray(parsed.required)
        ? parsed.required.filter((x) => typeof x === "string")
        : [];
    return { type: "object", properties, required };
}
function parseSourceLine(line, toolName) {
    const m = line.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S*?)(?:\s+\(([^)]+)\))?\s*$/);
    if (!m) {
        throw new ManifestFormatError(`tool "${toolName}": Source line must be \`<METHOD> <path>\` — got "${line}"`);
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
        method: m[1],
        path: m[2],
        operationId: toolName,
        ...(security && security.length > 0 ? { security } : {}),
    };
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/* ============================================================================
 * Excluded
 * ========================================================================= */
function parseExcluded(body) {
    const out = [];
    const lines = body.split("\n");
    for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("- "))
            continue;
        const payload = line.slice(2);
        const m = payload.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)\s+—\s+(.+?)\s*$/);
        if (!m) {
            throw new ManifestFormatError(`Excluded bullet is not \`<METHOD> <path> — <reason>\`: "${line}"`);
        }
        const method = m[1];
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
function parseOrphaned(body) {
    const out = [];
    const lines = body.split("\n");
    for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("- "))
            continue;
        const payload = line.slice(2);
        const m = payload.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)\s+—\s+previously:\s+(.+?)\s*$/);
        if (!m) {
            throw new ManifestFormatError(`Orphaned bullet is not \`<METHOD> <path> — previously: <tool_name>\`: "${line}"`);
        }
        out.push({
            method: m[1],
            path: m[2],
            previousToolName: m[3].trim(),
        });
    }
    return out;
}
async function crossValidateAgainstOpenAPI(manifest, openapiPath, opts = {}) {
    const openapiText = await fs.readFile(openapiPath, "utf8");
    const doc = JSON.parse(openapiText);
    const rootSecurity = doc.security ?? [];
    const byPair = new Map();
    for (const [p, item] of Object.entries(doc.paths ?? {})) {
        for (const [method, op] of Object.entries(item)) {
            const opId = op?.operationId;
            if (typeof opId !== "string" || opId.length === 0)
                continue;
            // FR-013: backfill security from per-op or root-level declaration.
            const opSecurity = Array.isArray(op.security) ? op.security : undefined;
            const effective = opSecurity ?? rootSecurity;
            const schemes = effective
                .flatMap((requirement) => Object.keys(requirement ?? {}))
                .filter((s, i, arr) => arr.indexOf(s) === i);
            byPair.set(pairKey(method.toUpperCase(), p), {
                operationId: opId,
                security: schemes,
            });
        }
    }
    for (const entry of manifest.included) {
        const known = byPair.get(pairKey(entry.source.method, entry.source.path));
        if (!known) {
            throw new ManifestValidationError(`manifest entry "${entry.toolName}" references (${entry.source.method} ${entry.source.path}) which does not exist in ${path.basename(openapiPath)} — anchored-generation invariant (Principle V, FR-004) violated.`);
        }
        entry.source.operationId = known.operationId;
        // Only backfill when the manifest itself didn't already carry security.
        const current = entry.source.security ?? [];
        if (current.length === 0 && known.security.length > 0) {
            entry.source.security = known.security;
        }
    }
    for (const entry of manifest.excluded) {
        const known = byPair.get(pairKey(entry.method, entry.path));
        if (known)
            entry.operationId = known.operationId;
    }
    // FR-013 D-CREDSRC halt: for customer-facing widget deployments, every
    // shopper-scoped included entry must carry at least one security scheme.
    if (opts.deploymentType === "customer-facing-widget") {
        const offenders = [];
        for (const entry of manifest.included) {
            // Runtime-only groups are exempt — they may target public endpoints.
            if (entry.runtimeOnly)
                continue;
            if ((entry.source.security ?? []).length > 0)
                continue;
            if (!looksShopperOwned(entry.source.path))
                continue;
            offenders.push({
                toolName: entry.toolName,
                method: entry.source.method,
                path: entry.source.path,
            });
        }
        if (offenders.length > 0) {
            throw new MissingCredentialSourceError(offenders);
        }
    }
}
function pairKey(method, p) {
    return `${method} ${p}`;
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
export function actionEntryToDescriptor(entry) {
    const base = {
        name: entry.toolName,
        description: entry.description,
        input_schema: entry.parameters,
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
export function canonicaliseInputSchema(schema) {
    return canonicaliseValue(schema);
}
function canonicaliseValue(value) {
    if (Array.isArray(value)) {
        return value.map(canonicaliseValue);
    }
    if (value !== null && typeof value === "object") {
        const src = value;
        const sortedKeys = Object.keys(src).sort();
        const out = {};
        for (const k of sortedKeys)
            out[k] = canonicaliseValue(src[k]);
        return out;
    }
    return value;
}
/* ============================================================================
 * Convenience re-exports
 * ========================================================================= */
export { ToolNameCollisionError } from "./lib/action-manifest-types.js";
//# sourceMappingURL=parse-action-manifest.js.map