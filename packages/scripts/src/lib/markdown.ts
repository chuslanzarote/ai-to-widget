import { promises as fs } from "node:fs";
import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import remarkFrontmatter from "remark-frontmatter";
import type { Root, Heading, Code, List, ListItem } from "mdast";

import type {
  ArtifactKind,
  ArtifactContent,
  ProjectArtifact,
  BriefArtifact,
  SchemaMapArtifact,
  ActionManifestArtifact,
  BuildPlanArtifact,
} from "./types.js";
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

/* ============================================================================
 * Low-level helpers
 * ========================================================================= */

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  tree: Root;
  rawBody: string;
}

export async function readMarkdown(path: string): Promise<ParsedMarkdown> {
  const raw = await fs.readFile(path, "utf8");
  return parseMarkdown(raw);
}

export function parseMarkdown(raw: string): ParsedMarkdown {
  const parsed = matter(raw);
  const tree = parser.parse(parsed.content) as Root;
  return {
    frontmatter: parsed.data,
    tree,
    rawBody: parsed.content,
  };
}

export function serializeMarkdown(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const fmKeys = Object.keys(frontmatter);
  if (fmKeys.length === 0) {
    return body.endsWith("\n") ? body : body + "\n";
  }
  const serialized = matter.stringify(body, frontmatter);
  return serialized.endsWith("\n") ? serialized : serialized + "\n";
}

/* ============================================================================
 * Section walker — group AST nodes by `## Heading`
 * ========================================================================= */

export interface Section {
  heading: string;
  level: number;
  children: Root["children"];
}

export function extractSections(tree: Root, level = 2): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const node of tree.children) {
    if (node.type === "heading" && (node as Heading).depth === level) {
      if (current) sections.push(current);
      current = {
        heading: headingText(node as Heading),
        level,
        children: [],
      };
    } else if (current) {
      current.children.push(node);
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function headingText(h: Heading): string {
  return h.children
    .map((c) => (c.type === "text" || c.type === "inlineCode" ? c.value : ""))
    .join("")
    .trim();
}

export function sectionText(section: Section): string {
  const wrapped: Root = { type: "root", children: section.children };
  return stringifier.stringify(wrapped).trim();
}

export function findSection(sections: Section[], heading: string): Section | undefined {
  const target = heading.trim().toLowerCase();
  return sections.find((s) => s.heading.toLowerCase() === target);
}

export function extractCodeBlock(section: Section, lang: string): string | null {
  for (const node of section.children) {
    if (node.type === "code" && (node as Code).lang === lang) {
      return (node as Code).value;
    }
  }
  return null;
}

export function extractListItems(section: Section): string[] {
  const items: string[] = [];
  for (const node of section.children) {
    if (node.type === "list") {
      for (const li of (node as List).children) {
        items.push(listItemText(li));
      }
    }
  }
  return items;
}

export function listItemText(li: ListItem): string {
  const wrapped: Root = { type: "root", children: li.children };
  return stringifier.stringify(wrapped).trim();
}

/* ============================================================================
 * Per-artifact parse
 * ========================================================================= */

export function parseArtifactFromMarkdown<K extends ArtifactKind>(
  kind: K,
  parsed: ParsedMarkdown,
): ArtifactContent<K> {
  let obj: unknown;
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
  return schema.parse(obj) as ArtifactContent<K>;
}

function parseProject(parsed: ParsedMarkdown): ProjectArtifact {
  const fm = parsed.frontmatter as Record<string, unknown>;
  return {
    name: (fm.name as string) ?? "",
    languages: Array.isArray(fm.languages) ? (fm.languages as string[]) : [],
    deploymentType: (fm.deploymentType as ProjectArtifact["deploymentType"]) ?? "custom",
    createdAt: (fm.createdAt as string) ?? new Date().toISOString(),
  };
}

function parseBrief(parsed: ParsedMarkdown): BriefArtifact {
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

function parseSchemaMap(parsed: ParsedMarkdown): SchemaMapArtifact {
  const sections = extractSections(parsed.tree);
  const summary = findSection(sections, "Summary");
  const referenceTables = findSection(sections, "Reference tables");
  const infraTables = findSection(sections, "Infrastructure / ignored");
  const piiExcluded = findSection(sections, "PII-excluded");

  const entities: SchemaMapArtifact["entities"] = [];
  for (const s of sections) {
    const m = s.heading.match(/^Entity:\s+(.+)$/i);
    if (!m) continue;
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

  return {
    summary: summary ? sectionText(summary) : "",
    entities,
    referenceTables: referenceTables ? extractListItems(referenceTables) : [],
    infrastructureTables: infraTables ? extractListItems(infraTables) : [],
    piiExcluded: piiExcluded ? parsePIIExcluded(piiExcluded) : [],
  };
}

function parsePIIExcluded(section: Section): SchemaMapArtifact["piiExcluded"] {
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

function parseEntityColumns(section: Section): SchemaMapArtifact["entities"][number]["columns"] {
  const cols: SchemaMapArtifact["entities"][number]["columns"] = [];
  const sub = findSubsection(section, "Columns");
  if (!sub) return cols;
  const lines = sub.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^[-*]\s+`?([^`\s]+)`?\s*:\s*(index|reference|exclude-pii|exclude-internal)(?:\s+(.*))?$/i);
    if (m) {
      cols.push({
        name: m[1].replace(/\\([\\_*`~\[\]()#+\-.!])/g, "$1"),
        decision: m[2].toLowerCase() as SchemaMapArtifact["entities"][number]["columns"][number]["decision"],
        notes: m[3]?.trim() || undefined,
      });
    }
  }
  return cols;
}

function parseActionManifest(parsed: ParsedMarkdown): ActionManifestArtifact {
  const sections = extractSections(parsed.tree);
  const summary = findSection(sections, "Summary");
  const excluded = findSection(sections, "Excluded");
  const runtime = findSection(sections, "Runtime system prompt block");
  const tools: ActionManifestArtifact["tools"] = [];
  for (const s of sections) {
    const m = s.heading.match(/^Tools:\s+(.+)$/i);
    if (!m) continue;
    tools.push({
      entity: m[1].trim(),
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

function parseToolItems(section: Section): ActionManifestArtifact["tools"][number]["items"] {
  const items: ActionManifestArtifact["tools"][number]["items"] = [];
  const subs = extractSubsections(section, 3);
  for (const sub of subs) {
    const paramJSON = sub.children.find(
      (n): n is Code => n.type === "code" && (n as Code).lang === "json",
    );
    let parameters: Record<string, unknown> = {};
    if (paramJSON) {
      try {
        parameters = JSON.parse(paramJSON.value);
      } catch {
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

function parseExcluded(section: Section): ActionManifestArtifact["excluded"] {
  const items = extractListItems(section);
  return items.map((line) => {
    const m = line.match(/^([A-Z]+)\s+(\S+)\s*[-—]\s*(.+)$/);
    if (m) {
      return { method: m[1].toLowerCase(), path: m[2], reason: m[3].trim() };
    }
    return { method: "get", path: line.trim(), reason: "" };
  });
}

function parseBuildPlan(parsed: ParsedMarkdown): BuildPlanArtifact {
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

function parseCategoryVocabs(section: Section): BuildPlanArtifact["categoryVocabularies"] {
  const result: BuildPlanArtifact["categoryVocabularies"] = [];
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

function parsePromptTemplates(section: Section): BuildPlanArtifact["enrichmentPromptTemplates"] {
  const result: BuildPlanArtifact["enrichmentPromptTemplates"] = [];
  const subs = extractSubsections(section, 3);
  for (const sub of subs) {
    const codeNode = sub.children.find((n) => n.type === "code") as Code | undefined;
    result.push({
      entity: sub.heading,
      template: codeNode ? codeNode.value : sectionText(sub),
    });
  }
  return result;
}

function parseCountsMap(section: Section): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of extractListItems(section)) {
    const m = item.match(/^([^:]+):\s*(\d+)/);
    if (m) out[m[1].trim()] = Number(m[2]);
  }
  return out;
}

function parseCostEstimate(section: Section): BuildPlanArtifact["costEstimate"] {
  const items = extractListItems(section);
  const lines = items.join("\n");
  const num = (label: string) => {
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

function parseStringMap(section: Section): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of extractListItems(section)) {
    const m = item.match(/^`?([\w.\-_]+)`?\s*:\s*(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function toClassification(line: string): SchemaMapArtifact["entities"][number]["classification"] {
  const v = line.trim().toLowerCase();
  if (v.startsWith("reference")) return "reference";
  if (v.startsWith("infra")) return "infrastructure";
  return "indexable";
}

function parseCSVField(line: string): string[] {
  return line
    .split(",")
    .map((s) => s.trim().replace(/\\([\\_*`~\[\]()#+\-.!])/g, "$1"))
    .filter(Boolean);
}

function extractFieldLine(section: Section, fieldLabel: string): string | null {
  const body = sectionText(section);
  const re = new RegExp(`^\\s*\\*?\\*?${fieldLabel}\\*?\\*?\\s*:\\s*(.+)$`, "im");
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

function findSubsection(section: Section, heading: string): string | null {
  const subs = extractSubsections(section, 3);
  const match = subs.find((s) => s.heading.toLowerCase() === heading.toLowerCase());
  return match ? sectionText(match) : null;
}

function extractSubsections(section: Section, level: number): Section[] {
  const subs: Section[] = [];
  let current: Section | null = null;
  for (const node of section.children) {
    if (node.type === "heading" && (node as Heading).depth === level) {
      if (current) subs.push(current);
      current = {
        heading: headingText(node as Heading),
        level,
        children: [],
      };
    } else if (current) {
      current.children.push(node);
    }
  }
  if (current) subs.push(current);
  return subs;
}

/* ============================================================================
 * Per-artifact serialization
 * ========================================================================= */

export function serializeArtifact<K extends ArtifactKind>(
  kind: K,
  content: ArtifactContent<K>,
): string {
  switch (kind) {
    case "project":
      return serializeProject(content as ProjectArtifact);
    case "brief":
      return serializeBrief(content as BriefArtifact);
    case "schema-map":
      return serializeSchemaMap(content as SchemaMapArtifact);
    case "action-manifest":
      return serializeActionManifest(content as ActionManifestArtifact);
    case "build-plan":
      return serializeBuildPlan(content as BuildPlanArtifact);
    default:
      throw new Error(`Unknown artifact kind: ${String(kind)}`);
  }
}

function serializeProject(p: ProjectArtifact): string {
  const body = `# Project

This project was initialized with \`/atw.init\`. Captured values:

- **Name**: ${p.name}
- **Languages**: ${p.languages.join(", ")}
- **Deployment type**: ${p.deploymentType}
- **Created at**: ${p.createdAt}

The remaining \`/atw.*\` commands read these values for context.
`;
  return serializeMarkdown(
    {
      name: p.name,
      languages: p.languages,
      deploymentType: p.deploymentType,
      createdAt: p.createdAt,
    },
    body,
  );
}

function serializeBrief(b: BriefArtifact): string {
  const bullets = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "- *(none recorded)*");
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

function serializeSchemaMap(s: SchemaMapArtifact): string {
  const entityBlock = (e: SchemaMapArtifact["entities"][number]) => {
    const cols = e.columns.length
      ? e.columns
          .map(
            (c) => `- \`${c.name}\`: ${c.decision}${c.notes ? ` — ${c.notes}` : ""}`,
          )
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

function serializeActionManifest(a: ActionManifestArtifact): string {
  const toolBlock = (item: ActionManifestArtifact["tools"][number]["items"][number]) =>
    `### ${item.name}

Description: ${item.description}

Parameters:

\`\`\`json
${JSON.stringify(item.parameters, null, 2)}
\`\`\`

requires_confirmation: ${item.requiresConfirmation}
Source: ${item.source.method.toUpperCase()} ${item.source.path}${
      item.source.security ? ` (${item.source.security})` : ""
    }
Parameter sources: ${item.parameterSources.join(", ") || "*(none)*"}
`;

  const toolGroups = a.tools
    .map((g) => `## Tools: ${g.entity}\n\n${g.items.map(toolBlock).join("\n")}`)
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

function serializeBuildPlan(b: BuildPlanArtifact): string {
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
