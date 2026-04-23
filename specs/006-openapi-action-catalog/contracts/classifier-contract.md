# Contract: Action classifier

**Feature**: 006 (OpenAPI-driven action catalog)
**Plan**: [../plan.md](../plan.md)
**Data model**: [../data-model.md §2](../data-model.md)
**Research**: [../research.md §R2, R7](../research.md)

This contract defines the behaviour of `classify-actions.ts` — the
two-stage (deterministic heuristic + Opus narrowing) classifier that
produces `action-manifest.md` from `openapi.json`. It is the
enforcement point for Principles V (Anchored Generation, red line)
and IV (Human-in-the-Loop).

Contract test:
`packages/scripts/test/classify-actions.anchored.contract.test.ts`
plus unit tests for each heuristic.

---

## 1. Entry point

```ts
export interface ClassifyActionsInput {
  parsed: ParsedOpenAPI;          // from parse-openapi.ts
  prior?: ActionManifest;         // from parse-action-manifest.ts, for delta-merge
  opusClient: OpusClient;         // injected for testability
  modelSnapshot: string;          // e.g. "claude-opus-4-7"
  hostOrigin: string;             // from brief.md; used for cross-origin detection signal
}

export interface ClassifyActionsOutput {
  manifest: ActionManifest;       // Zod-valid
  warnings: string[];             // emitted to stderr by caller
}

export async function classifyActions(
  input: ClassifyActionsInput,
): Promise<ClassifyActionsOutput>;
```

## 2. Stage 1 — Deterministic heuristic pass (pure function)

For every operation in `parsed.operations`, apply the following
exclusion rules in order. The first rule that matches wins; the
operation lands in `excluded[]` with that rule's reason token.

| # | Rule | Reason token |
|---|------|--------------|
| 1 | Path matches `/^(\/admin|\/internal)(\/|$)/` OR path token matches the pattern list in `packages/scripts/src/lib/admin-detection.ts` | `admin-prefix` |
| 2 | `operation.security[*].scheme` contains any scheme whose type is `oauth2`, `bearerFormat === "JWT"`, `apiKey` in `header` other than the session cookie name, or `openIdConnect` | `non-cookie-security` |
| 3 | Method is `POST`/`PUT`/`PATCH` AND `requestBody` is missing OR `requestBody.schema` is `null` OR schema is not an object | `missing-request-schema` |
| 4 | Path matches a destructive pattern from `packages/scripts/src/lib/destructive-detection.ts` AND the path does not look shopper-owned (heuristic: no `customer`, `carts/{id}`, `wishlist`, `reviews` token) | `destructive-unowned` |
| 5 | Method is `OPTIONS` or `HEAD` | `non-mutating-meta` (auto-excluded silently — no manifest entry needed) |

Operations that pass all rules land in `candidateIncluded[]`.
`candidateIncluded` and `excluded` are disjoint.

**Invariants of Stage 1:**

- Deterministic — same `parsed` input produces the same
  `{candidateIncluded, excluded}` output across any machine at any
  time. No network, no Opus, no random seeds.
- Side-effect free — does not read `action-manifest.md`, does not
  touch the filesystem, does not mutate its input.
- Auditable — the rule that excluded each operation is recorded in
  `excluded[*].reason`.

## 3. Stage 2 — Opus narrowing review (single call)

Input to Opus: a JSON document containing each `candidateIncluded`
operation's `(operationId, method, path, summary, description,
requestBody.schema, security)` — the minimum needed for a safety
judgment. Max ~40 operations per call (the classifier truncates and
logs if over; re-invokes in batches, merging results).

System prompt template:

```
You are auditing an OpenAPI-derived list of candidate actions for a
shopper-facing e-commerce assistant. Review each candidate and return
the subset that is safe for a logged-in shopper to invoke via natural
language.

You MAY remove an operation from the candidate list. You MAY NOT add
an operation that is not already in the candidate list. Your output
MUST be a JSON array of operationIds, each of which appears in the
input list exactly once.

Remove operations that:
- Mutate resources the shopper does not own (other users' carts,
  other users' addresses, admin-level entities).
- Perform multi-step flows the confirmation card cannot express
  (checkout, payment, order completion).
- Expose sensitive fields (PII, auth tokens, internal IDs) the
  shopper has no reason to see.
- Are ambiguously scoped and the description does not disambiguate.

Preserve operations that:
- Clearly mutate shopper-owned resources (cart items, wishlist,
  reviews the shopper authored).
- Have a focused, single-step request body.
- Read clearly from the description as shopper-initiated.

If uncertain, remove. Conservative bias.
```

User prompt: the JSON list of candidates.

Output expected: a JSON array of strings (each an `operationId` from
the input list). The classifier parses this response with a strict
Zod schema (`z.array(z.string())`); any other shape is a non-retry
failure (classifier exits non-zero, no manifest written).

**Anchored-generation post-check (FR-004, SC-002).** After Opus
returns, the classifier walks the returned list and asserts each
`operationId` was present in the Stage 1 `candidateIncluded` list. If
any was NOT (Opus invented an operation, or typoed one, or hallucinated
a variant), the classifier:
1. Does not write `action-manifest.md`.
2. Exits non-zero with a diagnostic:
   `classifier: Opus output contained operationId "<id>" that was not
   in the candidate list — aborting to preserve anchored-generation
   invariant (Principle V).`
3. Surfaces the full offending output in a debug log for the Builder
   to inspect.

## 4. Stage 3 — Manifest assembly

For each `operationId` Opus kept (the narrowed list):
- Fetch the corresponding `ParsedOpenAPIOperation` from Stage 1.
- Derive the manifest entry:
  - `toolName`: lowercase, snake-case rendering of `operationId`
    (collisions get `_1`, `_2` suffix; recorded as a warning).
  - `description`: `operation.summary ?? operation.description ?? ""`.
    Empty descriptions get a synthesized default:
    `<Method> <Path>`.
  - `parameters`: Zod-validated subset of the operation's request
    body schema, plus path-param fields (named after the template
    variables), plus query-param fields (named after their
    parameter `name`). Required fields are the union of
    OpenAPI-required path params, OpenAPI-required body fields, and
    OpenAPI-required query params.
  - `requiresConfirmation`: `true` (always, for `is_action: true`
    entries). `GET` operations that landed in the narrowed list (rare)
    default to `false`.
  - `isAction`: `true` for `POST`/`PUT`/`PATCH`/`DELETE`, `false`
    for `GET`/`HEAD`/`OPTIONS`.
  - `source.method`: uppercased method.
  - `source.path`: the OpenAPI path.
  - `source.operationId`: the source `operationId`.
  - `parameterSources`: `"tool arguments (OpenAPI-derived)"` by
    default.

For every `candidateIncluded` operation Opus removed:
- Add an `excluded[]` entry with reason token `opus-narrowed` and a
  secondary `reason` free-form line if Opus provided one (optional).

Stage 1 `excluded[]` entries pass through unchanged.

## 5. Delta-merge with prior manifest (R7)

When `prior` is present:

- For each entry in `prior.included`:
  - If the corresponding OpenAPI operation still exists (match on
    `(operationId, path, method)` triple): KEEP the prior entry
    verbatim. Builder edits (description, confirmation flag,
    description template) are preserved.
  - Else: move to `orphaned[]` with `previousToolName` set.
- For each entry in `prior.excluded`:
  - If the corresponding OpenAPI operation still exists AND a
    Builder edit moved it to `included` before re-run: KEEP in
    `included`. (Recognised by parsing the prior manifest — the
    parser flags entries whose `reason` in the prior manifest was a
    classifier reason but whose current state is `included`.)
  - If the operation still exists AND was excluded by the prior
    classifier: re-run rules 1-5 on it; may stay excluded, may
    promote.
  - Else: drop silently (operation no longer exists).
- For operations in the current OpenAPI not in prior manifest
  (included+excluded combined): run full Stage 1 + Stage 2 on those,
  merge into the result.

This preserves FR-017 (Builder edits stick) while FR-020 (pinned
OpenAPI as source of truth) remains true.

## 6. Output invariants (testable)

- Every entry in `manifest.included[]` has a
  `(source.operationId, source.path, source.method)` triple that
  exists in `parsed.operations`. (FR-004, SC-002)
- Every entry in `manifest.excluded[]` has a non-empty `reason`.
  (FR-003)
- Every `included` entry has `confirmationRequired === true` OR was
  explicitly flipped by a prior Builder edit preserved via
  delta-merge. (FR-011)
- `manifest.provenance.openapiSha256` matches the sha256 of the
  ingested `openapi.json`. (FR-018)
- `manifest.provenance.classifierModel` is the `modelSnapshot` input
  verbatim.
- `manifest.provenance.classifiedAt` is an ISO-8601 UTC timestamp of
  the classification run.
- If `prior` was passed, no Builder-edited field is overwritten.

## 7. Exit codes / caller contract

`classifyActions()` returns on success. On any of the following, it
throws an error with a `.code` property the caller maps to an exit
code:

| `code`                          | Meaning |
|---------------------------------|---------|
| `ANCHORED_GENERATION_VIOLATION` | Opus returned an operationId not in the candidate list. |
| `OPUS_RESPONSE_INVALID`         | Opus returned a non-JSON or non-array payload. |
| `CLASSIFIER_TIMEOUT`            | Opus call did not complete within 60 s. |
| `MANIFEST_VALIDATION`           | Assembled manifest fails `ActionManifestSchema` for any reason. |

Caller (`orchestrator.ts` or a standalone `/atw.classify` entry) maps
these to process exit 1.

## 8. Test outline

`classify-actions.heuristic.unit.test.ts`:
- Each rule gets a fixture and an assertion on the reason token.
- Rule order ties resolve deterministically (rule 1 wins over rule 3).
- `OPTIONS`/`HEAD` silently skipped, not in excluded list.

`classify-actions.anchored.contract.test.ts`:
- Mocked Opus returns an operationId not in the candidate list →
  throws `ANCHORED_GENERATION_VIOLATION`; no manifest written.
- Mocked Opus returns the candidate list unchanged → manifest
  identical to Stage 1's candidate list.
- Mocked Opus returns a subset → manifest excludes the removed
  entries with reason `opus-narrowed`.
- Mocked Opus returns an empty array → manifest has empty `included`
  (graceful degradation chain point).
- Mocked Opus returns malformed JSON → throws `OPUS_RESPONSE_INVALID`.

`classify-actions.delta-merge.unit.test.ts`:
- Prior manifest with a Builder-flipped `confirmationRequired: false`
  → preserved across re-run.
- Prior manifest with an entry whose OpenAPI operation disappeared →
  moved to `orphaned[]`.
- New OpenAPI operation not in prior manifest → runs through
  heuristic + Opus, merged in.
- OpenAPI with an identical set to prior → manifest byte-identical.
