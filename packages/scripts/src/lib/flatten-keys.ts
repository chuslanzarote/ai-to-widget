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
export function flattenKeys(value: unknown): Set<string> {
  const out = new Set<string>();
  walk(value, "", out);
  return out;
}

function walk(node: unknown, prefix: string, out: Set<string>): void {
  if (prefix) out.add(prefix);
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      walk(node[i], `${prefix}[${i}]`, out);
    }
    return;
  }
  if (typeof node === "object") {
    for (const k of Object.keys(node as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${k}` : k;
      walk((node as Record<string, unknown>)[k], next, out);
    }
  }
}
