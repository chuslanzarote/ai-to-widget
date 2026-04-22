# Contract: Widget configuration, auth, and UI behaviour

**Feature**: Runtime (003)
**Plan**: [../plan.md](../plan.md)
**Data types**: [../data-model.md §1, §3](../data-model.md)

Defines the behavioural contract the widget honours. Everything in
this document is testable at the contract or unit level; the widget
E2E in `tests/e2e/aurelia-demo.spec.ts` enforces the cross-cutting
invariants.

---

## 1. Loader contract

The widget loads via one `<link>` and one `<script>`:

```html
<link rel="stylesheet" href="/path/to/widget.css">
<script
  src="/path/to/widget.js"
  defer
  data-backend-url="https://atw.my-agent.example.com"
  data-api-base-url="https://my-host.example.com/api"
  data-auth-mode="cookie"
  data-launcher-position="bottom-right"
  data-theme="default"
  data-locale="es-ES"
  data-intro="Hi, I'm the Aurelia brew guide. Ask me anything about our coffees."
  data-login-url="https://my-host.example.com/login"
></script>
```

### `data-*` attributes

| Attribute                  | Required | Default                          | Notes                                                          |
|----------------------------|----------|----------------------------------|----------------------------------------------------------------|
| `data-backend-url`         | yes      | —                                | Absolute URL of ATW backend.                                   |
| `data-api-base-url`        | no       | `window.location.origin`         | Absolute or relative URL of host API.                          |
| `data-auth-mode`           | no       | `"cookie"`                       | One of `cookie`, `bearer`, `custom`.                           |
| `data-auth-token-key`      | conditional | —                             | Required iff `data-auth-mode="bearer"`.                        |
| `data-launcher-position`   | no       | `"bottom-right"`                 | One of `bottom-right`, `bottom-left`, `bottom-center`.         |
| `data-theme`               | no       | `"default"`                      | Named theme or `"custom"` (host provides CSS overrides).       |
| `data-locale`              | no       | `navigator.language`             | BCP-47.                                                         |
| `data-intro`               | no       | (none)                           | One-line greeting on empty conversation.                       |
| `data-login-url`           | no       | (none)                           | Surfaced by the anonymous-fallback path as a login link.       |

### Boot sequence (widget `index.ts`)

1. Read all `data-*` attributes from the current `document.currentScript`.
2. Fail loud on `data-backend-url` missing → console error + disabled
   launcher with `aria-label="Chat unavailable — contact support."`
3. Fail loud on `data-auth-mode="bearer"` without
   `data-auth-token-key` → same disabled state.
4. Inject launcher element into `document.body`.
5. Inject a `<link>`-less CSS block that provides defaults for CSS
   custom properties (so the widget renders even if the stylesheet
   is missing).
6. Bind click on launcher → toggle `ConversationState.open`.
7. Generate `sessionId` and persist to `sessionStorage`.
8. Ready.

**Invariants**

- The widget does not fire any network request until the user opens
  the panel and sends the first message. Launcher mount is a visual
  act only.
- No global JavaScript variables are added beyond `window.AtwWidget`
  (a single object with a `version` property for debugging). The
  bundle is IIFE and does not pollute the host.

---

## 2. Panel and launcher UI

- Launcher: circular button, 48×48, fixed position per
  `data-launcher-position`. Icon: chat bubble (inline SVG). Visible
  focus ring on tab-focus.
- Panel on open: slide-in from the launcher side. On viewports <
  640 px wide, panel is full-screen. On viewports ≥ 640 px, panel is
  fixed `380 × 600` px with drop shadow.
- Panel focus trap: `Tab` / `Shift+Tab` cycle within the panel while
  open. `Esc` closes.
- `prefers-reduced-motion`: disables slide/fade transitions; panel
  appears/disappears instantly.

---

## 3. Conversation flow

1. User types in the input; Enter sends, Shift+Enter inserts a
   newline.
2. `api-client.ts` posts `ChatRequest` to `backendUrl` with headers:
   - `Content-Type: application/json`
   - `X-Atw-Session-Id: <sessionId>`
   - **No** `Authorization`, `Cookie`, or credential-like header.
   - **No** `credentials: 'include'` on the fetch options.
3. Response is zod-parsed against `ChatResponseSchema`. Parse
   failures show a friendly error state, log to console with the
   request_id, and clear the pending spinner.
4. Assistant turn is appended via `state.turns` signal; citations
   render inline; action intents render as cards inline between
   turns.

---

## 4. Action confirmation gate (Principle IV, structural)

**Invariant**: no `fetch` to `apiBaseUrl` ever runs for a
`confirmation_required: true` action without a user click on the
card's primary button.

Implementation rules:

- `action-card.tsx` binds the execute path to the `onClick` handler
  of a real `<button>` element. There is no `useEffect`-triggered
  execution, no timer, no programmatic click.
- The execute path is defined in `api-client.ts:executeAction(intent,
  config)` and is only exported to `action-card.tsx`. It is not on
  the `window.AtwWidget` surface.
- Before calling `fetch`, `executeAction` runs
  `assertToolAllowed(intent.tool, config)` which throws
  `ATW_TOOL_NOT_ALLOWED` for any tool not in
  `config.allowedTools`. No `fetch` follows a throw.

Unit tests (`action-card.unit.test.ts`) assert:

- A click executes exactly one `fetch`.
- A cancel click runs zero `fetch` calls.
- An unknown tool name in the intent throws and runs zero `fetch`
  calls.

---

## 5. Authentication modes

For every request to `apiBaseUrl` (host API), the widget builds
headers via `auth.ts:buildAuthHeaders(config)`.

### Mode: `cookie` (default)

- Fetch options: `{ credentials: 'include' }`.
- Headers added: none (browser attaches same-site session cookies
  automatically).

### Mode: `bearer`

- Reads `localStorage[config.authTokenKey]` **on every call** (so
  host-app token refresh is respected).
- Headers added: `Authorization: Bearer <value>` (only if value is
  non-empty; empty token is treated as anonymous).
- Fetch options: `{ credentials: 'omit' }`.

### Mode: `custom`

- Expects `window.AtwAuthProvider` to be defined at action-execute
  time, as: `() => Promise<Record<string, string>>`.
- If missing: the action card surfaces a friendly error and does not
  fetch.
- Headers added: whatever the provider returns.
- Fetch options: `{ credentials: 'omit' }`.

**Invariants across all modes**:

- Credentials are **never** attached to requests targeting
  `config.backendUrl`. The api-client enforces this by building two
  separate header builders — one for backend, one for host-API — and
  the backend-targeted builder intentionally contains no auth logic.
- `buildAuthHeaders(config)` never reads from
  `localStorage[config.backendUrl]` or similar; unit tests assert on
  this.

---

## 6. Error surfaces

- **Backend unreachable**: panel shows "I'm having trouble right
  now." with a retry button that re-sends the last user message.
- **Backend 429**: panel shows "You're sending messages too quickly."
  with a `Retry-After` countdown derived from the response header.
- **Backend 503**: panel shows the server's `message` string (which
  is user-safe per `chat-endpoint.md §7`).
- **Host API 401/403 on an action**: panel shows "Please log in
  first for this action." with an `<a>` to `config.loginUrl` if
  present.
- **Host API 5xx on an action**: panel shows "Something went wrong
  executing that. Try again?" with retry.
- **Unknown tool intent**: widget refuses silently to the user
  (cannot know why the backend emitted it), logs to console with a
  structured `ATW_TOOL_NOT_ALLOWED` object, and the action card goes
  to a `failed` state with a generic "I couldn't complete that."

---

## 7. Theming contract

CSS custom properties the widget honours (fallback values in
parentheses):

- `--atw-primary-color` (`#3b5bdb`)
- `--atw-primary-text-color` (`#ffffff`)
- `--atw-background-color` (`#ffffff`)
- `--atw-surface-color` (`#f7f7f8`)
- `--atw-border-color` (`#e6e6e9`)
- `--atw-text-color` (`#1a1a1f`)
- `--atw-text-muted-color` (`#6a6a74`)
- `--atw-radius` (`8px`)
- `--atw-font-family` (`system-ui, -apple-system, sans-serif`)
- `--atw-font-size-base` (`15px`)
- `--atw-panel-width` (`380px`)
- `--atw-panel-height` (`600px`)
- `--atw-shadow` (`0 10px 30px rgba(0,0,0,0.12)`)

Host overrides reach the widget via normal CSS cascade; no Shadow
DOM. Contract: changing any of these on the host page and reloading
updates the widget's rendering without rebuilding the bundle
(FR-025, SC-012).

---

## 8. Accessibility contract

- Launcher is a `<button>` element with `aria-label="Open chat"`.
- Panel open has `role="dialog"` and `aria-modal="true"`.
- Panel close button is a `<button>` with `aria-label="Close chat"`.
- Message list is a `<div>` with `role="log"` and
  `aria-live="polite"`; new turns announce without stealing focus.
- Input is a `<textarea>` with a visible `<label>` (visually hidden
  via `.atw-visually-hidden`, but present for screen readers).
- Action card primary and cancel buttons both have visible text
  labels and keyboard-accessible focus.
- Visible focus rings are enforced via `:focus-visible` styles that
  ignore `outline: none` patterns from the host.
- `prefers-reduced-motion: reduce` disables animations.

Validated by `axe-core` in `tests/e2e/accessibility.spec.ts`.

---

## 9. Bundle size contract

- `widget.js.gz` ≤ 80 KB.
- `widget.css.gz` ≤ 10 KB.

Enforced twice:

1. **Build-time** in Feature 002's `atw-compile-widget` — extended
   this feature to assert the gzipped size of each artefact and fail
   the build if exceeded.
2. **Test-time** in `tests/integration/runtime-bundle-size.test.ts` —
   asserts the same invariant on the compiled artefact after build.
