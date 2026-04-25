import { type ProjectArtifact } from "./lib/types.js";
/**
 * Feature 009 (FR-009, FR-010, FR-011, R6) extends `/atw.init` with the
 * four origins every downstream phase consumes plus a pinned `model_snapshot`.
 * The slash-command markdown drives the prompts; this module owns:
 *   - the answer shape,
 *   - the URL / snapshot validators the slash command calls between turns,
 *   - the optional HEAD probe,
 *   - the strong post-write zod gate against the Feature 009 contract,
 *   - the serialized frontmatter (legacy keys + new keys, both written so
 *     legacy readers and `loadProjectConfig` see the same file).
 */
export interface InitProjectAnswers {
    name: string;
    languages: string[];
    deploymentType: ProjectArtifact["deploymentType"];
    /** Required when deploymentType === "customer-facing-widget" (FR-009). */
    atwBackendOrigin?: string;
    hostApiOrigin?: string;
    hostPageOrigin?: string;
    /** Optional in any deployment. */
    loginUrl?: string;
    /** Pinned LLM snapshot for downstream phases (FR-006, R6). */
    modelSnapshot?: string;
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
/**
 * Validate a single origin string against the http(s) URL contract enforced
 * by `ProjectConfigSchema`. The slash command calls this between turns to
 * surface the FR-010 "that doesn't look like a URL" message before
 * proceeding to the next question.
 */
export interface UrlValidationResult {
    ok: boolean;
    /** When ok=false, a short integrator-facing message. */
    error?: string;
    /** Parsed URL when ok=true, for the optional HEAD probe step. */
    url?: URL;
}
export declare function validateOriginUrl(value: string): UrlValidationResult;
/**
 * Optional HEAD probe (FR-010 SHOULD). Never blocks the init flow — the
 * slash command just surfaces the warning. Times out at 2 s so an
 * unresponsive demo server doesn't stall onboarding.
 */
export interface OriginProbeResult {
    reachable: boolean;
    status?: number;
    error?: string;
}
export declare function probeOrigin(url: string, opts?: {
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
}): Promise<OriginProbeResult>;
export declare function validateModelSnapshot(value: string): UrlValidationResult;
export declare function initProject(opts: InitProjectOptions): Promise<InitProjectResult>;
//# sourceMappingURL=init-project.d.ts.map