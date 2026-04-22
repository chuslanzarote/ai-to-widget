/**
 * Admin-namespace detection (FR-029).
 *
 * Operations that look like back-office / staff-only endpoints should be
 * excluded from the agent manifest by default. The Builder can always
 * override during interactive review, but the default must shield the
 * end-user agent from management surfaces.
 *
 * Signals, in rough order of confidence:
 *   1. Path prefix `/admin/*` or `/admin-*`.
 *   2. The operation or its path-item carries `x-admin: true` (or any
 *      truthy `x-admin-*` vendor extension).
 *   3. The operation's tag is literally `admin` or begins with `admin.`.
 *   4. The operation requires an admin-only security scheme — one whose
 *      name contains "admin" (e.g. `adminKey`, `adminBearer`).
 */
const ADMIN_PATH_RX = /(^|\/)admin(\/|-|$)/i;
const ADMIN_TAG_RX = /^admin(\.|$)/i;
const ADMIN_SCHEME_RX = /admin/i;
export function detectAdminOperations(parsed, 
/** Raw OpenAPI document (dereferenced) — needed to read `x-admin` vendor extensions. */
raw) {
    const flags = [];
    const rawPaths = extractRawPaths(raw);
    for (const op of parsed.operations) {
        const flag = classifyOperation(op, rawPaths);
        if (flag)
            flags.push(flag);
    }
    return flags;
}
function classifyOperation(op, rawPaths) {
    if (ADMIN_PATH_RX.test(op.path)) {
        return { operationId: op.id, path: op.path, reason: "path-prefix" };
    }
    if (op.tag && ADMIN_TAG_RX.test(op.tag)) {
        return { operationId: op.id, path: op.path, reason: "tag" };
    }
    for (const sec of op.security) {
        if (ADMIN_SCHEME_RX.test(sec.scheme)) {
            return { operationId: op.id, path: op.path, reason: "security-scheme" };
        }
    }
    const rawOp = lookupRawOperation(rawPaths, op.path, op.method);
    if (rawOp && hasAdminVendorExtension(rawOp)) {
        return { operationId: op.id, path: op.path, reason: "vendor-extension" };
    }
    return null;
}
function extractRawPaths(raw) {
    const out = new Map();
    if (!raw || typeof raw !== "object")
        return out;
    const paths = raw.paths;
    if (!paths)
        return out;
    for (const [p, item] of Object.entries(paths)) {
        if (item && typeof item === "object")
            out.set(p, item);
    }
    return out;
}
function lookupRawOperation(rawPaths, path, method) {
    const item = rawPaths.get(path);
    if (!item)
        return null;
    const op = item[method.toLowerCase()];
    return op && typeof op === "object" ? op : null;
}
function hasAdminVendorExtension(op) {
    for (const key of Object.keys(op)) {
        if (!key.startsWith("x-"))
            continue;
        if (key.toLowerCase().startsWith("x-admin")) {
            const val = op[key];
            if (val === true || (typeof val === "string" && val.length > 0))
                return true;
        }
    }
    return false;
}
//# sourceMappingURL=admin-detection.js.map