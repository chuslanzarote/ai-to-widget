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
export declare function runValidateArtifacts(argv: string[]): Promise<number>;
export {};
//# sourceMappingURL=validate-artifacts.d.ts.map