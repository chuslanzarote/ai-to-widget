# Quickstart — Verifying Feature 004 Locally

This quickstart is for a reviewer checking that the fix works end-to-end.
It maps onto the spec's User Story 1 (any Builder gets a working widget)
and User Story 2 (Aurelia demo works unmanagled).

## Prerequisites

- Docker running.
- Node 20+.
- An `ANTHROPIC_API_KEY` with enough credit for one Aurelia `/atw.build`
  (≈$14). Skip this only if you are verifying against a **pre-built**
  Aurelia state that already has `.atw/state/build-manifest.json` and
  `atw.sql` in place — see §4 below.

## 1. Install and branch

```bash
git clone <repo>
cd ai-to-widget
git checkout 004-ship-widget-bundle
npm install
npm run build --workspaces
```

## 2. Unit-level verification (fast, no Docker)

This confirms the core fix works without running the full pipeline.

```bash
cd packages/scripts
npx vitest run compile-widget
```

Expected: the new unit tests pass, including:

- Resolves the widget entry through `@atw/widget` with no CLI flag.
- Emits a `widget.js` with length > 1 KB (not the stub).
- Emits a manifest fragment containing `widget.source.package_version`
  and `widget.source.tree_hash`.
- Fails with exit code 3 / `WIDGET_SOURCE_MISSING` when `@atw/widget` is
  not installed (simulated via a temp directory fixture).
- Byte-identical output across two consecutive runs.
- Asserts the string `"no-op bundle"` is absent from the emitted
  `widget.js`.

## 3. Integration-level verification (requires fixture Builder)

```bash
cd packages/scripts
npx vitest run compile-widget.integration
```

Expected: a fixture host-project directory with only a `package.json`
(depending on `@atw/scripts`) runs `atw-compile-widget`, produces
`dist/widget.js` and `dist/widget.css`, and the JS contains the IIFE
banner `/* atw-widget */` but not the stub string.

## 4. Aurelia demo end-to-end (full verification, ≈ 20 min)

This is the User Story 2 acceptance path.

### 4a. Reviewer path (fast, if a pre-built `atw.sql` is committed)

```bash
cd demo/atw-aurelia
docker compose up -d            # brings up postgres + medusa + backend
cd ../..
npm run atw:build -w demo/atw-aurelia   # or: cd demo/atw-aurelia && claude, then /atw.build
```

Then `/atw.embed` in the same directory, answer the embed interview (or
pass `--answers-file`), then open the Aurelia storefront.

### 4b. Fresh Builder path (from a clean catalog)

Follow `specs/003-runtime/quickstart.md §3` verbatim. No step in that
quickstart should require a manual `cp` of widget files, nor any edit
to any file under `packages/widget/` or
`demo/atw-aurelia/dist/`.

## 5. Success criteria checklist

After §4 completes, verify each:

- [ ] `demo/atw-aurelia/dist/widget.js` exists and is > 1 KB.
- [ ] `demo/atw-aurelia/dist/widget.js` does NOT contain the substring
      `no-op bundle`.
- [ ] `demo/atw-aurelia/dist/widget.css` exists and is > 0 bytes of
      real CSS (contains a CSS rule, not just a comment).
- [ ] `gzip -c demo/atw-aurelia/dist/widget.js | wc -c` ≤ 81920.
- [ ] `gzip -c demo/atw-aurelia/dist/widget.css | wc -c` ≤ 10240.
- [ ] `demo/atw-aurelia/.atw/state/build-manifest.json` has a `widget`
      section with all fields required by
      `contracts/build-manifest-widget-section.md`.
- [ ] Storefront loads. Chat launcher appears (bottom-right).
- [ ] Clicking the launcher opens the panel.
- [ ] Sending a flavour-profile question (e.g., *"cafés chocolatosos
      para filtro"*) returns a reply that cites real products from
      the seeded catalog.
- [ ] Running `/atw.build` a second time with no input changes produces
      a byte-identical `widget.js` (`sha256sum` matches across runs).

## 6. Contributor workflow verification (User Story 4)

```bash
# Edit a visible string in packages/widget/src/panel.tsx
# (e.g., change the launcher label from "Chat" to "TEST-004")
cd demo/atw-aurelia
# Rerun /atw.build — no republish step, no manual copy
```

The storefront widget MUST show the new string after a page reload.

## 7. Rollback

If any of the above fails, revert the branch:

```bash
git checkout main
git branch -D 004-ship-widget-bundle
```

Feature 003's behaviour (stub + broken demo) is the pre-fix baseline and
is what `main` is supposed to still exhibit until this branch merges.
