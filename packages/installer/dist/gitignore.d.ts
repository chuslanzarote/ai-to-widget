export declare const ATW_GITIGNORE_MARKER = "# === ai-to-widget ===";
export declare const ATW_GITIGNORE_LINE = ".atw/inputs/";
export type GitignoreOutcome = "created" | "appended" | "unchanged";
export declare function ensureGitignoreBlock(targetDir: string, blockContent: string): Promise<GitignoreOutcome>;
//# sourceMappingURL=gitignore.d.ts.map