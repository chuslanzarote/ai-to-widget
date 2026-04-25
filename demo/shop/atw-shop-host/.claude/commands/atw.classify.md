---
description: "Classify ingested OpenAPI operations into shopper-safe actions."
---

# `/atw.classify`

**Purpose.** Derive `.atw/artifacts/action-manifest.md` from the
canonical `openapi.json` pinned by `/atw.api`, via a two-stage
classifier: deterministic heuristic filter → Opus narrowing review →
anchored-generation post-check. The manifest is the Builder-edit
surface; it is consumed by `/atw.build` to generate the runtime tool
catalog (`tools.ts`) and the widget's declarative executor recipes
(`action-executors.json`). Feature 006 (FR-004, FR-005, FR-006, R2, R7;
Principle V — Anchored Generation).

## Preconditions

- `.atw/artifacts/openapi.json` exists (from `/atw.api`).
- `.atw/state/openapi-meta.json` exists (provenance sidecar).
- `.atw/config/brief.md` exists (provides `hostOrigin` for the
  cross-origin detection signal).
- `ANTHROPIC_API_KEY` exported (Stage 2 calls Opus; Stage 1 is pure).

## Steps

1. **Load ingested OpenAPI.** Read `.atw/artifacts/openapi.json` and
   `.atw/state/openapi-meta.json`. If either is missing, exit 3 with a
   diagnostic telling the Builder to run `/atw.api` first.

2. **Load prior manifest if any.** Read `.atw/artifacts/action-manifest.md`
   via `parseActionManifestText()` (tolerant parse — Builder hand-edits
   under the `Tools:` and Summary sections are preserved via
   delta-merge per R7).

3. **Stage 1 — Deterministic heuristic pass (no LLM call).** For each
   operation in the parsed document, apply the following rules in
   order. The first match wins and lands the operation in `excluded[]`
   with the rule's reason token:

   | # | Rule | Reason token |
   |---|------|--------------|
   | 1 | Path matches `/^(\/admin|\/internal)(\/|$)/` OR matches `lib/admin-detection.ts` patterns | `admin-prefix` |
   | 2 | `security[*]` scheme is `oauth2`, `bearerFormat: "JWT"`, non-cookie `apiKey`, or `openIdConnect` | `non-cookie-security` |
   | 3 | Method is POST/PUT/PATCH AND `requestBody` is missing OR schema is null/non-object | `missing-request-schema` |
   | 4 | Path matches `lib/destructive-detection.ts` AND path is not shopper-owned (no `customer`, `carts/{id}`, `wishlist`, `reviews` token) | `destructive-unowned` |
   | 5 | Method is OPTIONS or HEAD | `non-mutating-meta` (silently excluded, no manifest entry) |

   Operations that pass every rule land in `candidateIncluded[]`.
   Stage 1 is pure — no network, no randomness, no Opus. Same input
   always yields the same split.

4. **Stage 2 — Opus narrowing review (single call, or batches of ~40).**
   Send Opus the JSON list of candidates with
   `(operationId, method, path, summary, description, requestBody.schema, security)`
   per entry. System prompt (contract-pinned):

   > *"You MAY remove an operation from the candidate list. You MAY NOT
   > add an operation that is not already in the candidate list. ...
   > If uncertain, remove. Conservative bias."*

   Output must be a JSON array of `operationId` strings; any other
   shape is a non-retry failure.

5. **Anchored-generation post-check (FR-004, SC-002, Principle V).**
   Walk Opus's returned list. Any `operationId` NOT present in
   Stage 1's `candidateIncluded[]` triggers
   `ANCHORED_GENERATION_VIOLATION`: the classifier does not write the
   manifest and exits non-zero. Diagnostic:
   *"Opus output contained operationId `<id>` that was not in the
   candidate list — aborting to preserve anchored-generation
   invariant (Principle V)."*

6. **Stage 3 — Manifest assembly.** For each kept `operationId`:
   - Pull the `ParsedOpenAPIOperation` from Stage 1.
   - Derive `inputSchema` (JSON Schema for the tool descriptor) by
     merging path parameters + the request-body schema, canonicalised
     via `canonicaliseInputSchema()`.
   - Default `confirmation_required: true` for any write-method
     operation. The Builder may later flip this to `false` in the
     manifest by hand; the delta-merge on the next `/atw.classify`
     preserves the edit.
   - Record `Source:` evidence (method, path, operationId) so every
     entry is traceable to an OpenAPI operation.

7. **Delta-merge with the prior manifest (R7).** Builder edits under
   `## Tools:` (renamed tools, hand-tuned descriptions, toggled
   `confirmation_required`, deleted entries) are the ground truth
   and are preserved. New operations that became candidates are
   appended with classifier defaults. Operations no longer in Stage 1
   are dropped from `Tools:` and appear in `Excluded:` with their
   current reason.

8. **Write the artifact.** Render the in-memory `ActionManifest` via
   `renderActionManifest()` and pipe it through
   `atw-write-artifact --target .atw/artifacts/action-manifest.md`.
   The write is atomic with a `.bak` sibling (FR-046).

9. **Announce next step.** End with exactly:

   *"Action manifest written. Next: edit `.atw/artifacts/action-manifest.md`
   by hand if you want to curate the tool list, then run `/atw.build`."*

## Re-run semantics (Principle VIII, R7)

- **Unchanged `openapi.json` + unchanged `action-manifest.md`** →
  Stage 1 runs (free), Stage 2 runs (Opus call with the same
  snapshot → same output under determinism constraints), Stage 3 emits
  byte-identical output. Result: `action: "unchanged"`.
- **Unchanged `openapi.json`, Builder edited `action-manifest.md`** →
  Stage 1 + Stage 2 run; Stage 3 delta-merges the Builder's edits.
  Edits under `## Tools:` are preserved; Stage 1 `excluded[]` is
  regenerated fresh (it is derived, not curated).
- **`openapi.json` changed** → Stage 1 reflects the delta; Stage 2
  reviews the new candidate set; Stage 3 delta-merges. Operations
  that disappeared from the source are dropped from `Tools:`.
- **Mid-command interrupt** → no persisted draft; the next run
  re-synthesizes from the same inputs.

## Failure handling

- **Missing `openapi.json`** → exit 3; tell the Builder to run
  `/atw.api` first.
- **Opus response not a JSON array of strings** → exit 1 with
  `OPUS_RESPONSE_INVALID`. No manifest written.
- **Anchored-generation violation** → exit 1 with
  `ANCHORED_GENERATION_VIOLATION`. No manifest written. Full offending
  Opus output is in the debug log.
- **Classifier timeout** → exit 1 with `CLASSIFIER_TIMEOUT`. Safe to
  re-run; Stage 1 is cached in memory within a single invocation only.
- **LLM auth / rate limit** → same handling as `/atw.brief`.

## Tooling

All deterministic work is delegated to `@atw/scripts`:

- `atw-classify [--project-root <path>] [--json]` — wraps
  `packages/scripts/src/atw-classify.ts` (programmatic entry
  `runAtwClassify`).
- `packages/scripts/src/classify-actions.ts` — the three-stage engine.
- `packages/scripts/src/lib/admin-detection.ts` — Stage 1 rule 1.
- `packages/scripts/src/lib/destructive-detection.ts` — Stage 1 rule 4.
- `packages/scripts/src/parse-action-manifest.ts` — tolerant reader
  for delta-merge.
- `packages/scripts/src/render-action-manifest.ts` — markdown emitter.
- `atw-write-artifact --target .atw/artifacts/action-manifest.md` —
  atomic write with `.bak` sibling (FR-046).

See the binding contract at
[`specs/006-openapi-action-catalog/contracts/classifier-contract.md`](../specs/006-openapi-action-catalog/contracts/classifier-contract.md).
