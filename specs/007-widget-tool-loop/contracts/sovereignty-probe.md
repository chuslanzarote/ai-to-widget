# Contract: Data-Sovereignty Verification Procedure

**Feature**: 007-widget-tool-loop
**Implements**: FR-023 and SC-008.
**Invariant enforced**: Principle I — the ATW backend never issues any request against the shop's API.
**Consumer**: CI (wired into the existing `/atw.build` gate).

## Purpose

Make Principle I mechanically verifiable, so a pull request that reintroduces a server-side call to the shop API fails in CI before it can merge. Without this probe, the red line is only enforced by reviewer discipline; with it, enforcement is a hard gate.

## Procedure (high level)

1. Render the backend template pack against a fixture OpenAPI input (the standard `/atw.build` render step).
2. Walk every rendered `.ts` file in the output directory.
3. For each file, extract every `fetch(` call-site.
4. For each call-site, statically resolve the URL expression.
5. Classify each resolved URL against the **allowlist**.
6. Any call-site whose URL does not fall into an allowlisted category fails the probe.

## Allowlist

A resolved URL is allowed only if it matches one of:

- **Empty set.** No `fetch(` at all in the rendered backend is the nominal outcome — all outbound ATW-backend HTTP goes through the Anthropic SDK (which is outside the rendered source) or through the `pg` driver (which is not `fetch`).
- **`localhost` / `127.0.0.1` / same-container hostname** (e.g. `atw_postgres`, `http://atw_backend:PORT/health`). Self-health-check endpoints and same-compose-network services.
- **A literal string beginning with `http://localhost`, `http://127.0.0.1`, or `http://` followed by a service name listed in `docker-compose.yml`'s services for `atw_backend`.** (Cross-referenced dynamically at test time.)

Everything else — including any URL that interpolates an environment variable like `HOST_API_BASE_URL` — fails the probe.

## URL resolution rules

The probe's URL classifier works off the AST, not runtime behaviour:

- **String literal.** Resolved to its value and checked against the allowlist.
- **Template literal with static head.** The static prefix before the first interpolation is extracted. If the prefix matches an allowlisted origin, the call-site is allowed; otherwise it fails.
- **Reference to an identifier** (e.g. `fetch(HOST_API_BASE_URL)`). The probe follows the identifier to its definition site (same file, then imported modules). If the definition is a string literal, resolve as above; if the definition reads from `process.env`, the call-site fails regardless of the env var name (the principle is about the code path, not the env value).
- **Any other shape** (dynamic concatenation from an unknown expression) fails closed.

## Implementation

Implemented as a Vitest contract test under `packages/scripts/test/sovereignty.contract.test.ts`:

```text
packages/scripts/test/
└── sovereignty.contract.test.ts   # NEW — implements this procedure.
```

The test:
1. Invokes the backend renderer against a fixture OpenAPI with at least one authenticated endpoint.
2. Scans the rendered output directory recursively.
3. For each `.ts` file, parses with the TypeScript compiler API.
4. Visits every `CallExpression` whose callee is `fetch` or `globalThis.fetch`.
5. Resolves the first argument per the rules above.
6. Assembles a list of (file, line, resolved-url-or-unresolvable) tuples.
7. Asserts the list is empty OR every entry is allowlisted.
8. On failure, reports every offending call-site with path, line number, and resolved expression.

## Performance budget

The probe scans a small rendered source tree (~15–20 files, a few thousand LOC). Runtime under 60 seconds is the SC-008 target. Expected actual runtime: under 5 seconds.

## CI wiring

The test is part of the standard `packages/scripts` test run and gates the `/atw.build` CI job. A PR that reintroduces a server-side shop call makes this test fail, blocking merge.

## Manual-run equivalent

For local verification, the Builder Owner can run:

```bash
cd packages/scripts
npm run test -- sovereignty.contract.test.ts
```

A single pass/fail line is emitted on stdout (per SC-008's "single pass/fail result" requirement).

## Regression narrative

The purpose of this probe is to make the red line self-enforcing. A future contributor who writes:

```ts
// packages/backend/src/routes/chat.ts.hbs
const response = await fetch(`${process.env.SHOP_API_BASE_URL}/products`);
```

…triggers a failure in CI with a clear message pointing at the line, before the change can merge. Principle I is preserved by construction.
