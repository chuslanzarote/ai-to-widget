/**
 * Feature 008 / FR-015 — tool name `,` is forbidden because
 * `data-allowed-tools` uses a comma-separated list. A tool whose name
 * contains a comma would corrupt the allow-list at parse time.
 */
export declare class ToolNameCommaError extends Error {
    readonly tool: string;
    readonly code: "TOOL_NAME_CONTAINS_COMMA";
    constructor(tool: string);
}
export declare const SUPPORTED_FRAMEWORKS: readonly ["next-app-router", "next-pages-router", "plain-html", "custom"];
export type Framework = (typeof SUPPORTED_FRAMEWORKS)[number];
export declare const SUPPORTED_AUTH_MODES: readonly ["cookie", "bearer", "custom"];
export type AuthMode = (typeof SUPPORTED_AUTH_MODES)[number];
export interface EmbedAnswers {
    framework: Framework;
    backendUrl: string;
    authMode: AuthMode;
    authTokenKey?: string;
    apiBaseUrl?: string;
    loginUrl?: string;
    locale?: string;
    themePrimary?: string;
    themeRadius?: string;
    themeFont?: string;
}
export interface EmbedOptions {
    projectRoot: string;
    answers: EmbedAnswers;
    outputPath?: string;
    frozenTime?: string;
}
export interface EmbedSnippetBlock {
    /** FR-016/017 — files-to-copy markdown task-list. */
    filesToCopy: string;
    /** FR-003 reminder. `null` when `host-requirements.md` does not exist. */
    hostRequirementsReminder: string | null;
    /** FR-014/015/025 — the pasteable HTML snippet. */
    pasteableSnippet: string;
    /** Alphabetically-sorted tool names used to build `data-allowed-tools`. */
    allowedTools: string[];
    /** Concatenation of the three sections (plus a trailing newline). */
    full: string;
}
export interface EmbedResult {
    outputPath: string;
    bytesWritten: number;
    sha256: string;
    /**
     * Feature 008 / contracts/embed-snippet.md — the 3-section integration
     * block printed to stdout and spliced into the top of the rendered
     * embed-guide.md. Carried on the result so CLI + tests see the same
     * bytes.
     */
    snippet: EmbedSnippetBlock;
}
/**
 * Read `.atw/artifacts/action-executors.json`, extract every `entry.tool`,
 * sort alphabetically, and return the list. Missing file ⇒ empty list.
 * Throws `ToolNameCommaError` if any tool name contains a comma (FR-015).
 */
export declare function readAllowedTools(projectRoot: string): Promise<string[]>;
/**
 * Read `project.md#welcomeMessage`. Missing file ⇒ `undefined`.
 */
export declare function readProjectWelcomeMessage(projectRoot: string): Promise<string | undefined>;
export declare function hostRequirementsExists(projectRoot: string): boolean;
interface BuildSnippetInputs {
    backendUrl: string;
    authTokenKey: string;
    allowedTools: string[];
    welcomeMessage: string;
    hostRequirementsPresent: boolean;
    catalogIsEmpty: boolean;
}
export declare function buildEmbedSnippet(inputs: BuildSnippetInputs): EmbedSnippetBlock;
export declare function checkPreconditions(projectRoot: string): {
    ok: boolean;
    missing: string[];
};
/**
 * Parse the simple YAML-front-matter shape we persist to
 * `.atw/state/embed-answers.md` (data-model §4.1).
 */
export declare function parseAnswersMarkdown(source: string): EmbedAnswers;
export declare function formatAnswersMarkdown(answers: EmbedAnswers, now: string): string;
export declare function renderEmbedGuide(opts: EmbedOptions): Promise<EmbedResult>;
export declare function runEmbedCli(argv: string[], cwd?: string): Promise<number>;
export {};
//# sourceMappingURL=embed.d.ts.map