import { type AssembledEntityInput, type EnrichmentResponse } from "./lib/types.js";
import { type TokenUsage } from "./lib/pricing.js";
import { type ValidatorRule } from "./lib/enrichment-validator.js";
export declare const PROMPT_TEMPLATE_VERSION = "enrich-v1";
export declare const ENRICH_V1_SYSTEM = "You are an enrichment assistant for a retrieval-augmented AI widget.\nYou MUST ONLY use facts present in the structured input below. Every fact.source you emit MUST be a key in the input JSON. You MUST NOT invent facts not present in the input.\nRespond with ONE JSON object. Two shapes are valid:\n\n(A) kind: \"enriched\" with:\n- document: a single natural-language paragraph (>= 40 characters) describing the entity.\n- facts: a list of { claim, source } items where \"source\" is a dotted-key path into the input JSON.\n- categories: a record mapping category axis -> list of string labels.\n\n(B) insufficient_data: true with \"reason\" when the input lacks enough signal.\n\nReturn no text other than the JSON object.";
export interface EnrichOptions {
    input: AssembledEntityInput;
    opusClient?: OpusClient;
    retryStrategy?: "aggressive" | "conservative";
    model?: string;
    systemPrompt?: string;
    apiKey?: string;
    categoryVocabularies?: Record<string, Record<string, readonly string[]>>;
    /**
     * When `true` (default), run the Principle V validator on the response
     * and retry once with a sharpening prompt on rejection. When `false`,
     * behave as the MVP path did: only zod-validate the shape.
     */
    anchorValidation?: boolean;
    /**
     * T099 / US9 — observer hook invoked for each HTTP status surfaced by
     * the SDK call path (via `callWithHttpRetries`). The orchestrator uses
     * this to track sustained 429 pressure and auto-reduce concurrency.
     * Fired exactly once per HTTP response — including retries.
     */
    onHttpStatus?: (status: number) => void;
}
export interface OpusCallResult {
    response: EnrichmentResponse;
    tokens: TokenUsage;
    costUsd: number;
    promptTemplateVersion: string;
    modelId: string;
    /** Set when the validator rejected the response twice and we gave up. */
    validationFailedTwice?: true;
    /** The rule that failed on the first rejection (and second, if present). */
    rejectedRules?: ValidatorRule[];
}
/**
 * Subset of the Anthropic SDK surface we consume. Lets tests inject a
 * fake client without pulling in the real SDK.
 */
export interface OpusClient {
    createMessage(args: {
        model: string;
        system: string;
        user: string;
    }): Promise<{
        contentText: string;
        usage: {
            input_tokens: number;
            output_tokens: number;
        };
    }>;
}
/**
 * Full enrichment path: one Opus call, parse JSON, zod-validate shape, then
 * apply the Principle V structural validator. On rejection, invoke a
 * sharpening retry with the offending rule cited. A second rejection flags
 * the entity as `validation_failed_twice`; the orchestrator skips it.
 *
 * When `anchorValidation: false`, behaves as the MVP path did: a parse
 * failure or shape mismatch throws `OPUS_INVALID_JSON` / `VALIDATION_FAILED`.
 *
 * Contract: contracts/scripts.md §5, contracts/enrichment.md §§1, 2, 3.
 */
export declare function enrichEntity(opts: EnrichOptions): Promise<OpusCallResult>;
/**
 * Render the sharpening follow-up prompt as a JSON-wrapped user message.
 * Opus ignores the sugar; the important bits are the rule name and the
 * offending string. We keep this inline (no Handlebars engine) because the
 * template is tiny and the engine would pull a dep into orchestrator land.
 */
export declare function buildSharpeningUser(originalUser: string, rule: ValidatorRule, detail: string, input?: AssembledEntityInput): string;
export declare function defaultOpusClient(_model: string, apiKey?: string): Promise<OpusClient>;
/**
 * T078 / US6 — HTTP failure-mode matrix (enrichment.md §5).
 *
 *   200  → pass through.
 *   400  → throw `OPUS_400` once, orchestrator flags the entity.
 *   401/403 → throw `OPUS_AUTH` once, orchestrator halts (FR-085).
 *   408/409 → retry once with jittered delay, then throw.
 *   429  → exponential backoff (base 1 s, max 32 s, ±25 % jitter),
 *          up to 3 attempts, then throw `OPUS_RATE_LIMIT`.
 *   5xx  → retry once, second failure throws `OPUS_5XX_TWICE`.
 *
 * The orchestrator layer is responsible for 429-triggered auto-reduce
 * of `--concurrency` (US9 / T099) — this wrapper handles per-call
 * backoff only.
 */
export declare function callWithHttpRetries<T>(fn: () => Promise<T>, opts?: {
    /** Overridable for tests */
    sleep?: (ms: number) => Promise<void>;
    rng?: () => number;
    /** T099 — fired for every observed HTTP status (success or error). */
    onHttpStatus?: (status: number) => void;
}): Promise<T>;
export declare function runEnrichEntity(argv: string[]): Promise<number>;
//# sourceMappingURL=enrich-entity.d.ts.map