import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { writeArtifactAtomic } from "./lib/atomic.js";
import { parseArtifactFromMarkdown, parseMarkdown, serializeArtifact, } from "./lib/markdown.js";
import { DeploymentTypeSchema, ProjectArtifactSchema, } from "./lib/types.js";
import { ProjectConfigSchema, checkProjectConfigInvariants, } from "./lib/schemas/project-md.js";
import { isSupportedSnapshot, SUPPORTED_MODEL_SNAPSHOTS } from "./lib/pricing.js";
export async function loadExistingProject(targetPath) {
    try {
        const raw = await fs.readFile(targetPath, "utf8");
        return parseArtifactFromMarkdown("project", parseMarkdown(raw));
    }
    catch (err) {
        if (err.code === "ENOENT")
            return null;
        throw err;
    }
}
export function validateOriginUrl(value) {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return { ok: false, error: "value is empty" };
    }
    // Catch the `http//localhost:3200` typo from spec acceptance scenario 2:
    // a string with a host but no `://` separator parses as a relative URL in
    // some Node versions; reject explicitly.
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
        return {
            ok: false,
            error: "missing scheme (did you mean http://… or https://…?)",
        };
    }
    let parsed;
    try {
        parsed = new URL(trimmed);
    }
    catch {
        return { ok: false, error: "not a valid URL" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: `unsupported scheme ${parsed.protocol}` };
    }
    return { ok: true, url: parsed };
}
export async function probeOrigin(url, opts = {}) {
    const validation = validateOriginUrl(url);
    if (!validation.ok) {
        return { reachable: false, error: validation.error };
    }
    const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== "function") {
        return { reachable: false, error: "fetch unavailable in this runtime" };
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 2000);
    try {
        const res = await fetchImpl(url, { method: "HEAD", signal: ac.signal });
        return { reachable: true, status: res.status };
    }
    catch (err) {
        return { reachable: false, error: err.message };
    }
    finally {
        clearTimeout(timer);
    }
}
export function validateModelSnapshot(value) {
    if (!value || value.trim().length === 0) {
        return { ok: false, error: "value is empty" };
    }
    if (!isSupportedSnapshot(value.trim())) {
        return {
            ok: false,
            error: `unsupported snapshot — choose one of: ${SUPPORTED_MODEL_SNAPSHOTS.join(", ")}`,
        };
    }
    return { ok: true };
}
/**
 * Map the legacy `deploymentType` enum to the Feature 009 `deployment`
 * enum used by `ProjectConfigSchema`. The two were intentionally
 * misaligned across feature cycles; this is the single point of truth.
 */
function deploymentToFeature009(deploymentType) {
    switch (deploymentType) {
        case "customer-facing-widget":
            return "customer-facing-widget";
        case "internal-copilot":
            return "internal-tool";
        case "custom":
            return "headless";
    }
}
export async function initProject(opts) {
    const { answers, targetPath } = opts;
    const deployment = DeploymentTypeSchema.parse(answers.deploymentType);
    const languages = answers.languages.map((l) => l.trim()).filter((l) => l.length > 0);
    if (languages.length === 0) {
        throw new Error("initProject: at least one language is required.");
    }
    const existing = await loadExistingProject(targetPath);
    const createdAt = existing?.createdAt ?? (opts.now ? opts.now() : new Date()).toISOString();
    const candidate = ProjectArtifactSchema.parse({
        name: answers.name.trim(),
        languages,
        deploymentType: deployment,
        createdAt,
    });
    // FR-011 zod gate: when the deployment requires the new origin set
    // (customer-facing-widget), validate the assembled Feature 009 frontmatter
    // through `ProjectConfigSchema` BEFORE writing. Surface field-level paths
    // so the slash command can re-prompt the precise question that failed.
    if (deployment === "customer-facing-widget") {
        const f009 = {
            project_name: candidate.name,
            deployment: deploymentToFeature009(deployment),
            atw_backend_origin: answers.atwBackendOrigin,
            host_api_origin: answers.hostApiOrigin,
            host_page_origin: answers.hostPageOrigin,
            ...(answers.loginUrl ? { login_url: answers.loginUrl } : {}),
            model_snapshot: answers.modelSnapshot ?? "claude-opus-4-7",
        };
        const parsed = ProjectConfigSchema.safeParse(f009);
        if (!parsed.success) {
            const issues = parsed.error.issues
                .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
                .join("; ");
            throw new Error(`initProject: project.md validation failed — ${issues}`);
        }
        const invariantIssues = checkProjectConfigInvariants(parsed.data);
        if (invariantIssues.length > 0) {
            const msg = invariantIssues.map((i) => `${i.path}: ${i.message}`).join("; ");
            throw new Error(`initProject: project.md invariants failed — ${msg}`);
        }
    }
    if (existing && shallowEqualProject(existing, candidate)) {
        // Even when the legacy 4 fields match, the integrator may have provided
        // new origin/snapshot answers that diverge from what's on disk. Detect
        // that by reading the existing frontmatter and comparing.
        const existingExtras = await readExistingExtras(targetPath);
        const desiredExtras = buildExtraFrontmatter(answers, deployment);
        if (extrasEqual(existingExtras, desiredExtras)) {
            return { artifact: candidate, wrote: false, targetPath };
        }
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const markdown = mergeProjectFrontmatter(serializeArtifact("project", candidate), buildExtraFrontmatter(answers, deployment));
    await writeArtifactAtomic(targetPath, markdown);
    return { artifact: candidate, wrote: true, targetPath };
}
function buildExtraFrontmatter(answers, deployment) {
    const out = {
        project_name: answers.name.trim(),
        deployment: deploymentToFeature009(deployment),
        model_snapshot: answers.modelSnapshot ?? "claude-opus-4-7",
    };
    if (deployment === "customer-facing-widget") {
        if (answers.atwBackendOrigin)
            out.atw_backend_origin = answers.atwBackendOrigin;
        if (answers.hostApiOrigin)
            out.host_api_origin = answers.hostApiOrigin;
        if (answers.hostPageOrigin)
            out.host_page_origin = answers.hostPageOrigin;
    }
    if (answers.loginUrl)
        out.login_url = answers.loginUrl;
    return out;
}
/**
 * Layer the Feature 009 frontmatter keys on top of the legacy
 * `serializeArtifact("project", ...)` output without dropping the
 * existing prose body. gray-matter round-trip preserves the body text.
 */
function mergeProjectFrontmatter(legacyMarkdown, extras) {
    const parsed = matter(legacyMarkdown);
    const merged = { ...parsed.data, ...extras };
    return matter.stringify(parsed.content, merged);
}
async function readExistingExtras(targetPath) {
    try {
        const raw = await fs.readFile(targetPath, "utf8");
        const parsed = matter(raw);
        const fm = (parsed.data ?? {});
        const out = {};
        for (const k of [
            "project_name",
            "deployment",
            "atw_backend_origin",
            "host_api_origin",
            "host_page_origin",
            "login_url",
            "model_snapshot",
        ]) {
            if (k in fm)
                out[k] = fm[k];
        }
        return out;
    }
    catch {
        return {};
    }
}
function extrasEqual(a, b) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length)
        return false;
    for (const k of ka) {
        if (a[k] !== b[k])
            return false;
    }
    return true;
}
function shallowEqualProject(a, b) {
    return (a.name === b.name &&
        a.deploymentType === b.deploymentType &&
        a.createdAt === b.createdAt &&
        a.languages.length === b.languages.length &&
        a.languages.every((v, i) => v === b.languages[i]));
}
//# sourceMappingURL=init-project.js.map