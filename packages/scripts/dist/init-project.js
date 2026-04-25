import { promises as fs } from "node:fs";
import path from "node:path";
import { writeArtifactAtomic } from "./lib/atomic.js";
import { parseArtifactFromMarkdown, parseMarkdown, serializeArtifact, } from "./lib/markdown.js";
import { DeploymentTypeSchema, ProjectArtifactSchema, } from "./lib/types.js";
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
export async function initProject(opts) {
    const { answers, targetPath } = opts;
    const deployment = DeploymentTypeSchema.parse(answers.deploymentType);
    const languages = answers.languages.map((l) => l.trim()).filter((l) => l.length > 0);
    if (languages.length === 0) {
        throw new Error("initProject: at least one language is required.");
    }
    const existing = await loadExistingProject(targetPath);
    const createdAt = existing?.createdAt ?? (opts.now ? opts.now() : new Date()).toISOString();
    // Feature 008 / T006 — when deploymentType is customer-facing-widget the
    // ProjectArtifact refine requires a non-empty storefrontOrigins. Default
    // here (T044 will prompt interactively) so callers that don't supply one
    // still produce a valid artifact.
    const storefrontOrigins = answers.storefrontOrigins && answers.storefrontOrigins.length > 0
        ? answers.storefrontOrigins
        : deployment === "customer-facing-widget"
            ? ["http://localhost:5173"]
            : undefined;
    const candidate = ProjectArtifactSchema.parse({
        name: answers.name.trim(),
        languages,
        deploymentType: deployment,
        createdAt,
        ...(storefrontOrigins ? { storefrontOrigins } : {}),
        ...(answers.welcomeMessage ? { welcomeMessage: answers.welcomeMessage } : {}),
        ...(answers.authTokenKey ? { authTokenKey: answers.authTokenKey } : {}),
        ...(answers.loginUrl !== undefined ? { loginUrl: answers.loginUrl } : {}),
    });
    if (existing && shallowEqualProject(existing, candidate)) {
        return { artifact: candidate, wrote: false, targetPath };
    }
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const markdown = serializeArtifact("project", candidate);
    await writeArtifactAtomic(targetPath, markdown);
    return { artifact: candidate, wrote: true, targetPath };
}
function shallowEqualProject(a, b) {
    return (a.name === b.name &&
        a.deploymentType === b.deploymentType &&
        a.createdAt === b.createdAt &&
        a.languages.length === b.languages.length &&
        a.languages.every((v, i) => v === b.languages[i]));
}
//# sourceMappingURL=init-project.js.map