import type { ActionManifest } from "./lib/action-manifest-types.js";
import { type ActionExecutorsCatalog } from "./lib/action-executors-types.js";
/**
 * Feature 007 — `credentialSource` emission.
 *
 * When the source OpenAPI operation requires `bearerAuth`, the widget
 * needs to know where the token lives. v1 pins the localStorage key to
 * `shop_auth_token`; future features can thread a shop-specific value
 * through from `.atw/setup.yaml`.
 */
export declare const BEARER_AUTH_SCHEME = "bearerAuth";
export declare const DEFAULT_BEARER_STORAGE_KEY = "shop_auth_token";
export declare class UnsupportedSecuritySchemeError extends Error {
    readonly code: "UNSUPPORTED_SECURITY_SCHEME";
    readonly tool: string;
    readonly scheme: string;
    constructor(tool: string, scheme: string);
}
/**
 * Thrown when a manifest entry's `source.path` carries a `{placeholder}`
 * for which `parameters.properties` has no matching key. Indicates a
 * broken manifest that would produce an un-callable executor. Mapped to
 * process exit 1 by the orchestrator.
 */
export declare class InvalidSubstitutionError extends Error {
    readonly code: "INVALID_SUBSTITUTION";
    readonly tool: string;
    readonly identifier: string;
    constructor(tool: string, identifier: string, message: string);
}
export interface RenderExecutorsResult {
    path: string;
    sha256: string;
    bytes: number;
    action: "created" | "unchanged" | "rewritten";
    warnings: string[];
}
export interface RenderExecutorsOptions {
    outputPath: string;
    hostOrigin: string;
    widgetOrigin: string;
    backup?: boolean;
    /**
     * FR-013 / Feature 008 — the localStorage key the widget will read the
     * bearer token from. Sourced from `project.md#authTokenKey`. Falls back
     * to `DEFAULT_BEARER_STORAGE_KEY` when the project metadata is absent.
     */
    authTokenKey?: string;
}
export declare function renderExecutors(manifest: ActionManifest, opts: RenderExecutorsOptions): Promise<RenderExecutorsResult>;
export declare function canonicaliseCatalog(catalog: ActionExecutorsCatalog): string;
//# sourceMappingURL=render-executors.d.ts.map