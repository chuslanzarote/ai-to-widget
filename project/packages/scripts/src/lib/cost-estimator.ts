import { CostEstimateSchema } from "./types.js";
import {
  MODEL_PRICING,
  type ModelSnapshot,
  type PricingEntry,
} from "./pricing.js";

export interface CostEstimateInput {
  entityCounts: Record<string, number>;
  perEntityMultiplier?: number;
  perCallCostUsd?: number;
  retryBufferRatio?: number;
}

export interface CostEstimate {
  enrichmentCalls: number;
  perCallCostUsd: number;
  totalCostUsd: number;
  retryBufferUsd: number;
}

export interface CostEstimateBreakdown extends CostEstimate {
  byEntity: Array<{
    entity: string;
    count: number;
    calls: number;
    subtotalUsd: number;
  }>;
  perEntityMultiplier: number;
  retryBufferRatio: number;
}

export const COST_CONSTANTS = {
  perEntityMultiplier: 1,
  perCallCostUsd: 0.03,
  retryBufferRatio: 0.2,
} as const;

export function estimateCost(input: CostEstimateInput): CostEstimateBreakdown {
  const multiplier = input.perEntityMultiplier ?? COST_CONSTANTS.perEntityMultiplier;
  const perCall = input.perCallCostUsd ?? COST_CONSTANTS.perCallCostUsd;
  const buffer = input.retryBufferRatio ?? COST_CONSTANTS.retryBufferRatio;

  if (multiplier < 0) throw new Error("perEntityMultiplier must be >= 0");
  if (perCall < 0) throw new Error("perCallCostUsd must be >= 0");
  if (buffer < 0) throw new Error("retryBufferRatio must be >= 0");

  const byEntity = Object.entries(input.entityCounts).map(([entity, count]) => {
    if (!Number.isFinite(count) || count < 0 || !Number.isInteger(count)) {
      throw new Error(`entity count for "${entity}" must be a non-negative integer`);
    }
    const calls = count * multiplier;
    return {
      entity,
      count,
      calls,
      subtotalUsd: round2(calls * perCall),
    };
  });

  const enrichmentCalls = byEntity.reduce((sum, b) => sum + b.calls, 0);
  const subtotal = byEntity.reduce((sum, b) => sum + b.subtotalUsd, 0);
  const retryBufferUsd = round2(subtotal * buffer);
  const totalCostUsd = round2(subtotal + retryBufferUsd);

  const estimate = {
    enrichmentCalls,
    perCallCostUsd: perCall,
    totalCostUsd,
    retryBufferUsd,
    byEntity,
    perEntityMultiplier: multiplier,
    retryBufferRatio: buffer,
  };

  CostEstimateSchema.parse({
    enrichmentCalls,
    perCallCostUsd: perCall,
    totalCostUsd,
    retryBufferUsd,
  });

  return estimate;
}

export function formatCostBreakdown(e: CostEstimateBreakdown): string {
  const subtotal = round2(e.totalCostUsd - e.retryBufferUsd);
  return [
    `Enrichment calls:     ${e.enrichmentCalls}`,
    `Per-call cost (USD):  ${e.perCallCostUsd.toFixed(4)}`,
    `Subtotal (USD):       ${subtotal.toFixed(2)}`,
    `Retry buffer (USD):   ${e.retryBufferUsd.toFixed(2)}  (+${Math.round(e.retryBufferRatio * 100)}%)`,
    `Estimated total:      ${e.totalCostUsd.toFixed(2)}`,
  ].join("\n");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ============================================================================
 * Feature 009 — Pre-call cost estimate (FR-006a, R5)
 *
 * Used by `/atw.build` to print the 2-second informational countdown
 * before an LLM call:
 *
 *   [CLASSIFY] OpenAPI: 14 operations | model: claude-opus-4-7 |
 *              est. cost: ~$0.07 (continuing in 2s, Ctrl+C to abort)
 *
 * Input tokens come from `messages.countTokens()` when an SDK client is
 * supplied; otherwise a `chars / 4` heuristic (we are pinned to SDK 0.27,
 * which does not expose `countTokens`). Output tokens are projected from
 * the in-scope operation count using the spec's `100 tokens/operation`
 * rule of thumb. The actual cost recorded post-call in build-provenance
 * is the source of truth — this is just a pre-flight estimate.
 * ========================================================================= */

export interface LlmCallEstimateInput {
  bundledOpenapi: string;
  projectMd: string;
  operationCount: number;
  modelSnapshot: ModelSnapshot;
  systemPrompt?: string;
  client?: {
    messages: {
      countTokens?: (args: {
        model: string;
        system?: string;
        messages: Array<{ role: "user"; content: string }>;
      }) => Promise<{ input_tokens: number }>;
    };
  };
}

export interface LlmCallEstimateResult {
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  pricing: PricingEntry;
  /** True when the chars/4 heuristic was used. */
  approximate: boolean;
}

const OUTPUT_TOKENS_PER_OPERATION = 100;
const MIN_OUTPUT_TOKENS = 200;

export async function estimateLlmCallCost(
  input: LlmCallEstimateInput,
): Promise<LlmCallEstimateResult> {
  const pricing = MODEL_PRICING[input.modelSnapshot];
  if (!pricing) {
    throw new Error(`estimateLlmCallCost: unknown model_snapshot ${input.modelSnapshot}`);
  }

  const userMessage = `${input.projectMd}\n\n${input.bundledOpenapi}`;
  let inputTokens: number;
  let approximate = false;

  if (input.client?.messages?.countTokens) {
    try {
      const res = await input.client.messages.countTokens({
        model: input.modelSnapshot,
        system: input.systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });
      inputTokens = res.input_tokens;
    } catch {
      inputTokens = approximateTokenCount(userMessage, input.systemPrompt);
      approximate = true;
    }
  } else {
    inputTokens = approximateTokenCount(userMessage, input.systemPrompt);
    approximate = true;
  }

  const outputTokens = Math.max(
    MIN_OUTPUT_TOKENS,
    input.operationCount * OUTPUT_TOKENS_PER_OPERATION,
  );

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  const estimatedCostUsd = roundUsdHundredth(inputCost + outputCost);

  return {
    estimatedCostUsd,
    inputTokens,
    outputTokens,
    pricing,
    approximate,
  };
}

function approximateTokenCount(userMessage: string, systemPrompt?: string): number {
  return Math.ceil(((systemPrompt?.length ?? 0) + userMessage.length) / 4);
}

function roundUsdHundredth(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function formatPreCallAnnouncement(opts: {
  phase: string;
  operationCount: number;
  modelSnapshot: ModelSnapshot;
  estimate: LlmCallEstimateResult;
}): string {
  const cost = opts.estimate.estimatedCostUsd.toFixed(2);
  return `[${opts.phase}] OpenAPI: ${opts.operationCount} operations | model: ${opts.modelSnapshot} | est. cost: ~$${cost} (continuing in 2s, Ctrl+C to abort)`;
}

/**
 * 2-second informational countdown (FR-006a, Q5). Resolves after `delayMs`;
 * never prompts. Ctrl+C interrupts the entire process — no special handling
 * needed here.
 */
export async function preCallCountdown(delayMs = 2000): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
