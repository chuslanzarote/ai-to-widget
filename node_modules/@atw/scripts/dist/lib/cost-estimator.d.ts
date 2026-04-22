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
//# sourceMappingURL=cost-estimator.d.ts.map