# Contract: `/atw.embed` output

**Feature**: 008-atw-hardening
**Amends**: Feature 004 embed-guide.
**Producer**: `packages/scripts/src/embed.ts` + `embed-templates/` (via `/atw.embed`).
**Consumer**: the Builder (reads the output, copies files, pastes the snippet).

## Output composition

The `/atw.embed` command prints to stdout a block containing **three** sections, in this order:

1. **Files-to-copy checklist** (FR-016, FR-017).
2. **Host-requirements reminder** (a short pointer to `.atw/artifacts/host-requirements.md`).
3. **Pasteable snippet** (FR-014, FR-015, FR-017).

## 1. Files-to-copy checklist

```markdown
**Files to copy into your host's public assets:**

- [ ] `dist/widget.js`
- [ ] `dist/widget.css`
- [ ] `.atw/artifacts/action-executors.json`
```

The checklist renders as literal markdown task-list syntax. The list contains exactly these three items when the widget has action capability; when the catalog is empty (no tools), the third item is omitted.

## 2. Host-requirements reminder

```markdown
**Before embedding, verify your host meets these requirements:**
See `.atw/artifacts/host-requirements.md`.
```

This section is emitted only when `host-requirements.md` was produced by `/atw.api` (i.e., when `deploymentType === "customer-facing-widget"`).

## 3. Pasteable snippet

```html
<script
  src="/widget.js"
  defer
  data-atw-endpoint="<backend public URL>"
  data-auth-token-key="<authTokenKey from project.md>"
  data-allowed-tools="<alphabetically-sorted comma-separated tool names>"
  data-welcome-message="<welcomeMessage from project.md>"
></script>
<link rel="stylesheet" href="/widget.css">
```

### Attribute requirements

| Attribute | Source | FR |
| --- | --- | --- |
| `data-atw-endpoint` | Existing config (unchanged by this feature) | - |
| `data-auth-token-key` | `project.md#authTokenKey` (default `shop_auth_token`) | FR-014 |
| `data-allowed-tools` | Alphabetically-sorted comma-separated list derived from `action-executors.json#tool` fields | FR-015 / R12 |
| `data-welcome-message` | `project.md#welcomeMessage` | FR-025 |

### Removed attributes

- `data-bearer-storage-key` — renamed to `data-auth-token-key` (FR-014). The widget's `config.ts` already reads `authTokenKey`; the embed template now emits the matching attribute name.

## Contract tests

1. **Attribute-name alignment (FR-014).** `data-auth-token-key` appears in the emitted snippet; `data-bearer-storage-key` does not.
2. **Allow-list derivation (FR-015).** Given an `action-executors.json` with tools `["listMyOrders", "addToCart", "getProduct"]`, the snippet contains `data-allowed-tools="addToCart,getProduct,listMyOrders"`.
3. **Checklist presence (FR-016 / FR-017).** Output contains the literal markdown task-list block; the third item (`action-executors.json`) is present iff the catalog is non-empty.
4. **Host-requirements reminder gate.** Output contains the host-requirements reminder iff `host-requirements.md` exists.
5. **Welcome-message propagation.** Given `welcomeMessage: "Welcome!"`, the snippet contains `data-welcome-message="Welcome!"`.

## `/atw.build` DONE banner (FR-005)

Separately from `/atw.embed`'s output, the `/atw.build` DONE banner appends a Next Steps section:

```
✅ Build complete.

Next steps:
  1. Run /atw.embed to get your integration snippet.
  2. Copy dist/widget.{js,css} and .atw/artifacts/action-executors.json
     into your host's public assets.
  3. Paste the snippet from /atw.embed into your host's HTML <body>.
  4. Review .atw/artifacts/host-requirements.md before going live.
```
