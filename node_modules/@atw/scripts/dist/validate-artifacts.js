import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { exists } from "./lib/atomic.js";
import { loadArtifactFromFile } from "./load-artifact.js";
import { ArtifactConsistencyReportSchema, } from "./lib/types.js";
export function defaultArtifactPaths(root) {
    return {
        project: path.join(root, "config", "project.md"),
        brief: path.join(root, "config", "brief.md"),
        "schema-map": path.join(root, "artifacts", "schema-map.md"),
        "action-manifest": path.join(root, "artifacts", "action-manifest.md"),
        "build-plan": path.join(root, "artifacts", "build-plan.md"),
    };
}
const DEFAULT_REQUIRED = [
    "project",
    "brief",
    "schema-map",
    "action-manifest",
];
export async function validateArtifacts(options) {
    const paths = defaultArtifactPaths(options.root);
    const required = options.required ?? DEFAULT_REQUIRED;
    const missing = [];
    for (const kind of required) {
        const p = paths[kind];
        if (!(await exists(p)))
            missing.push({ kind, expectedPath: p });
    }
    if (missing.length > 0) {
        const report = {
            ok: false,
            missing,
            inconsistencies: [],
        };
        return ArtifactConsistencyReportSchema.parse(report);
    }
    const project = (await loadArtifactFromFile("project", paths.project)).content;
    const brief = (await loadArtifactFromFile("brief", paths.brief)).content;
    const schemaMap = (await loadArtifactFromFile("schema-map", paths["schema-map"]))
        .content;
    const actionManifest = (await loadArtifactFromFile("action-manifest", paths["action-manifest"]))
        .content;
    let buildPlan = null;
    if (await exists(paths["build-plan"])) {
        buildPlan = (await loadArtifactFromFile("build-plan", paths["build-plan"]))
            .content;
    }
    void project;
    const inconsistencies = [];
    inconsistencies.push(...checkActionReferencesExcludedEntity(actionManifest, schemaMap, paths["action-manifest"], paths["schema-map"]));
    inconsistencies.push(...checkBriefReferencesMissingVocabulary(brief, schemaMap, actionManifest, paths.brief, paths["schema-map"]));
    inconsistencies.push(...checkSchemaMapReferencesMissingBriefSection(schemaMap, brief, paths["schema-map"], paths.brief));
    if (buildPlan) {
        inconsistencies.push(...checkPlanReferencesMissingUpstream(buildPlan, schemaMap, actionManifest, paths["build-plan"], paths["schema-map"]));
    }
    const report = {
        ok: inconsistencies.length === 0,
        missing,
        inconsistencies,
    };
    return ArtifactConsistencyReportSchema.parse(report);
}
function normalize(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function checkActionReferencesExcludedEntity(actionManifest, schemaMap, leftPath, rightPath) {
    const indexableEntities = new Set(schemaMap.entities
        .filter((e) => e.classification === "indexable")
        .map((e) => normalize(e.name)));
    const knownEntities = new Set(schemaMap.entities.map((e) => normalize(e.name)));
    const piiTables = new Set(schemaMap.piiExcluded.map((p) => normalize(p.table)));
    const out = [];
    for (const group of actionManifest.tools) {
        const norm = normalize(group.entity);
        if (!knownEntities.has(norm) && !indexableEntities.has(norm)) {
            out.push({
                kind: "action-references-excluded-entity",
                detail: `action-manifest tool group "${group.entity}" has no matching entity in schema-map`,
                leftPath,
                rightPath,
            });
            continue;
        }
        if (piiTables.has(norm)) {
            out.push({
                kind: "action-references-excluded-entity",
                detail: `action-manifest tool group "${group.entity}" targets a PII-excluded table in schema-map`,
                leftPath,
                rightPath,
            });
        }
    }
    return out;
}
function checkBriefReferencesMissingVocabulary(brief, schemaMap, actionManifest, leftPath, rightPath) {
    if (brief.vocabulary.length === 0)
        return [];
    const schemaTokens = new Set();
    for (const entity of schemaMap.entities) {
        schemaTokens.add(normalize(entity.name));
        for (const col of entity.columns)
            schemaTokens.add(normalize(col.name));
        for (const t of entity.sourceTables)
            schemaTokens.add(normalize(t));
    }
    const actionTokens = new Set();
    for (const g of actionManifest.tools) {
        actionTokens.add(normalize(g.entity));
        for (const t of g.items)
            actionTokens.add(normalize(t.name));
    }
    const out = [];
    for (const v of brief.vocabulary) {
        const t = normalize(v.term);
        if (t.length === 0)
            continue;
        const matched = schemaTokens.has(t) ||
            actionTokens.has(t) ||
            [...schemaTokens].some((s) => s.includes(t) || t.includes(s)) ||
            [...actionTokens].some((s) => s.includes(t) || t.includes(s));
        if (!matched) {
            out.push({
                kind: "brief-references-missing-vocabulary",
                detail: `brief vocabulary term "${v.term}" does not appear in schema-map entities/columns or action-manifest tools`,
                leftPath,
                rightPath,
            });
        }
    }
    return out;
}
function checkSchemaMapReferencesMissingBriefSection(schemaMap, brief, leftPath, rightPath) {
    const out = [];
    if (schemaMap.entities.length > 0) {
        if (brief.businessScope.trim().length === 0) {
            out.push({
                kind: "schema-map-references-missing-brief-section",
                detail: `schema-map has ${schemaMap.entities.length} entities but brief "Business scope" section is empty`,
                leftPath,
                rightPath,
            });
        }
        if (brief.allowedActions.length === 0 && brief.forbiddenActions.length === 0) {
            out.push({
                kind: "schema-map-references-missing-brief-section",
                detail: `schema-map has indexable entities but brief has neither allowed nor forbidden actions`,
                leftPath,
                rightPath,
            });
        }
    }
    return out;
}
function checkPlanReferencesMissingUpstream(buildPlan, schemaMap, actionManifest, leftPath, rightPath) {
    const out = [];
    const indexableEntities = new Set(schemaMap.entities
        .filter((e) => e.classification === "indexable")
        .map((e) => normalize(e.name)));
    for (const vocab of buildPlan.categoryVocabularies) {
        if (!indexableEntities.has(normalize(vocab.entity))) {
            out.push({
                kind: "plan-references-missing-upstream",
                detail: `build-plan category vocabulary for "${vocab.entity}" has no matching indexable entity in schema-map`,
                leftPath,
                rightPath,
            });
        }
    }
    for (const tmpl of buildPlan.enrichmentPromptTemplates) {
        if (!indexableEntities.has(normalize(tmpl.entity))) {
            out.push({
                kind: "plan-references-missing-upstream",
                detail: `build-plan enrichment template for "${tmpl.entity}" has no matching indexable entity in schema-map`,
                leftPath,
                rightPath,
            });
        }
    }
    for (const [entity, count] of Object.entries(buildPlan.estimatedEntityCounts)) {
        if (count > 0 && !indexableEntities.has(normalize(entity))) {
            out.push({
                kind: "plan-references-missing-upstream",
                detail: `build-plan estimates ${count} entities of type "${entity}" but no such indexable entity exists in schema-map`,
                leftPath,
                rightPath,
            });
        }
    }
    void actionManifest;
    return out;
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            root: { type: "string" },
        },
        strict: true,
    });
    if (!values.root)
        throw new Error("--root <path> is required");
    return { root: values.root };
}
export async function runValidateArtifacts(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-validate-artifacts: ${err.message}\n`);
        return 3;
    }
    const resolved = path.resolve(opts.root);
    try {
        await fs.stat(resolved);
    }
    catch {
        process.stderr.write(`atw-validate-artifacts: root not found: ${resolved}\n`);
        return 2;
    }
    try {
        const report = await validateArtifacts({ root: resolved });
        process.stdout.write(JSON.stringify(report, null, 2) + "\n");
        if (report.missing.length > 0)
            return 2;
        if (!report.ok)
            return 1;
        return 0;
    }
    catch (err) {
        process.stderr.write(`atw-validate-artifacts: ${err.message}\n`);
        return 1;
    }
}
//# sourceMappingURL=validate-artifacts.js.map