# Aurelia — completed `.atw/` example

This directory ships the output of running the full Feature 001 flow
(`/atw.init` → `/atw.brief` → `/atw.schema` → `/atw.api` → `/atw.plan`)
against the Aurelia reference fixture (`tests/fixtures/aurelia/`).

It exists so reviewers can inspect the five committed artifacts without
having to install dependencies, authenticate with Anthropic, or wait on LLM
calls. Principle VIII — reviewers must be able to see the output.

## Tree

```text
examples/aurelia-completed/
├── config/
│   ├── project.md
│   └── brief.md
└── artifacts/
    ├── schema-map.md
    ├── action-manifest.md
    └── build-plan.md
```

In a real Builder project these files live under `.atw/` instead of
`examples/aurelia-completed/`. The content is identical.

## Reproducing

To regenerate these artifacts yourself:

1. `npx create-atw@latest my-test-project`
2. `cd my-test-project`
3. Open Claude Code and run the five commands in order.
4. Feed the `/atw.schema` step `tests/fixtures/aurelia/schema.sql` and
   `/atw.api` `tests/fixtures/aurelia/openapi.json`.

Prose may differ (the LLM is stochastic); the structural decisions
(same `## Headings` in the same order, same PII exclusions, same admin
endpoint exclusions) are stable.
