# Contract — Build-manifest extensions

**Feature**: 005-full-reviewer-path
**Covers**: FR-003, FR-004, FR-005, FR-006, FR-009, SC-008
**Owner**: `packages/scripts/src/write-manifest.ts`

Extends the Feature 002 build-manifest shape. All new fields are
additive; existing fields are unchanged.

---

## Top-level additions

### `steps` (new object)

Per-step execution summary. Present on every run (success, failed,
aborted).

```json
"steps": {
  "render":   { "action": "<RenderStepAction>", "files_changed": <int> },
  "bundle":   { "action": "<BundleStepAction>" },
  "image":    { "action": "<ImageStepAction>", "reason": "<string>" },
  "compose":  { "action": "<ComposeStepAction>" },
  "scan":     { "action": "<ScanStepAction>", "clean": <bool> }
}
```

Step-action enums:

- `RenderStepAction` — `"created" | "rewritten" | "unchanged"` (rolled up
  from per-file actions; "rewritten" wins over "created" wins over
  "unchanged" when steps mix actions).
- `BundleStepAction` — `"created" | "rewritten" | "unchanged"`.
- `ImageStepAction` — `"created" | "rebuilt" | "unchanged" | "skipped" | "failed"`.
- `ComposeStepAction` — `"activated" | "unchanged" | "skipped"`.
- `ScanStepAction` — `"ran" | "skipped"`.

`steps.image.reason` is a required string when `action` is `"skipped"`
or `"failed"`; it's omitted otherwise.

### `input_hashes` entries (new keys)

Added alongside existing entries. All values are hex-encoded sha256 of
the file's UTF-8 bytes (text files) or raw bytes (binary; currently N/A
for this feature).

| Key | Covers |
|---|---|
| `backend/Dockerfile` | seeded meta |
| `backend/.dockerignore` | seeded meta |
| `backend/package.json` | seeded meta |
| `backend/tsconfig.json` | seeded meta |
| `backend/src/_shared/<name>.ts` (one per vendored file) | vendored shared-lib |
| `backend_source_tree` | roll-up |

### `backend_source_tree` roll-up

```
backend_source_tree = sha256(
  join('\n',
    sorted([
      "<path>:<sha256>"
      for path, sha256 in input_hashes.items()
      if path starts with "backend/"
    ])
  )
)
```

Purpose: fast "did anything that affects the image change?" check on
re-run. If this hash matches the prior manifest's
`backend_source_tree`, and Docker still has the prior `image_id` tagged
as `atw_backend:latest`, the IMAGE step can record
`action: "unchanged"` without invoking dockerode.

---

## Rules

### Rule 1 — success + failure are mutually exclusive (FR-005)

`result: "success"` and any `failure_entries[]` entry with
`step: "image"` MUST NOT coexist in the same manifest. Asserted by:

```ts
assert(
  manifest.result !== "success" ||
  !manifest.failure_entries.some((f) => f.step === "image")
);
```

### Rule 2 — image skip is flag-gated (FR-013)

```ts
assert(
  manifest.steps.image.action !== "skipped" ||
  manifest.steps.image.reason === "suppressed by --skip-image flag"
);
```

No other `reason` value legitimises a skip. Contract test:
`orchestrator.skip-image.contract.test.ts`.

### Rule 3 — image success implies image record present (FR-003)

```ts
assert(
  manifest.steps.image.action !== "created" &&
  manifest.steps.image.action !== "rebuilt" &&
  manifest.steps.image.action !== "unchanged"
  ||
  (manifest.backend_image !== null &&
   typeof manifest.backend_image.image_id === "string" &&
   typeof manifest.backend_image.ref === "string" &&
   typeof manifest.backend_image.size_bytes === "number")
);
```

### Rule 4 — input-hash closure (SC-008)

Every file inside the backend image's build context at build time MUST
be represented in the manifest's `input_hashes` — directly (as a hash
entry) or indirectly (as a deterministic output of a hashed input).
Asserted by `orchestrator.determinism.integration.test.ts`:

```ts
// For every file in backend/, either:
//   input_hashes[path] exists, OR
//   the file was produced by a function whose inputs are all in input_hashes.
```

### Rule 5 — failure entries name the failing step (FR-006)

Every `failure_entries[]` entry MUST have:
- `step`: one of `"render" | "bundle" | "image" | "compose" | "scan"`
- `code`: a taxonomy string (see contracts/orchestrator-cli.md)
- `message`: a single-line (no embedded `\n`) human-readable diagnostic

Asserted by per-error-path contract tests.

---

## Backward compatibility

Readers of the manifest that pre-date this feature:

- Still find `result`, `input_hashes`, `backend_files`, `backend_image`,
  `widget_bundle`, `failure_entries`, `compliance_scan` intact.
- If they attempt to read `steps` and it's absent, they MUST fall back
  to deriving the equivalent information from the existing fields
  (reader-side defensive code; not required for this feature's own
  writers).

Feature 002 and Feature 003 manifests without `steps` MAY coexist with
Feature 005 manifests in the same demo directory (e.g., during a
migration commit).

---

## Schema change summary

| Field | Type | Added | Covers |
|---|---|---|---|
| `steps.render.action` | enum | yes | FR-009 |
| `steps.render.files_changed` | int | yes | FR-009 |
| `steps.bundle.action` | enum | yes | FR-009 |
| `steps.image.action` | enum | yes | FR-003, FR-005, FR-013 |
| `steps.image.reason` | string | yes | FR-005, FR-013 |
| `steps.compose.action` | enum | yes | FR-009 |
| `steps.scan.action` | enum | yes | FR-009 |
| `steps.scan.clean` | bool | yes | FR-009 |
| `input_hashes["backend/Dockerfile"]` | hex | yes | FR-004, SC-008 |
| `input_hashes["backend/.dockerignore"]` | hex | yes | FR-004 |
| `input_hashes["backend/package.json"]` | hex | yes | FR-004 |
| `input_hashes["backend/tsconfig.json"]` | hex | yes | FR-004 |
| `input_hashes["backend/src/_shared/<name>.ts"]` | hex | yes | FR-004, FR-002a |
| `input_hashes["backend_source_tree"]` | hex | yes | FR-009 |
