import type { StructuralDiff } from "./types.js";
export interface DiffOptions<T> {
    /**
     * Extract the identity key for an item. Items with the same key in both
     * sides are candidates for "modified"; items present on only one side
     * are "added" / "removed".
     */
    keyFn: (item: T) => string;
    /**
     * Compare two items with the same key and return the list of changed
     * field names. An empty list means they are identical (and therefore
     * not reported as modified).
     */
    compareFn?: (before: T, after: T) => string[];
}
/**
 * Compute a structural diff between two lists of items keyed by
 * `keyFn`. Used for Level-2 change detection (FR-049): the LLM only
 * operates on `added + modified` items, never on the full set.
 */
export declare function diffByKey<T>(before: readonly T[], after: readonly T[], options: DiffOptions<T>): StructuralDiff<T>;
//# sourceMappingURL=structural-diff.d.ts.map