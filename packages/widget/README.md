# @atw/widget

The Preact + Signals widget source that `/atw.build` ships to every Builder
project. The sources under `src/` are compiled to `dist/widget.{js,css}` by
`@atw/scripts` (`atw-compile-widget`), which resolves this package through the
Node module resolver — identical resolution semantics inside the monorepo
(via npm workspaces) and for external Builders who install `@atw/widget`
transitively via `@atw/scripts`.

## Contributor loop (FR-010)

Workspace symlinks mean edits to `packages/widget/src/` are picked up by the
next `atw-compile-widget` run without any publish/republish step:

1. Edit any file under `packages/widget/src/`.
2. Run `atw-compile-widget --out-dir <some-dist>` (or the orchestrated
   `/atw.build` inside a demo).
3. The rebuilt bundle reflects the edit. The build manifest's
   `widget.source.tree_hash` changes, giving a deterministic signal that the
   source changed.

There is no republish step because consumers resolve `@atw/widget` through
the workspace, not a registry. The build hashes the tree at compile time and
compiles straight from `src/` — so the round-trip is always source-fresh.
