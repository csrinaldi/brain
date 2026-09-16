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
- `ui/lib`'s `canvas-model.mjs` and `drawer-model.mjs` are untouched, and the
  reason recorded here first — "they do not exist on this base" — WAS FALSE.
  Corrected 2026-09-16 after the fresh-context review measured it:
  `git ls-tree -r --name-only origin/feature/issue-967 | rg ui/lib` lists both.
  What is true is that they are INERT to this slice.
  `canvas-model.mjs:58-68` builds its drawn node from an explicit object literal
  — `number`, `label`, `className`, `marks`, `track`, `x`, `y`, `w`, `h` — so it
  projects node fields BY NAME and never spreads the node; four new keys on a
  graph node cannot reach it. `drawer-model.mjs` reads no graph node at all (its
  entries come from spec cards, review rounds and threads). Surfacing `kind`,
  `tracker` and `parent` in the UI is #882's three lines, not this slice's.

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

## Review round 1 — 2026-09-16, fresh context, before push

Verdict REVISE: two majors, four minors, four editorials. Three code fixes and
one documentation fix landed on top of the ten original commits. Nothing pushed;
no PR opened. Every item below was MEASURED on the pre-fix tree before a line was
written, and every fix was written test-first with the stated mutation run.

### M2 — a column-zero `Parent:` inside a fenced block was read as a declaration

**Commit** `7b2c212b`. **Finding**: the prose scan ran over the whole body,
fences included. Measured, three shapes: `Parent: #999` inside a plain ``` fence
yielded parent 999; the same line inside the `brain-graph/1` fence itself yielded
999 too (`Parent:` is not the block's exact-case `parent:` key, so `scalar` never
reads it and the prose scan did); and — the damaging one, found while writing the
test — a fenced example standing ABOVE a real `Parent: #878` line did not merely
add a parent, it DELETED the real declaration by manufacturing a
`parent-ambiguous` refusal with it.

**Fix**: the scan runs over the body with every fenced region blanked, derived
from `fencedBlocks`'s own report rather than from a second fence reader (#340).
An unterminated fence is blanked to the end of the document — that is how far it
runs on the page — which the review did not ask for and is included because
leaving it out reproduces the same defect class one shape over; it carries its
own assertion. **RED**: the new test failed `999 !== null` on its first case.
**GREEN**: 98/98 in `epic-map.test.mjs`. **Mutation**: scanning the raw `body`
again → 97 pass, 1 fail, and the one failure is exactly this test.

**`spec.md` R967-2 amended in the same commit.** The code was conformant to the
sentence it had; the sentence was the defect. #709 had already settled for the
fence selector that an illustration and a declaration must not be byte-identical
to a reader, and R967-2 left prose out of that ruling.

### m1 — `Parent: #878, #879` on one line resolved to 878 silently

**Commit** `3c6a3336`. **Finding**: two `Parent:` lines naming different issues
were refused as `parent-ambiguous`; one line naming two was not, because the
pattern stopped at the first number and the rest of the line was never read. 878
won BY WRITING ORDER — the first-match-wins guess R967-2 refuses in the two-line
shape, reached by a different door.

**Fix**: the rule is stated over the SET of issue numbers a declaring line names,
not over the count of lines, so the one-line and two-line shapes cannot disagree
about what counts as a restatement either. `Parent: #878 (Brain UI) — slice 3,
Wave B.` carries no second `#<digits>` and still reads — it is the one real body
this reader exists for, and it has its own guard test. **RED**: 100 pass, 1 fail,
on the new ambiguity case only; the two guard tests were green from the start,
which is what they are for. **GREEN**: 113/113 across both suites. **Mutation**:
`.slice(0, 1)` on the per-line number list → 100 pass, 1 fail, exactly this test.

**`spec.md` R967-2 amended**: it said "more than one line-initial match with
different numbers", the line-counting statement the defect hid behind, and it
quoted a regex the code no longer uses verbatim.

### m2 — the decision: a leading zero is REFUSED, not normalised

**Commit** `8c941474`. **Decided: refusal.** `parent: 007` became `7` through
`Number()`, and `7` is not the byte the body wrote. R967-1 forbids repairing a
declaration for `tracker:` on exactly this ground, and a parser that quietly
decides the author meant a different issue than the one they typed is the failure
mode the `declarationDivergences` channel exists to stop. Documented normalisation
was the alternative and is rejected.

**Measured beyond the review's finding**: the PROSE path was worse than the block
path — it carried no positivity check at all, so `Parent: #0` yielded `parent: 0`,
a value the block key's own refused list already names, and `Parent: #007` yielded
`7`. Fixing only the block key would have left the two paths disagreeing about
what an issue number is.

**Fix**: the grammar is spelled ONCE (`ISSUE_NUMBER`, `[1-9]\d*`) and composed
into the block key, the prose line and the ambiguity rescan. The two paths still
differ in what SILENCE means, and that asymmetry is the module's existing rule
rather than a new one: a `parent:` key present and malformed is SAID as
`parent-grammar`, while a prose line that does not match is not a declaration and
says nothing — the treatment `Parent: #878x` already got. **RED**: 100 pass, 2
fail (`007`/`0007` added to the block key's refused list, and the new prose case).
**GREEN**: 114/114. **Mutation**: `ISSUE_NUMBER` back to `\d+` with the old
`Number(parentRaw) > 0` guard → 100 pass, 2 fail, exactly those two tests.

**`spec.md` R967-1 and R967-2 amended** with the decision and the measurement.

### M1 — a false absence claim in this file, and a stale design line

**Commit**: the documentation commit this section ships in. The "they do not exist on this base"
sentence under *Absence guards* was false and is corrected above with what was
actually measured. `design.md:141` still wrote the parent grammar as
`#?<digits>`, which ADMITS `parent: #878` — the exact value `spec.md` R967-1 and
`tasks.md` A2a demand be refused, and which the implementation refuses. The
design line is overruled by the spec and the tasks, and is corrected with a dated
note rather than silently rewritten. The D2 ambiguity row and the Q3 regex carry
dated notes for m1 and m2 as well.

## Follow-ups, recorded not fixed

- **m3 — a dangling parent is invisible by spec.** R967-4 states that a parent
  ABSENT from the issue set produces no entry, on the "not in this list is not
  not-an-epic" rule. That is the settled behaviour and the code honours it, but
  it means a typo'd `parent: 8778` is silent. Flagged for **#882**, which owns
  the surface where a human could see it.
- **m4 — the self-parent wording.** A node naming ITSELF as parent is not called
  out by any token in D2's table. No code change; the wording is owed.
- **An HTML comment is not masked.** `outsideFences` removes fenced regions only.
  A column-zero `Parent: #999` inside `<!-- … -->` renders as nothing and would
  still be read. `fencedBlocks` reports no SPAN for a comment — only
  `unterminatedComment` — so masking one needs the splitter to grow a field, and
  that is #709's splitter half, not this slice. Blockquoted and four-space
  indented lines are already refused by the column-zero anchor.
- **e2 — the proposal's "six sites".** `proposal.md` Q8 still says six where
  seven were measured. Belongs to the archive pass, outside PR A's slice fence.
- **e4 — `scalar()` trims whitespace.** Pre-existing behaviour of
  `review/lib/yaml-block.mjs`, not introduced or changed here.

## Next

Push and open PR A against `feature/issue-967`. PR B (`resolveBase`) and PR C
(the `base-branch` gate) follow in later batches.
