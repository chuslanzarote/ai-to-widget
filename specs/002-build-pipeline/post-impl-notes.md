# Post-implementation notes — Feature 002 (Build Pipeline)

## T104 — manual cross-platform quickstart verification (DEFERRED)

T104 requires a human operator to walk through
[`quickstart.md`](./quickstart.md) on three reference environments
(macOS, Linux, WSL2), recording timings and any platform-specific
surprises. This task was not executable inside the implementation agent
session that completed T001–T103, T105–T109.

Action items (for a human owner):

1. Reserve a small window on each reference OS and follow
   `quickstart.md` top-to-bottom.
2. Record wall-clock for the Aurelia fixture and the mini fixture.
3. Note any Docker / Node / shell-path divergences not already covered
   by the README "Cross-platform support" section.
4. Append findings below.

## Integration tests guarded by `ATW_E2E_DOCKER=1`

Every integration test added for US1–US9 (and Polish) skips by default
and runs only when `ATW_E2E_DOCKER=1` is exported. This is intentional:
they need a live Docker daemon and pull the `pgvector/pgvector:pg16`
image. CI lanes without Docker should leave the env var unset.

## Notes from the PC crash during T088–T097

The implementation was interrupted by a PC reboot while T088–T097 were
in progress. On resume (2026-04-22) the repo state was:

- Code for T088, T089, T090, T092, T093 had landed on disk but the
  matching `[X]` checkboxes in `tasks.md` were not yet written.
- Reconciled these to [X] and continued with T091 onward.

No code was lost; every resumed task was re-verified against the code
and contracts before the checkbox was flipped.
