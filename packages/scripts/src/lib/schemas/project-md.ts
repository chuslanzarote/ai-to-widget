/**
 * Zod mirror of `specs/009-demo-guide-hardening/contracts/project-md.schema.json`.
 *
 * Validates `.atw/config/project.md` YAML frontmatter at /atw.init time
 * (FR-009, FR-010, FR-011) and at every downstream phase that reads it.
 */

import { z } from "zod";
import { isSupportedSnapshot, SUPPORTED_MODEL_SNAPSHOTS } from "../pricing.js";

export const DeploymentSchema = z.enum([
  "customer-facing-widget",
  "internal-tool",
  "headless",
]);

const httpUrl = z
  .string()
  .min(1)
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "must be an absolute http(s) URL" },
  );

export const ProjectConfigSchema = z
  .object({
    project_name: z.string().min(1),
    deployment: DeploymentSchema,
    brief_summary: z.string().optional(),
    atw_backend_origin: httpUrl,
    host_api_origin: httpUrl,
    host_page_origin: httpUrl,
    login_url: z.string().url().optional(),
    model_snapshot: z
      .string()
      .default("claude-opus-4-7")
      .refine((v) => isSupportedSnapshot(v), {
        message: `model_snapshot must be one of: ${SUPPORTED_MODEL_SNAPSHOTS.join(", ")}`,
      }),
  })
  .passthrough();

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
export function checkProjectConfigInvariants(
  cfg: ProjectConfig,
  opts: { allowSameOrigin?: boolean } = {},
): ProjectConfigIssue[] {
  const issues: ProjectConfigIssue[] = [];

  if (cfg.deployment === "customer-facing-widget" && !cfg.host_page_origin) {
    issues.push({
      path: "host_page_origin",
      message: "customer-facing-widget deployments require host_page_origin",
    });
  }

  if (!opts.allowSameOrigin && cfg.atw_backend_origin === cfg.host_api_origin) {
    issues.push({
      path: "host_api_origin",
      message: "host_api_origin must differ from atw_backend_origin (or pass allowSameOrigin)",
    });
  }

  return issues;
}
