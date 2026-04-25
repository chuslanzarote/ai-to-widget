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
export declare const SubstitutionSourceSchema: z.ZodString;
export type SubstitutionSource = z.infer<typeof SubstitutionSourceSchema>;
/**
 * Feature 007 — declarative credential source for a tool. v1 defines
 * one variant: the widget reads a bearer token from `localStorage[key]`
 * and sets `<header>: <scheme> <token>` on the outgoing request.
 *
 * Contract: specs/007-widget-tool-loop/contracts/action-catalog-v2.md.
 * Unknown `type` values cause the catalog to fail to load (FR-021).
 */
export declare const BearerLocalStorageCredentialSourceSchema: z.ZodObject<{
    type: z.ZodLiteral<"bearer-localstorage">;
    key: z.ZodString;
    header: z.ZodString;
    scheme: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "bearer-localstorage";
    scheme: string;
    header: string;
    key: string;
}, {
    type: "bearer-localstorage";
    scheme: string;
    header: string;
    key: string;
}>;
export type BearerLocalStorageCredentialSource = z.infer<typeof BearerLocalStorageCredentialSourceSchema>;
export declare const CredentialSourceSchema: z.ZodObject<{
    type: z.ZodLiteral<"bearer-localstorage">;
    key: z.ZodString;
    header: z.ZodString;
    scheme: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "bearer-localstorage";
    scheme: string;
    header: string;
    key: string;
}, {
    type: "bearer-localstorage";
    scheme: string;
    header: string;
    key: string;
}>;
export type CredentialSource = z.infer<typeof CredentialSourceSchema>;
export declare const ActionExecutorEntrySchema: z.ZodObject<{
    tool: z.ZodString;
    method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
    pathTemplate: z.ZodEffects<z.ZodString, string, string>;
    substitution: z.ZodObject<{
        path: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        body: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        query: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        path: Record<string, string>;
        query: Record<string, string>;
        body: Record<string, string>;
    }, {
        path?: Record<string, string> | undefined;
        query?: Record<string, string> | undefined;
        body?: Record<string, string> | undefined;
    }>;
    headers: z.ZodDefault<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Record<string, string>, Record<string, string>>>;
    responseHandling: z.ZodObject<{
        successStatuses: z.ZodArray<z.ZodNumber, "many">;
        summaryTemplate: z.ZodString;
        summaryFields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        errorMessageField: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        summaryFields: string[];
        summaryTemplate: string;
        successStatuses: number[];
        errorMessageField?: string | undefined;
    }, {
        summaryTemplate: string;
        successStatuses: number[];
        summaryFields?: string[] | undefined;
        errorMessageField?: string | undefined;
    }>;
    /**
     * Feature 007 — optional per-operation credential injection. Present
     * when the source OpenAPI declares `bearerAuth` on the operation;
     * absent for unauthenticated catalogue reads.
     */
    credentialSource: z.ZodOptional<z.ZodObject<{
        type: z.ZodLiteral<"bearer-localstorage">;
        key: z.ZodString;
        header: z.ZodString;
        scheme: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "bearer-localstorage";
        scheme: string;
        header: string;
        key: string;
    }, {
        type: "bearer-localstorage";
        scheme: string;
        header: string;
        key: string;
    }>>;
    /**
     * FR-012 — propagated from the `(runtime-only)` flag on the source
     * `## Tools: <group> (runtime-only)` heading. Widgets use this to
     * skip any lookup/RAG shortcuts and always route through tool-use.
     */
    runtimeOnly: z.ZodOptional<z.ZodBoolean>;
    /**
     * Feature 008 / FR-026 — Handlebars-style summary template rendered
     * by the widget's ActionCard in US5 (`{{ name }}` substitutions
     * against the tool call's `arguments` object). Distinct from
     * `responseHandling.summaryTemplate`, which describes the *response*
     * wording; this field describes the *pre-execution* confirmation
     * wording. Missing placeholder ⇒ ActionCard falls back to raw JSON.
     */
    summaryTemplate: z.ZodOptional<z.ZodString>;
    /**
     * Feature 008 / FR-003 — per-tool host prerequisite string consumed
     * by `host-requirements.md#Tool-specific prerequisites`. Declarative
     * pass-through; never rendered by the widget.
     */
    hostPrerequisite: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    tool: string;
    pathTemplate: string;
    substitution: {
        path: Record<string, string>;
        query: Record<string, string>;
        body: Record<string, string>;
    };
    headers: Record<string, string>;
    responseHandling: {
        summaryFields: string[];
        summaryTemplate: string;
        successStatuses: number[];
        errorMessageField?: string | undefined;
    };
    runtimeOnly?: boolean | undefined;
    summaryTemplate?: string | undefined;
    hostPrerequisite?: string | undefined;
    credentialSource?: {
        type: "bearer-localstorage";
        scheme: string;
        header: string;
        key: string;
    } | undefined;
}, {
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    tool: string;
    pathTemplate: string;
    substitution: {
        path?: Record<string, string> | undefined;
        query?: Record<string, string> | undefined;
        body?: Record<string, string> | undefined;
    };
    responseHandling: {
        summaryTemplate: string;
        successStatuses: number[];
        summaryFields?: string[] | undefined;
        errorMessageField?: string | undefined;
    };
    runtimeOnly?: boolean | undefined;
    summaryTemplate?: string | undefined;
    hostPrerequisite?: string | undefined;
    headers?: Record<string, string> | undefined;
    credentialSource?: {
        type: "bearer-localstorage";
        scheme: string;
        header: string;
        key: string;
    } | undefined;
}>;
export type ActionExecutorEntry = z.infer<typeof ActionExecutorEntrySchema>;
export declare const ActionExecutorsCatalogSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    /**
     * Feature 007 collapses the cookie-mode assumption. The widget now
     * injects bearer tokens per operation via `credentialSource`. Older
     * catalogs carrying `same-origin-cookies` still load.
     */
    credentialMode: z.ZodDefault<z.ZodEnum<["same-origin-cookies", "bearer-localstorage"]>>;
    actions: z.ZodArray<z.ZodObject<{
        tool: z.ZodString;
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
        pathTemplate: z.ZodEffects<z.ZodString, string, string>;
        substitution: z.ZodObject<{
            path: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            body: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
            query: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            path: Record<string, string>;
            query: Record<string, string>;
            body: Record<string, string>;
        }, {
            path?: Record<string, string> | undefined;
            query?: Record<string, string> | undefined;
            body?: Record<string, string> | undefined;
        }>;
        headers: z.ZodDefault<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Record<string, string>, Record<string, string>>>;
        responseHandling: z.ZodObject<{
            successStatuses: z.ZodArray<z.ZodNumber, "many">;
            summaryTemplate: z.ZodString;
            summaryFields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            errorMessageField: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            summaryFields: string[];
            summaryTemplate: string;
            successStatuses: number[];
            errorMessageField?: string | undefined;
        }, {
            summaryTemplate: string;
            successStatuses: number[];
            summaryFields?: string[] | undefined;
            errorMessageField?: string | undefined;
        }>;
        /**
         * Feature 007 — optional per-operation credential injection. Present
         * when the source OpenAPI declares `bearerAuth` on the operation;
         * absent for unauthenticated catalogue reads.
         */
        credentialSource: z.ZodOptional<z.ZodObject<{
            type: z.ZodLiteral<"bearer-localstorage">;
            key: z.ZodString;
            header: z.ZodString;
            scheme: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "bearer-localstorage";
            scheme: string;
            header: string;
            key: string;
        }, {
            type: "bearer-localstorage";
            scheme: string;
            header: string;
            key: string;
        }>>;
        /**
         * FR-012 — propagated from the `(runtime-only)` flag on the source
         * `## Tools: <group> (runtime-only)` heading. Widgets use this to
         * skip any lookup/RAG shortcuts and always route through tool-use.
         */
        runtimeOnly: z.ZodOptional<z.ZodBoolean>;
        /**
         * Feature 008 / FR-026 — Handlebars-style summary template rendered
         * by the widget's ActionCard in US5 (`{{ name }}` substitutions
         * against the tool call's `arguments` object). Distinct from
         * `responseHandling.summaryTemplate`, which describes the *response*
         * wording; this field describes the *pre-execution* confirmation
         * wording. Missing placeholder ⇒ ActionCard falls back to raw JSON.
         */
        summaryTemplate: z.ZodOptional<z.ZodString>;
        /**
         * Feature 008 / FR-003 — per-tool host prerequisite string consumed
         * by `host-requirements.md#Tool-specific prerequisites`. Declarative
         * pass-through; never rendered by the widget.
         */
        hostPrerequisite: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        tool: string;
        pathTemplate: string;
        substitution: {
            path: Record<string, string>;
            query: Record<string, string>;
            body: Record<string, string>;
        };
        headers: Record<string, string>;
        responseHandling: {
            summaryFields: string[];
            summaryTemplate: string;
            successStatuses: number[];
            errorMessageField?: string | undefined;
        };
        runtimeOnly?: boolean | undefined;
        summaryTemplate?: string | undefined;
        hostPrerequisite?: string | undefined;
        credentialSource?: {
            type: "bearer-localstorage";
            scheme: string;
            header: string;
            key: string;
        } | undefined;
    }, {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        tool: string;
        pathTemplate: string;
        substitution: {
            path?: Record<string, string> | undefined;
            query?: Record<string, string> | undefined;
            body?: Record<string, string> | undefined;
        };
        responseHandling: {
            summaryTemplate: string;
            successStatuses: number[];
            summaryFields?: string[] | undefined;
            errorMessageField?: string | undefined;
        };
        runtimeOnly?: boolean | undefined;
        summaryTemplate?: string | undefined;
        hostPrerequisite?: string | undefined;
        headers?: Record<string, string> | undefined;
        credentialSource?: {
            type: "bearer-localstorage";
            scheme: string;
            header: string;
            key: string;
        } | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    version: 1;
    actions: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        tool: string;
        pathTemplate: string;
        substitution: {
            path: Record<string, string>;
            query: Record<string, string>;
            body: Record<string, string>;
        };
        headers: Record<string, string>;
        responseHandling: {
            summaryFields: string[];
            summaryTemplate: string;
            successStatuses: number[];
            errorMessageField?: string | undefined;
        };
        runtimeOnly?: boolean | undefined;
        summaryTemplate?: string | undefined;
        hostPrerequisite?: string | undefined;
        credentialSource?: {
            type: "bearer-localstorage";
            scheme: string;
            header: string;
            key: string;
        } | undefined;
    }[];
    credentialMode: "bearer-localstorage" | "same-origin-cookies";
}, {
    version: 1;
    actions: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        tool: string;
        pathTemplate: string;
        substitution: {
            path?: Record<string, string> | undefined;
            query?: Record<string, string> | undefined;
            body?: Record<string, string> | undefined;
        };
        responseHandling: {
            summaryTemplate: string;
            successStatuses: number[];
            summaryFields?: string[] | undefined;
            errorMessageField?: string | undefined;
        };
        runtimeOnly?: boolean | undefined;
        summaryTemplate?: string | undefined;
        hostPrerequisite?: string | undefined;
        headers?: Record<string, string> | undefined;
        credentialSource?: {
            type: "bearer-localstorage";
            scheme: string;
            header: string;
            key: string;
        } | undefined;
    }[];
    credentialMode?: "bearer-localstorage" | "same-origin-cookies" | undefined;
}>;
export type ActionExecutorsCatalog = z.infer<typeof ActionExecutorsCatalogSchema>;
/**
 * Empty but well-formed catalog — what the build writes when the
 * manifest has zero included entries (graceful-degradation, FR-014).
 * The widget loads this without error and falls back to chat-only.
 */
export declare const EMPTY_CATALOG: ActionExecutorsCatalog;
//# sourceMappingURL=action-executors-types.d.ts.map