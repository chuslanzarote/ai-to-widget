import { type ModelSnapshot, type PricingEntry } from "./pricing.js";
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
export declare const COST_CONSTANTS: {
    readonly perEntityMultiplier: 1;
    readonly perCallCostUsd: 0.03;
    readonly retryBufferRatio: 0.2;
};
export declare function estimateCost(input: CostEstimateInput): CostEstimateBreakdown;
export declare function formatCostBreakdown(e: CostEstimateBreakdown): string;
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
                messages: Array<{
                    role: "user";
                    content: string;
                }>;
            }) => Promise<{
                input_tokens: number;
            }>;
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
export declare function estimateLlmCallCost(input: LlmCallEstimateInput): Promise<LlmCallEstimateResult>;
export declare function formatPreCallAnnouncement(opts: {
    phase: string;
    operationCount: number;
    modelSnapshot: ModelSnapshot;
    estimate: LlmCallEstimateResult;
}): string;
/**
 * 2-second informational countdown (FR-006a, Q5). Resolves after `delayMs`;
 * never prompts. Ctrl+C interrupts the entire process — no special handling
 * needed here.
 */
export declare function preCallCountdown(delayMs?: number): Promise<void>;
//# sourceMappingURL=cost-estimator.d.ts.map