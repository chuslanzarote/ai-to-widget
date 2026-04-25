/**
 * Embed-guide placeholder lint (FR-013, SC-006). Used by both build-time
 * template validation (T060) and the FR-035 CI regression harness.
 *
 * The lint asserts that the rendered `embed-guide.md` (and the four
 * source `.hbs` templates) contain none of:
 *   - `<your storefront origin>` placeholder
 *   - `[NEEDS CLARIFICATION]` markers
 *   - `specs/` repo-internal path leaks
 *   - bare `localhost` outside an explicit `REPLACE THIS` annotation
 *
 * The function returns the offending matches; an empty result means
 * clean. The caller decides whether to fail (build-time, CI) or warn.
 */
export interface LintMatch {
    line: number;
    pattern: string;
    excerpt: string;
}
export interface LintOptions {
    /** When true, treat `localhost` outside REPLACE-THIS as an offence. */
    allowLocalhost?: boolean;
}
export declare function lintEmbedGuide(content: string, opts?: LintOptions): LintMatch[];
export declare function formatMatches(matches: ReadonlyArray<LintMatch>): string;
//# sourceMappingURL=embed-guide-lint.d.ts.map