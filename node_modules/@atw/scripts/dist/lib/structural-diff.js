/**
 * Compute a structural diff between two lists of items keyed by
 * `keyFn`. Used for Level-2 change detection (FR-049): the LLM only
 * operates on `added + modified` items, never on the full set.
 */
export function diffByKey(before, after, options) {
    const beforeByKey = new Map();
    for (const item of before) {
        beforeByKey.set(options.keyFn(item), item);
    }
    const afterByKey = new Map();
    for (const item of after) {
        afterByKey.set(options.keyFn(item), item);
    }
    const added = [];
    const removed = [];
    const modified = [];
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
function deepEqual(a, b) {
    if (a === b)
        return true;
    if (a === null || b === null)
        return false;
    if (typeof a !== typeof b)
        return false;
    if (typeof a !== "object")
        return false;
    if (Array.isArray(a) !== Array.isArray(b))
        return false;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i]))
                return false;
        }
        return true;
    }
    const ao = a;
    const bo = b;
    const aKeys = Object.keys(ao).sort();
    const bKeys = Object.keys(bo).sort();
    if (aKeys.length !== bKeys.length)
        return false;
    for (let i = 0; i < aKeys.length; i++) {
        if (aKeys[i] !== bKeys[i])
            return false;
        if (!deepEqual(ao[aKeys[i]], bo[bKeys[i]]))
            return false;
    }
    return true;
}
//# sourceMappingURL=structural-diff.js.map