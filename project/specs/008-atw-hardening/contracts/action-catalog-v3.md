# Contract: `action-executors.json` — v3

**Feature**: 008-atw-hardening
**Amends**: Feature 007 `action-catalog-v2.md`.
**Producer**: `packages/scripts/src/render-executors.ts` (via `/atw.build`).
**Consumers**: widget action-executor engine; `/atw.embed` allow-list derivation.

## Shape (v3 additions marked)

```jsonc
[
  {
    "tool": "addToCart",
    "endpoint": { "method": "POST", "path": "/cart/items" },
    "arguments": { /* JSON-schema-like shape */ },
    "confirmationRequired": true,

    // v2 field — now REQUIRED when source.security is non-empty
    "credentialSource": {
      "type": "bearer-localstorage",
      "key": "shop_auth_token",
      "header": "Authorization",
      "scheme": "Bearer"
    },

    // v3 — optional
    "summaryTemplate": "Add {{ quantity }}× {{ product_name }} to your cart",

    // v3 — optional; round-tripped from action-manifest's `(runtime-only)` group flag
    "runtimeOnly": true,

    // v3 — optional; drives host-requirements.md tool-specific section
    "hostPrerequisite": "Shop backend must run `npx prisma migrate deploy` at startup.",

    // existing source trace — v3 requires .security populated for authed ops
    "source": {
      "openapiOperationId": "addToCart",
      "security": [{ "bearerAuth": [] }]
    }
  }
]
```

## Invariants (v3)

1. **Credential-source authority (FR-013).** If `entry.source.security` is non-empty, `entry.credentialSource` MUST be present and well-formed. The rendering stage refuses to emit the catalog otherwise; the build halts with the diagnostic documented in `builder-diagnostics.md#D-CREDSRC`.
2. **Backfill ordering.** `crossValidateAgainstOpenAPI` MUST run before `render-executors.ts`. The backfill copies each operation's `security` list from the loaded OpenAPI document to `entry.source.security`. `render-executors.ts` then generates `credentialSource` from that value.
3. **Template determinism (FR-026).** `summaryTemplate`, if present, uses `{{ name }}` placeholders referencing keys from `arguments`. Unknown placeholders cause a widget-side fallback to raw JSON at render time; the build does not halt.
4. **Allow-list derivation (FR-015).** `/atw.embed` enumerates the `tool` field of every entry, sorts alphabetically, and emits the list as `data-allowed-tools` on the script tag. Tool names MUST NOT contain commas.

## Contract tests

1. **Backfill happy path.** Given an OpenAPI doc declaring `security: [{ bearerAuth: [] }]` on `POST /cart/items`, the rendered catalog entry for `addToCart` carries `credentialSource: { type: "bearer-localstorage", key: "<authTokenKey>", header: "Authorization", scheme: "Bearer" }`.
2. **Backfill halt path.** Given an OpenAPI doc with a shopper-scoped operation that declares no security, the build halts with the R3 diagnostic; no catalog is written.
3. **Deterministic allow-list.** Two runs against unchanged inputs emit byte-identical `data-allowed-tools` values.
4. **Template fallback.** A `summaryTemplate` referencing an undeclared argument causes the widget's ActionCard to render the raw-JSON fallback (not an error).
5. **Runtime-only round-trip.** A manifest group flagged `(runtime-only)` produces catalog entries with `runtimeOnly: true` that pass `validate-artifacts.ts` even when their target entity is absent from `schema-map.md`.
