# Contract — `renderBackend()` recursive + import rewriting

**Feature**: 005-full-reviewer-path
**Covers**: FR-001, FR-002a, FR-009, FR-010, FR-014
**Owner**: `packages/scripts/src/render-backend.ts`

---

## Behaviour change 1 — recursive template walk

### Before (current)

```ts
const entries = await fs.readdir(opts.templatesDir);
const templates = entries.filter((f) => f.endsWith(".hbs")).sort();
```

Top-level only. `src/lib/*.hbs` and `src/routes/*.hbs` are silently
ignored.

### After (this feature)

```ts
// Recursive walk. Returns paths RELATIVE to opts.templatesDir, sorted
// by locale-agnostic byte comparison, filtered to *.hbs files.
const templates: string[] = await collectTemplates(opts.templatesDir);
```

`collectTemplates()` MUST:

1. Walk `opts.templatesDir` depth-first.
2. At every level, sort directory entries with `String.prototype.localeCompare`-free
   byte comparison (the existing top-level `.sort()` behaviour).
3. Return relative paths using `/` as separator, regardless of platform.
4. Filter to files ending in `.hbs`.
5. Not follow symlinks (deterministic + avoids loops).

### Output contract (per rendered file)

Unchanged from current: `RenderedFile { path, sha256, bytes, action, backup? }`.
The `path` field MUST be relative to
`path.dirname(opts.outputDir)` (i.e., starts with `backend/…`) and MUST
use `/` separators. Mirror the prior line:

```ts
const rel = path.relative(path.dirname(opts.outputDir), targetAbs).replace(/\\/g, "/");
```

### Ordering guarantee

For a templates tree like:

```
src/
  config.ts.hbs
  index.ts.hbs
  lib/
    cors.ts.hbs
    pii-scrub.ts.hbs
  routes/
    chat.ts.hbs
```

The rendered-file emission order MUST be:

```
backend/src/config.ts
backend/src/index.ts
backend/src/lib/cors.ts
backend/src/lib/pii-scrub.ts
backend/src/routes/chat.ts
```

(top-level files first, then subdirs in sorted order, files within each
subdir sorted). This is the order rendered-files appear in the
manifest's `backend_files[]`, and must be stable across platforms to
satisfy SC-005.

---

## Behaviour change 2 — import rewriting during render

### Rule

Before Handlebars compiles a template, the raw template source is
scanned for import specifiers of the form:

```ts
from "@atw/scripts/dist/lib/<name>.js"
```

and each match is replaced with a relative path into the vendored
`_shared/` directory.

Replacement algorithm:
1. Let `filePath` = the relative path of the output file from
   `backend/src/` (e.g., `lib/pii-scrub.ts`, `routes/chat.ts`,
   `config.ts`).
2. Compute `depth` = number of `/` in `filePath` (0 for `config.ts`,
   1 for `lib/pii-scrub.ts`, 1 for `routes/chat.ts`).
3. Replacement prefix = `"./_shared/"` when `depth == 0`, else
   `("../".repeat(depth)) + "_shared/"`.
4. Replace `"@atw/scripts/dist/lib/<name>.js"` with
   `"<prefix><name>.js"`.

### Why before Handlebars, not after

If we rewrote after rendering, any template that used `{{…}}` near a
matching import line could desync the replacement. Running the
regex-replace over the `.hbs` source (which has no `{{…}}` tokens inside
the matched span in practice — all current imports are static strings)
keeps the rewrite independent of template evaluation.

### Rewritten import — test assertions

For `lib/pii-scrub.ts.hbs` containing:

```ts
import { scrubPii } from "@atw/scripts/dist/lib/runtime-pii-scrub.js";
```

the rendered `backend/src/lib/pii-scrub.ts` MUST contain:

```ts
import { scrubPii } from "../_shared/runtime-pii-scrub.js";
```

For `routes/chat.ts.hbs`:

```ts
import { something } from "@atw/scripts/dist/lib/types.js";
```

→ `backend/src/routes/chat.ts`:

```ts
import { something } from "../_shared/types.js";
```

For `config.ts.hbs`:

```ts
import { env } from "@atw/scripts/dist/lib/runtime-config.js";
```

→ `backend/src/config.ts`:

```ts
import { env } from "./_shared/runtime-config.js";
```

### What import specifiers are NOT rewritten

- `@atw/scripts/dist/…` paths that don't match `lib/<name>.js` (currently
  none exist; if one appears, render fails loudly with a
  `VENDOR_IMPORT_UNRESOLVED` error).
- `@atw/*` paths for unrelated packages (currently none in backend
  templates).
- Relative imports and bare npm imports — untouched.

### Output invariant

After rendering, `grep -r "@atw/scripts" <project>/backend/src/` MUST
return zero results. Asserted by
`render-backend.vendor.unit.test.ts`.

---

## Behaviour change 3 — determinism preserved

### Re-run contract (FR-009)

When `renderBackend()` runs with identical inputs (same
`templatesDir` contents, same `RenderContext`, same `outputDir` contents),
it MUST:

- emit the same ordered list of `RenderedFile` entries,
- with `action: "unchanged"` for every entry,
- without invoking `fs.writeFile` for any rendered output,
- without modifying mtimes of existing outputs.

The existing diff pipeline at `render-backend.ts:72-91` already
enforces this for files it visits. The recursive walk preserves the
invariant for the expanded set.

### Cross-machine contract (FR-010, SC-005)

For the same `templatesDir` contents and the same `RenderContext`, two
different machines MUST produce identical sha256 for every
`RenderedFile.path`. Preserving `\r\n` → `\n` normalisation (current
`render-backend.ts:64`) is sufficient given all other determinism
sources (Handlebars is pure, Buffer is platform-stable,
locale-agnostic byte sort).

---

## Error propagation

- A template compile error anywhere in the tree raises
  `Error` with `code = "TEMPLATE_COMPILE"` (same behaviour as today for
  top-level files, now extends to subdir templates).
- A vendored import that doesn't match `@atw/scripts/dist/lib/<name>.js`
  with a known `<name>` (i.e., the vendored lib doesn't include it)
  raises `Error` with `code = "VENDOR_IMPORT_UNRESOLVED"` and a message
  naming the file and the unresolved specifier. Exit code 17.
- IO errors (missing templatesDir, permission denied) surface as-is; the
  orchestrator converts them to `failure_entries` with step = "render".

---

## Test coverage

| Test | Purpose | File |
|---|---|---|
| walks subdirs, emits mirrored output tree | coverage for recursion | `render-backend.recursive.unit.test.ts` |
| output paths use forward slashes on Windows | cross-platform determinism | same |
| emission order matches byte-sorted path order | SC-005 invariant | same |
| rewrites `@atw/scripts/dist/lib/*.js` imports at every depth | coverage for rewrite | `render-backend.vendor.unit.test.ts` |
| fails with `VENDOR_IMPORT_UNRESOLVED` when no vendored match | error path | same |
| re-render with unchanged inputs → all actions `unchanged`, no writes | FR-009 | `render-backend.recursive.unit.test.ts` |
| re-render on simulated second machine → byte-identical sha256s | FR-010 | `orchestrator.determinism.integration.test.ts` |
