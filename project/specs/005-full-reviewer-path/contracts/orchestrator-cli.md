# Contract — `/atw.build` orchestrator CLI

**Feature**: 005-full-reviewer-path
**Covers**: FR-005, FR-006, FR-007, FR-013
**Owner**: `packages/scripts/src/orchestrator.ts`

---

## New flag

### `--skip-image`

Type: boolean (no argument).
Default: absent.
Visibility: MUST appear in `/atw.build --help` output.

**Semantics.** When present, the orchestrator skips the IMAGE step
entirely. No `dockerode` calls are made. The build manifest records:

```json
"steps": { "image": { "action": "skipped", "reason": "suppressed by --skip-image flag" } }
```

`result: "success"` remains reachable (subject to other steps passing).

**Only valid activation.** No environment variable, no implicit
detection, no config-file override activates this behaviour. The flag is
the single, visible, testable switch.

**Help-output requirement.** The literal string `--skip-image` appears
in the output of `/atw.build --help`. Contract test:
`orchestrator.skip-image.contract.test.ts` asserts this.

---

## IMAGE-step failure taxonomy (loud mode)

When `--skip-image` is NOT set, the IMAGE step runs. Failures propagate
out of `buildBackendImage()` and are classified by `error.code`. Exit
codes and manifest entries:

| Cause | `error.code` | Exit code | stderr diagnostic |
|---|---|---|---|
| Docker daemon unreachable | `DOCKER_UNREACHABLE` | 3 | `atw.build: IMAGE step failed — Docker daemon unreachable. Start Docker Desktop (macOS/Windows) or systemctl start docker (Linux).` |
| Secret-shaped file in build context | `SECRET_IN_CONTEXT` | 20 | `atw.build: IMAGE step failed — secret-shaped files in build context: <file-list>` |
| Docker build returned an error event | `DOCKER_BUILD` | 19 | `atw.build: IMAGE step failed — docker build failed: <inner message>` |
| Handlebars template compile failure (raised from RENDER, before IMAGE) | `TEMPLATE_COMPILE` | 17 | `atw.build: RENDER step failed — Template <name> compile error: <msg>` |
| Unexpected error | (none) | 1 | `atw.build: IMAGE step failed — <err.message>` |

### Manifest shape on failure

```json
{
  "result": "failed",
  "steps": { "image": { "action": "failed", "reason": "<code>" } },
  "failure_entries": [
    { "step": "image", "code": "<code>", "message": "<single-line>" }
  ],
  "backend_image": null
}
```

### No-overwrite guarantee (FR-007)

When the IMAGE step fails, any previously-tagged `atw_backend:latest`
image MUST remain untouched. Enforced by dockerode's default behaviour:
a failed build does not re-tag. The orchestrator MUST NOT call
`docker.removeImage()` anywhere. Contract test:
`orchestrator.loud-failure.contract.test.ts` asserts that after
injecting a template failure, `docker images atw_backend:latest` still
returns the prior image unchanged.

---

## Removed code pattern

`orchestrator.ts:612-617` currently contains:

```ts
} catch (err) {
  // Feature 002 US1 MVP: if no backend Dockerfile present (e.g. in
  // tests with stubbed scaffolding), record the failure but do not
  // abort the whole build. US9 revisits the failure taxonomy.
  log("image build skipped: %s", (err as Error).message);
}
```

MUST be removed. Replacement: the step is simply not wrapped; the
orchestrator's outer error handler (same one that already exists for
RENDER/BUNDLE errors) converts thrown errors into the manifest shape
above.

---

## Exit-code stability

Exit codes match the existing per-command CLI in
`build-backend-image.ts:190-206`:
- `3` reserved for "environment/prerequisite failure" (missing
  artefact, bad flags, daemon unreachable).
- `17` reserved for template-render errors (already in
  `render-backend.ts:202`).
- `19` reserved for docker-build errors.
- `20` reserved for secret-in-context errors.
- `1` generic.

These codes are part of the test-runnable contract. Changing any of
them is a spec-level change, not an implementation tweak.

---

## Interactions with existing flags

| Combination | Behaviour |
|---|---|
| `--skip-image` alone | RENDER + BUNDLE + COMPOSE ACTIVATE + SCAN run; IMAGE skipped. |
| `--skip-image --entities-only` | RENDER/BUNDLE/IMAGE/COMPOSE/SCAN all skipped (entities-only precedence). |
| `--skip-image --no-enrich` | Compatible — neither affects the other. |
| `--skip-image --dry-run` | Dry-run returns before any step. |
| (none of the above) | IMAGE step is mandatory; loud on failure. |
