# Contract: `.atw/config/project.md` — v2 frontmatter

**Feature**: 008-atw-hardening
**Amends**: Feature 001 `project.md` schema.
**Producer**: `packages/scripts/src/init-project.ts` (via `/atw.init`).
**Consumers**: `atw-classify`, `atw-api`, `render-backend`, `embed`, widget loader attributes.

## Frontmatter shape

```yaml
---
shopName: "<string>"
createdAt: "<ISO-8601 quoted>"
updatedAt: "<ISO-8601 quoted>"

# NEW in Feature 008
deploymentType: "customer-facing-widget"
storefrontOrigins:
  - "http://localhost:5173"
welcomeMessage: "Hi! How can I help you today?"
authTokenKey: "shop_auth_token"
loginUrl: ""
---
```

## Field rules

| Field | Required? | Validation | Notes |
| --- | --- | --- | --- |
| `deploymentType` | No (default `customer-facing-widget` on `/atw.init` interactive flow) | `"customer-facing-widget"` or unset | Drives classifier (R1 / FR-010) and `host-requirements.md` emission |
| `storefrontOrigins` | Required when `deploymentType === "customer-facing-widget"` | Non-empty array; each entry parses as absolute URL with scheme + host | Threaded into `ALLOWED_ORIGINS`, `host-requirements.md`, embed output |
| `welcomeMessage` | No | Plain text, up to 200 chars | Surfaced by widget on first render (FR-025) |
| `authTokenKey` | No | Non-empty string, matches `/^[a-zA-Z0-9_-]+$/` | Threaded into `data-auth-token-key` and `host-requirements.md` |
| `loginUrl` | No | Absolute URL or empty string | Widget redirects here on 401 |
| `createdAt` / `updatedAt` | Yes | `z.string().datetime()` — quoted ISO string | FR-008 — YAML emitter must quote |

## `/atw.init` re-run behaviour

Per FR-005a / R6, `/atw.init` reads the existing `project.md` and presents every field as a pre-filled default. The Builder confirms with Enter or types a new value. A diff of old vs. new is shown before writing. `updatedAt` is re-emitted; all other captured values that the Builder accepts are preserved byte-for-byte.

## Validator contract tests

1. **Quoted timestamps.** A freshly-emitted `project.md` parses as `z.string().datetime()` for both `createdAt` and `updatedAt` — no YAML date-auto-typing drift.
2. **Origin validation.** Non-URL `storefrontOrigins` entries cause `/atw.init` to re-prompt.
3. **Pre-fill fidelity.** Re-running `/atw.init` without changing any answer yields a byte-identical frontmatter (except `updatedAt`).
4. **deploymentType default.** First-run interactive flow defaults `deploymentType` to `"customer-facing-widget"`; accepting defaults writes the field.
5. **deploymentType absent.** When the Builder explicitly clears the field, the classifier's pre-008 bearer-JWT rejection rule applies (US1 AC1 negative case).
