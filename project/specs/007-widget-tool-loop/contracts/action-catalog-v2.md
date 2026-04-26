# Contract: `action-executors.json` (v2 — credentialSource field)

**Feature**: 007-widget-tool-loop
**Amends**: Feature 006's action-catalog emission.
**Producer**: `packages/scripts/src/lib/manifest-builder.ts` (`/atw.build`).
**Consumer**: the widget's action-executor engine (`packages/widget`).
**Status**: Additive amendment — one new optional field per entry. Entries without the field behave exactly as before.

## Motivation

Feature 006 emits declarative action recipes (path template, method, header keys, request-body substitution, response-handling template). The widget's action-executor engine interprets those recipes at fetch time. Feature 007 introduces bearer-JWT authentication (Clarification Q3). The widget needs to know — per operation — *where* the bearer token lives. Hardcoding `localStorage[shop_auth_token]` inside the widget couples the widget to one testbed. Declaring the source per operation in the action catalog keeps the widget generic and keeps the constitution's Principle V (Anchored Generation) honest: every credential injection traces to a declaration in the shop's OpenAPI.

## New field

Each entry in `actions[]` MAY carry an optional `credentialSource` block. For v1, exactly one variant is emitted:

```jsonc
{
  "tool": "listMyOrders",
  "method": "GET",
  "pathTemplate": "/orders",
  "headers": {},
  "substitution": { "path": {}, "query": {}, "body": {} },
  "responseHandling": { ... },

  // NEW — optional.
  "credentialSource": {
    "type": "bearer-localstorage",
    "key": "shop_auth_token",
    "header": "Authorization",
    "scheme": "Bearer"
  }
}
```

### Field semantics

- **`type`**: `"bearer-localstorage"` is the only variant v1 defines. The engine rejects unknown types at load time (fail-closed).
- **`key`**: the `localStorage` key the widget reads at fetch time.
- **`header`**: the HTTP header to set on the outgoing request. Always `"Authorization"` for v1.
- **`scheme`**: the token prefix. Always `"Bearer"` for v1; the engine emits `<scheme> <token>` as the header value.

### Absence semantics

- Entries without a `credentialSource` block invoke the endpoint without credentials. This covers public catalogue reads (`listProducts`, `getProduct`) whose OpenAPI operations do not declare `bearerAuth`.
- Entries whose OpenAPI operation declares `bearerAuth` MUST have a `credentialSource` block at build time. A missing block on such an operation is a manifest-build failure.

### Missing-token runtime behaviour

If the widget reads the declared `key` from `localStorage` and gets `null` or an empty string, the widget MUST NOT send the request. It MUST synthesize a failure `tool_result` with `is_error: true`, `status: 0`, `content: "not authenticated"`, and post it back. This lets Opus tell the shopper to log in again (US2 AC3).

## Emission rule (manifest-builder)

When the manifest builder walks the OpenAPI document:

1. For each operation, look up its `security` array.
2. If the operation's security requires `bearerAuth` (as declared in `components.securitySchemes`), emit a `credentialSource` block with the four fields above, pinning `key` to the value configured for the shop (v1: `"shop_auth_token"`).
3. If the operation has no security requirement, omit the block.
4. If the operation requires a security scheme other than `bearerAuth` (e.g., OAuth2), fail the build with an unambiguous error — this is out of scope for v1.

The `key` value comes from the shop's setup configuration (`.atw/setup.yaml` or equivalent) so the same manifest builder can, in principle, target shops with different storage-key conventions in future features. For v1, the value is fixed at `shop_auth_token`.

## Engine behaviour (widget)

The widget's action-executor (`packages/widget/src/chat/action-runner.ts`) extends its header-resolution step:

1. Start from the recipe's static `headers` object.
2. If `credentialSource` is present:
   a. Read `window.localStorage.getItem(credentialSource.key)`.
   b. If the value is non-empty, set the header named by `credentialSource.header` to `<scheme> <token>`.
   c. If the value is empty, abort and post back the `not authenticated` failure `tool_result` (above).
3. Proceed with the fetch.

**Principle V discipline**: the engine recognises exactly the variants declared by the manifest builder; an unknown `type` value causes the catalog to fail to load. No `eval`, no dynamic dispatch on untrusted strings (FR-021).

## Reproducibility

The `credentialSource` block is a pure function of the OpenAPI document's security requirements and the shop's configured `key`. Re-running `/atw.build` with unchanged inputs produces byte-identical catalog entries (FR-022, SC-009).

## Contract tests

1. **Emission test.** `manifest-builder` fed a fixture OpenAPI with `bearerAuth` on `GET /orders` MUST emit a `credentialSource` block on that entry.
2. **Reproducibility test.** Two builds of the same fixture input produce byte-identical `action-executors.json`.
3. **Unknown-type fail-closed test.** The widget engine fed a catalog with `"type": "unknown-variant"` MUST reject the catalog at load and refuse to execute any intent.
4. **Missing-token test.** The widget engine with `localStorage[shop_auth_token]` unset MUST synthesize an `is_error: true, status: 0, content: "not authenticated"` tool_result on the first intent that requires the credential.
