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
export interface EmbedResult {
    outputPath: string;
    bytesWritten: number;
    sha256: string;
}
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
//# sourceMappingURL=embed.d.ts.map