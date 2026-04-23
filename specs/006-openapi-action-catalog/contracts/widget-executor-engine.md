# Contract: Widget action-execution engine

**Feature**: 006 (OpenAPI-driven action catalog)
**Plan**: [../plan.md](../plan.md)
**Data model**: [../data-model.md §3, §7, §8](../data-model.md)
**Related Feature 003 contract**: [../../003-runtime/contracts/chat-endpoint.md §5](../../003-runtime/contracts/chat-endpoint.md)

This contract defines the behaviour of the widget's fixed, audited
action-execution engine: the single code path that consumes
`action-executors.json` and issues HTTP requests to the host. It is
the enforcement point for FR-009 (no dynamic code execution), FR-009a
(HTML-escape host content), FR-010 (no credentials through backend),
FR-011 (confirmation card surfaces success/error), FR-015 (refuse
malformed requests), FR-015a (no automatic retry), FR-016 (runtime
cross-origin detection), FR-021 (15 s timeout), and SC-006 (static
verifiability).

Files:
- `packages/widget/src/action-executors.ts` — NEW; catalog loader +
  interpreter.
- `packages/widget/src/api-client-action.ts` — MODIFIED;
  `executeAction()` refactored to use the interpreter.
- `packages/widget/src/action-card.tsx` — MODIFIED (minimal);
  explicit audit of HTML-escape behaviour.
- `packages/widget/src/config.ts` — MODIFIED; adds
  `actionExecutorsUrl`.
- `packages/widget/src/init.ts` — MODIFIED; fetches catalog at boot.

Contract tests:
- `packages/widget/test/action-executors.unit.test.ts` — URL
  substitution, missing variable, cross-origin.
- `packages/widget/test/action-executors.abort.unit.test.ts` — FR-021.
- `packages/widget/test/action-executors.no-retry.unit.test.ts` — FR-015a.
- `packages/widget/test/action-card.html-escape.unit.test.ts` — FR-009a / SC-006.
- `packages/widget/test/action-card.interpreter-safety.contract.test.ts` — SC-006 static check.

---

## 1. Catalog loader

At widget init (after `WidgetConfig` resolution, before first chat
turn):

```ts
let executorsCatalog: ActionExecutorsCatalog | null = null;

export async function loadExecutorsCatalog(
  config: WidgetConfig,
): Promise<void> {
  const url = config.actionExecutorsUrl ?? `${widgetBundleOrigin()}/action-executors.json`;
  try {
    const res = await fetch(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const parsed = ActionExecutorsCatalogSchema.safeParse(body);
    if (!parsed.success) {
      console.warn("[atw] action-executors catalog is malformed; falling back to chat-only", parsed.error);
      executorsCatalog = null;
      return;
    }
    if (parsed.data.version !== 1) {
      console.warn(`[atw] action-executors version ${parsed.data.version} unsupported; falling back to chat-only`);
      executorsCatalog = null;
      return;
    }
    executorsCatalog = parsed.data;
  } catch (err) {
    console.warn("[atw] could not load action-executors; falling back to chat-only", err);
    executorsCatalog = null;
  }
}
```

Invariants:

- `loadExecutorsCatalog` is called exactly once per widget boot.
- Catalog is fetched with `credentials: "omit"` — this is a
  public-artefact fetch, not a credentialed call. (Prevents the
  catalog URL from becoming an accidental session-id beacon.)
- On ANY error (network, parse, schema, version), the widget falls
  back to `executorsCatalog = null` and continues to chat. The user
  sees no error dialog; the console gets one warning.
- No retry of the fetch. A single failed load means chat-only for
  the session; re-mounting the widget re-attempts.

## 2. Interpreter entry point

`executeAction` in `api-client-action.ts` is refactored to:

```ts
export async function executeAction(
  intent: ActionIntent,
  config: WidgetConfig,
): Promise<ExecuteActionOutcome> {
  // Pre-existing gate: tool-name allowlist
  assertToolAllowed(intent.tool, config);

  // NEW: catalog lookup
  if (!executorsCatalog) {
    return {
      ok: false,
      status: 0,
      message: "Actions are temporarily unavailable in this session.",
    };
  }
  const entry = executorsCatalog.actions.find((a) => a.tool === intent.tool);
  if (!entry) {
    return {
      ok: false,
      status: 0,
      message: `No executor for tool "${intent.tool}".`,
    };
  }

  // Build request from entry
  const { url, init, validationError } = buildRequestFromEntry(
    entry,
    intent,
    config,
  );
  if (validationError) {
    return { ok: false, status: 0, message: validationError };
  }

  // NEW: 15 s abort
  const abort = new AbortController();
  const timeout = window.setTimeout(() => abort.abort(), 15000);
  init.signal = abort.signal;

  // NEW: cross-origin runtime check
  if (new URL(url, window.location.href).origin !== window.location.origin
      && executorsCatalog.credentialMode === "same-origin-cookies") {
    window.clearTimeout(timeout);
    return {
      ok: false,
      status: 0,
      message: "This action is misconfigured for cross-origin use.",
    };
  }

  // Single fetch, no retry
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    window.clearTimeout(timeout);
    if ((err as Error).name === "AbortError") {
      return {
        ok: false,
        status: 0,
        message: "The action timed out. Try asking again.",
      };
    }
    return {
      ok: false,
      status: 0,
      message: "Can't reach the host right now. Please try again.",
    };
  }
  window.clearTimeout(timeout);

  // Response handling per catalog directives
  return handleResponse(entry, intent, res);
}
```

## 3. `buildRequestFromEntry`

Pure function, side-effect free:

```ts
interface BuildResult {
  url: string;
  init: RequestInit;
  validationError?: string;
}

function buildRequestFromEntry(
  entry: ActionExecutorEntry,
  intent: ActionIntent,
  config: WidgetConfig,
): BuildResult;
```

Steps:

1. **Path substitution.** For each `{identifier}` placeholder in
   `entry.pathTemplate`:
   - Look up `entry.substitution.path[identifier]`. If absent in the
     catalog → `validationError: "catalog missing path substitution
     for {identifier}"` (indicates a build-time bug; should never
     fire at runtime because Zod validates this).
   - Resolve the value via `resolveSubstitutionSource(src, intent)`
     (§4 below).
   - If resolved value is `undefined`/`null` → `validationError:
     "missing required path argument \"<identifier>\""`. (FR-015)
   - URL-encode the resolved value (`encodeURIComponent`).
   - Replace `{identifier}` in `pathTemplate` with the encoded value.

2. **Query substitution.** Build a `URLSearchParams` from
   `entry.substitution.query`, skipping entries whose resolved value
   is `undefined` (optional query params). For each non-null value,
   coerce to string and append.

3. **Body substitution.** For methods other than `GET`, build a
   plain object mapping each `entry.substitution.body[fieldName]` to
   its resolved value. Entries whose resolved value is `undefined`
   are omitted from the body (optional body fields). Required body
   fields (per the matching `ActionManifestEntry.parameters.required`
   list, loaded into the widget via a separate tiny JSON or via a
   `required` annotation on the catalog entry) MUST be present; else
   `validationError: "missing required body field \"<name>\""`.

4. **URL assembly.** The final URL is:
   `${config.apiBaseUrl.replace(/\/$/, "")}${resolvedPath}${query}`.

5. **RequestInit assembly.**
   - `method`: `entry.method`.
   - `headers`: `Object.assign({}, entry.headers)`. Because the catalog
     schema forbids credential-class headers, this object is
     guaranteed free of `Authorization`, `Cookie`, etc.
   - `credentials`: derived from `buildHostApiRequest()` which already
     knows `authMode: "cookie"` means `credentials: "include"`.
   - `body`: `GET`/`HEAD` → `undefined`; others →
     `JSON.stringify(bodyObject)`.

## 4. `resolveSubstitutionSource`

The single code path that interprets a substitution value:

```ts
export function resolveSubstitutionSource(
  src: string,          // must match /^arguments\.[a-zA-Z_][a-zA-Z0-9_]*$/
  intent: ActionIntent,
): unknown {
  // Validate at runtime as a belt-and-braces check against a
  // malformed catalog the loader somehow accepted.
  if (!/^arguments\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(src)) {
    throw new Error(`invalid substitution source: ${src}`);
  }
  const key = src.slice("arguments.".length);
  return intent.arguments?.[key];
}
```

Invariants (static-verifiable):

- This is the ONLY function in the widget source tree that reads a
  catalog-derived string and returns a value. Any other consumer of
  catalog strings treats them as opaque (header values passed
  through; method/path template substituted via `String.replace`
  with fixed placeholders).
- No `eval`, no `new Function`, no dynamic `import`, no
  `Function.prototype.call` against catalog strings, no `Reflect.get`
  with catalog-derived paths.
- No dotted paths: a catalog-derived `arguments.foo.bar` would be
  rejected by the regex. Security posture is explicit.

## 5. Response handling

```ts
function handleResponse(
  entry: ActionExecutorEntry,
  intent: ActionIntent,
  res: Response,
): Promise<ExecuteActionOutcome>;
```

Steps:

1. Read body as text. Attempt `JSON.parse`; on failure, keep raw
   string.
2. If `entry.responseHandling.successStatuses.includes(res.status)`:
   - Render `summary` via `renderSummary(entry, intent, parsedBody)`.
   - Return `{ ok: true, status: res.status, summary, body:
     parsedBody }`.
3. Else (failure):
   - Extract a human-readable message:
     - If 401/403: canonical "Please log in first for this action."
     - Else if `entry.responseHandling.errorMessageField` is set and
       that field exists on `parsedBody`: use that value
       (HTML-escaped at render time by Preact in the card).
     - Else: canonical "Something went wrong executing that. Please
       try again."
   - Return `{ ok: false, status: res.status, message, body:
     parsedBody }`.

## 6. `renderSummary`

```ts
function renderSummary(
  entry: ActionExecutorEntry,
  intent: ActionIntent,
  body: unknown,
): string;
```

Implementation:

```ts
return entry.responseHandling.summaryTemplate.replace(
  /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
  (_match, name) => {
    // Try body first (the host's authoritative response), fall back to
    // intent.arguments.
    const fromBody = isObject(body) ? (body as Record<string, unknown>)[name] : undefined;
    if (fromBody !== undefined) return String(fromBody);
    const fromArgs = intent.arguments?.[name];
    if (fromArgs !== undefined) return String(fromArgs);
    return `{${name}}`; // visible placeholder if nothing resolved
  },
);
```

Invariants:

- One `String.replace` call, one regex, no other transformation
  pipeline. (SC-006)
- Result is a plain string; rendered into the confirmation card as
  a JSX text child, which Preact HTML-escapes by default. (FR-009a)

## 7. 15-second timeout (FR-021)

- Implemented via `AbortController` whose signal is passed into
  `fetch`. On timeout, `fetch` rejects with `AbortError`.
- The timeout is a fixed constant `ACTION_FETCH_TIMEOUT_MS = 15000`
  exported from `action-executors.ts`. Not configurable via
  `WidgetConfig`, not configurable via the catalog, not configurable
  via the host response. (Spec: fixed in v1.)
- Timeout surfaces as `ExecuteActionFailure` with `status: 0` and
  `message: "The action timed out. Try asking again."`.

## 8. No automatic retry (FR-015a)

- `executeAction` issues exactly ONE `fetch`. On any failure
  (timeout, network error, non-2xx, schema mismatch), the function
  returns an `ExecuteActionFailure` and the caller (the confirmation
  card) surfaces that failure state.
- No retry loop exists in the widget source for action execution.
  Test `action-executors.no-retry.unit.test.ts` mocks the global
  fetch to count invocations and asserts `fetchMock.mock.calls.length
  === 1` after any failure path.
- The shopper's "try again" is a new natural-language message to
  the chat: Opus emits a new `tool_use`, a new `ActionIntent`, a new
  confirmation card. The widget never issues a second HTTP request
  on behalf of the original `tool_use`.

## 9. HTML-escape (FR-009a, SC-006)

- Every value rendered into the confirmation card that was derived
  from a host response is rendered as a JSX text child:

  ```tsx
  <div class="atw-action-card__summary-val">{summary[k]}</div>
  ```

  Preact HTML-escapes text children by default.
- The widget source tree MUST NOT contain any of the following
  constructs. Statically verified by the contract test
  `action-card.interpreter-safety.contract.test.ts` (grep-based):
  - `dangerouslySetInnerHTML`
  - `DOMParser`
  - `innerHTML =` / `outerHTML =`
  - `eval(`
  - `new Function(`
  - dynamic `import(` with a variable argument (bare import of a
    literal module string is permitted; import-as-side-effect of
    catalog-derived strings is forbidden)
- A positive assertion test: inject a response body containing
  `<script>alert(1)</script>` and `<img onerror=...>` and assert the
  rendered DOM contains the literal characters `<`, `>`, `&`
  (entity-escaped) rather than an executed or parsed element.

## 10. Cross-origin runtime check (FR-016)

Executed in §2 step "Single fetch, no retry", before `fetch`:

```ts
const actionUrl = new URL(url, window.location.href);
if (actionUrl.origin !== window.location.origin
    && executorsCatalog.credentialMode === "same-origin-cookies") {
  return {
    ok: false,
    status: 0,
    message: "This action is misconfigured for cross-origin use.",
  };
}
```

This is the runtime half of FR-016; the build-time half lives in
`render-executors.ts` (see `action-executors.schema.md §6 step 2`).

## 11. Test outline

### `action-executors.unit.test.ts`

- Catalog with one action + intent with matching arguments →
  correct URL, method, body.
- Intent missing a required path-substitution argument →
  `validationError: "missing required path argument ..."`.
- Intent with extra arguments not in substitution → those arguments
  ignored, not leaked into URL or body.
- URL-encoding: arguments containing `/`, `?`, `#`, space → encoded
  correctly.
- Response with `successStatuses: [200]` returning 201 → outcome
  `ok: false` (catalog strict).
- Response with `errorMessageField: "message"` returning 400 with
  `{"message": "Variant out of stock"}` → outcome's `message` equals
  `"Variant out of stock"`.
- Response with no `errorMessageField` on 500 → canonical error
  message.

### `action-executors.abort.unit.test.ts`

- Mocked `fetch` hangs → after 15 s (fake timers), `AbortController`
  fires, outcome is `ok: false` with timeout message.
- Mocked `fetch` resolves in 200 ms → timeout does NOT fire.
- Timeout length is exactly 15000 ms (not configurable).

### `action-executors.no-retry.unit.test.ts`

- Mocked `fetch` rejects with network error → exactly 1 fetch call;
  outcome is `ok: false`.
- Mocked `fetch` returns 500 → exactly 1 fetch call; outcome is
  `ok: false`.
- Mocked `fetch` times out → exactly 1 fetch call; outcome is
  `ok: false` (timeout message).
- Under any failure mode, no subsequent fetches fire within 30 s of
  wall-clock wait.

### `action-card.html-escape.unit.test.ts` (FR-009a, SC-006)

- Render card with `summary[k]` containing `<script>alert(1)</script>`
  → DOM contains literal text, no `<script>` element.
- Render card with `summary[k]` containing `<img src=x onerror=...>`
  → no `<img>` element.
- Render card with `summary[k]` containing `&amp;` → DOM text is
  literal `&amp;`, not `&` (Preact does not double-unescape).
- Render card with error body `message` containing HTML → error text
  contains the literal markup characters.
- Render card with Markdown-looking string (`**bold**`, `[link](url)`)
  → no formatting applied; literal asterisks and brackets displayed.

### `action-card.interpreter-safety.contract.test.ts` (SC-006 static)

- Grep entire `packages/widget/src/**/*.{ts,tsx}` tree for banned
  constructs; assert zero matches:
  - `dangerouslySetInnerHTML` → 0
  - `DOMParser` → 0
  - `innerHTML\s*=` → 0
  - `outerHTML\s*=` → 0
  - `eval\(` → 0
  - `new Function\(` → 0
  - `import\s*\(\s*[a-zA-Z_$]` (dynamic import with a variable
    argument) → 0
- Treat any violation as a failing test with a diagnostic pointing
  to the file + line.

### `credentials-sovereignty.integration.test.ts` (top-level tests/)

- Stand up a mock host server and a mock chat backend.
- Boot widget with a fake session cookie set on the document.
- Issue a chat, simulate a tool_use, confirm the action, capture
  BOTH the host server's request AND the chat backend's request.
- Assert: host server's request carries the cookie (via
  `credentials: "include"`). Chat backend's request log contains
  ZERO occurrences of the cookie value, zero `Authorization`
  headers, zero `X-*-Token|Auth|Session` headers — structurally
  stripped by the existing credential-strip hook.

## 12. Configuration surface (extensions)

`WidgetConfig` gains a single field:

```ts
interface WidgetConfig {
  // ... existing fields
  actionExecutorsUrl?: string;   // defaults to `${widgetBundleOrigin()}/action-executors.json`
}
```

Resolution order (unchanged from Feature 004's `WidgetConfig`
resolution):
1. Explicit `window.atwConfig` object at load.
2. `data-atw-action-executors-url` attribute on the `<script>` tag.
3. Default (sibling of widget bundle URL).

Invariant: the resolved URL MUST be same-origin with the widget
bundle. Cross-origin catalog URLs are rejected at load (§1) to
prevent a third party from serving a hostile catalog.
