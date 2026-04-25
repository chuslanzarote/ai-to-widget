/**
 * Flatten a JSON value into the set of dotted-path keys Opus is allowed to
 * cite in `fact.source`. Per contracts/enrichment.md §2.4:
 *
 *   - Objects:        parent.child
 *   - Arrays:         parent[0].child, parent[1].child, ...
 *   - Leaf primitives contribute their containing key only.
 *
 * The returned set includes every intermediate path (so `primary_record`
 * and `primary_record.title` are both valid sources) and every leaf path.
 * Arrays contribute both the container path (`related`) and each indexed
 * path (`related[0]`, `related[0].relation`, ...).
 */
export declare function flattenKeys(value: unknown): Set<string>;
//# sourceMappingURL=flatten-keys.d.ts.map