/**
 * Feature 006 — Zod schemas for `.atw/artifacts/action-manifest.md`
 * in-memory representation. Contract: specs/006-openapi-action-catalog/
 * contracts/action-manifest.schema.md and data-model.md §2.
 *
 * These schemas validate both (a) what the parser returns from
 * `parse-action-manifest.ts` and (b) what the classifier writes. The
 * render pipeline derives `RuntimeToolDescriptor[]` from
 * `ActionManifest.included` and the executors pipeline derives the
 * declarative catalog from the same source.
 *
 * Distinct from the legacy `ActionManifestArtifactSchema` in
 * `lib/types.ts`, which models the Feature 001 shape. The two live
 * side-by-side during migration; Feature 006 consumers use this file.
 */
import { z } from "zod";

const HTTP_METHOD = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const ActionManifestEntrySchema = z.object({
  toolName: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, {
      message: "toolName must match /^[a-z][a-z0-9_]*$/",
    }),
  description: z.string().min(1),
  descriptionTemplate: z.string().optional(),
  summaryFields: z.array(z.string()).optional(),
  parameters: z.object({
    type: z.literal("object"),
    properties: z.record(z.any()).default({}),
    required: z.array(z.string()).default([]),
  }),
  requiresConfirmation: z.boolean(),
  isAction: z.boolean(),
  source: z.object({
    method: HTTP_METHOD,
    path: z.string().regex(/^\/.*/, {
      message: "source.path must be a rooted URL path starting with /",
    }),
    operationId: z.string().min(1),
  }),
  parameterSources: z.string().optional(),
});
export type ActionManifestEntry = z.infer<typeof ActionManifestEntrySchema>;

export const ExcludedEntrySchema = z.object({
  method: HTTP_METHOD,
  path: z.string().regex(/^\/.*/),
  operationId: z.string(),
  reason: z.string().min(1),
});
export type ExcludedEntry = z.infer<typeof ExcludedEntrySchema>;

export const OrphanedEntrySchema = z.object({
  method: HTTP_METHOD,
  path: z.string().regex(/^\/.*/),
  previousToolName: z.string().min(1),
});
export type OrphanedEntry = z.infer<typeof OrphanedEntrySchema>;

export const ActionManifestSchema = z.object({
  provenance: z.object({
    openapiSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/, {
      message: "openapiSha256 must match /^sha256:[0-9a-f]{64}$/",
    }),
    classifierModel: z.string().min(1),
    classifiedAt: z.string().datetime(),
  }),
  summary: z.string(),
  included: z.array(ActionManifestEntrySchema),
  excluded: z.array(ExcludedEntrySchema),
  orphaned: z.array(OrphanedEntrySchema).default([]),
});
export type ActionManifest = z.infer<typeof ActionManifestSchema>;

/**
 * Thrown when two `### <tool_name>` blocks share the same name. Parser
 * maps this to exit 1 with a diagnostic listing every offending
 * tool_name and the line ranges they appear at.
 */
export class ToolNameCollisionError extends Error {
  readonly code = "TOOL_NAME_COLLISION" as const;
  readonly toolName: string;
  constructor(toolName: string, message: string) {
    super(message);
    this.name = "ToolNameCollisionError";
    this.toolName = toolName;
  }
}
