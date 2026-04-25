import { promises as fs } from "node:fs";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkFrontmatter from "remark-frontmatter";
import { ARTIFACT_SCHEMAS } from "./types.js";
/* ============================================================================
 * Parser setup
 * ========================================================================= */
const parser = unified().use(remarkParse).use(remarkFrontmatter, ["yaml"]);
const stringifier = unified()
    .use(remarkStringify, {
    bullet: "-",
    fences: true,
    rule: "-",
    listItemIndent: "one",
})
    .use(remarkFrontmatter, ["yaml"]);
export async function readMarkdown(path) {
    const raw = await fs.readFile(path, "utf8");
    return parseMarkdown(raw);
}
export function parseMarkdown(raw) {
    const parsed = matter(raw);
    const tree = parser.parse(parsed.content);
    return {
        frontmatter: parsed.data,
        tree,
        rawBody: parsed.content,
    };
}
/**
 * ISO-8601 pattern used to detect timestamp values in the YAML frontmatter
 * block. gray-matter's default js-yaml engine auto-types unquoted ISO
 * timestamps to `Date` objects; downstream schemas expect `z.string()`,
 * so we force-quote every timestamp at emit time (FR-008 / research R16).
 */
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
function quoteIsoTimestampsInFrontmatter(serialized) {
    const fmMatch = serialized.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fmMatch)
        return serialized;
    const block = fmMatch[1];
    const quotedBlock = block
        .split("\n")
        .map((line) => {
        const m = line.match(/^(\s*[^:\s][^:]*:\s*)(.+?)\s*$/);
        if (!m)
            return line;
        const prefix = m[1];
        let value = m[2];
        if (value.startsWith('"'))
            return line;
        // gray-matter's default js-yaml engine single-quotes ISO-like strings
        // to prevent auto-typing to `Date`. Normalise those to double-quoted
        // per the FR-008 example in specs/008-atw-hardening/tasks.md.
        if (value.startsWith("'") && value.endsWith("'")) {
            const inner = value.slice(1, -1).replace(/''/g, "'");
            if (ISO_TIMESTAMP_RE.test(inner)) {
                return `${prefix}"${inner}"`;
            }
            return line;
        }
        if (ISO_TIMESTAMP_RE.test(value)) {
            return `${prefix}"${value}"`;
        }
        return line;
    })
        .join("\n");
    return `---\n${quotedBlock}\n---\n${serialized.slice(fmMatch[0].length)}`;
}
export function serializeMarkdown(frontmatter, body) {
    const fmKeys = Object.keys(frontmatter);
    if (fmKeys.length === 0) {
        return body.endsWith("\n") ? body : body + "\n";
    }
    const serialized = matter.stringify(body, frontmatter);
    const withQuotedTimestamps = quoteIsoTimestampsInFrontmatter(serialized);
    return withQuotedTimestamps.endsWith("\n")
        ? withQuotedTimestamps
        : withQuotedTimestamps + "\n";
}
export function extractSections(tree, level = 2) {
    const sections = [];
    let current = null;
    for (const node of tree.children) {
        if (node.type === "heading" && node.depth === level) {
            if (current)
                sections.push(current);
            current = {
                heading: headingText(node),
                level,
                children: [],
            };
        }
        else if (current) {
            current.children.push(node);
        }
    }
    if (current)
        sections.push(current);
    return sections;
}
export function headingText(h) {
    return h.children
        .map((c) => (c.type === "text" || c.type === "inlineCode" ? c.value : ""))
        .join("")
        .trim();
}
export function sectionText(section) {
    const wrapped = { type: "root", children: section.children };
    return stringifier.stringify(wrapped).trim();
}
export function findSection(sections, heading) {
    const target = heading.trim().toLowerCase();
    return sections.find((s) => s.heading.toLowerCase() === target);
}
export function extractCodeBlock(section, lang) {
    for (const node of section.children) {
        if (node.type === "code" && node.lang === lang) {
            return node.value;
        }
    }
    return null;
}
export function extractListItems(section) {
    const items = [];
    for (const node of section.children) {
        if (node.type === "list") {
            for (const li of node.children) {
                items.push(listItemText(li));
            }
        }
    }
    return items;
}
export function listItemText(li) {
    const wrapped = { type: "root", children: li.children };
    return stringifier.stringify(wrapped).trim();
}
/* ============================================================================
 * Per-artifact parse
 * ========================================================================= */
export function parseArtifactFromMarkdown(kind, parsed) {
    let obj;
    switch (kind) {
        case "project":
            obj = parseProject(parsed);
            break;
        case "brief":
            obj = parseBrief(parsed);
            break;
        case "schema-map":
            obj = parseSchemaMap(parsed);
            break;
        case "action-manifest":
            obj = parseActionManifest(parsed);
            break;
        case "build-plan":
            obj = parseBuildPlan(parsed);
            break;
        default:
            throw new Error(`Unknown artifact kind: ${String(kind)}`);
    }
    const schema = ARTIFACT_SCHEMAS[kind];
    return schema.parse(obj);
}
function parseProject(parsed) {
    const fm = parsed.frontmatter;
    const base = {
        name: fm.name ?? "",
        languages: Array.isArray(fm.languages) ? fm.languages : [],
        deploymentType: fm.deploymentType ?? "custom",
        createdAt: fm.createdAt ?? new Date().toISOString(),
    };
    // Feature 008 / T006 — v2 optional fields; only pass-through when present.
    const extras = {};
    if (typeof fm.updatedAt === "string")
        extras.updatedAt = fm.updatedAt;
    if (Array.isArray(fm.storefrontOrigins))
        extras.storefrontOrigins = fm.storefrontOrigins;
    if (typeof fm.welcomeMessage === "string")
        extras.welcomeMessage = fm.welcomeMessage;
    if (typeof fm.authTokenKey === "string")
        extras.authTokenKey = fm.authTokenKey;
    if (typeof fm.loginUrl === "string")
        extras.loginUrl = fm.loginUrl;
    return { ...base, ...extras };
}
function parseBrief(parsed) {
    const sections = extractSections(parsed.tree);
    const businessScope = findSection(sections, "Business scope");
    const customers = findSection(sections, "Customers");
    const allowed = findSection(sections, "Agent's allowed actions");
    const forbidden = findSection(sections, "Agent's forbidden actions");
    const tone = findSection(sections, "Tone");
    const useCases = findSection(sections, "Primary use cases");
    const vocab = findSection(sections, "Business vocabulary");
    const antiPatterns = findSection(sections, "Anti-patterns");
    const vocabItems = vocab
        ? extractListItems(vocab).map((line) => {
            // Strip leading bold markers around the term if present.
            const boldMatch = line.match(/^\*\*([^*]+)\*\*\s*[-:—–]\s*(.+)$/);
            if (boldMatch) {
                return { term: boldMatch[1].trim(), definition: boldMatch[2].trim() };
            }
            // Fall back to a non-bold form; only split on em/en dash or ` - ` with
            // spaces on both sides so hyphenated terms like "slip-cast" stay whole.
            const m = line.match(/^([^—–]+?)\s+[—–]\s+(.+)$/) ?? line.match(/^(\S[^\n]*?)\s+-\s+(.+)$/);
            if (m) {
                return { term: m[1].trim(), definition: m[2].trim() };
            }
            return { term: line.trim(), definition: "" };
        })
        : [];
    return {
        businessScope: businessScope ? sectionText(businessScope) : "",
        customers: customers ? sectionText(customers) : "",
        allowedActions: allowed ? extractListItems(allowed) : [],
        forbiddenActions: forbidden ? extractListItems(forbidden) : [],
        tone: tone ? sectionText(tone) : "",
        primaryUseCases: useCases ? extractListItems(useCases) : [],
        vocabulary: vocabItems,
        antiPatterns: antiPatterns ? extractListItems(antiPatterns) : undefined,
    };
}
/**
 * D-ZEROENTITY (FR-009 / T016) — thrown when the schema-map parser extracts
 * zero entity sections. Variant A fires when the raw markdown contains
 * `### Entity:` headings (the parser expects H2 `## Entity:`); variant B
 * fires when neither H2 nor H3 `Entity:` markers are present at all.
 */
export class SchemaMapZeroEntityError extends Error {
    variant;
    path;
    constructor(variant, path) {
        const where = path ?? "schema-map.md";
        const base = `ERROR: Zero entities parsed from ${where}.`;
        const body = variant === "A"
            ? `Detected H3 "### Entity:" headings — the parser expects H2 "## Entity:".\n\n` +
                `Fix: convert your H3 headings one level up, or regenerate the file with /atw.schema.\n` +
                `See examples/sample-schema-map.md for the expected convention.`
            : `No "Entity:" headings found at H2 or H3.\n\n` +
                `Fix: add at least one "## Entity: <name>" section, or regenerate the file with /atw.schema.\n` +
                `See examples/sample-schema-map.md for the expected convention.`;
        super(`${base}\n${body}`);
        this.variant = variant;
        this.path = path;
        this.name = "SchemaMapZeroEntityError";
    }
}
function parseSchemaMap(parsed) {
    const sections = extractSections(parsed.tree);
    const summary = findSection(sections, "Summary");
    const referenceTables = findSection(sections, "Reference tables");
    const infraTables = findSection(sections, "Infrastructure / ignored");
    const piiExcluded = findSection(sections, "PII-excluded");
    const entities = [];
    for (const s of sections) {
        const m = s.heading.match(/^Entity:\s+(.+)$/i);
        if (!m)
            continue;
        const evidence = findSubsection(s, "Evidence");
        const classificationLine = extractFieldLine(s, "Classification") ?? "indexable";
        entities.push({
            name: m[1].trim(),
            classification: toClassification(classificationLine),
            sourceTables: parseCSVField(extractFieldLine(s, "Source tables") ?? ""),
            joinedReferences: parseCSVField(extractFieldLine(s, "Joined references") ?? ""),
            columns: parseEntityColumns(s),
            evidence: evidence ?? "",
        });
    }
    if (entities.length === 0) {
        const hasH3Entity = /^###\s+Entity:/m.test(parsed.rawBody);
        throw new SchemaMapZeroEntityError(hasH3Entity ? "A" : "B");
    }
    return {
        summary: summary ? sectionText(summary) : "",
        entities,
        referenceTables: referenceTables ? extractListItems(referenceTables) : [],
        infrastructureTables: infraTables ? extractListItems(infraTables) : [],
        piiExcluded: piiExcluded ? parsePIIExcluded(piiExcluded) : [],
    };
}
function parsePIIExcluded(section) {
    const items = extractListItems(section);
    return items.map((line) => {
        const unescaped = line.replace(/\\([[\]])/g, "$1");
        const m = unescaped.match(/^([^:]+):\s*columns?\s*\[(.*?)\]\s*[-—]\s*(.*)$/i);
        if (m) {
            return {
                table: m[1].trim(),
                columns: m[2].split(",").map((c) => c.trim()).filter(Boolean),
                reason: m[3].trim(),
            };
        }
        return { table: unescaped.trim(), columns: [], reason: "" };
    });
}
function parseEntityColumns(section) {
    const cols = [];
    const sub = findSubsection(section, "Columns");
    if (!sub)
        return cols;
    const lines = sub.split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(/^[-*]\s+`?([^`\s]+)`?\s*:\s*(index|reference|exclude-pii|exclude-internal)(?:\s+(.*))?$/i);
        if (m) {
            cols.push({
                name: m[1].replace(/\\([\\_*`~\[\]()#+\-.!])/g, "$1"),
                decision: m[2].toLowerCase(),
                notes: m[3]?.trim() || undefined,
            });
        }
    }
    return cols;
}
function parseActionManifest(parsed) {
    const sections = extractSections(parsed.tree);
    const summary = findSection(sections, "Summary");
    const excluded = findSection(sections, "Excluded");
    const runtime = findSection(sections, "Runtime system prompt block");
    const tools = [];
    for (const s of sections) {
        const m = s.heading.match(/^Tools:\s+(.+)$/i);
        if (!m)
            continue;
        // FR-012: strip optional inline `(runtime-only)` flag from the group name.
        let entity = m[1].trim();
        let runtimeOnly = false;
        const flagMatch = entity.match(/^(.+?)\s*\(runtime-only\)\s*$/i);
        if (flagMatch) {
            entity = flagMatch[1].trim();
            runtimeOnly = true;
        }
        tools.push({
            entity,
            ...(runtimeOnly ? { runtimeOnly: true } : {}),
            items: parseToolItems(s),
        });
    }
    return {
        summary: summary ? sectionText(summary) : "",
        tools,
        excluded: excluded ? parseExcluded(excluded) : [],
        runtimeSystemPromptBlock: runtime ? sectionText(runtime) : "",
    };
}
function parseToolItems(section) {
    const items = [];
    const subs = extractSubsections(section, 3);
    for (const sub of subs) {
        const paramJSON = sub.children.find((n) => n.type === "code" && n.lang === "json");
        let parameters = {};
        if (paramJSON) {
            try {
                parameters = JSON.parse(paramJSON.value);
            }
            catch {
                parameters = {};
            }
        }
        const desc = extractFieldLine(sub, "Description") ?? "";
        const reqConf = (extractFieldLine(sub, "requires_confirmation") ?? "false")
            .toLowerCase()
            .startsWith("t");
        const sourceLine = extractFieldLine(sub, "Source") ?? "";
        const sourceMatch = sourceLine.match(/^([A-Z]+)\s+(\S+)(?:\s+\((.*)\))?$/);
        items.push({
            name: sub.heading,
            description: desc,
            parameters,
            requiresConfirmation: reqConf,
            source: sourceMatch
                ? {
                    method: sourceMatch[1].toLowerCase(),
                    path: sourceMatch[2],
                    security: sourceMatch[3],
                }
                : { method: "get", path: "", security: undefined },
            parameterSources: parseCSVField(extractFieldLine(sub, "Parameter sources") ?? ""),
        });
    }
    return items;
}
function parseExcluded(section) {
    const items = extractListItems(section);
    return items.map((line) => {
        const m = line.match(/^([A-Z]+)\s+(\S+)\s*[-—]\s*(.+)$/);
        if (m) {
            return { method: m[1].toLowerCase(), path: m[2], reason: m[3].trim() };
        }
        return { method: "get", path: line.trim(), reason: "" };
    });
}
function parseBuildPlan(parsed) {
    const sections = extractSections(parsed.tree);
    const summary = findSection(sections, "Summary");
    const embed = findSection(sections, "Embedding approach");
    const vocabs = findSection(sections, "Category vocabularies");
    const templates = findSection(sections, "Enrichment prompt templates");
    const counts = findSection(sections, "Estimated entity counts");
    const cost = findSection(sections, "Cost estimate");
    const backend = findSection(sections, "Backend configuration defaults");
    const widget = findSection(sections, "Widget configuration defaults");
    const sequence = findSection(sections, "Build sequence");
    const failure = findSection(sections, "Failure handling");
    return {
        summary: summary ? sectionText(summary) : "",
        embeddingApproach: embed ? sectionText(embed) : "",
        categoryVocabularies: vocabs ? parseCategoryVocabs(vocabs) : [],
        enrichmentPromptTemplates: templates ? parsePromptTemplates(templates) : [],
        estimatedEntityCounts: counts ? parseCountsMap(counts) : {},
        costEstimate: cost
            ? parseCostEstimate(cost)
            : {
                enrichmentCalls: 0,
                perCallCostUsd: 0,
                totalCostUsd: 0,
                retryBufferUsd: 0,
            },
        backendConfigurationDefaults: backend ? parseStringMap(backend) : {},
        widgetConfigurationDefaults: widget ? parseStringMap(widget) : {},
        buildSequence: sequence ? extractListItems(sequence) : [],
        failureHandling: failure ? sectionText(failure) : "",
    };
}
function parseCategoryVocabs(section) {
    const result = [];
    const subs = extractSubsections(section, 3);
    for (const sub of subs) {
        result.push({
            entity: sub.heading,
            terms: extractListItems(sub),
        });
    }
    if (result.length === 0) {
        for (const item of extractListItems(section)) {
            const m = item.match(/^([^:]+):\s*(.+)$/);
            if (m) {
                result.push({
                    entity: m[1].trim(),
                    terms: m[2].split(",").map((s) => s.trim()),
                });
            }
        }
    }
    return result;
}
function parsePromptTemplates(section) {
    const result = [];
    const subs = extractSubsections(section, 3);
    for (const sub of subs) {
        const codeNode = sub.children.find((n) => n.type === "code");
        result.push({
            entity: sub.heading,
            template: codeNode ? codeNode.value : sectionText(sub),
        });
    }
    return result;
}
function parseCountsMap(section) {
    const out = {};
    for (const item of extractListItems(section)) {
        const m = item.match(/^([^:]+):\s*(\d+)/);
        if (m)
            out[m[1].trim()] = Number(m[2]);
    }
    return out;
}
function parseCostEstimate(section) {
    const items = extractListItems(section);
    const lines = items.join("\n");
    const num = (label) => {
        const m = lines.match(new RegExp(`${label}[^\\d]*([\\d.]+)`, "i"));
        return m ? Number(m[1]) : 0;
    };
    return {
        enrichmentCalls: num("enrichment calls?"),
        perCallCostUsd: num("per[- ]?call"),
        totalCostUsd: num("total"),
        retryBufferUsd: num("retry buffer"),
    };
}
function parseStringMap(section) {
    const out = {};
    for (const item of extractListItems(section)) {
        const m = item.match(/^`?([\w.\-_]+)`?\s*:\s*(.+)$/);
        if (m)
            out[m[1]] = m[2].trim();
    }
    return out;
}
function toClassification(line) {
    const v = line.trim().toLowerCase();
    if (v.startsWith("reference"))
        return "reference";
    if (v.startsWith("infra"))
        return "infrastructure";
    return "indexable";
}
function parseCSVField(line) {
    return line
        .split(",")
        .map((s) => s.trim().replace(/\\([\\_*`~\[\]()#+\-.!])/g, "$1"))
        .filter(Boolean);
}
function extractFieldLine(section, fieldLabel) {
    const body = sectionText(section);
    const re = new RegExp(`^\\s*\\*?\\*?${fieldLabel}\\*?\\*?\\s*:\\s*(.+)$`, "im");
    const m = body.match(re);
    return m ? m[1].trim() : null;
}
function findSubsection(section, heading) {
    const subs = extractSubsections(section, 3);
    const match = subs.find((s) => s.heading.toLowerCase() === heading.toLowerCase());
    return match ? sectionText(match) : null;
}
function extractSubsections(section, level) {
    const subs = [];
    let current = null;
    for (const node of section.children) {
        if (node.type === "heading" && node.depth === level) {
            if (current)
                subs.push(current);
            current = {
                heading: headingText(node),
                level,
                children: [],
            };
        }
        else if (current) {
            current.children.push(node);
        }
    }
    if (current)
        subs.push(current);
    return subs;
}
/* ============================================================================
 * Per-artifact serialization
 * ========================================================================= */
export function serializeArtifact(kind, content) {
    switch (kind) {
        case "project":
            return serializeProject(content);
        case "brief":
            return serializeBrief(content);
        case "schema-map":
            return serializeSchemaMap(content);
        case "action-manifest":
            return serializeActionManifest(content);
        case "build-plan":
            return serializeBuildPlan(content);
        default:
            throw new Error(`Unknown artifact kind: ${String(kind)}`);
    }
}
function serializeProject(p) {
    const body = `# Project

This project was initialized with \`/atw.init\`. Captured values:

- **Name**: ${p.name}
- **Languages**: ${p.languages.join(", ")}
- **Deployment type**: ${p.deploymentType}
- **Created at**: ${p.createdAt}

The remaining \`/atw.*\` commands read these values for context.
`;
    // Feature 008 / T006 — v2 optional fields are serialised only when present.
    const fm = {
        name: p.name,
        languages: p.languages,
        deploymentType: p.deploymentType,
        createdAt: p.createdAt,
    };
    if (p.updatedAt !== undefined)
        fm.updatedAt = p.updatedAt;
    if (p.storefrontOrigins !== undefined)
        fm.storefrontOrigins = p.storefrontOrigins;
    if (p.welcomeMessage !== undefined)
        fm.welcomeMessage = p.welcomeMessage;
    if (p.authTokenKey !== undefined)
        fm.authTokenKey = p.authTokenKey;
    if (p.loginUrl !== undefined)
        fm.loginUrl = p.loginUrl;
    return serializeMarkdown(fm, body);
}
function serializeBrief(b) {
    const bullets = (xs) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- *(none recorded)*");
    const vocab = b.vocabulary.length
        ? b.vocabulary.map((v) => `- **${v.term}** — ${v.definition}`).join("\n")
        : "- *(none recorded)*";
    const anti = b.antiPatterns && b.antiPatterns.length ? bullets(b.antiPatterns) : "- *(none identified)*";
    return `# Business Brief

## Business scope

${b.businessScope || "*(not provided)*"}

## Customers

${b.customers || "*(not provided)*"}

## Agent's allowed actions

${bullets(b.allowedActions)}

## Agent's forbidden actions

${bullets(b.forbiddenActions)}

## Tone

${b.tone || "*(not provided)*"}

## Primary use cases

${bullets(b.primaryUseCases)}

## Business vocabulary

${vocab}

## Anti-patterns

${anti}
`;
}
function serializeSchemaMap(s) {
    const entityBlock = (e) => {
        const cols = e.columns.length
            ? e.columns
                .map((c) => `- \`${c.name}\`: ${c.decision}${c.notes ? ` — ${c.notes}` : ""}`)
                .join("\n")
            : "- *(no columns classified)*";
        return `## Entity: ${e.name}

Classification: ${e.classification}
Source tables: ${e.sourceTables.join(", ") || "*(none)*"}
Joined references: ${e.joinedReferences.join(", ") || "*(none)*"}

### Columns

${cols}

### Evidence

${e.evidence || "*(not recorded)*"}
`;
    };
    const pii = s.piiExcluded.length
        ? s.piiExcluded.map((p) => `- ${p.table}: columns [${p.columns.join(", ")}] — ${p.reason}`).join("\n")
        : "- *(none)*";
    const refs = s.referenceTables.length ? s.referenceTables.map((t) => `- ${t}`).join("\n") : "- *(none)*";
    const infra = s.infrastructureTables.length
        ? s.infrastructureTables.map((t) => `- ${t}`).join("\n")
        : "- *(none)*";
    return `# Schema Map

## Summary

${s.summary || "*(not provided)*"}

${s.entities.map(entityBlock).join("\n")}

## Reference tables

${refs}

## Infrastructure / ignored

${infra}

## PII-excluded

${pii}
`;
}
function serializeActionManifest(a) {
    const toolBlock = (item) => `### ${item.name}

Description: ${item.description}

Parameters:

\`\`\`json
${JSON.stringify(item.parameters, null, 2)}
\`\`\`

requires_confirmation: ${item.requiresConfirmation}
Source: ${item.source.method.toUpperCase()} ${item.source.path}${item.source.security ? ` (${item.source.security})` : ""}
Parameter sources: ${item.parameterSources.join(", ") || "*(none)*"}
`;
    const toolGroups = a.tools
        .map((g) => {
        const heading = g.runtimeOnly
            ? `## Tools: ${g.entity} (runtime-only)`
            : `## Tools: ${g.entity}`;
        return `${heading}\n\n${g.items.map(toolBlock).join("\n")}`;
    })
        .join("\n");
    const excluded = a.excluded.length
        ? a.excluded.map((e) => `- ${e.method.toUpperCase()} ${e.path} — ${e.reason}`).join("\n")
        : "- *(none)*";
    return `# Action Manifest

## Summary

${a.summary || "*(not provided)*"}

${toolGroups}

## Excluded

${excluded}

## Runtime system prompt block

${a.runtimeSystemPromptBlock || "*(not provided)*"}
`;
}
function serializeBuildPlan(b) {
    const vocabBlock = b.categoryVocabularies.length
        ? b.categoryVocabularies
            .map((v) => `### ${v.entity}\n\n${v.terms.map((t) => `- ${t}`).join("\n")}`)
            .join("\n\n")
        : "*(none recorded)*";
    const tplBlock = b.enrichmentPromptTemplates.length
        ? b.enrichmentPromptTemplates
            .map((t) => `### ${t.entity}\n\n\`\`\`\n${t.template}\n\`\`\``)
            .join("\n\n")
        : "*(none recorded)*";
    const counts = Object.entries(b.estimatedEntityCounts)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join("\n") || "- *(none)*";
    const backend = Object.entries(b.backendConfigurationDefaults)
        .map(([k, v]) => `- \`${k}\`: ${v}`)
        .join("\n") || "- *(none)*";
    const widget = Object.entries(b.widgetConfigurationDefaults)
        .map(([k, v]) => `- \`${k}\`: ${v}`)
        .join("\n") || "- *(none)*";
    const sequence = b.buildSequence.length ? b.buildSequence.map((s) => `- ${s}`).join("\n") : "- *(none)*";
    return `# Build Plan

## Summary

${b.summary || "*(not provided)*"}

## Embedding approach

${b.embeddingApproach || "*(not provided)*"}

## Category vocabularies

${vocabBlock}

## Enrichment prompt templates

${tplBlock}

## Estimated entity counts

${counts}

## Cost estimate

- enrichment calls: ${b.costEstimate.enrichmentCalls}
- per-call cost: $${b.costEstimate.perCallCostUsd.toFixed(4)}
- total cost: $${b.costEstimate.totalCostUsd.toFixed(2)}
- retry buffer: $${b.costEstimate.retryBufferUsd.toFixed(2)}

## Backend configuration defaults

${backend}

## Widget configuration defaults

${widget}

## Build sequence

${sequence}

## Failure handling

${b.failureHandling || "*(not provided)*"}
`;
}
//# sourceMappingURL=markdown.js.map