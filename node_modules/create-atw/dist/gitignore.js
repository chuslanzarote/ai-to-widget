import { promises as fs } from "node:fs";
import path from "node:path";
import writeFileAtomic from "write-file-atomic";
export const ATW_GITIGNORE_MARKER = "# === ai-to-widget ===";
export const ATW_GITIGNORE_LINE = ".atw/inputs/";
export async function ensureGitignoreBlock(targetDir, blockContent) {
    const gitignorePath = path.join(targetDir, ".gitignore");
    const trimmed = blockContent.endsWith("\n") ? blockContent : `${blockContent}\n`;
    let existing = null;
    try {
        existing = await fs.readFile(gitignorePath, "utf8");
    }
    catch (err) {
        if (err.code === "ENOENT") {
            await writeFileAtomic(gitignorePath, trimmed, "utf8");
            return "created";
        }
        throw err;
    }
    if (hasAtwBlock(existing)) {
        return "unchanged";
    }
    const separator = existing.endsWith("\n") ? "" : "\n";
    const next = `${existing}${separator}\n${trimmed}`;
    await writeFileAtomic(gitignorePath, next, "utf8");
    return "appended";
}
function hasAtwBlock(contents) {
    if (contents.includes(ATW_GITIGNORE_MARKER))
        return true;
    return contents.split(/\r?\n/).some((line) => line.trim() === ATW_GITIGNORE_LINE);
}
//# sourceMappingURL=gitignore.js.map