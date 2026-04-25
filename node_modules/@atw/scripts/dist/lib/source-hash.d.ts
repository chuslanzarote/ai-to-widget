/**
 * Canonical JSON serialization: sort keys alphabetically at every level,
 * emit no whitespace. Produces bit-identical output for structurally equal
 * values, enabling stable hashing.
 *
 * Contract: contracts/enrichment.md §4
 */
export declare function canonicalJson(value: unknown): string;
export interface SourceHashInput {
    /**
     * The assembled input *without* the volatile metadata block.
     * The caller must pass `input.primary_record + input.related + input.entity_type + input.entity_id`
     * (or equivalent) — NOT `input.metadata.assembled_at` / `input.metadata.assembler_version`,
     * which would churn the hash unnecessarily.
     */
    assembledWithoutMetadata: unknown;
    promptTemplateVersion: string;
    modelId: string;
}
/**
 * Compute the source hash that binds an atw_documents row to the exact input
 * and model that produced it. Any change to the input, the prompt template
 * version, or the model id invalidates the hash and forces re-enrichment.
 *
 * Contract: contracts/enrichment.md §4
 *
 * Format: `sha256:<hex>` — prefix matches the on-disk representation in
 * atw_documents.source_hash and in build-manifest.input_hashes.
 */
export declare function computeSourceHash(input: SourceHashInput): string;
/**
 * Strip `metadata` from an AssembledEntityInput before feeding it to the
 * hash. `metadata.assembled_at` changes every run; excluding it is what
 * makes the hash stable across assembling the same entity twice.
 */
export declare function stripMetadataForHash<T extends {
    metadata?: unknown;
}>(input: T): Omit<T, "metadata">;
//# sourceMappingURL=source-hash.d.ts.map