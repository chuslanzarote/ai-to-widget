import type { ParsedOpenAPI } from "./lib/types.js";
import type { ProjectArtifact } from "./lib/types.js";
export interface HostRequirementsInputs {
    project: ProjectArtifact;
    openapi: ParsedOpenAPI;
    /** Optional per-tool host prerequisites, keyed by `operationId` or
     * tool name. Emitted as bullet items when any are present. */
    hostPrerequisites?: Array<{
        tool: string;
        hostPrerequisite: string;
    }>;
}
export interface HostRequirementsEmitResult {
    /** Repository-relative path of the emitted artefact. */
    path: string;
    action: "created" | "unchanged" | "rewritten" | "skipped";
    /** In-terminal summary suitable for the `/atw.api` DONE banner
     * (contracts/host-requirements.md §In-flow Builder summary). */
    summary: string;
}
export declare const HOST_REQUIREMENTS_REL = ".atw/artifacts/host-requirements.md";
/**
 * Deploy-type gate. Kept as its own helper so callers (the `atw-api`
 * CLI, `/atw.api` integration, tests) share one source of truth.
 */
export declare function shouldEmitHostRequirements(project: ProjectArtifact | null): project is ProjectArtifact & {
    deploymentType: "customer-facing-widget";
};
/**
 * Pure-function render: inputs → markdown body. Separated from the
 * filesystem write so tests can assert the rendered bytes without touching
 * disk, and so the in-terminal summary can be derived from the same
 * values in one place.
 */
export declare function renderHostRequirements(inputs: HostRequirementsInputs): {
    body: string;
    summary: string;
};
/**
 * Filesystem entry. Skipped (no write, no `.bak`) when the gate fails,
 * so consumers can call this unconditionally.
 */
export declare function emitHostRequirements(opts: {
    projectRoot: string;
    project: ProjectArtifact | null;
    openapi: ParsedOpenAPI;
    hostPrerequisites?: HostRequirementsInputs["hostPrerequisites"];
}): Promise<HostRequirementsEmitResult>;
//# sourceMappingURL=host-requirements.d.ts.map