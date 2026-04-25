/**
 * T060 — build-time template validation (FR-036, R13).
 *
 * Every `.hbs` under `packages/backend/src/` and
 * `packages/scripts/src/embed-templates/` is compiled and rendered
 * against a canonical fixture context. Compilation failures (e.g. the
 * `{{/if}}}` parse-error class regression caught in 009) are reported
 * with the file name + line. When `runTsc: true`, rendered backend
 * outputs are additionally type-checked with `tsc --noEmit` against the
 * backend's tsconfig.
 *
 * The lib is re-used by the build-validation CLI and a vitest test so
 * the same fixture is exercised in CI and during `npm run build`.
 */
export interface ValidationIssue {
    file: string;
    phase: "compile" | "render" | "tsc";
    message: string;
}
export interface ValidateOptions {
    backendDir?: string;
    embedDir?: string;
    /** When true, also run `tsc --noEmit` against rendered backend output. */
    runTsc?: boolean;
}
export interface ValidationResult {
    ok: boolean;
    rendered: number;
    issues: ValidationIssue[];
    /** Path to the temp dir containing rendered backend output (kept on tsc failures for inspection). */
    renderDir?: string;
}
export declare function defaultBackendDir(): string;
export declare function defaultEmbedDir(): string;
/**
 * Canonical fixture context used to render every backend template. The
 * fields mirror what `render-backend.ts` emits at runtime; values are
 * representative but synthetic so renders are deterministic.
 */
export declare function canonicalBackendContext(): Record<string, unknown>;
/**
 * Canonical fixture context used to render every embed template.
 */
export declare function canonicalEmbedContext(): Record<string, unknown>;
export declare function validateTemplates(opts?: ValidateOptions): Promise<ValidationResult>;
export declare function runValidateTemplatesCli(argv: string[]): Promise<number>;
//# sourceMappingURL=validate-templates.d.ts.map