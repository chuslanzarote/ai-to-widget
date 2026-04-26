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
import {
  EnrichmentResponseSchema,
  type AssembledEntityInput,
  type EnrichmentResponse,
} from "./types.js";
import { flattenKeys } from "./flatten-keys.js";

export type ValidatorRule =
  | "invalid_shape"
  | "document_too_short"
  | "fact_missing_fields"
  | "source_not_in_input"
  | "unknown_category_label";

export type ValidatorResult =
  | { ok: true; response: EnrichmentResponse }
  | { ok: false; rule: ValidatorRule; detail: string };

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

const DOC_MIN_CHARS = 40;

export function validateEnrichment(opts: ValidatorOptions): ValidatorResult {
  // Rule 1: invalid_shape
  const zodRes = EnrichmentResponseSchema.safeParse(opts.rawResponse);
  if (!zodRes.success) {
    return {
      ok: false,
      rule: "invalid_shape",
      detail: zodRes.error.issues[0]?.message ?? "shape mismatch",
    };
  }
  const resp = zodRes.data;
  if ("insufficient_data" in resp) return { ok: true, response: resp };

  // Rule 2: document_too_short
  if (resp.document.trim().length < DOC_MIN_CHARS) {
    return {
      ok: false,
      rule: "document_too_short",
      detail: `document is ${resp.document.trim().length} chars, needs ≥ ${DOC_MIN_CHARS}`,
    };
  }

  // Rule 3: fact_missing_fields — zod already enforces min(1) on both,
  // but defend against future schema loosening / empty arrays of length 0
  // (an empty facts array is NOT a violation per schema; tested by §2.3
  // only when entries are present).
  for (const f of resp.facts) {
    if (!f.claim || !f.source) {
      return {
        ok: false,
        rule: "fact_missing_fields",
        detail: "fact missing claim or source",
      };
    }
  }

  // Rule 4: source_not_in_input (Principle V core)
  const allowed = flattenKeys(opts.input);
  for (const f of resp.facts) {
    if (!allowed.has(f.source)) {
      return {
        ok: false,
        rule: "source_not_in_input",
        detail: `source "${f.source}" is not a key in the flattened input`,
      };
    }
  }

  // Rule 5: unknown_category_label
  const vocab = opts.categoryVocabularies?.[opts.input.entity_type];
  if (vocab) {
    for (const [cat, labels] of Object.entries(resp.categories)) {
      const allowedLabels = vocab[cat];
      if (!allowedLabels) continue;
      const allowedSet = new Set(allowedLabels);
      for (const lbl of labels) {
        if (!allowedSet.has(lbl)) {
          return {
            ok: false,
            rule: "unknown_category_label",
            detail: `category "${cat}" received unknown label "${lbl}"`,
          };
        }
      }
    }
  }

  return { ok: true, response: resp };
}
