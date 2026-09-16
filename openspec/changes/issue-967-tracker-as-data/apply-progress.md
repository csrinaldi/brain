---
status: in-progress
issue: 967
batch: 1
slice: "PR A — the block is data"
---

# Apply progress — #967, batch 1 (PR A)

**Mode**: Strict TDD (`GIT_CONFIG_GLOBAL=/dev/null npm test`).
**Chain**: `feature-branch-chain` on the tracker `feature/issue-967`. PR A targets
the tracker. PR B and PR C are NOT in this batch.
**Worktree**: `/home/gandalf/IA/brain-issue-967`, branch
`feat/issue-967-featgovernance-an-epics-tracker-is-data`, base
`origin/feature/issue-967` (c442533a).
**Previous apply-progress**: none — this is the first batch.

## Completed tasks

- [x] A0 — `spec.md` amended per the nine reconciliation points
- [x] A1a / A1b — `graphShape()` helper, the seven sites, `kind` and `tracker`
- [x] A2a / A2b — the four `declarationDivergences` reasons
- [x] A3a / A3b — the prose `Parent: #N` reader, block-key precedence, no salvage
- [x] A4a / A4b — the node's four fields, the lift, `parent-not-epic`
- [x] A5a / A5b — `renderSummary`'s optional parameter
- [x] A6a / A6b — the snapshot fields and the unreadable-node reset
- [x] A7 — full suite and `npm run brain:repo:check` green
- [x] A8 — the record-first memory commit

Not in this batch, by design: A9 and A10 are maintainer forge acts after PR A
merges into the tracker; PR B, PR C and the tracker PR are later slices.

## TDD cycle evidence

| Pair | RED (test first) | GREEN | Stated mutation → result |
|---|---|---|---|
| A1 | 8 failing: the seven `assert.deepEqual` sites + the new "declares none of the three keys" case | 69/69 | A stray key added to the parser return → 8 red. Switching one site to `partialDeepStrictEqual` under the same mutant → 7 red, i.e. that site stopped noticing. The weakening is real and is refused. |
| A2 | 6 failing: `tracker: main`, `tracker: feature/../x`, tracker-on-a-non-epic, malformed-tracker-on-a-non-epic, the seven bad `parent:` values, two differing `Parent:` lines | 76/76 | Dropping the `..` clause → exactly the `feature/../x` case red. First-match-wins on two `Parent:` lines → exactly the ambiguity case red. |
| A3 | 2 failing: #881's verbatim line, and two `Parent:` lines naming the same issue | 86/86 | Relaxing the anchor to `/Parent:/` → the #337 case and the indented/quoted case red. Reading `Epic:` as a synonym → the `Epic: #313` case red. |
| A4 | 9 failing: the node's four fields, `track`/`tracker`, the unknown key, the `epic(...)` title, the lift, `parent-not-epic`, the epic parent, the absent parent, the unreadable block | 95/95 | Emitting an entry for the ABSENT parent → that case red (plus R967-1 S1, which also pins it). Inferring `kind` from an `epic(` title → the R967-9 S1 case red. |
| A5 | 1 failing: the summary line | 97/97 | Dropping the `= []` default → the byte-identity case red. |
| A6 | 0 failing — see the finding below; the case was already green and is pinned and labelled as such | 12/12 | The stated mutation does NOT hold. See "Deviations". |

Full suite under isolation: **5612 pass / 0 fail** (baseline on `main` today:
5582 / 0 — 30 added). `npm run brain:repo:check` green before every commit.

## Commits (all local, nothing pushed)

```
3903b49e docs(sdd): issue-967 planning artefacts — explore, proposal, spec, design, tasks (#967)
d8636a54 docs(sdd): spec.md amended per the design's measurements (#967)
255dd515 feat(status): the brain-graph block declares kind and tracker (#967)
a3dc7695 feat(status): a malformed tracker or parent is said, never guessed (#967)
01fab940 feat(status): absent a parent: key, a line-initial Parent: #N is read and said as prose (#967)
92c7b59d feat(status): the graph node carries kind, tracker and parent, and lifts what each body said (#967)
8ddaf30f feat(status): the epic map summary says the declarations it could not honour (#967)
16a67cf4 feat(status): the snapshot carries the declared kind, tracker and parent (#967)
```

Plus this file's commit and the record-first memory commit.

## Diff

| Measure | Value | Budget |
|---|---|---|
| Counted source lines (`*.test.mjs`, `openspec/changes/**`, `.memory/**` excluded) | **153** | tier `lite` = 1000 |
| Review lines, planning artefacts excluded | 556 (347+7 of them tests) | 400 reviewer budget |
| Review lines, source only | 153 | — |
| Full `git diff --shortstat` | 10 files, 2241 insertions, 13 deletions | — |

The 65–85 estimate in `tasks.md` counted code and not comments; comments count
and are not shrinkable to fit a budget (`work-unit-commits`, `chained-pr`). The
overage is entirely explanatory prose in `epic-graph.mjs` carrying the
measurements each rule rests on, in the house style of the file it lands in.

`openspec/changes/**` is uncounted by this repo's own config
(`brain.config.json:18-29`), so the 1698 artefact lines are budget-free by rule,
not by omission. Excluding them and the tests, a reviewer reads 153 lines.

## Deviations from the design

1. **A6's stated mutation does not hold, and the test says so.** `readForge`
   substitutes `body: ''` for a body it could not read (`snapshot.mjs:208`), so
   `parseGraphBlock` returns `null` and all four fields arrive `null` BEFORE the
   unreadable-node reset runs. Omitting them from the reset therefore turns no
   test red. They join `track`, `files` and `sources`, already in that same reset
   and already equally free. The reset is the written guarantee, not the
   mechanism; the assertion is pinned and labelled "already green", the module's
   own precedent for this exact shape (`epic-map.test.mjs`, the #639 `js`-snippet
   case). Reported rather than hidden behind a green checkbox.
2. **`reason` is a stable token, not the prose sentence** the design's
   "Data shapes" example showed (`reason: 'not a feature/<name> branch'`). D2's
   table names the four as `tracker-grammar`, `tracker-without-kind-epic`,
   `parent-grammar`, `parent-ambiguous`, and `tasks.md` A2a/A4a assert exactly
   those. The deciding reason is PR C: its gate must branch on "the tracker is
   malformed", and a reader that string-matches prose to decide is one wording
   change away from going quiet. `renderSummary` prints the token beside the
   issue, the key and the offending value, which keeps A5b at one formatter line.
3. **A5's stated mutation is refined, not dropped.** "Making the parameter
   required turns the existing `renderSummary` assertions red" cannot hold:
   every existing call site passes a whole `buildGraph` result, which now carries
   the field. The byte-identity test therefore calls `renderSummary` a second
   time with the key REMOVED — the exact shape every caller had before this
   change — and that call is what dropping the `= []` default kills. Recorded in
   `tasks.md` beside A5a.
4. **`parent: #878` is malformed.** D2 wrote the parent grammar as `#?<digits>`,
   which would admit it; `spec.md` R967-1's scenario and `tasks.md` A2a both
   demand a refusal. Implemented as bare positive digits only, two sources
   against one, and `#878` is in the refused set with `abc`, `main`, `0`, `-3`,
   `87.5` and `878x`.
5. **Reconciliation point 7 had nothing to amend in `spec.md`.** The
   six-vs-seven count lives in `proposal.md` Q8, which is outside PR A's
   `brain-slice-scope/1` fence. It landed instead as an added `AND` clause under
   R967-1 scenario 2, naming the seven measured sites and the no-weakening rule.
   `proposal.md`'s own count is still six and is left for a later slice or for
   the archive phase.

## Fixture matrix, as required before writing each parser

Every row below is a test, and each was written before the code that satisfies
it: all four keys declared; none declared (plus a byte-equality check of every
pre-existing field against the pre-change literal); an unknown key; `tracker` on
a non-epic; a malformed `tracker`; a `..` segment; a legal nested
`feature/a/b`; a malformed tracker on a non-epic (one entry, not two); seven bad
`parent:` values; prose `Parent: #878 (text)` verbatim from #881; #337's
verbatim mid-line; an indented, a quoted and a list-item `Parent:`; two prose
matches disagreeing; two prose matches agreeing; block and prose disagreeing;
block parent beside two disagreeing prose lines; a malformed block `parent:`
beside a prose line; `Epic: #N` alone; `needs: [879]` alone; an unreadable body
(duplicated block, hidden block, and no block at all); a parent that is not an
epic; a parent that IS an epic; a parent absent from the graph; an `epic(...)`
title with no `kind:`.

## Absence guards, run over the whole diff

- No path under `brain/core/**` or `brain/project/**` appears — verified with
  `git diff --name-only`.
- `stranded.mjs`, `brain-ship.mjs`, `memory/lane/ship.mjs` and
  `snapshot-cli.test.mjs` are byte-identical: `git diff` over those four paths
  is empty.
- No sub-issues endpoint, no new port verb, no title pattern matched anywhere.
- `ui/lib`'s `canvas-model.mjs` / `drawer-model.mjs` untouched: they do not
  exist on this base, and their three lines belong to #882.

## Workload / PR boundary

- Mode: chained PR slice, `feature-branch-chain`.
- Current work unit: PR A — "the block and the snapshot carry `kind`, `tracker`,
  `parent`, `parentSource`".
- Boundary: starts at `origin/feature/issue-967` (c442533a); ends with the
  record-first memory commit below. Nothing pushed, no PR opened.
- Rollback: reverting `epic-graph.mjs`, `epic-render.mjs` and `snapshot.mjs`
  removes the whole slice; no other module reads the four fields yet.
- Runtime harness: N/A — nothing in this slice has a runtime boundary. The
  fields are inert until a body declares them (design R5), and activation is
  maintainer task A9 on the forge.

## Next

Fresh-context review of the diff, then push and open PR A against
`feature/issue-967`. PR B (`resolveBase`) and PR C (the `base-branch` gate)
follow in later batches.
