/**
 * Structural enforcement of Principle V (Anchored Generation) per
 * contracts/enrichment.md §2. The validator is authoritative: if it
 * rejects a response, the orchestrator MUST NOT persist the claim.
 *
 * Rules are applied in order; first failure short-circuits:
 *
 *   1. invalid_shape          — JSON shape did not match EnrichmentResponse
 *   2. document_too_short     — trimmed document < 40 chars
 *   3. fact_missing_fields    — any fact missing claim/source
 *   4. source_not_in_input    — source not in flattened input keys
 *   5. unknown_category_label — category label absent from vocabulary
 *
 * `insufficient_data` branch is always accepted (§2.6).
 */
import { type AssembledEntityInput, type EnrichmentResponse } from "./types.js";
export type ValidatorRule = "invalid_shape" | "document_too_short" | "fact_missing_fields" | "source_not_in_input" | "unknown_category_label";
export type ValidatorResult = {
    ok: true;
    response: EnrichmentResponse;
} | {
    ok: false;
    rule: ValidatorRule;
    detail: string;
};
export interface ValidatorOptions {
    rawResponse: unknown;
    input: AssembledEntityInput;
    /**
     * `entity_type → { category_key → allowed labels }` from build-plan.md.
     * When a vocabulary is missing for a given `(entity_type, category_key)`
     * pair, the rule is treated as "no constraint" (no rejection).
     */
    categoryVocabularies?: Record<string, Record<string, readonly string[]>>;
}
export declare function validateEnrichment(opts: ValidatorOptions): ValidatorResult;
//# sourceMappingURL=enrichment-validator.d.ts.map