/**
 * Produce a 384-dimensional embedding via @xenova/transformers running
 * locally on CPU. The extractor is cached after the first load so callers
 * can invoke `embedText` many times in a loop without reloading weights.
 *
 * Contract: contracts/scripts.md §6, FR-062–FR-064.
 */
export declare function embedText(text: string, modelId?: string): Promise<number[]>;
export declare function clearExtractorCache(): void;
export declare function runEmbedText(argv: string[]): Promise<number>;
//# sourceMappingURL=embed-text.d.ts.map