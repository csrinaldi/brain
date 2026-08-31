# ADR-0019 Amendment 3 — Amendment 2's replacement count was also wrong (issue #456)

> Amendment 2 corrected *"Twelve modules import that layout"* to *"Ten production
> modules… eighteen counting tests"*. **Both halves of that replacement are wrong.**
> Measured: **eleven** production modules and **five** test files, sixteen in total.
>
> Found by brain's cold review on PR #811 (`judgment:cold-1`, severity `correction`),
> measuring the tree rather than trusting the amendment. An amendment written against
> citations that decay, carrying a miscount, is the defect naming itself.

```brain-amendment/1
target: brain/project/decisions/adr-0019-harness-port.md
amendment: 3
issue: 456
home-summary: Amendment 2's own replacement count was wrong — eleven production importers and five test files, not ten and eighteen, #456
body: ## Amendment 3 — the replacement count, measured this time (issue #456)
body-end: ### Notes for the promoter
```

```amend-find
Ten production modules import that layout, eighteen counting tests. Three of them are gates on every pull request —
```

```amend-replace
Eleven production modules import that layout, sixteen counting its five test files. Three of them are gates on every pull request —
```

---

## Amendment 3 — the replacement count, measured this time (issue #456)

**Signed**: — Cristian Rinaldi

### What changed

`Ten production modules … eighteen counting tests` becomes `Eleven production modules
… sixteen counting its five test files`.

Measured with a quote-agnostic pattern over the tree:

```
rg -l "from ['\"][^'\"]*sdd-layout\.mjs['\"]" --glob '*.mjs'
```

**Eleven production importers**: `check-refs.mjs`, `lib/archive-logic.mjs`,
`lib/archive-sweep.mjs`, `lib/stage-engine.mjs`, `memory/backends/engram.mjs`,
`memory/lib/feature-resolution.mjs`, `new-change.mjs`,
`review/evaluators/checkpoint.mjs`, `session-start.mjs`, `vcs/governance-tiers.mjs`,
`vcs/phase-order-check.mjs`. **Five test files.** Sixteen total.

### How both numbers were wrong at once

The measurement behind Amendment 2 matched only single-quoted import specifiers.
`memory/backends/engram.mjs` and `new-change.mjs` import with double quotes, so they
fell out of the production count — ten instead of eleven.

The "eighteen counting tests" half came from a second, looser pass that counted every
file mentioning the string `sdd-layout.mjs` anywhere, including comments and
drift-guard fixtures. Two different greps, neither stated, producing two numbers that
could not both be right about the same set.

### Why this is worth its own amendment rather than a quiet edit

Amendment 2 exists because Amendment 1 cited a count that was never true and pointed
at line numbers that rot. Its replacement carried the same class of defect, and it was
**repeated** — the identical wrong pair appears in this change's `proposal.md`,
`design.md` and in Amendment 2's own draft, so it was a measurement taken once and
copied, not a typo.

That is the sharper lesson and it belongs in the record: a correction is not
self-verifying. Amendment 2 was reviewed, promoted through `brain:promote` with a
typed confirmation, and merged into signed doctrine with a wrong number inside — and
what caught it was not the promotion ceremony but a reviewer that re-measured the
claim instead of reading it.

### What this amendment does NOT touch

The four conditions, the definition of the evidence contract, the boundary in *"What
this amendment does NOT authorise"*, and Amendment 2's other correction — the
`ARTEFACT_FILE` quotation and the move from line numbers to symbols, both of which
were and remain right. Only the module count changes.

### Notes for the promoter

The `amend-find` line is the exact sentence Amendment 2 installed, including the
trailing em-dash and the space before it. If Amendment 2 has not been promoted in the
target yet, this draft will not match — promote them in order.
