import { type ProjectArtifact } from "./lib/types.js";
export interface InitProjectAnswers {
    name: string;
    languages: string[];
    deploymentType: ProjectArtifact["deploymentType"];
    /** Feature 008 / T044 — prompts default this to `["http://localhost:5173"]`
     * when `deploymentType === "customer-facing-widget"`. */
    storefrontOrigins?: string[];
    welcomeMessage?: string;
    authTokenKey?: string;
    loginUrl?: string;
}
export interface InitProjectOptions {
    answers: InitProjectAnswers;
    targetPath: string;
    now?: () => Date;
}
export interface InitProjectResult {
    artifact: ProjectArtifact;
    wrote: boolean;
    targetPath: string;
}
export declare function loadExistingProject(targetPath: string): Promise<ProjectArtifact | null>;
export declare function initProject(opts: InitProjectOptions): Promise<InitProjectResult>;
//# sourceMappingURL=init-project.d.ts.map