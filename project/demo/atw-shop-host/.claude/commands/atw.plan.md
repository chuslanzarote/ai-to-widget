---
description: "Consolidate upstream artifacts into a build plan with a cost estimate."
argument-hint: "(no arguments)"
---

# `/atw.plan`

**Purpose.** Validate cross-artifact consistency, synthesize the build
plan that Feature 002 will execute, display a cost estimate
*before* the confirmation prompt, and write
`.atw/artifacts/build-plan.md` only on affirmative confirmation.
1 LLM call for synthesis (FR-034, FR-035, FR-037, FR-038).

## Preconditions

- All four upstream artifacts exist under `.atw/`:
  - `.atw/config/project.md`
  - `.atw/config/brief.md`
  - `.atw/artifacts/schema-map.md`
  - `.atw/artifacts/action-manifest.md`
- If any is missing, halt with a message naming the exact next
  command to run (FR-037). Example:

  > *"Missing `schema-map.md`. Run `/atw.schema` first, then
  > return here."*

## Steps

1. **Preflight consistency check.** Run
   `atw-validate-artifacts --root .atw`. This cross-references:
   - every tool in `action-manifest.md` against an entity in
     `schema-map.md`;
   - every vocabulary term in `brief.md` against an entity or column
     in `schema-map.md` (soft check — warn, don't block);
   - every non-indexable entity in `schema-map.md` against tools in
     `action-manifest.md` that rely on it.

   On inconsistency (FR-038), surface the four inconsistency kinds
   from [data-model.md §2.5] and offer the Builder either an in-place
   edit path or a targeted re-run of the upstream command. **No LLM
   call** until the Builder resolves the conflict.

2. **Hash + change detection (FR-047, FR-049).**

   ```bash
   atw-hash-inputs --root .atw --inputs \
     .atw/config/project.md .atw/config/brief.md \
     .atw/artifacts/schema-map.md .atw/artifacts/action-manifest.md
   ```

   - **Level 1**: all four hashes unchanged + existing
     `build-plan.md` → refinement mode: show current plan, ask
     *"What would you like to change?"*. **No LLM call.**
   - **Level 2**: one or more hashes changed → re-synthesize the
     plan, but preserve Builder hand-edits in the existing
     `build-plan.md` (FR-040).

3. **LLM synthesis.** Produce a draft `build-plan.md` anchored to
   the four upstream artifacts (Principle V, FR-034):
   - Every enrichment template must cite the entity it enriches.
   - Every category vocabulary must cite the column whose values it
     will derive.
   - Every embedding dimension choice must cite a sentence in this
     prompt block — no invented numbers.
   - Estimated entity counts come from the Builder during review,
     or default to `"estimated"` markers the Builder fills in.

4. **Cost estimate (FR-035).** Compute and display, **before** the
   confirmation gate:

   ```
   Enrichment calls:     <N>          (schema-map entities × per-entity multiplier)
   Per-call cost (USD):  <P>          (embedding + enrichment model constants)
   Subtotal (USD):       <N × P>
   Retry buffer (USD):   <B>          (+20 % per FR-035)
   Estimated total:      <N × P + B>
   ```

   Display the breakdown verbatim; do not collapse it into a single
   number.

5. **Interactive review (FR-036).** Walk the Builder through:
   - embedding approach and model,
   - category vocabularies per entity,
   - enrichment prompt templates per entity,
   - backend + widget configuration defaults,
   - build sequence.

   Accept overrides on each section. Overrides update the draft in
   memory only.

6. **Final confirmation gate (FR-041).** Re-display the cost
   estimate and summarize: *"Writing build plan: <N> enrichment
   calls, estimated <total> USD including retry buffer."*. Wait for
   affirmative reply.

7. **Write the artifact.** Pipe the serialized markdown through
   `atw-write-artifact --target .atw/artifacts/build-plan.md`. The
   write is atomic with a `.bak` sibling (FR-046).

8. **Announce completion.** End with exactly:

   *"Build plan written. Feature 001 is complete. Feature 002 will
   execute this plan."*

## Re-run semantics (FR-036, FR-040, FR-049)

- **Unchanged upstream** → Level 1 refinement mode (no LLM call).
- **Upstream changed** → re-synthesize only the affected sections;
  preserve Builder hand-edits elsewhere (FR-040).
- **Mid-command close before confirmation** → no persisted draft
  state; re-run re-synthesizes from the same inputs (FR-050).

## Failure handling

- **Missing upstream artifact** → halt with the exact next command
  to run (FR-037). No LLM call. The halt message names the missing
  artifact and the prior command by slug, e.g.:

  > *"Missing `schema-map.md`. Run `/atw.schema` first, then return
  > here."*

  > *"Missing `action-manifest.md`. Run `/atw.api` first, then
  > return here."*

- **Cross-artifact inconsistency** → surface the conflict, request
  resolution, no LLM call until resolved (FR-038). The four
  inconsistency kinds from [data-model.md §2.5] are rendered
  verbatim so the Builder knows which side to edit:
  - `action-references-excluded-entity`
  - `brief-references-missing-vocabulary`
  - `schema-map-references-missing-brief-section`
  - `plan-references-missing-upstream`
- **LLM auth / rate limit** → same handling as `/atw.brief`.
- **Cost estimate rejected by Builder** → treat as an override
  opportunity (revisit schema-map entity scoping, the per-entity
  multiplier, or the retry buffer), not a failure.

## Tooling

All deterministic work is delegated to `@atw/scripts`:

- `atw-validate-artifacts --root .atw` — wraps
  `packages/scripts/src/validate-artifacts.ts`. Exit codes: `0` all
  four upstream artifacts present and consistent, `1` one or more
  inconsistencies (FR-038), `2` one or more required upstream
  artifacts missing (FR-037), `3` bad CLI args. Emits the full
  `ArtifactConsistencyReport` (see [data-model.md §2.5]) on stdout.
- `packages/scripts/src/lib/cost-estimator.ts` — `estimateCost({
  entityCounts, perEntityMultiplier?, perCallCostUsd?,
  retryBufferRatio? })` returns a `CostEstimateBreakdown` with
  `enrichmentCalls`, `perCallCostUsd`, `totalCostUsd`, and
  `retryBufferUsd` (all four required by FR-035). `formatCostBreakdown`
  renders the five-line display used in Step 4.
- `atw-hash-inputs --root .atw --inputs …` — two-level re-run
  detection (FR-047, FR-049).
- `atw-load-artifact --kind <k> --source <path>` — used internally
  by `validate-artifacts` to load each of the four upstream files.
- `atw-write-artifact --target .atw/artifacts/build-plan.md` —
  atomic write with `.bak` sibling (FR-046).
