import { promises as fs } from "node:fs";
import path from "node:path";
const STRUCTURAL_TARGETS = [
    ".atw",
    ".claude/commands/atw.init.md",
    ".claude/commands/atw.brief.md",
    ".claude/commands/atw.schema.md",
    ".claude/commands/atw.api.md",
    ".claude/commands/atw.plan.md",
    "docker-compose.yml",
    "README-atw.md",
];
async function pathExists(p) {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
}
export async function detectConflicts(targetDir) {
    const targetExists = await pathExists(targetDir);
    if (!targetExists) {
        return { conflicts: [], targetExists: false };
    }
    const conflicts = [];
    for (const rel of STRUCTURAL_TARGETS) {
        const full = path.join(targetDir, rel);
        if (await pathExists(full)) {
            conflicts.push(rel);
        }
    }
    return { conflicts, targetExists };
}
export const BUILDER_PRESERVED_SUBPATHS = [".atw/config", ".atw/artifacts", ".atw/inputs"];
export function isBuilderPreserved(relPath) {
    const normalized = relPath.split(path.sep).join("/");
    return BUILDER_PRESERVED_SUBPATHS.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}
//# sourceMappingURL=conflicts.js.map