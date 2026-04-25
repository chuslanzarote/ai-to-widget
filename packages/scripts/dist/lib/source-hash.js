import { createHash } from "node:crypto";
/**
 * Canonical JSON serialization: sort keys alphabetically at every level,
 * emit no whitespace. Produces bit-identical output for structurally equal
 * values, enabling stable hashing.
 *
 * Contract: contracts/enrichment.md §4
 */
export function canonicalJson(value) {
    if (value === null)
        return "null";
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error(`canonicalJson: non-finite number ${String(value)}`);
        }
        return JSON.stringify(value);
    }
    if (typeof value === "string" || typeof value === "boolean") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return "[" + value.map((v) => canonicalJson(v)).join(",") + "]";
    }
    if (typeof value === "object") {
        const entries = Object.entries(value);
        entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return ("{" +
            entries.map(([k, v]) => JSON.stringify(k) + ":" + canonicalJson(v)).join(",") +
            "}");
    }
    if (typeof value === "undefined") {
        throw new Error("canonicalJson: undefined is not representable in JSON");
    }
    throw new Error(`canonicalJson: unsupported type ${typeof value}`);
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
export function computeSourceHash(input) {
    const canonical = canonicalJson(input.assembledWithoutMetadata);
    const h = createHash("sha256");
    h.update(canonical, "utf8");
    h.update("\0", "utf8");
    h.update(input.promptTemplateVersion, "utf8");
    h.update("\0", "utf8");
    h.update(input.modelId, "utf8");
    return "sha256:" + h.digest("hex");
}
/**
 * Strip `metadata` from an AssembledEntityInput before feeding it to the
 * hash. `metadata.assembled_at` changes every run; excluding it is what
 * makes the hash stable across assembling the same entity twice.
 */
export function stripMetadataForHash(input) {
    const copy = { ...input };
    delete copy.metadata;
    return copy;
}
//# sourceMappingURL=source-hash.js.map