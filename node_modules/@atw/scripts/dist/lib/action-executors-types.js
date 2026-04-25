/**
 * Feature 006 — Zod schemas for `.atw/artifacts/action-executors.json`,
 * the declarative execution catalog the widget loads at init. Contract:
 * specs/006-openapi-action-catalog/contracts/action-executors.schema.md
 * and data-model.md §3.
 *
 * The whole point of this file is the static guarantees it provides:
 *   - Principle I (User Data Sovereignty): no credential-class header
 *     may appear in the catalog — the widget always carries cookies
 *     via `credentials: "include"`; anything the Builder puts here is
 *     non-secret.
 *   - FR-009 interpreter-safety: substitution expressions are reduced
 *     to `arguments.<identifier>` — no dotted paths, no brackets, no
 *     arbitrary expressions, so the runtime interpreter's single
 *     lookup pass cannot be abused.
 */
import { z } from "zod";
/**
 * `arguments.<identifier>` — nothing else. The runtime interpreter
 * takes each matching value verbatim from `ActionIntent.arguments`,
 * so the static regex is the only allow-list that matters.
 */
export const SubstitutionSourceSchema = z
    .string()
    .regex(/^arguments\.[a-zA-Z_][a-zA-Z0-9_]*$/, {
    message: "substitution must match /^arguments\\.[a-zA-Z_][a-zA-Z0-9_]*$/ (no dotted paths, no brackets)",
});
const HTTP_METHOD = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
/**
 * Credential-class header regex. Case-insensitive. If a Builder puts
 * `Authorization`, `Cookie`, `Set-Cookie`, or anything matching
 * `X-*-{Token,Auth,Session}` in the catalog, the Zod refinement below
 * rejects the whole catalog at write time so the widget never even
 * sees it. Principle I enforcement (data-model.md §11).
 *
 * Feature 007 note: credentials still cannot appear in `headers`; they
 * appear in the separate `credentialSource` field, which the widget
 * resolves at fetch time from `localStorage` — never via the backend.
 */
const CREDENTIAL_CLASS_HEADER_RE = /^(authorization|cookie|set-cookie|x-.*-(token|auth|session))$/i;
/**
 * Feature 007 — declarative credential source for a tool. v1 defines
 * one variant: the widget reads a bearer token from `localStorage[key]`
 * and sets `<header>: <scheme> <token>` on the outgoing request.
 *
 * Contract: specs/007-widget-tool-loop/contracts/action-catalog-v2.md.
 * Unknown `type` values cause the catalog to fail to load (FR-021).
 */
export const BearerLocalStorageCredentialSourceSchema = z.object({
    type: z.literal("bearer-localstorage"),
    key: z.string().min(1),
    header: z.string().min(1),
    scheme: z.string().min(1),
});
export const CredentialSourceSchema = BearerLocalStorageCredentialSourceSchema;
export const ActionExecutorEntrySchema = z.object({
    tool: z.string().min(1),
    method: HTTP_METHOD,
    pathTemplate: z
        .string()
        .regex(/^\/[A-Za-z0-9\-_/{}.]*$/, {
        message: "pathTemplate must be a relative URL path starting with / — absolute URLs are rejected (R4)",
    })
        .refine((p) => !p.startsWith("//"), {
        message: "pathTemplate must be rooted with a single leading / — protocol-relative URLs (`//host/...`) are rejected (R4)",
    }),
    substitution: z.object({
        path: z.record(SubstitutionSourceSchema).default({}),
        body: z.record(SubstitutionSourceSchema).default({}),
        query: z.record(SubstitutionSourceSchema).default({}),
    }),
    headers: z
        .record(z.string())
        .refine((h) => Object.keys(h).every((k) => !CREDENTIAL_CLASS_HEADER_RE.test(k)), { message: "credential-class headers forbidden in catalog" })
        .default({ "content-type": "application/json" }),
    responseHandling: z.object({
        successStatuses: z.array(z.number().int().gte(100).lte(599)).min(1),
        summaryTemplate: z.string(),
        summaryFields: z.array(z.string()).default([]),
        errorMessageField: z.string().optional(),
    }),
    /**
     * Feature 007 — optional per-operation credential injection. Present
     * when the source OpenAPI declares `bearerAuth` on the operation;
     * absent for unauthenticated catalogue reads.
     */
    credentialSource: CredentialSourceSchema.optional(),
    /**
     * FR-012 — propagated from the `(runtime-only)` flag on the source
     * `## Tools: <group> (runtime-only)` heading. Widgets use this to
     * skip any lookup/RAG shortcuts and always route through tool-use.
     */
    runtimeOnly: z.boolean().optional(),
    /**
     * Feature 008 / FR-026 — Handlebars-style summary template rendered
     * by the widget's ActionCard in US5 (`{{ name }}` substitutions
     * against the tool call's `arguments` object). Distinct from
     * `responseHandling.summaryTemplate`, which describes the *response*
     * wording; this field describes the *pre-execution* confirmation
     * wording. Missing placeholder ⇒ ActionCard falls back to raw JSON.
     */
    summaryTemplate: z.string().optional(),
    /**
     * Feature 008 / FR-003 — per-tool host prerequisite string consumed
     * by `host-requirements.md#Tool-specific prerequisites`. Declarative
     * pass-through; never rendered by the widget.
     */
    hostPrerequisite: z.string().optional(),
});
export const ActionExecutorsCatalogSchema = z.object({
    version: z.literal(1),
    /**
     * Feature 007 collapses the cookie-mode assumption. The widget now
     * injects bearer tokens per operation via `credentialSource`. Older
     * catalogs carrying `same-origin-cookies` still load.
     */
    credentialMode: z
        .enum(["same-origin-cookies", "bearer-localstorage"])
        .default("bearer-localstorage"),
    actions: z.array(ActionExecutorEntrySchema),
});
/**
 * Empty but well-formed catalog — what the build writes when the
 * manifest has zero included entries (graceful-degradation, FR-014).
 * The widget loads this without error and falls back to chat-only.
 */
export const EMPTY_CATALOG = {
    version: 1,
    credentialMode: "bearer-localstorage",
    actions: [],
};
//# sourceMappingURL=action-executors-types.js.map