/**
 * Zod mirror of `specs/009-demo-guide-hardening/contracts/build-provenance.schema.json`.
 *
 * Used by orchestrator.ts to validate every per-phase log entry before it
 * appends to `.atw/artifacts/build-provenance.json`. Captures the status
 * taxonomy (FR-028), the LLM-call telemetry block (FR-008a), and the
 * dynamic next-hint string (FR-031).
 */
import { z } from "zod";
export declare const BuildPhaseSchema: z.ZodEnum<["INIT_CHECK", "CLASSIFY", "IMPORT", "ENRICH", "EMBED", "RENDER", "COMPOSE", "EMBED_GUIDE"]>;
export type BuildPhase = z.infer<typeof BuildPhaseSchema>;
export declare const BuildPhaseStatusSchema: z.ZodEnum<["success", "success_cached", "warning", "skipped", "failed", "not_run"]>;
export type BuildPhaseStatus = z.infer<typeof BuildPhaseStatusSchema>;
export declare const LLMCallTelemetrySchema: z.ZodObject<{
    attempts: z.ZodOptional<z.ZodNumber>;
    retry_delays_ms: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
    input_tokens: z.ZodOptional<z.ZodNumber>;
    output_tokens: z.ZodOptional<z.ZodNumber>;
    estimated_cost_usd: z.ZodOptional<z.ZodNumber>;
    actual_cost_usd: z.ZodOptional<z.ZodNumber>;
    cost_variance_pct: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    input_tokens?: number | undefined;
    output_tokens?: number | undefined;
    estimated_cost_usd?: number | undefined;
    cost_variance_pct?: number | undefined;
    attempts?: number | undefined;
    retry_delays_ms?: number[] | undefined;
    actual_cost_usd?: number | undefined;
}, {
    input_tokens?: number | undefined;
    output_tokens?: number | undefined;
    estimated_cost_usd?: number | undefined;
    cost_variance_pct?: number | undefined;
    attempts?: number | undefined;
    retry_delays_ms?: number[] | undefined;
    actual_cost_usd?: number | undefined;
}>;
export declare const BuildProvenanceEntrySchema: z.ZodEffects<z.ZodObject<{
    build_id: z.ZodString;
    phase: z.ZodEnum<["INIT_CHECK", "CLASSIFY", "IMPORT", "ENRICH", "EMBED", "RENDER", "COMPOSE", "EMBED_GUIDE"]>;
    started_at: z.ZodString;
    finished_at: z.ZodString;
    status: z.ZodEnum<["success", "success_cached", "warning", "skipped", "failed", "not_run"]>;
    input_hashes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    model_snapshot: z.ZodOptional<z.ZodString>;
    llm_call: z.ZodOptional<z.ZodObject<{
        attempts: z.ZodOptional<z.ZodNumber>;
        retry_delays_ms: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        input_tokens: z.ZodOptional<z.ZodNumber>;
        output_tokens: z.ZodOptional<z.ZodNumber>;
        estimated_cost_usd: z.ZodOptional<z.ZodNumber>;
        actual_cost_usd: z.ZodOptional<z.ZodNumber>;
        cost_variance_pct: z.ZodOptional<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        input_tokens?: number | undefined;
        output_tokens?: number | undefined;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
        attempts?: number | undefined;
        retry_delays_ms?: number[] | undefined;
        actual_cost_usd?: number | undefined;
    }, {
        input_tokens?: number | undefined;
        output_tokens?: number | undefined;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
        attempts?: number | undefined;
        retry_delays_ms?: number[] | undefined;
        actual_cost_usd?: number | undefined;
    }>>;
    outputs: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    skipped_reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    failed_reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    next_hint: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strict", z.ZodTypeAny, {
    status: "skipped" | "failed" | "success" | "success_cached" | "warning" | "not_run";
    build_id: string;
    started_at: string;
    phase: "IMPORT" | "ENRICH" | "RENDER" | "CLASSIFY" | "INIT_CHECK" | "EMBED" | "COMPOSE" | "EMBED_GUIDE";
    finished_at: string;
    warnings?: string[] | undefined;
    input_hashes?: Record<string, string> | undefined;
    outputs?: Record<string, unknown> | undefined;
    model_snapshot?: string | undefined;
    skipped_reason?: string | null | undefined;
    llm_call?: {
        input_tokens?: number | undefined;
        output_tokens?: number | undefined;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
        attempts?: number | undefined;
        retry_delays_ms?: number[] | undefined;
        actual_cost_usd?: number | undefined;
    } | undefined;
    failed_reason?: string | null | undefined;
    next_hint?: string | null | undefined;
}, {
    status: "skipped" | "failed" | "success" | "success_cached" | "warning" | "not_run";
    build_id: string;
    started_at: string;
    phase: "IMPORT" | "ENRICH" | "RENDER" | "CLASSIFY" | "INIT_CHECK" | "EMBED" | "COMPOSE" | "EMBED_GUIDE";
    finished_at: string;
    warnings?: string[] | undefined;
    input_hashes?: Record<string, string> | undefined;
    outputs?: Record<string, unknown> | undefined;
    model_snapshot?: string | undefined;
    skipped_reason?: string | null | undefined;
    llm_call?: {
        input_tokens?: number | undefined;
        output_tokens?: number | undefined;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
        attempts?: number | undefined;
        retry_delays_ms?: number[] | undefined;
        actual_cost_usd?: number | undefined;
    } | undefined;
    failed_reason?: string | null | undefined;
    next_hint?: string | null | undefined;
}>, {
    status: "skipped" | "failed" | "success" | "success_cached" | "warning" | "not_run";
    build_id: string;
    started_at: string;
    phase: "IMPORT" | "ENRICH" | "RENDER" | "CLASSIFY" | "INIT_CHECK" | "EMBED" | "COMPOSE" | "EMBED_GUIDE";
    finished_at: string;
    warnings?: string[] | undefined;
    input_hashes?: Record<string, string> | undefined;
    outputs?: Record<string, unknown> | undefined;
    model_snapshot?: string | undefined;
    skipped_reason?: string | null | undefined;
    llm_call?: {
        input_tokens?: number | undefined;
        output_tokens?: number | undefined;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
        attempts?: number | undefined;
        retry_delays_ms?: number[] | undefined;
        actual_cost_usd?: number | undefined;
    } | undefined;
    failed_reason?: string | null | undefined;
    next_hint?: string | null | undefined;
}, {
    status: "skipped" | "failed" | "success" | "success_cached" | "warning" | "not_run";
    build_id: string;
    started_at: string;
    phase: "IMPORT" | "ENRICH" | "RENDER" | "CLASSIFY" | "INIT_CHECK" | "EMBED" | "COMPOSE" | "EMBED_GUIDE";
    finished_at: string;
    warnings?: string[] | undefined;
    input_hashes?: Record<string, string> | undefined;
    outputs?: Record<string, unknown> | undefined;
    model_snapshot?: string | undefined;
    skipped_reason?: string | null | undefined;
    llm_call?: {
        input_tokens?: number | undefined;
        output_tokens?: number | undefined;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
        attempts?: number | undefined;
        retry_delays_ms?: number[] | undefined;
        actual_cost_usd?: number | undefined;
    } | undefined;
    failed_reason?: string | null | undefined;
    next_hint?: string | null | undefined;
}>;
export type BuildProvenanceEntry = z.infer<typeof BuildProvenanceEntrySchema>;
//# sourceMappingURL=build-provenance.d.ts.map