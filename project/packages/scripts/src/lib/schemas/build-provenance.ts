/**
 * Zod mirror of `specs/009-demo-guide-hardening/contracts/build-provenance.schema.json`.
 *
 * Used by orchestrator.ts to validate every per-phase log entry before it
 * appends to `.atw/artifacts/build-provenance.json`. Captures the status
 * taxonomy (FR-028), the LLM-call telemetry block (FR-008a), and the
 * dynamic next-hint string (FR-031).
 */

import { z } from "zod";

export const BuildPhaseSchema = z.enum([
  "INIT_CHECK",
  "CLASSIFY",
  "IMPORT",
  "ENRICH",
  "EMBED",
  "RENDER",
  "COMPOSE",
  "EMBED_GUIDE",
]);
export type BuildPhase = z.infer<typeof BuildPhaseSchema>;

export const BuildPhaseStatusSchema = z.enum([
  "success",
  "success_cached",
  "warning",
  "skipped",
  "failed",
  "not_run",
]);
export type BuildPhaseStatus = z.infer<typeof BuildPhaseStatusSchema>;

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const modelSnapshotPattern = /^claude-(opus|sonnet|haiku)-[0-9]+-[0-9]+(-[0-9]{8})?$/;

export const LLMCallTelemetrySchema = z
  .object({
    attempts: z.number().int().min(1).max(3),
    retry_delays_ms: z.array(z.number().int().min(0)),
    input_tokens: z.number().int().min(0),
    output_tokens: z.number().int().min(0),
    estimated_cost_usd: z.number().min(0),
    actual_cost_usd: z.number().min(0),
    cost_variance_pct: z.number(),
  })
  .partial()
  .strict();

export const BuildProvenanceEntrySchema = z
  .object({
    build_id: ulid,
    phase: BuildPhaseSchema,
    started_at: z.string(),
    finished_at: z.string(),
    status: BuildPhaseStatusSchema,
    input_hashes: z.record(sha256Hex).optional(),
    model_snapshot: z.string().regex(modelSnapshotPattern).optional(),
    llm_call: LLMCallTelemetrySchema.optional(),
    outputs: z.record(z.unknown()).optional(),
    warnings: z.array(z.string()).optional(),
    skipped_reason: z.string().nullable().optional(),
    failed_reason: z.string().nullable().optional(),
    next_hint: z.string().nullable().optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.status === "skipped" && !entry.skipped_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["skipped_reason"],
        message: "skipped status requires a non-null skipped_reason",
      });
    }
    if (entry.status === "failed" && !entry.failed_reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failed_reason"],
        message: "failed status requires a non-null failed_reason",
      });
    }
    if ((entry.phase === "CLASSIFY" || entry.phase === "ENRICH") && !entry.model_snapshot) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["model_snapshot"],
        message: `phase ${entry.phase} requires a model_snapshot`,
      });
    }
  });

export type BuildProvenanceEntry = z.infer<typeof BuildProvenanceEntrySchema>;
