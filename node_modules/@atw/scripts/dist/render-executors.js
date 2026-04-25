/**
 * Feature 006 — T057: render `.atw/artifacts/action-executors.json`.
 *
 * Consumes a validated `ActionManifest` and produces the declarative
 * execution catalog the widget loads at init. Enforces the
 * no-dynamic-code posture (SC-006) via the Zod schema in
 * `lib/action-executors-types.ts` and the 2-space canonical JSON
 * encoding that keeps byte-identity across machines (Principle VIII).
 *
 * Contract: specs/006-openapi-action-catalog/contracts/
 *   action-executors.schema.md §6.
 */
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { ActionExecutorEntrySchema, ActionExecutorsCatalogSchema, } from "./lib/action-executors-types.js";
/**
 * Feature 007 — `credentialSource` emission.
 *
 * When the source OpenAPI operation requires `bearerAuth`, the widget
 * needs to know where the token lives. v1 pins the localStorage key to
 * `shop_auth_token`; future features can thread a shop-specific value
 * through from `.atw/setup.yaml`.
 */
export const BEARER_AUTH_SCHEME = "bearerAuth";
export const DEFAULT_BEARER_STORAGE_KEY = "shop_auth_token";
export class UnsupportedSecuritySchemeError extends Error {
    code = "UNSUPPORTED_SECURITY_SCHEME";
    tool;
    scheme;
    constructor(tool, scheme) {
        super(`manifest entry "${tool}" declares security scheme "${scheme}" — only "${BEARER_AUTH_SCHEME}" is supported in v1`);
        this.name = "UnsupportedSecuritySchemeError";
        this.tool = tool;
        this.scheme = scheme;
    }
}
/* ============================================================================
 * Error classes
 * ========================================================================= */
/**
 * Thrown when a manifest entry's `source.path` carries a `{placeholder}`
 * for which `parameters.properties` has no matching key. Indicates a
 * broken manifest that would produce an un-callable executor. Mapped to
 * process exit 1 by the orchestrator.
 */
export class InvalidSubstitutionError extends Error {
    code = "INVALID_SUBSTITUTION";
    tool;
    identifier;
    constructor(tool, identifier, message) {
        super(message);
        this.name = "InvalidSubstitutionError";
        this.tool = tool;
        this.identifier = identifier;
    }
}
export async function renderExecutors(manifest, opts) {
    const warnings = [];
    const catalog = buildCatalog(manifest, opts, warnings);
    // Post-build Zod assertion — a shape violation here means this
    // renderer has a bug; bail loudly rather than write a malformed file
    // that the widget would later reject at load.
    const parsed = ActionExecutorsCatalogSchema.safeParse(catalog);
    if (!parsed.success) {
        throw new Error(`renderExecutors: post-build catalog failed schema validation: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    }
    const rendered = canonicaliseCatalog(parsed.data);
    let prior = null;
    try {
        prior = await fs.readFile(opts.outputPath, "utf8");
    }
    catch {
        prior = null;
    }
    let action;
    if (prior === null) {
        action = "created";
    }
    else if (prior === rendered) {
        action = "unchanged";
    }
    else {
        action = "rewritten";
        if (opts.backup) {
            await fs.writeFile(opts.outputPath + ".bak", prior, "utf8");
        }
    }
    if (action !== "unchanged") {
        await fs.writeFile(opts.outputPath, rendered, "utf8");
    }
    const buf = Buffer.from(rendered, "utf8");
    const sha256 = createHash("sha256").update(buf).digest("hex");
    return {
        path: opts.outputPath,
        sha256,
        bytes: buf.byteLength,
        action,
        warnings,
    };
}
/* ============================================================================
 * Catalog assembly
 * ========================================================================= */
function buildCatalog(manifest, opts, warnings) {
    const entries = manifest.included
        .map((e) => manifestEntryToExecutor(e, opts, warnings))
        .sort((a, b) => (a.tool < b.tool ? -1 : a.tool > b.tool ? 1 : 0));
    return {
        version: 1,
        credentialMode: "bearer-localstorage",
        actions: entries,
    };
}
function deriveCredentialSource(entry, authTokenKey) {
    const security = entry.source.security ?? [];
    if (security.length === 0)
        return undefined;
    for (const scheme of security) {
        if (scheme !== BEARER_AUTH_SCHEME) {
            throw new UnsupportedSecuritySchemeError(entry.toolName, scheme);
        }
    }
    return {
        type: "bearer-localstorage",
        key: authTokenKey && authTokenKey.length > 0 ? authTokenKey : DEFAULT_BEARER_STORAGE_KEY,
        header: "Authorization",
        scheme: "Bearer",
    };
}
function manifestEntryToExecutor(entry, opts, warnings) {
    const placeholders = extractPathPlaceholders(entry.source.path);
    const props = (entry.parameters.properties ?? {});
    const propNames = Object.keys(props);
    // Path bucket: every placeholder needs a matching property.
    const pathBucket = {};
    for (const ph of placeholders) {
        if (!(ph in props)) {
            throw new InvalidSubstitutionError(entry.toolName, ph, `manifest entry "${entry.toolName}" references path placeholder "{${ph}}" but has no matching parameter in properties`);
        }
        pathBucket[ph] = `arguments.${ph}`;
    }
    // Body vs query: GET → query, everything else → body.
    const nonPathNames = propNames.filter((n) => !placeholders.has(n));
    const bodyBucket = {};
    const queryBucket = {};
    if (entry.source.method === "GET") {
        for (const n of nonPathNames)
            queryBucket[n] = `arguments.${n}`;
    }
    else {
        for (const n of nonPathNames)
            bodyBucket[n] = `arguments.${n}`;
    }
    const headers = entry.source.method === "GET"
        ? {}
        : { "content-type": "application/json" };
    // Cross-origin detection (FR-016, build-time half): resolve the
    // relative pathTemplate against hostOrigin and compare against the
    // widget's origin. If they differ, same-origin cookies will not flow
    // — warn so the Builder fixes the host/widget deployment topology.
    try {
        const resolved = new URL(entry.source.path, opts.hostOrigin);
        if (resolved.origin !== opts.widgetOrigin) {
            warnings.push(`cross-origin action "${entry.toolName}": host ${resolved.origin} !== widget ${opts.widgetOrigin}`);
        }
    }
    catch {
        // hostOrigin malformed; surface as a warning but don't block.
        warnings.push(`could not resolve host origin for action "${entry.toolName}" (hostOrigin=${opts.hostOrigin})`);
    }
    const summaryFields = (entry.summaryFields ?? []).slice();
    const credentialSource = deriveCredentialSource(entry, opts.authTokenKey);
    // Validate per-entry via Zod so InvalidSubstitutionError (arg missing)
    // fires before the whole-catalog parse. This also resolves the schema
    // defaults (e.g. headers, substitution buckets) in the shape.
    const parsed = ActionExecutorEntrySchema.safeParse({
        tool: entry.toolName,
        method: entry.source.method,
        pathTemplate: entry.source.path,
        substitution: {
            path: pathBucket,
            body: bodyBucket,
            query: queryBucket,
        },
        headers,
        responseHandling: {
            successStatuses: defaultSuccessStatuses(entry.source.method),
            summaryTemplate: entry.descriptionTemplate ?? entry.description,
            summaryFields,
            errorMessageField: "message",
        },
        ...(credentialSource ? { credentialSource } : {}),
        ...(entry.runtimeOnly ? { runtimeOnly: true } : {}),
        ...(entry.summaryTemplate ? { summaryTemplate: entry.summaryTemplate } : {}),
        ...(entry.hostPrerequisite
            ? { hostPrerequisite: entry.hostPrerequisite }
            : {}),
    });
    if (!parsed.success) {
        throw new Error(`renderExecutors: entry "${entry.toolName}" failed schema validation: ${parsed.error.issues[0]?.message ?? "unknown"}`);
    }
    return parsed.data;
}
function extractPathPlaceholders(path) {
    const out = new Set();
    const rx = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
    let m;
    while ((m = rx.exec(path)) !== null) {
        out.add(m[1]);
    }
    return out;
}
function defaultSuccessStatuses(method) {
    switch (method) {
        case "POST":
            return [200, 201];
        case "DELETE":
            return [200, 204];
        default:
            return [200];
    }
}
/* ============================================================================
 * Canonicalisation
 * ========================================================================= */
export function canonicaliseCatalog(catalog) {
    const sorted = sortKeysDeep(catalog);
    return JSON.stringify(sorted, null, 2) + "\n";
}
function sortKeysDeep(value) {
    if (Array.isArray(value)) {
        return value.map(sortKeysDeep);
    }
    if (value !== null && typeof value === "object") {
        const src = value;
        const out = {};
        for (const k of Object.keys(src).sort()) {
            out[k] = sortKeysDeep(src[k]);
        }
        return out;
    }
    return value;
}
//# sourceMappingURL=render-executors.js.map