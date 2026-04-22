import { type ProjectArtifact } from "./lib/types.js";
export interface InitProjectAnswers {
    name: string;
    languages: string[];
    deploymentType: ProjectArtifact["deploymentType"];
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