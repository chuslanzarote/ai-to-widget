# Quickstart — OpenAPI-driven action catalog

**Feature**: 006-openapi-action-catalog
**Audience**: two distinct users, each with their own shortcut

This quickstart proves the end-to-end path: host OpenAPI → manifest →
tools → widget-executable actions. Both paths assume Feature 005's
reviewer flow already works; this feature closes the gap that made
`tools.ts` land empty.

---

## Path A — Reviewer (add-to-cart round-trip in under 3 minutes)

You want to see the widget put an item into Medusa's cart end-to-end,
without running the Builder pipeline yourself. The checked-in demo
(`demo/atw-aurelia/`) has this feature's artefacts already committed:
`.atw/artifacts/openapi.json`, `action-manifest.md`, and
`action-executors.json`, plus a non-empty `backend/src/tools.ts`.

**Prerequisites.** Docker Desktop running; `ANTHROPIC_API_KEY` set in
`.env`.

**Steps.**

```bash
git clone <repo-url> ai-to-widget
cd ai-to-widget
cp .env.example .env
# Edit .env to set ANTHROPIC_API_KEY (Principle I — the key is yours).

docker compose up -d --wait
```

Open http://localhost:8000. You land on the Aurelia coffee storefront,
pre-logged-in as the demo shopper (Medusa session cookie set by the
storefront's existing auth; no ATW involvement in the login).

**Exercise the action path.**

1. Click the widget launcher (bottom-right).
2. Type: *"Add a Midnight Roast 1kg whole bean to my cart."*
3. The widget shows a confirmation card summarising: product title,
   quantity, preview price. This is `action-card.tsx` reading the
   `summary[]` emitted by the backend's `ActionIntent`.
4. Click **Confirm**.
5. The widget sends a `POST /store/carts/{cart_id}/line-items` with
   `credentials: 'include'` directly to the host (Medusa at
   `http://localhost:9000` in the demo). The atw_backend process never
   sees this request.
6. On success, the confirmation card renders Medusa's response under
   the catalog's `summaryTemplate` — e.g., *"Added Midnight Roast 1kg
   whole bean ×1 to cart."*
7. Navigate to http://localhost:8000/cart — the item is there.

**Verify the sovereignty invariant (SC-007, Principle I).** In a
separate terminal:

```bash
docker compose logs atw_backend | grep -i -E 'cookie|authorization|session'
```

Expected: **zero** matches related to the shopper's Medusa session
cookie across the entire cart-add round-trip. The backend only ever
sees ATW's chat protocol payload; it cannot log what it does not
receive.

### What goes wrong and what to check

| Symptom | Likely cause | Fix |
|---|---|---|
| Widget responds in text only ("I can't do that from here") | `tools.ts` committed empty — feature not yet applied | regenerate: `cd demo/atw-aurelia && claude-code /atw.build` |
| Confirmation card says "Missing argument: cart_id" | shopper is not logged into Medusa; no cart cookie available | log into Medusa storefront first, then reopen widget |
| Cart fails with "Action request timed out" after 15s | Medusa container unhealthy or slow to start | `docker compose ps medusa_backend` — wait for `(healthy)` |
| Confirmation card renders raw HTML text from host | static audit regressed (dangerouslySetInnerHTML slipped in) | fail-safe: grep `packages/widget/src/action-card.tsx` for `dangerouslySetInnerHTML` — expected to be zero |
| Browser console shows `CORS preflight failed` on cart POST | host and widget are on different origins without CORS headers | warning should have been raised at build time; check `.atw/state/build-manifest.json` → `warnings[]` |

---

## Path B — Builder (end-to-end pipeline on a fresh project)

You are bootstrapping a new ATW project against a host that publishes
OpenAPI, and want to exercise every step the feature introduces:
`/atw.api` → `/atw.classify` → `/atw.build` → `/atw.embed`.

**Prerequisites.** Node.js ≥ 20, Claude Code CLI, Docker Desktop,
`ANTHROPIC_API_KEY`. The host's OpenAPI 3.0 document as either a local
file or reachable URL.

**Steps.**

```bash
# Bootstrap (existing features 001-002):
claude-code /atw.init my-host-project
cd my-host-project
claude-code /atw.brief
claude-code /atw.schema

# This feature's new step — ingest host OpenAPI:
claude-code /atw.api ./openapi.yaml
# or: claude-code /atw.api https://host.example.com/openapi.json
#
# -> validates OpenAPI 3.0.x shape (Swagger 2.0 rejected with diagnostic)
# -> resolves external $refs through @apidevtools/swagger-parser
# -> writes .atw/artifacts/openapi.json (canonicalised, stable key order)
# -> writes .atw/state/openapi-meta.json (sha256, fetched-at, source)

# This feature's classifier step (may be folded into /atw.plan):
claude-code /atw.classify
#
# -> Stage 1: deterministic heuristic pass (admin-prefix, non-cookie-
#    security, missing-request-schema, destructive-unowned rules)
# -> Stage 2: Opus narrowing review (can remove, never add)
# -> Stage 3: anchored-generation assertion — every kept operationId
#    must trace back to the candidate list or classifier aborts
# -> writes .atw/artifacts/action-manifest.md with Provenance,
#    Summary, Tools: sections, and an Excluded list

# Review the manifest by hand. This is the Builder-checkpoint (Principle IV).
$EDITOR .atw/artifacts/action-manifest.md
# Edit what you need:
# - flip `requires_confirmation: true` → `false` on a safe read-only op
# - remove an included entry you don't want exposed
# - inspect the Excluded list; move an entry back into Tools: if the
#   heuristic was too aggressive (re-run /atw.classify after)

# This feature's render step (folded into existing /atw.build):
claude-code /atw.build
# -> RENDER: now also reads action-manifest.md, derives
#    RuntimeToolDescriptor[], threads them as RenderContext.tools,
#    and writes .atw/artifacts/action-executors.json alongside the
#    rendered backend/src/** output
# -> BUNDLE: widget bundle unchanged (the widget reads
#    action-executors.json at runtime)
# -> IMAGE, COMPOSE, SCAN, MANIFEST: unchanged from Feature 005

claude-code /atw.embed
# -> emits .atw/artifacts/embed-guide.md with the widget <script> tag
#    pointing to the project's static-hosting base URL

# Bring it up:
cd ..
docker compose up -d --wait
```

Open http://localhost:8000 (or your host's reviewer URL) and exercise
at least one shopper action end-to-end.

### Expected artefacts after a full run

```
my-host-project/
├── .atw/
│   ├── artifacts/
│   │   ├── brief.md                      (feature 001)
│   │   ├── schema-map.md                 (feature 002)
│   │   ├── openapi.json                  (NEW: this feature)
│   │   ├── action-manifest.md            (NEW: this feature)
│   │   ├── action-executors.json         (NEW: this feature)
│   │   └── embed-guide.md                (feature 002)
│   └── state/
│       ├── openapi-meta.json             (NEW: sha256 + source)
│       ├── input-hashes.json             (EXTENDED: + openapi)
│       └── build-manifest.json
├── backend/src/
│   ├── tools.ts                          (NOW NON-EMPTY: N descriptors)
│   ├── routes/chat.ts                    (unchanged template output)
│   └── ...
└── widget/dist/
    ├── widget.js
    ├── widget.css
    └── action-executors.json             (served by static host)
```

---

## Verifying the determinism contract (SC-004, SC-005)

Re-running with no source changes is a no-op. From the project root:

```bash
claude-code /atw.api ./openapi.yaml          # action: unchanged
claude-code /atw.classify                    # action: unchanged
claude-code /atw.build                       # all steps action: unchanged
```

Byte-identical checks:

```bash
# Before re-run:
sha256sum .atw/artifacts/openapi.json \
          .atw/artifacts/action-manifest.md \
          .atw/artifacts/action-executors.json \
          backend/src/tools.ts > /tmp/before.sha256

claude-code /atw.build

# After re-run:
sha256sum .atw/artifacts/openapi.json \
          .atw/artifacts/action-manifest.md \
          .atw/artifacts/action-executors.json \
          backend/src/tools.ts > /tmp/after.sha256

diff /tmp/before.sha256 /tmp/after.sha256    # expected: empty
```

Cross-platform byte-identity (the harder contract): run the same
commands on Linux and Windows against the same OpenAPI input and the
same model snapshot. `openapi.json`, `action-manifest.md`,
`action-executors.json`, and `tools.ts` MUST have matching sha256s.

---

## Verifying graceful degradation (SC-010, FR-014)

**Case 1 — no OpenAPI ingested.**

```bash
# Skip /atw.api entirely on a fresh project.
claude-code /atw.build
```

Expected:
- The build completes with `result: "success"` in
  `build-manifest.json`.
- The backend still builds; `tools.ts` contains
  `RUNTIME_TOOLS: RuntimeToolDescriptor[] = []`.
- `action-executors.json` is NOT emitted (no manifest to derive from).
- The widget loads, shows the launcher, and operates in chat-only mode
  when opened.
- Exactly one build-time warning is printed: `No action-manifest.md —
  widget will be chat-only.`

**Case 2 — OpenAPI ingested, classifier returns zero included.**

```bash
# Simulate by editing action-manifest.md to delete every `### tool_name`
# block under every `## Tools:` heading, leaving only Excluded.
claude-code /atw.build
```

Expected:
- `action-executors.json` is emitted with `"actions": []` and the
  fixed `version` + `credentialMode` fields.
- Widget loads the empty catalog, sees zero entries, and operates in
  chat-only mode. No warning banner in the UI; a single build-time
  warning prints: `action-executors catalog has zero actions`.

---

## Verifying the anchored-generation invariant (SC-002, Principle V)

This is the hardest invariant to observe in passing tests; the best
confirmation is failure mode.

**Inject a fabricated operationId into the manifest by hand:**

```bash
$EDITOR .atw/artifacts/action-manifest.md
# Under `## Tools: cart`, add a fresh `### totally_fabricated` block
# whose `Source:` line names a path+method that does NOT exist in
# .atw/artifacts/openapi.json.
```

Then run:

```bash
claude-code /atw.build
```

Expected:
- Build exits non-zero.
- `ManifestValidationError`: `action-manifest.md entry "totally_fabricated"
  references OpenAPI operation POST /store/nonexistent which is not
  present in openapi.json.`
- `backend/src/tools.ts` is NOT rewritten.
- `action-executors.json` is NOT emitted.

Restore the manifest (git checkout) and the next run returns to
`action: unchanged`.

---

## Verifying the no-credential-templating invariant (SC-007, Principle I)

Strict static check, runnable at any time:

```bash
grep -ri -E '(Authorization|Bearer|Cookie|session.?token)' \
  packages/backend/src/*.hbs packages/backend/src/**/*.hbs \
  | grep -v "^.*\.hbs: *\*.*$"           # filter out comments
```

Expected: **zero** matches. The rendered backend never issues an
`Authorization` header, never reads a `Cookie` header, never
forwards one. The same check on the rendered output:

```bash
grep -ri -E '(Authorization|Bearer|Cookie|session.?token)' \
  demo/atw-aurelia/backend/src/
```

Expected: zero matches.

And the catalog-level check — no catalog entry may include a
credential-class header:

```bash
jq '.actions[] | select(.headers | keys | map(ascii_downcase) |
     any(. == "authorization" or . == "cookie"
         or startswith("x-") and endswith("-token")))' \
  demo/atw-aurelia/.atw/artifacts/action-executors.json
```

Expected: no output (catalog passes the refinement).

---

## Command cheatsheet

| Command | When to run | Side effects |
|---|---|---|
| `/atw.api <file-or-url>` | Host publishes a new OpenAPI version; you want to pin it. | Writes `.atw/artifacts/openapi.json`, `.atw/state/openapi-meta.json`. |
| `/atw.classify` | OpenAPI changed OR Builder wants a fresh classification pass. | Writes `.atw/artifacts/action-manifest.md` (delta-merges Builder edits). |
| `/atw.build` | Any upstream artefact changed, including manifest edits. | RENDER, BUNDLE, IMAGE, COMPOSE, SCAN, MANIFEST. Now also writes `.atw/artifacts/action-executors.json`. |
| `/atw.embed` | After a successful build, to get the embed snippet. | Writes `.atw/artifacts/embed-guide.md`. |

Editing `action-manifest.md` by hand between `/atw.classify` and
`/atw.build` is supported and expected; the next `/atw.classify`
preserves your edits via delta-merge (R7).
