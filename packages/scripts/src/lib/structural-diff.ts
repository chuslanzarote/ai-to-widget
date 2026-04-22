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
export function diffByKey<T>(
  before: readonly T[],
  after: readonly T[],
  options: DiffOptions<T>,
): StructuralDiff<T> {
  const beforeByKey = new Map<string, T>();
  for (const item of before) {
    beforeByKey.set(options.keyFn(item), item);
  }
  const afterByKey = new Map<string, T>();
  for (const item of after) {
    afterByKey.set(options.keyFn(item), item);
  }

  const added: T[] = [];
  const removed: T[] = [];
  const modified: StructuralDiff<T>["modified"] = [];

  for (const [key, afterItem] of afterByKey) {
    const beforeItem = beforeByKey.get(key);
    if (beforeItem === undefined) {
      added.push(afterItem);
      continue;
    }
    const changedFields = options.compareFn
      ? options.compareFn(beforeItem, afterItem)
      : deepEqual(beforeItem, afterItem)
        ? []
        : ["<any>"];
    if (changedFields.length > 0) {
      modified.push({ before: beforeItem, after: afterItem, changedFields });
    }
  }

  for (const [key, beforeItem] of beforeByKey) {
    if (!afterByKey.has(key)) {
      removed.push(beforeItem);
    }
  }

  return { added, removed, modified };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao).sort();
  const bKeys = Object.keys(bo).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    if (!deepEqual(ao[aKeys[i]], bo[bKeys[i]])) return false;
  }
  return true;
}
