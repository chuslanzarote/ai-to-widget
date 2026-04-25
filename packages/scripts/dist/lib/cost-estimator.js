import { CostEstimateSchema } from "./types.js";
import { MODEL_PRICING, } from "./pricing.js";
export const COST_CONSTANTS = {
    perEntityMultiplier: 1,
    perCallCostUsd: 0.03,
    retryBufferRatio: 0.2,
};
export function estimateCost(input) {
    const multiplier = input.perEntityMultiplier ?? COST_CONSTANTS.perEntityMultiplier;
    const perCall = input.perCallCostUsd ?? COST_CONSTANTS.perCallCostUsd;
    const buffer = input.retryBufferRatio ?? COST_CONSTANTS.retryBufferRatio;
    if (multiplier < 0)
        throw new Error("perEntityMultiplier must be >= 0");
    if (perCall < 0)
        throw new Error("perCallCostUsd must be >= 0");
    if (buffer < 0)
        throw new Error("retryBufferRatio must be >= 0");
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
export function formatCostBreakdown(e) {
    const subtotal = round2(e.totalCostUsd - e.retryBufferUsd);
    return [
        `Enrichment calls:     ${e.enrichmentCalls}`,
        `Per-call cost (USD):  ${e.perCallCostUsd.toFixed(4)}`,
        `Subtotal (USD):       ${subtotal.toFixed(2)}`,
        `Retry buffer (USD):   ${e.retryBufferUsd.toFixed(2)}  (+${Math.round(e.retryBufferRatio * 100)}%)`,
        `Estimated total:      ${e.totalCostUsd.toFixed(2)}`,
    ].join("\n");
}
function round2(n) {
    return Math.round(n * 100) / 100;
}
const OUTPUT_TOKENS_PER_OPERATION = 100;
const MIN_OUTPUT_TOKENS = 200;
export async function estimateLlmCallCost(input) {
    const pricing = MODEL_PRICING[input.modelSnapshot];
    if (!pricing) {
        throw new Error(`estimateLlmCallCost: unknown model_snapshot ${input.modelSnapshot}`);
    }
    const userMessage = `${input.projectMd}\n\n${input.bundledOpenapi}`;
    let inputTokens;
    let approximate = false;
    if (input.client?.messages?.countTokens) {
        try {
            const res = await input.client.messages.countTokens({
                model: input.modelSnapshot,
                system: input.systemPrompt,
                messages: [{ role: "user", content: userMessage }],
            });
            inputTokens = res.input_tokens;
        }
        catch {
            inputTokens = approximateTokenCount(userMessage, input.systemPrompt);
            approximate = true;
        }
    }
    else {
        inputTokens = approximateTokenCount(userMessage, input.systemPrompt);
        approximate = true;
    }
    const outputTokens = Math.max(MIN_OUTPUT_TOKENS, input.operationCount * OUTPUT_TOKENS_PER_OPERATION);
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
function approximateTokenCount(userMessage, systemPrompt) {
    return Math.ceil(((systemPrompt?.length ?? 0) + userMessage.length) / 4);
}
function roundUsdHundredth(value) {
    return Math.round(value * 10000) / 10000;
}
export function formatPreCallAnnouncement(opts) {
    const cost = opts.estimate.estimatedCostUsd.toFixed(2);
    return `[${opts.phase}] OpenAPI: ${opts.operationCount} operations | model: ${opts.modelSnapshot} | est. cost: ~$${cost} (continuing in 2s, Ctrl+C to abort)`;
}
/**
 * 2-second informational countdown (FR-006a, Q5). Resolves after `delayMs`;
 * never prompts. Ctrl+C interrupts the entire process — no special handling
 * needed here.
 */
export async function preCallCountdown(delayMs = 2000) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
}
//# sourceMappingURL=cost-estimator.js.map