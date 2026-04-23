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
    message:
      "substitution must match /^arguments\\.[a-zA-Z_][a-zA-Z0-9_]*$/ (no dotted paths, no brackets)",
  });
export type SubstitutionSource = z.infer<typeof SubstitutionSourceSchema>;

const HTTP_METHOD = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Credential-class header regex. Case-insensitive. If a Builder puts
 * `Authorization`, `Cookie`, `Set-Cookie`, or anything matching
 * `X-*-{Token,Auth,Session}` in the catalog, the Zod refinement below
 * rejects the whole catalog at write time so the widget never even
 * sees it. Principle I enforcement (data-model.md §11).
 */
const CREDENTIAL_CLASS_HEADER_RE =
  /^(authorization|cookie|set-cookie|x-.*-(token|auth|session))$/i;

export const ActionExecutorEntrySchema = z.object({
  tool: z.string().min(1),
  method: HTTP_METHOD,
  pathTemplate: z
    .string()
    .regex(/^\/[A-Za-z0-9\-_/{}.]*$/, {
      message:
        "pathTemplate must be a relative URL path starting with / — absolute URLs are rejected (R4)",
    })
    .refine((p) => !p.startsWith("//"), {
      message:
        "pathTemplate must be rooted with a single leading / — protocol-relative URLs (`//host/...`) are rejected (R4)",
    }),
  substitution: z.object({
    path: z.record(SubstitutionSourceSchema).default({}),
    body: z.record(SubstitutionSourceSchema).default({}),
    query: z.record(SubstitutionSourceSchema).default({}),
  }),
  headers: z
    .record(z.string())
    .refine(
      (h) =>
        Object.keys(h).every((k) => !CREDENTIAL_CLASS_HEADER_RE.test(k)),
      { message: "credential-class headers forbidden in catalog" },
    )
    .default({ "content-type": "application/json" }),
  responseHandling: z.object({
    successStatuses: z.array(z.number().int().gte(100).lte(599)).min(1),
    summaryTemplate: z.string(),
    summaryFields: z.array(z.string()).default([]),
    errorMessageField: z.string().optional(),
  }),
});
export type ActionExecutorEntry = z.infer<typeof ActionExecutorEntrySchema>;

export const ActionExecutorsCatalogSchema = z.object({
  version: z.literal(1),
  credentialMode: z.literal("same-origin-cookies"),
  actions: z.array(ActionExecutorEntrySchema),
});
export type ActionExecutorsCatalog = z.infer<
  typeof ActionExecutorsCatalogSchema
>;

/**
 * Empty but well-formed catalog — what the build writes when the
 * manifest has zero included entries (graceful-degradation, FR-014).
 * The widget loads this without error and falls back to chat-only.
 */
export const EMPTY_CATALOG: ActionExecutorsCatalog = {
  version: 1,
  credentialMode: "same-origin-cookies",
  actions: [],
};
