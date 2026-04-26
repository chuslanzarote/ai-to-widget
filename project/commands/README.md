# Source of `.claude/commands/atw.*.md`

These markdown files are the canonical source for the five Ai to Widget
slash commands. The installer (`create-atw`) copies them verbatim into
the Builder's project under `.claude/commands/` at scaffold time.

| File | Command | Purpose |
|---|---|---|
| `atw.init.md` | `/atw.init` | Capture project metadata (no LLM). |
| `atw.brief.md` | `/atw.brief` | Interview-based business brief synthesis. |
| `atw.schema.md` | `/atw.schema` | Parse SQL schema, PII-safe classify, produce schema-map. |
| `atw.api.md` | `/atw.api` | Parse OpenAPI, classify operations, produce action manifest. |
| `atw.plan.md` | `/atw.plan` | Consolidate upstream artifacts into a build plan with cost estimate. |

Do not edit these files inside a Builder's project; re-run the installer
with `--force` to pick up upstream revisions.
