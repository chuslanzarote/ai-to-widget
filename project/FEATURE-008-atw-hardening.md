# Feature 008 — ATW Hardening

**Status:** draft / scope capture
**Authored:** 2026-04-24
**Origin:** Feature 007 demo run against `demo/atw-shop-host` (coffee reference shop). Every item below was surfaced by either (a) a failure encountered during the run, or (b) a UX gap the user noticed while operating the widget as an end-shopper.

## Goal

Close all remaining gaps between the `/atw.*` setup flow, the generated runtime, and the widget such that a fresh `/atw.init … /atw.embed` sequence against a clean host can reach a working tool loop without hand-editing artifacts, without undocumented conventions, and without silent failures.

## Non-goals

- No new features beyond closing these gaps.
- No redesign of the widget's rendering pipeline or conversation state shape beyond what is strictly needed to fix the tool-loop contract drift (D1).
- No re-introduction of the client-routing "navigation pills" experiment — explicitly out of scope (E2 removes them).

## Scope themes

Five themes grouping 22 items. Numbers with a `#N` suffix cross-reference the gap list in memory (`project_atw_skill_gaps_f007.md`, gaps #1–#16).

---

## A. Setup flow — capture upfront

Things the `/atw.*` slash commands must ask the Builder (or emit) during the setup conversation so later stages don't have to guess.

### A1. Capture host domain + CORS origin during `/atw.init`  _(#9)_

- **Problem:** `/atw.build`'s RENDER step emitted 8 `cross-origin action … host http://localhost:9000 !== widget http://localhost:8000` warnings because nothing in the setup flow ever asked where the widget will be hosted. The renderer then shipped with mismatched `ALLOWED_ORIGINS` defaults.
- **Fix:** add an interactive prompt in `/atw.init` that captures the storefront origin(s) the widget will run on. Persist it in `.atw/config/project.md`. Downstream render-backend uses it to set `ALLOWED_ORIGINS` and widget/host URL defaults. Removes the RENDER warnings and removes the class of "works locally, breaks once deployed" bugs.

### A2. Capture configurable welcome message during `/atw.init`

- **Problem:** the widget currently renders with a hard-coded greeting that is not specific to the Builder's brand or product.
- **Fix:** in `/atw.init`, ask the Builder for a short welcome message (with a sane default). Store in `.atw/config/project.md`. See also E3 (widget-side surfacing).

### A3. New artifact `.atw/artifacts/host-requirements.md` produced by `/atw.api`

- **Problem:** a host that integrates the generated widget has hard requirements (CORS for the storefront origin, `Authorization` header allowed on preflight, a `localStorage` bearer token under a known key, a known login URL, etc.). Today these are spread across embed-guide prose, TL;DR README lines, and tribal knowledge. Feature 007's demo failed at each of them in turn.
- **Fix:** `/atw.api` writes a `host-requirements.md` artifact that enumerates every contract the host must satisfy for the generated widget to work. The file must be:
  1. **Surfaced to the Builder mid-flow** — `/atw.api` prints a short "your host must provide these" summary and points at the file.
  2. **Re-used in post-setup troubleshooting** — when the Builder asks Claude "why doesn't my widget work?", the file is the first thing Claude checks against the real host.
- Required checklist content (minimum):
  - CORS origin(s) allowed (matches A1)
  - Preflight `Authorization` header allowed, verbs allowed (GET/POST/PATCH/DELETE/OPTIONS)
  - Bearer-token localStorage key (matches C1's `data-auth-token-key`)
  - Login URL the widget redirects to on 401
  - Any tool-specific prerequisites surfaced from the action catalog

### A4. Guide the Builder to produce the SQL dump  _(#7)_

- **Problem:** `/atw.build` halts with a one-liner if `.atw/inputs/<name>.sql` is missing, but no prior slash command walks the Builder through generating it.
- **Fix:** during `/atw.schema` or `/atw.plan`, either (a) prompt the Builder interactively for the dump location and save the exact `pg_dump` command into `.atw/inputs/README.md`, or (b) make the `/atw.build` halt diagnostic include the exact `pg_dump` invocation derived from `schema-map.md` plus the shop's connection info. Prefer (a) — fail early, with context.

### A5. Post-build DONE banner + next-steps checklist  _(#10)_

- **Problem:** `/atw.build` produces `dist/widget.js` and `dist/widget.css` but never tells the Builder what to do with them. `/atw.embed` exists but is not advertised from `/atw.build`.
- **Fix:** add an explicit "Next steps" section to the `/atw.build` DONE banner:
  1. Run `/atw.embed` to get your integration snippet.
  2. Copy `dist/widget.{js,css}` into your host's public assets.
  3. Copy `.atw/artifacts/action-executors.json` into your host's public assets (see C3).
  4. Paste the snippet (see C4) into your host HTML.

---

## B. Setup correctness

Bugs in the setup flow itself — things that are wrong today and silently force the Builder into hand-edits.

### B1. `atw-hash-inputs` vs `atw-api` schema mismatch  _(#4)_

- **Files:** `packages/scripts/src/lib/input-hashes.ts` vs `packages/scripts/src/atw-api.ts`.
- **Problem:** `atw-api` writes `{schema_version: "1", files: {...}}`; the validator for `atw-hash-inputs` expects `{version: 1, entries: [...]}`. Running `atw-hash-inputs` after `atw-api` throws a schema-validation error.
- **Fix:** pick one shape, migrate the other. Add a schema regression test.

### B2. `atw-hash-inputs` CLI arg shape vs skill docs  _(#5)_

- **Problem:** `/atw.plan` documents `--inputs a.md b.md c.md`; the CLI fails with "Unexpected argument", appearing to expect comma-separated values after a single `--inputs`.
- **Fix:** align skill docs and CLI. Teach the CLI to accept positional args after `--inputs` (preferred — the doc form is more readable).

### B3. `/atw.init` emits unquoted ISO timestamps, Zod rejects them  _(#6)_

- **Problem:** `atw-write-artifact` emits unquoted YAML timestamps in `project.md`. Downstream Zod schema expects `string`, receives `date`, fails validation on a fresh setup.
- **Fix:** `atw-write-artifact` must quote timestamps when emitting YAML frontmatter.

### B4. Schema-map parser expects H2, sample uses H3  _(#3)_

- **Files:** `packages/scripts/src/lib/markdown.ts:225-255` vs `examples/sample-schema-map.md`.
- **Problem:** the parser uses `extractSections(tree)` default level 2; the sample uses `### Entity:`. Hand-authored schema-maps following the sample produce zero parsed entities silently.
- **Fix:** pick one convention and align both. If keeping the parser at H2, update the sample. If accepting H3, extend the parser. Either way: fail loudly when a file's entity-heading count parses to zero.

### B5. Classifier Stage 1 rule 2 over-rejects bearer-JWT security  _(#1)_

- **File:** `packages/scripts/src/atw-classify.ts` (+ `lib/admin-detection.ts`).
- **Problem:** Stage 1 rule 2 rejects every op with `bearerFormat: "JWT"` as `non-cookie-security`. Feature 007's whole point is that shopper-owned endpoints (`/cart`, `/orders`, `/customers/me`) run in the widget with the shopper's bearer token. The rule sends them all to `excluded[]`.
- **Fix:** gate the rule behind an explicit config signal (e.g. `deploymentType: customer-facing-widget` in `project.md`, or a `shopperBearerAllowed: true` flag surfaced in `host-requirements.md`). When the signal is on, bearer-JWT with a shopper-scoped operation is accepted, not excluded.

### B6. Classifier group-name vs entity-name normalization  _(#8)_

- **File:** `validate-artifacts.ts:134`.
- **Problem:** classifier emits tool groups named after OpenAPI tags (plural: `products`); schema-map uses singular entity names (`Product`). `normalize("Products") !== normalize("Product")`.
- **Fix:** extend normalization to tolerate singular/plural, OR agree on a single convention end-to-end. Prefer normalization (more forgiving).

### B7. Validator `action-references-excluded-entity` blocks non-indexed tool groups  _(#2)_

- **File:** `packages/scripts/src/validate-artifacts.ts:140-175`.
- **Problem:** the validator requires every `## Tools: <group>` to match an entity in `schema-map.md`. Under Feature 007 many tool groups target per-shopper endpoints whose tables are correctly excluded from indexing. The rule no longer holds.
- **Fix:** add a `runtime-only: true` flag for action-manifest tool groups (or check classification rather than presence). `runtime-only` tool groups are allowed to reference entities that are absent from, or explicitly excluded in, `schema-map.md`.

### B8. `crossValidateAgainstOpenAPI` must copy `security` from OpenAPI  _(#15)_

- **Files:** `packages/scripts/src/parse-action-manifest.ts:433-460` + `523-553`, `render-executors.ts:168-184`.
- **Problem:** `render-executors.ts` emits the `credentialSource` block only when `entry.source.security` is non-empty. That field can be set only via a `(bearerAuth)` suffix on the Source line, which the classifier does not emit and `crossValidateAgainstOpenAPI` does not backfill. When absent, the catalog ships `credentialSource: undefined`, the widget never attaches `Authorization`, every authed tool 401s, and the symptom surfaces far from the root cause ("something went wrong").
- **Fix:** `crossValidateAgainstOpenAPI` copies the operation's `security` list from the OpenAPI doc into `entry.source.security` (authoritative + anchored-generation friendly). Additionally document the `Source: METHOD /path (scheme)` convention in any doc a Builder might hand-edit, so manual edits don't silently drop it.

---

## C. Embed outputs

Things `/atw.embed` must emit so a fresh embed produces a working widget without hand-patching.

### C1. Rename `data-bearer-storage-key` → `data-auth-token-key`  _(#11)_

- **Files:** `/atw.embed` template vs `packages/widget/src/config.ts:72-77`.
- **Problem:** embed-guide emits `data-bearer-storage-key`; widget reads `attrs.authTokenKey` i.e. `data-auth-token-key`. Widget fails config validation on a fresh embed and disables the launcher silently until the Builder traces the console error.
- **Fix:** align on `data-auth-token-key` (matches the TS field). Update the embed template.

### C2. Embed-guide must emit `data-allowed-tools`  _(#13)_

- **Files:** `/atw.embed` template + `packages/widget/src/index.ts:25` + `api-client-action.ts:54`.
- **Problem:** `config.allowedTools` defaults to `[]`; every tool call throws `ToolNotAllowedError`; widget synthesises `{is_error: true, content: "tool X not allowed by widget"}`; next turn fails with "Something went wrong on our side."
- **Fix:** `/atw.embed` derives the allow-list from `.atw/artifacts/action-executors.json` (one entry per `action.tool`) and emits `data-allowed-tools="a,b,c,..."` on the generated `<script>` tag. Also: surface `ToolNotAllowedError` as a visible chat warning instead of a silent synthetic reply (fail loud).

### C3. Embed-guide must instruct copying `action-executors.json`  _(#12)_

- **Files:** `/atw.embed` template + `packages/widget/src/action-executors.ts` + `panel.tsx:92-107`.
- **Problem:** `/atw.embed` tells the Builder to copy only `widget.js` + `widget.css`. The widget also needs `.atw/artifacts/action-executors.json` served at the same origin or it falls back to chat-only (`actionCapable = false`) and silently ignores every `ActionIntent`.
- **Fix:** extend the embed-guide to require copying `action-executors.json` into the host's public assets. Also: when the backend emits an intent while `actionCapable === false`, surface a loud in-widget error (not just `console.warn`) so the Builder sees *why*.

### C4. `/atw.embed` emits a visible files-to-copy checklist

- **Problem:** the embed-guide is prose. Builders miss steps.
- **Fix:** the `/atw.embed` output includes a short explicit checklist block:

  > **Files to copy into your host's public assets:**
  > - [ ] `dist/widget.js`
  > - [ ] `dist/widget.css`
  > - [ ] `.atw/artifacts/action-executors.json`
  >
  > **Snippet to paste in your HTML `<body>`:** ``<script src="/widget.js" defer …>``

---

## D. Runtime

Code fixes that are not in the setup flow but are exercised by a successful setup.

### D1. Chat-endpoint v2 — close the contract-vs-code drift on the tool loop  _(#16)_

- **Files:** `specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md` §Request shape lines 17-20, 103; `packages/scripts/src/lib/types.ts:747-766` (`ToolResultPayloadSchema`, `ChatRequestSchema`, `ConversationTurnSchema`); `packages/widget/src/panel.tsx` + `loop-driver.ts`; `demo/atw-shop-host/backend/src/routes/chat.ts:109-124`.
- **Problem:** the contract says the widget carries an `assistant`-role turn whose content is an array including the `tool_use` block. In the code, `ConversationTurnSchema.content` is string-only; the widget never appends an assistant turn for the `tool_use`; the backend pushes a `tool_result` with no matching `tool_use`; Anthropic rejects with *"unexpected tool_use_id found in tool_result blocks — each tool_result block must have a corresponding tool_use block in the previous message"*. Every first write-action fails with "Something went wrong on our side."
- **Approach — A (chosen):** keep the second Opus pass. The backend receives the widget's tool_result, reconstructs the Anthropic `[user, assistant:tool_use, user:tool_result]` message sequence, re-invokes Opus, and streams the natural-language reply back to the widget. This preserves the model's voice on the post-action reply ("Added 1× Espresso to your cart — want to checkout?") instead of a templated "action succeeded" blob.
- **Contract alignment:** the widget is NOT required to carry the typed assistant turn. Instead:
  - Extend `ToolResultPayloadSchema` so the widget sends enough information for the backend to reconstruct the `tool_use` block without session state: at minimum `tool_name` and `tool_input` (the arguments the widget actually executed against the host), alongside the existing `tool_use_id` and `content` / `is_error`.
  - Backend owns the Anthropic-shape message assembly. Widget stays stateless wrt Opus message shape.
  - Rewrite `contracts/chat-endpoint-v2.md` so the documented request shape matches the one the code actually sends.
  - `ConversationTurn.content` remains string-only. No ripple to render templates, widget state, or prompt composer.
- **Explicitly rejected — Approach B:** backend templates the reply from the tool result. Rejected because it loses the model's ability to weave tool output into the conversation naturally.

### D2. Reference shop ships with CORS + document as a hard host contract  _(#14)_

- **Files:** `demo/shop/backend/src/index.ts` + `package.json`.
- **Problem:** the shop Fastify app had no `@fastify/cors`. Browser preflight `OPTIONS /cart/items` returned 404; the real POST never left the browser. Fixed in-session for the demo by adding `@fastify/cors` 9.0.1 + registering it with `ALLOWED_ORIGINS` env override.
- **Fix:** land the in-session fix permanently in `demo/shop`, AND add CORS + allowed-`Authorization`-header as a hard requirement in the new `host-requirements.md` artifact (A3). Feature 007's architecture puts the shop API call in the browser — CORS is a non-optional host contract, not a shop-specific implementation detail.

---

## E. Widget UX

End-user-visible polish. None of these are blockers for the tool loop, but each one surfaced as an unpleasant moment while operating the widget manually on 2026-04-24.

### E1. Loading indicator during long turns

- **Problem:** when Opus takes > 1s to reply (common on tool-loop turns where the backend re-invokes Opus after the tool result), the widget shows no activity. The user doesn't know whether the message was sent.
- **Fix:** render a typing / thinking indicator in the transcript while a request is in flight. Remove it the moment the first delta / final response lands.

### E2. Remove client-routing "navigation pills"

- **Problem:** the widget currently renders citation / navigation links as pills (e.g. `http://host/Products/<id>`). Without a proper client-router integration those links blow away the widget's in-page state and the conversation, which is worse than showing nothing.
- **Fix:** remove the pills from the render pipeline until a client-routing integration is designed post-hackathon. Leave the markdown hook in place if it's cheap, but do not surface the link UI.

### E3. Configurable welcome message (widget-side)

- **Problem:** the widget greeting is hard-coded.
- **Fix:** widget reads the welcome message from config (set by A2 during `/atw.init`, threaded through `project.md` → embed-guide → loader attribute or catalog metadata). Sane default when unset.

### E4. ActionCard renders a human-readable summary

- **Problem:** the pending-action confirmation card shows raw JSON-ish parameters. An end shopper reading "`product_id: a1f2…` × 1" can't tell what they're about to buy.
- **Fix:** use the action catalog's `description_template` (or an explicit `summary_template`) to render a human-readable sentence ("Add 1× **Espresso** to your cart") in the ActionCard. Fall back to the current raw view only when no template is available.

---

## Out of scope (explicit)

- Broader migration of `ConversationTurn.content` to `string | ContentBlock[]`. D1 uses Approach A specifically so this migration is not needed.
- Any reintroduction of navigation pills or client-routing coupling (E2).
- New ATW skills beyond the fixes above.
- Any change to the Medusa testbed (long gone).

## Cross-references

- Origin gaps list: memory `project_atw_skill_gaps_f007.md` (gaps #1–#16).
- Feature 007 artifacts: `specs/007-widget-tool-loop/` (spec, plan, contracts, data-model, quickstart).
- Constitution (binding): `.specify/memory/constitution.md`.
