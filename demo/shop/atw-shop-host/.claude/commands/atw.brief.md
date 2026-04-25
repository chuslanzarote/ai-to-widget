---
description: "Interview the Builder and synthesize a business brief."
argument-hint: "(no arguments)"
---

# `/atw.brief`

**Purpose.** Capture the business context of the Builder's client via a
guided 10–15 minute conversation, then synthesize an anchored markdown
brief. 1 LLM call for synthesis (FR-011, FR-012).

## Preconditions

- `.atw/config/project.md` exists (run `/atw.init` if not).
- `.atw/config/` is writable.

## Steps

1. **Detect re-run (FR-015, FR-049 L1).** If `.atw/config/brief.md`
   exists, run

   ```bash
   atw-hash-inputs --root .atw --inputs .atw/config/brief.md
   ```

   to hash the committed artifact. When the artifact exists and its
   hash is unchanged versus `.atw/state/input-hashes.json`, enter
   **Level 1 refinement mode**: load the brief via `atw-load-artifact
   --kind brief`, summarize captured content in bullet form, and ask
   *"What would you like to change?"*. Skip the full interview.
   **No LLM call** happens on this branch.

2. **Eight-question interview** (new runs only):

   1. *Business scope* — what the client sells and what its core
      operations are.
   2. *Customers* — who the client serves (segment, geography,
      sophistication).
   3. *Agent's allowed actions* — what the agent may do on behalf of a
      customer.
   4. *Agent's forbidden actions* — what the agent must never do.
   5. *Tone* — how the agent should read (warm / precise / playful /
      terse / …).
   6. *Primary use cases* — 3–5 concrete scenarios.
   7. *Business vocabulary* — term + one-line definition pairs.
   8. *Anti-patterns (optional)* — industry pitfalls to avoid.

3. **Contradiction check (FR-014).** Run
   `contradiction-check.ts` over the collected answers. If two
   answers conflict (e.g., *"never discuss price"* followed by a use
   case that asks for price negotiation), surface the conflict
   verbatim using the helper's `disambiguationPrompt` and ask which
   applies. Do not silently pick one.

4. **Anchored synthesis (FR-013, Principle V).** Issue the synthesis
   LLM call with this rule-set in the system prompt:

   - Every sentence in the draft must be traceable to a Builder
     statement captured above.
   - Do not invent customers, actions, vocabulary, or anti-patterns.
   - If a section has no Builder input, emit the heading followed by a
     short placeholder note (e.g., *"No anti-patterns were supplied
     in this brief."*) rather than synthesized prose.
   - Tone of the brief itself is neutral / factual — the Builder's
     requested *agent* tone is captured as data, not mirrored in the
     brief.

   After the draft comes back, run `brief-synthesis.ts`'s
   `verifyBriefAnchoring(draft, answers)` as a post-hoc check. Any
   sentence returned in `unsupportedClaims` is presented to the
   Builder as *"I couldn't trace this to what you said. Keep it
   (and anchor it) or drop it?"* — never silently.

5. **Confirmation gate.** Present the full draft to the Builder
   verbatim. Accept one of:
   - *"Looks good"* → proceed to write.
   - *"Change X to Y"* → edit in place and re-show. Do **not** write
     between the proposal and the final confirmation (FR-012, FR-050).

6. **Write the artifact.**

   ```bash
   cat <<'EOF' | atw-write-artifact --target .atw/config/brief.md
   # Business Brief

   ## Business scope
   ...
   ## Customers
   ...
   ## Agent's allowed actions
   - ...
   ## Agent's forbidden actions
   - ...
   ## Tone
   ...
   ## Primary use cases
   - ...
   ## Business vocabulary
   - **Term** — definition.
   ## Anti-patterns
   - ... (or placeholder)
   EOF
   ```

   Structure must match [examples/sample-brief.md](../examples/sample-brief.md)
   (identical `## Headings` in the same order).

7. **Announce next step.** End with exactly:

   *"Brief written. Next: run `/atw.schema`."*

## Failure handling

- **LLM auth failure.** Halt with a one-line message naming the env
  var the Builder must export (`ANTHROPIC_API_KEY`) (FR-043).
- **LLM rate limit.** Exponential backoff (1s → 2s → 4s), maximum
  3 attempts, then halt with an actionable message (FR-044).
- **Mid-command close.** The proposal is discarded. Re-run the
  command to re-synthesize (FR-050).

## Atomicity notes

Nothing is persisted under `.atw/` between the first draft and the
Builder's final confirmation. The LLM output lives in conversation
memory only. If the Builder closes Claude Code before confirming, the
next run starts over from step 1 (FR-050).

## Tooling

- `atw-hash-inputs --root .atw --inputs .atw/config/brief.md` — Level
  1 change detection for the brief artifact (FR-047, FR-049).
- `atw-load-artifact --kind brief --source .atw/config/brief.md` —
  loads the prior brief for refinement-mode summarization.
- `atw-write-artifact --target .atw/config/brief.md` — atomic write
  with `.bak` sibling (FR-046).
