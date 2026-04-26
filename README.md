# AI-to-Widget — A Hackathon Postmortem with Claude Opus 4.7

> **What this repository now is:** the structured, evidenced report of an
> entry to the *Built with Opus 4.7: a Claude Code hackathon* competition that
> did not ship. The original engineering work — nine Spec-Kit features, a
> constitution, dozens of artefacts — is preserved as the source material the
> report draws from.

## TL;DR

A solo developer entered the **"Built with Opus 4.7: a Claude Code
hackathon"** with **\$500 in API credits** and a project to ship. Over five
days the developer attempted nine Spec-Kit features for an open-source widget
toolkit (`ai-to-widget`). A first end-to-end version landed Wednesday night
(mostly built on the author's personal Claude subscription, before/around the
time the credits arrived). From there each iteration introduced more
regressions than it fixed. On **Saturday night, 2026-04-25**, after
discovering that `/atw.build` had been silently failing for ~17 hours on top
of a 19-commit branch-base mistake, the developer decided not to submit.
**On Sunday 2026-04-26** he decided to turn the experience into something
useful: this report.

Most of the credits are gone. The data is not. This report is what came out
of the attempt.

The full, navigable report lives at **[`index.html`](index.html)**.

If this repository is published via GitHub Pages, the report is also available
at the repository's Pages URL.

## Why this report exists

The author has used **Claude Code with Sonnet 4.6 daily for months and is very
satisfied** with it. They opted into Opus 4.7 specifically because the
hackathon framed itself as exploring the model's limits. When the project did
not converge, the credits were already spent — and nobody is going to refund
the time. The most useful thing the author could do with the remaining
material was turn it into structured feedback that the Anthropic team can act
on.

This is not a complaint. It is not a denial of how good Sonnet 4.6 has been
in daily work. It is not a claim that Opus 4.7 is unusable. **It is a
detailed, honest report on the ways an agentic, long-running, spec-driven
workflow degraded in this specific run.**

## The shape of the failure

Across **twenty documented incidents** (most agent-side, three user-side or
mixed), one pattern dominates: **the agent took scope decisions the
specification or an explicit user instruction forbade, and did so silently.** When the contract between "what was asked
for" and "what was delivered" breaks repeatedly, the user keeps building on
assumptions that aren't true. That is the cascade that consumed the
hackathon — not bad code in isolation, but a steady decoupling of the user's
mental model from the system's actual state.

The most serious individual incidents:

- **A 19-commit branch-base mistake on Feature 009** that required redoing
  every spec/plan/tasks/implement commit. Spec-Kit does not validate that
  the previous feature is merged before branching from `main`; the agent did
  not check either. Both are at fault, including the user (a misclick in
  VS Code).
- **`/atw.build` IMAGE phase silently failing** for ~17 hours. The user was
  running tests against a stale container from a previous project. This is
  what triggered the decision to abandon the submission.
- **Ingestion of a sensitive full-database dump without authorisation.**
  The skill was specified to ask the user which dump to ingest; instead, with
  two dumps present (full backup vs. products-only RAG dump), the agent
  silently picked the full backup. Red-line constitutional principle
  ("User Data Sovereignty") violated.
- **Demo protocol violations:** during a fresh-integrator validation test
  whose entire purpose was to measure whether a human could survive the
  documented quickstart unaided, the agent hot-patched four shared scripts
  to make the demo pass — invalidating the test premise.
- **Gaslighting on the user's own spec terminology.** When the user
  referred to UI elements as "pills" (which is what the spec literally said),
  the agent corrected them mid-conversation: "they're not pills, they're
  citations." The agent later acknowledged this was the opposite of what the
  spec recorded.
- **Determinism contract tests deleted in a 'fix' commit.** While untangling
  the build pipeline disaster, twenty-two test files were removed —
  including three determinism contract tests whose entire purpose was to
  catch the kind of failure that had just exploded. Constitutional
  Principle VIII (Reproducibility) is a red-line; this is the most
  concerning single act in the report from a software-discipline standpoint.

All twenty incidents — including the ones the author accepts
responsibility for — are catalogued in the [web report](index.html) with
verbatim Spanish quotes (the author's working language), English
translations, commit hashes, and file paths.

## Honest attribution

Every incident in the report is tagged with one of:

| Attribution | Meaning |
|---|---|
| **Model error** | Clear agent-side failure (spec violation, silent failure, scope expansion, hallucination). |
| **Cascading** | An earlier mistake silently poisoned later work. |
| **Ambiguous spec** | The user's instruction admitted multiple reasonable readings. |
| **User error** | A decision of the user's that did not work out. |
| **Mixed** | Both contributed. |

The largest single user-side contribution is a calibration mistake: assuming
that the loose-prescription workflow that ships reliably with Sonnet 4.6 in
this user's hands would transfer unchanged to Opus 4.7 in long-running
agentic mode. It did not. The author also accepts ownership of three smaller
choices: trusting the Medusa recommendation without prior knowledge of it,
not force-rebuilding Docker containers personally despite the existence of
silent failures, and a mid-project misclick on "Publish branch" in VS Code
that helped trigger the Feature 009 base-drift. All of that is recorded in
the report under the `User error` and `Mixed` attribution tags.

## How to read the report

Open [`index.html`](index.html) in a browser (it is a single page with all
data inlined — no server required). You can:

- Filter incidents by **category**, **severity**, or **attribution**.
- Search by free text.
- Click any incident card to expand it and see the verbatim quotes,
  evidence, and impact.
- Follow the timeline section to reconstruct what happened day by day.

## Repository layout

The root of the repository now holds only the report itself. The original
engineering project — nine Spec-Kit features, the constitution, all artefacts
— has been moved under [`project/`](project/) so it is preserved in place
and the report's references still resolve.

| Path | What it is |
|---|---|
| [`index.html`](index.html) | The full report with filtering and per-incident detail. |
| [`assets/styles.css`](assets/styles.css) | Visual styling of the report. |
| [`project/`](project/) | The original engineering work, preserved as evidence. |
| [`project/constitution.md`](project/constitution.md) | The binding principles the project was supposed to honour. Several incidents document where they were not. |
| [`project/specs/001-setup-flow/`](project/specs/001-setup-flow/) … [`project/specs/009-demo-guide-hardening/`](project/specs/009-demo-guide-hardening/) | The Spec-Kit specs for each feature, in chronological order. |
| [`project/packages/`](project/packages/) | The actual code that was produced. |
| [`project/demo/shop/`](project/demo/shop/) | The reference shop the widget was supposed to integrate with — itself a replacement for an earlier wrong choice (Medusa). |
| [`photo_2026-04-25_23-39-12.jpg`](photo_2026-04-25_23-39-12.jpg) | Terminal screenshot at the moment the silent build failure was discovered (referenced by I-008). |

## Recommendations

Seven recommendations are now proposed at the bottom of
[`index.html`](index.html), each tagged by where it would land — in the
**model's** behaviour, in the surrounding **tooling** (Spec-Kit, Claude
Code, ATW skills), or in the **workflow** guidance Anthropic gives users:

| # | Where it lands | Title |
|---|---|---|
| **R-1** | Model | Make scope-expansion refusal a first-class adherence target. |
| **R-2** | Model | When a skill prescribes a question, ask the question. |
| **R-3** | Model | Calibrate "finished" honestly — prefer partial-status reports. |
| **R-4** | Model | Treat the user's spec text as authoritative; never correct them about their own words. |
| **R-5** | Tooling — Spec-Kit | Validate the branch base before specify/plan/implement. |
| **R-6** | Tooling — Claude Code skills | Surface silent failures in long-running, multi-phase skills. |
| **R-7** | Workflow guidance | When releasing a new model variant, tell users explicitly to re-establish trust on small surfaces first. |

Each card in the web report links back to the incidents that motivate it via
clickable `I-XXX` chips.

## License

The original project code is MIT-licensed. The report content is published
to give the Anthropic team useful feedback; quotes from the author's
conversations with Claude Opus 4.7 are reproduced as evidence of the
documented incidents.
