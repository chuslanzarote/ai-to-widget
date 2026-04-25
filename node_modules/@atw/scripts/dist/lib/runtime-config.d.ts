/**
 * Runtime configuration resolution — shared between the rendered backend
 * (`packages/backend/src/config.ts` after Feature 002's render) and the
 * contract tests that verify startup failure modes (T099 / U2 finding).
 *
 * Source: specs/003-runtime/contracts/chat-endpoint.md §9.
 */
export interface RuntimeConfig {
    port: number;
    databaseUrl: string;
    anthropicApiKey: string;
    allowedOrigins: string[];
    retrievalThreshold: number;
    retrievalTopK: number;
    maxConversationTurns: number;
    maxToolCallsPerTurn: number;
    rateLimitMax: number;
    rateLimitWindowMs: number;
    logLevel: string;
    nodeEnv: string;
}
export declare class ConfigError extends Error {
    readonly missing: string[];
    constructor(missing: string[]);
}
export declare function loadRuntimeConfig(env?: NodeJS.ProcessEnv): RuntimeConfig;
import { type ProjectConfig } from "./schemas/project-md.js";
export declare class ProjectConfigError extends Error {
    readonly issues: ReadonlyArray<{
        path: string;
        message: string;
    }>;
    constructor(message: string, issues: ReadonlyArray<{
        path: string;
        message: string;
    }>);
}
export interface LoadProjectConfigOptions {
    projectRoot?: string;
    /** Allow atw_backend_origin === host_api_origin (rare, single-process demos). */
    allowSameOrigin?: boolean;
}
export declare const DEFAULT_PROJECT_MD_PATH = ".atw/config/project.md";
/**
 * Reads `.atw/config/project.md` and returns the validated frontmatter.
 * Defaults `model_snapshot` to `claude-opus-4-7` when the field is absent.
 * Throws `ProjectConfigError` with a list of `{path, message}` issues when
 * structural or cross-field validation fails.
 */
export declare function loadProjectConfig(opts?: LoadProjectConfigOptions): ProjectConfig;
//# sourceMappingURL=runtime-config.d.ts.map