import { type ArtifactConsistencyReport, type ArtifactKind } from "./lib/types.js";
interface ArtifactPaths {
    project: string;
    brief: string;
    "schema-map": string;
    "action-manifest": string;
    "build-plan": string;
}
export declare function defaultArtifactPaths(root: string): ArtifactPaths;
export interface ValidateArtifactsOptions {
    root: string;
    required?: ArtifactKind[];
}
export declare function validateArtifacts(options: ValidateArtifactsOptions): Promise<ArtifactConsistencyReport>;
/**
 * Feature 008 / T060 — D-RUNTIMEONLY text per
 * specs/008-atw-hardening/contracts/builder-diagnostics.md. Exported
 * so `test/diagnostics.text.test.ts` can assert byte-for-byte match.
 */
export declare function formatRuntimeOnlyHalt(groupName: string, entityName: string): string;
export declare function runValidateArtifacts(argv: string[]): Promise<number>;
export {};
//# sourceMappingURL=validate-artifacts.d.ts.map