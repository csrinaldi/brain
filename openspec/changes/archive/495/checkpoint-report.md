# Checkpoint report — issue #495, the declared budget claim

```brain-checkpoint/1
counted_lines: 363
diff_budget: 1000
```

**This is the first checkpoint report in this repository that the reviewer can
read.** Every one of the seventeen before it states its budget claim in prose,
and the reader now says so — *absent*, with a reason — rather than inferring a
number from a sentence. That is the whole of #495, dogfooded.

## What the block above says, and how it was produced

| key | value | how |
|---|---|---|
| `counted_lines` | 363 | `git diff --numstat --cached \| node brain/scripts/vcs/diff-size-count.mjs` — the real gate, not a hand tally |
| `diff_budget` | 1000 | `lite`, the tier this repo declares (ADR-0026) |

Breakdown of the 363, from the same numstat (`**/*.test.mjs` and
`openspec/changes/**` are in `governance.ignoreList`, so they are budget-free):

| file | counted |
|---|---|
| `review/lib/checkpoint-block.mjs` | 127 |
| `review/evaluators/checkpoint.mjs` | 144 (50 added, 94 removed — `parseBudgetClaim` and its two helpers) |
| `lib/fenced-blocks.mjs` | 54 |
| `lib/amendment-draft.mjs` | 38 (the pure move out) |

## §10.2 artifact completeness

`proposal.md` · `spec.md` · `design.md` · `tasks.md` present; `tasks.md` carries
completed items. At `lite` the required set is `spec.md` alone, but the SDD must
be **executed** at every tier (#555 round 3, `evaluateRuleC`).

## §10.4 TDD-RED

Red-first throughout, and mutation-proved rather than asserted. Every mutation
diffed, **read back from disk**, restored under a trap:

| mutation | red |
|---|---|
| `absent` answers `null` instead of `{ok:false, absent:true}` — the ruling's point 2 | 11 |
| the block is located by POSITION (first fence) instead of by TAG | 4 |
| a missing required key is tolerated as `0` | 2 |
| the collected reasons never reach `conditions:` | 3 |
| the gather silently drops the unparseable reason | 1 |

The first is the one that matters: `null` is the answer this change exists to
remove, and eleven cases refuse it.

## §10.5 audit / governance-status

- `npm test` — **3562 pass, 0 fail** (3563 tests, 1 pre-existing skip)
- `npm run brain:repo:check` — no prohibited references, artifact structure valid
- `npm run brain:nav` — no orphans, no broken links

## Doctrine

The rule this change enforces is Tier 2. It ships as a `brain-amendment/1`
**draft** under `brain-drafts/`; nothing under `brain/core/**` or `brain/HOME.md`
is edited here. Verified against the real target with `parseAmendmentDraft` +
`planAmendment`: 3 acts, all pending, both anchors occurring exactly once and
neither replacement present (idempotent). The appended body was read through
`extractBody` directly rather than from the plan's display labels — 3124 chars,
cut before the promoter notes, and carrying zero source-line citations (#586).

**The maintainer's `brain:promote` commit is the signature** (ADR-0028).
