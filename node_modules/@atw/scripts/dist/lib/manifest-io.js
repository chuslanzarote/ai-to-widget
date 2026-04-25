import { openSync, fsyncSync, renameSync, closeSync, writeSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { BuildManifestSchema } from "./types.js";
/**
 * Atomic JSON writer for build-manifest.json.
 *
 * Contract: contracts/manifest.md §3
 *
 *   1. Serialize with stable key order and 2-space indent
 *   2. Write to <target>.tmp
 *   3. fsync the temp file
 *   4. rename over the target
 *   5. fsync the parent directory
 *
 * On any failure the existing manifest (if any) is preserved.
 * A crashed write leaves either the previous file or no file at all.
 */
export function writeManifestAtomic(targetPath, manifest) {
    BuildManifestSchema.parse(manifest);
    const serialized = stableStringify(manifest);
    const dir = dirname(targetPath);
    mkdirSync(dir, { recursive: true });
    const tmpPath = targetPath + ".tmp";
    const fd = openSync(tmpPath, "w");
    try {
        writeSync(fd, serialized);
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
    renameSync(tmpPath, targetPath);
    // fsync the parent directory so the rename is durable.
    try {
        const dirFd = openSync(dir, "r");
        try {
            fsyncSync(dirFd);
        }
        finally {
            closeSync(dirFd);
        }
    }
    catch {
        // Windows does not support fsync on a directory; that is acceptable —
        // the file rename is still atomic on NTFS.
    }
}
export function readManifest(targetPath) {
    if (!existsSync(targetPath))
        return null;
    const raw = readFileSync(targetPath, "utf8");
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    return BuildManifestSchema.parse(migrated);
}
/**
 * Forward-compatible migrator. Given an unknown manifest shape (possibly
 * from an older schema_version), upconvert to the current shape.
 *
 * For schema_version === "1" (the current version) this is the identity.
 * Future versions add cases.
 */
export function migrate(raw) {
    if (!raw || typeof raw !== "object")
        return raw;
    const m = raw;
    const version = m["schema_version"];
    switch (version) {
        case "1":
            return raw;
        default:
            return raw;
    }
}
/**
 * Serialize with stable key order: keys are emitted in the order they
 * appear in the object, which for freshly-constructed manifests matches
 * the declaration order in BuildManifestSchema. For round-trip safety
 * we also sort string-keyed objects deep-first to avoid ordering drift.
 */
function stableStringify(value) {
    return JSON.stringify(orderObjectKeys(value), null, 2);
}
function orderObjectKeys(value) {
    if (value === null || typeof value !== "object")
        return value;
    if (Array.isArray(value))
        return value.map(orderObjectKeys);
    const entries = Object.entries(value);
    // Preserve the manifest's natural top-level order by NOT sorting the
    // top-level keys; but sort record-valued objects (like input_hashes)
    // so two builds with the same content produce byte-identical output.
    // Rule: objects tagged with known top-level keys keep insertion order;
    // other plain string-keyed objects are sorted.
    const knownRoots = new Set([
        "schema_version",
        "build_id",
        "started_at",
        "completed_at",
        "duration_seconds",
        "result",
        "totals",
        "failures",
        "opus",
        "concurrency",
        "input_hashes",
        "outputs",
        "environment",
        "compliance_scan",
    ]);
    const isManifestRoot = entries.every(([k]) => knownRoots.has(k));
    if (!isManifestRoot) {
        entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    }
    const out = {};
    for (const [k, v] of entries) {
        out[k] = orderObjectKeys(v);
    }
    return out;
}
/**
 * Default path inside a project's .atw/state directory.
 */
export function defaultManifestPath(projectRoot) {
    return join(projectRoot, ".atw", "state", "build-manifest.json");
}
/* ============================================================================
 * Feature 009 — Action manifest round-trip (FR-007, FR-008)
 *
 * The action manifest at `.atw/artifacts/action-manifest.md` is YAML
 * frontmatter (machine-readable, validated against the Feature 009 zod
 * schema) + markdown body (prose, free-form). gray-matter handles the
 * round-trip; the schema check happens on write.
 * ========================================================================= */
import grayMatter from "gray-matter";
import { ActionManifestSchema, } from "./schemas/action-manifest.js";
export class ActionManifestValidationError extends Error {
    issues;
    constructor(message, issues) {
        super(message);
        this.issues = issues;
        this.name = "ActionManifestValidationError";
    }
}
export function readActionManifest(targetPath) {
    const raw = readFileSync(targetPath, "utf8");
    const parsed = grayMatter(raw);
    const result = ActionManifestSchema.safeParse(parsed.data);
    if (!result.success) {
        const issues = result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
        }));
        throw new ActionManifestValidationError(`action-manifest.md frontmatter failed schema validation`, issues);
    }
    return { manifest: result.data, body: parsed.content };
}
export function writeActionManifest(targetPath, manifest, body = "") {
    const result = ActionManifestSchema.safeParse(manifest);
    if (!result.success) {
        const issues = result.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
        }));
        throw new ActionManifestValidationError("action-manifest payload failed schema validation before write", issues);
    }
    const serialized = grayMatter.stringify(body, result.data);
    mkdirSync(dirname(targetPath), { recursive: true });
    const tmp = targetPath + ".tmp";
    const fd = openSync(tmp, "w");
    try {
        writeSync(fd, serialized);
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
    renameSync(tmp, targetPath);
}
//# sourceMappingURL=manifest-io.js.map