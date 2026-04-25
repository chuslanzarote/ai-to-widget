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
/**
 * Feature 008 / T045 — a single frontmatter field that differs between
 * the prior artifact and the newly-captured answers. Surfaced as the
 * `diff` array on {@link InitProjectResult} so `/atw.init` can show a
 * human-readable before/after before the atomic write.
 */
export interface ProjectFieldDiff {
    field: string;
    before: unknown;
    after: unknown;
}
export interface InitProjectResult {
    artifact: ProjectArtifact;
    wrote: boolean;
    targetPath: string;
    /** The pre-existing artifact, or `null` on a first run. */
    previous: ProjectArtifact | null;
    /**
     * Per-field diff vs. `previous` (empty on first run AND on no-op re-runs
     * where every captured value matches). `updatedAt` is excluded — it
     * always changes, so listing it adds noise.
     */
    diff: ProjectFieldDiff[];
}
export declare function loadExistingProject(targetPath: string): Promise<ProjectArtifact | null>;
/**
 * Feature 008 / T045 — compute the per-field diff between two project
 * artifacts, ignoring `updatedAt`. Used by `/atw.init` to render the
 * confirmation-gate diff and by `initProject` to decide whether the
 * captured answers actually changed anything.
 */
export declare function diffProjects(before: ProjectArtifact, after: ProjectArtifact): ProjectFieldDiff[];
export declare function initProject(opts: InitProjectOptions): Promise<InitProjectResult>;
//# sourceMappingURL=init-project.d.ts.map