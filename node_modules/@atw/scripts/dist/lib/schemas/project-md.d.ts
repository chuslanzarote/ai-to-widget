/**
 * Zod mirror of `specs/009-demo-guide-hardening/contracts/project-md.schema.json`.
 *
 * Validates `.atw/config/project.md` YAML frontmatter at /atw.init time
 * (FR-009, FR-010, FR-011) and at every downstream phase that reads it.
 */
import { z } from "zod";
export declare const DeploymentSchema: z.ZodEnum<["customer-facing-widget", "internal-tool", "headless"]>;
export declare const ProjectConfigSchema: z.ZodObject<{
    project_name: z.ZodString;
    deployment: z.ZodEnum<["customer-facing-widget", "internal-tool", "headless"]>;
    brief_summary: z.ZodOptional<z.ZodString>;
    atw_backend_origin: z.ZodEffects<z.ZodString, string, string>;
    host_api_origin: z.ZodEffects<z.ZodString, string, string>;
    host_page_origin: z.ZodEffects<z.ZodString, string, string>;
    login_url: z.ZodOptional<z.ZodString>;
    model_snapshot: z.ZodEffects<z.ZodDefault<z.ZodString>, import("../pricing.js").ModelSnapshot, string | undefined>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    project_name: z.ZodString;
    deployment: z.ZodEnum<["customer-facing-widget", "internal-tool", "headless"]>;
    brief_summary: z.ZodOptional<z.ZodString>;
    atw_backend_origin: z.ZodEffects<z.ZodString, string, string>;
    host_api_origin: z.ZodEffects<z.ZodString, string, string>;
    host_page_origin: z.ZodEffects<z.ZodString, string, string>;
    login_url: z.ZodOptional<z.ZodString>;
    model_snapshot: z.ZodEffects<z.ZodDefault<z.ZodString>, import("../pricing.js").ModelSnapshot, string | undefined>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    project_name: z.ZodString;
    deployment: z.ZodEnum<["customer-facing-widget", "internal-tool", "headless"]>;
    brief_summary: z.ZodOptional<z.ZodString>;
    atw_backend_origin: z.ZodEffects<z.ZodString, string, string>;
    host_api_origin: z.ZodEffects<z.ZodString, string, string>;
    host_page_origin: z.ZodEffects<z.ZodString, string, string>;
    login_url: z.ZodOptional<z.ZodString>;
    model_snapshot: z.ZodEffects<z.ZodDefault<z.ZodString>, import("../pricing.js").ModelSnapshot, string | undefined>;
}, z.ZodTypeAny, "passthrough">>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export interface ProjectConfigIssue {
    path: string;
    message: string;
}
/**
 * Cross-field validation. Surfaces problems the JSON schema's `allOf`
 * conditional captures (deployment-conditional requirements) plus the
 * "atw_backend_origin must not equal host_api_origin without confirmation"
 * rule from data-model.md.
 */
export declare function checkProjectConfigInvariants(cfg: ProjectConfig, opts?: {
    allowSameOrigin?: boolean;
}): ProjectConfigIssue[];
//# sourceMappingURL=project-md.d.ts.map