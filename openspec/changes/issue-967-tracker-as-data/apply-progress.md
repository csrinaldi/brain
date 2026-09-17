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

---

# Apply progress — #967, batch 2 (PR B)

**Mode**: Strict TDD (`GIT_CONFIG_GLOBAL=/dev/null node --test <file>` per unit,
the full `npm test` once at the end of the slice).
**Chain**: `feature-branch-chain` on the tracker `feature/issue-967`. PR B
targets PR A's branch while A is open, retargeted to `feature/issue-967` once A
merges. PR C is NOT in this batch.
**Worktree**: `/home/gandalf/IA/brain-issue-967-b`, branch
`feat/issue-967-b-verb`, base `eeb81ecc` (PR A's head at the time of the batch).
**Previous apply-progress**: batch 1 (PR A), above — merged, not overwritten.

## Completed tasks (batch 2)

- [x] B1a — three added tests in `ticket-args.test.mjs`
- [x] B1b — `baseExplicit`, `offTracker` and `OFF_TRACKER_FLAG` in `ticket-args.mjs`
- [x] B2a — `ticket-base.test.mjs` (new), the six rows of D7 plus one-hop and R967-9
- [x] B2b — `ticket-base.mjs` (new), `resolveBase` as a pure leaf
- [x] B3 — five i18n pairs and `--off-tracker` in the usage line, en + es
- [x] B4 — the verb calls the leaf, prints the reason, refuses before any git work
- [ ] B5 — manual verification, OPEN: it needs #878's body to carry the
      declaration and A9 to have landed on the forge. Not a check that can be
      faked locally, so it stays unticked rather than claimed.
- [x] B6 — `npm test` 5634/0 and `npm run brain:repo:check` green
- [x] B7 — the record-first memory commit closes this batch (record `rec-18add279543cfcd6`)

## TDD cycle evidence

| Unit | RED | GREEN | Mutation (one per unit) | Result |
|---|---|---|---|---|
| B1 — the parse | `ticket-args.test.mjs` imports `OFF_TRACKER_FLAG`: `SyntaxError: does not provide an export named 'OFF_TRACKER_FLAG'` | 14/14 | default `baseBranch` to `null` when `--base` is absent | 3 red: the #782 no-flags default test plus both new reads. Design Q1 predicted four `baseBranch` reads would be affected; measured, only `:24` reads the DEFAULT — the other three pass an explicit `--base` and survive. The claim is directionally right and numerically loose; recorded rather than repeated. |
| B2 — the leaf | `ticket-base.test.mjs`: module not found, 0/1 | 14/14 | the unreachable-epic path returns a refusal instead of failing open | 1 red — the fail-open test (R967-5 S4) |
| B3 — the strings | en keys added without their twins: `es catalog has an entry for every key in en` red, 46/47 | 47/47 | delete the `es` twin of `ticket.base.offTracker` | 1 red, the same parity test (R967-6 S6) |
| B4 — the verb | N/A — no `ticket-start.test.mjs` exists and the design deliberately did not create one (Q2); the decision it now makes is tested in B2 | ticket-args 14/14, ticket-base 14/14, i18n 47/47 | N/A for this unit | runtime harness below |

**Runtime harness (B4)**: a scratch script imported `resolveBase` and the real
`en`/`es` catalogs and rendered every message the verb can print with the params
the leaf actually returns — `fromEpic`, `noEpic`, `epicUnreadable`, `offTracker`
and the `baseIsTracked` refusal, both locales, asserting no `{placeholder}` was
left unfilled. All ten rendered; `base` was `feature/brain-ui` on the tracker row
and `main` on the off-tracker row. A param-name typo in a catalog is invisible to
the parity test, which compares key sets — this is the check that sees it.

## Commits (all local, nothing pushed)

| Commit | Work unit |
|---|---|
| `2af91d91` | the parse says whether anyone asked for a base (B1) |
| `b7f8cda6` | the base comes from the epic's declaration (B2) |
| `fba4e877` | the decision speaks both languages (B3) |
| `e306561c` | the verb starts a slice where its epic says (B4) |

## Diff

| Measure | Value | Budget |
|---|---|---|
| Counted source lines (`*.test.mjs`, `openspec/changes/**`, `.memory/**` excluded) | **232** | tier `lite` = 1000 |
| Review lines, planning artefacts excluded | 558 (325 of them tests) | 400 reviewer budget |
| Review lines, source only | 232 | — |
| Full `git diff --shortstat eeb81ecc...HEAD` | 8 files, 557 insertions, 13 deletions | — |

`tasks.md` estimated 155–185 counted source lines and ≈360 review lines. Source
came in at 232 and review at 558. The gap is the same one PR A measured and for
the same reason: the estimate counted code, comments count, and a diff is never
shrunk by deleting the prose that carries why a rule exists
(`work-unit-commits`: "budget is not code-golf"). The 325 test lines are the
fixture matrix D7 required before the leaf was written — six rows, one hop, two
fail-open shapes and the absence guard.

## Full suite

| Point | `npm test` | Note |
|---|---|---|
| `eeb81ecc` (PR A's head, measured here, not assumed) | 5617 / 0 | the brief's 5612 predates PR A's later fixes |
| `e306561c` (PR B's head) | 5634 / 0 | +17 = 3 (`ticket-args`) + 14 (`ticket-base`) |

`npm run brain:repo:check`: green before each of the four commits.

## Deviations from the design

- **`ticket.base.noEpic` carries a `reason` TOKEN, not three keys.** D7 fixes
  five keys and row 2 covers three facts, so the fact travels as a param:
  `no-parent`, `parent-not-epic`, `epic-declares-no-tracker`. The tokens render
  verbatim in both locales, as `parseGraphBlock`'s divergence reasons already do
  (D2: "a token rather than a sentence because a later reader has to branch on
  it"). Translating them would make one fact read as two.
- **`ticket.base.epicUnreadable` also covers "not found" and "two graph
  blocks".** D7 row 3 names only a throwing fetch; R967-5 S4 says "cannot be
  reached **or** whose body cannot be read". A `null` issue and a
  `parseGraphBlock` `{ok: false}` are both unreadable bodies and fail open the
  same way. A body that parses to `null` — no `brain-graph/1` block at all — is
  NOT unreadable: it declares nothing, so it is `parent-not-epic`.
- **A refusal carries no `base`.** D7's shape says `{ok: false, refusal}` and the
  test pins `r.base === undefined`, so a caller that ignored `ok` could not
  accidentally proceed on a base the resolver refused.
- **One-hop asserted at "at most one call".** `tasks.md` wrote "at most two";
  the leaf reads only the parent, so the stronger bound is the true one and the
  grandparent's absence from the call list is asserted beside it.

## Absence guards

- **No title is matched anywhere in the leaf** (R967-9 S2): asserted over the
  source text of `ticket-base.mjs` — no `.title`, no `epic(`.
- **No new port verb, no sub-issues endpoint** (R967-10): `fetchIssue` is a
  closure over the `vcs.issueView` the verb already called for the issue itself.
- **No `process`, no `gh`, no clock in the leaf**: the port and the default
  branch are injected; `_now` was deliberately not added (D7).
- **`brain/core/**` and `brain/project/**` untouched**: the doctrine row this
  rests on (`harness-contract.md:28`) was already written, so no oracle test was
  added for an unsigned sentence (D8, proposal R4).

## Workload / PR boundary

- Mode: chained PR slice, `feature-branch-chain`.
- Start: `eeb81ecc` (PR A's head). Finish: `e306561c`.
- Rollback boundary: revert the four commits. `ticket-args.mjs` loses two
  fields, `ticket-base.*` disappear, five i18n pairs and the `ticket-start.mjs`
  call go with them. Nothing in PR A depends on any of it; PR C's gate is not
  yet written.
- Not pushed. No PR opened from this batch.

## Next

B5's manual verification once #878's body carries `kind: epic` and
`tracker: feature/brain-ui` on the forge, then PR C (the `base-branch` gate).

## PR C — implemented ("the gate"), 2026-09-17

**What**: PR C ("the gate") implemented in full, strict TDD, in this
worktree (`/home/gandalf/IA/brain-issue-967`), branch
`feat/issue-967-c-gate`, base `origin/feature/issue-967` (`c86e62cc`, PR A +
PR B already squash-merged there as #997/#999). Five local commits, nothing
pushed, no PR opened.

**Tasks done**: C1a, C1b, C2a, C2b, C3a, C3b, C4 (verified — no code change
owed), C5, C6, C7. C8 is this file's own closing record-first commit. **C9
(maintainer, post-merge `brain:protect` re-run) left UNTICKED** — it cannot
be performed until the tracker PR merges to `main`.

**Commits** (`c86e62cc..HEAD`):
- `02ad752c` feat(governance): base-branch is a pure rule — a slice's base
  must equal its epic's declared tracker
- `63830aac` feat(governance): wire runBaseBranchCheck — D10's eight steps,
  at most two issue reads
- `a841e08e` feat(governance): base-branch is registered and required at
  every tier, lite included
- `d6ece731` docs(sdd): two doctrine drafts for the maintainer —
  base-branch's lite exception, ADR-0032's three keys

**Where**: `brain/scripts/governance/checks/base-branch.mjs` (NEW, the pure
predicate), `base-branch.test.mjs` (NEW, 13 tests); `run-check.mjs`
(`runBaseBranchCheck`, dispatch, `SUBCOMMAND_PORT_REACH`), `run-check.test.mjs`
(+11 tests); `brain/scripts/vcs/governance-checks.mjs` (`GOVERNANCE_JOBS`),
`governance-tiers.mjs` (`GATE_MATRIX['base-branch']`); `.github/workflows/
governance.yml` + `brain/scripts/ci/gitlab-governance.yml` (new job);
`brain/scripts/vcs/contributor-scaffold.mjs` (`GATE_SUMMARY` row) +
regenerated `.github/PULL_REQUEST_TEMPLATE.md` / `.gitlab/
merge_request_templates/Default.md`; `test/review-regulated/fixture.mjs`
(canned status rollup); `openspec/changes/issue-967-tracker-as-data/
brain-drafts/lite-required-base-branch.md` + `graph-block-kind-tracker-
parent.md` (NEW, two doctrine drafts). No path under `brain/core/**` or
`brain/project/**`.

**TDD evidence, one mutation per unit**:
- C1 — RED: `ERR_MODULE_NOT_FOUND` (base-branch.mjs did not exist), 0/13.
  GREEN 13/13. Mutation: `baseBranchRule` body replaced with a throw → 12/13
  red (only the static import-scan test, which never calls the function,
  survived).
- C2 — RED (informal — implementation drafted alongside tests, then
  verified by mutation rather than by a literal missing-file RED): GREEN
  123/123 (full `run-check.test.mjs`). Mutation: step 5's `fetchIssue`
  throw handler changed from fail-closed to `return { pass: true }` → exactly
  one test red (`fetchIssue(linked) throws → fail closed…`).
- C3 — RED (measured, C3a): registering `GOVERNANCE_JOBS` site 1 alone
  turned 7 pre-existing tests red (governance-checks.test.mjs's order/lane-
  count guards, governance-tiers.test.mjs's REQ-TIER-8 key-set parity, both
  directions) — `run-check.test.mjs`'s T7 and `workflow-auth.test.mjs`'s
  VCS_TOKEN guard did NOT go red at this point, because `SUBCOMMAND_PORT_REACH`
  and the dispatch (site 5) were already wired in C2, and no CI job existed
  yet for the VCS_TOKEN scanner to check — a narrower blast radius than the
  task's "four pre-existing oracles" predicted, reported rather than forced
  to match. GREEN after landing sites 2–4 (site 5 already landed in C2):
  273/273 across the five drift-guard files. Mutation: `GATE_MATRIX['base-
  branch'].lite.policy` flipped to `'detection'` → exactly the new "#967
  ruling 1" test red (`0 !== 1`, `mapDetectionToWarning` softened it).
- C4 — no RED/GREEN cycle: `local-ci-parity.test.mjs` run first (18/18
  green, unaffected) and again after full registration (still 18/18). No
  code change — see the tasks.md C4 outcome note for the full reasoning and
  the two options considered and not taken.
- C5/C6 — no unit test (doctrine drafts + absence verification); `git diff
  --stat -- brain/core brain/project` empty, byte-identity and absence
  guards re-run green.

**Deviations from the design, all reported**:
1. **The pure predicate's parameter names differ from D10's literal text.**
   Design D10 writes `baseBranchRule({targetBranch, defaultBranch,
   sourceBranch, linkedIssue, parentIssue})`; this apply's brief specified
   `{issueBody, epicBody, targetBranch, defaultBranch, headBranch}` instead —
   raw body strings the predicate parses itself via `parseGraphBlock`, rather
   than pre-parsed issue objects. Followed as directed; the DECISION LOGIC
   (all 8 of D10's steps) is unchanged, only the parameter shape.
2. **C2's mapDetectionToWarning assertion moved from C2a's commit into C3's.**
   `mapDetectionToWarning(result, 'lite', 'base-branch')` throws until
   `GATE_MATRIX['base-branch']` exists (C3b) — testing it at C2 would either
   throw or require a premature partial registration. The assertion (`main('
   base-branch', …)` exits 1 at `lite`) was written and verified in C3's
   commit instead, where it is naturally GREEN and its own mutation is clean.
3. **An `ok: false` graph-block branch added to the predicate beyond D10's
   literal 8 steps.** D10 step 6 only names `null` (no block) for the linked
   issue's own declaration; an unreadable block (two declarations, an
   unterminated fence) was not explicitly listed. Left unhandled it would
   silently fall through to `pass: true` — a silent pass on an unreadable
   declaration, the exact defect the deny-reader rule (#942) exists to
   refuse. Added `uncomputable` handling for both the linked issue's and the
   epic's own unreadable block, covered by two extra tests beyond C1a's
   named scenario list.
4. **A malformed-tracker branch distinguished from "no tracker" via
   `declarationDivergences`.** `parseGraphBlock` already sets `tracker: null`
   on a grammar failure and records the divergence separately
   (`reason: 'tracker-grammar'`) — the predicate inspects that array to
   fail (naming the epic and the bad value) rather than silently treating a
   malformed tracker the same as "epic declares no tracker" (which passes).
5. **Downstream drift, not anticipated by tasks.md, fixed in the same
   commits it broke**: `workflow-auth.test.mjs`'s T4 fixture hardcoded the
   manifest's 4-key set (fixed in C2); `governance-checks.test.mjs`'s
   "ten jobs" test and two `governance-tiers.test.mjs` `requiredJobs()`
   literal-array tests hardcoded the pre-#967 job count/set (fixed in C3);
   `contributor-scaffold.mjs`'s `GATE_SUMMARY` and the two on-disk PR/MR
   templates it byte-identity-guards needed a `base-branch` row (fixed in
   C3); `test/review-regulated/fixture.mjs`'s canned status-check rollup
   needed a `base-branch` entry or three e2e tests' causal-admission
   evaluator flagged it as a required gate "not present in rollup" (fixed in
   C3). None of these were named in tasks.md's C1–C8 list; all are the
   direct, mechanical consequence of GOVERNANCE_JOBS growing from ten to
   eleven, verified by running the full suite (not just the files tasks.md
   named) before each commit.

**Absence guards** (C6, re-run over the complete PR C diff):
`git diff --stat origin/feature/issue-967...HEAD -- brain/core brain/project`
is empty; `brain-ship.mjs`, `memory/lane/ship.mjs` and `status/stranded.mjs`
byte-identity tests still green (246/246 in that file group); no `.title`
reference in `base-branch.mjs` or the new `run-check.mjs` code; no new VCS
port verb — `runBaseBranchCheck` reuses the existing injected `fetchIssue`
closure, same shape `issue-link` already uses.

**Verification**: full suite `GIT_CONFIG_GLOBAL=/dev/null npm test` →
**5659 pass / 0 fail** (baseline before this batch: 5634, from PR B's close
— +25: 13 base-branch.mjs unit tests + 11 run-check.mjs wrapper/ruling-1
tests + 1 net new fixture-driven pass in the e2e suite). `npm run
brain:repo:check` green before every commit. Tree clean, no `.memory/**`
staged before the closing record-first commit, no AI attribution.

**Learned (the transferable part)**: adding an 11th REQUIRED governance job
touches more than the five sites design.md named — anything that snapshots
`GOVERNANCE_JOBS`'s cardinality or membership as a literal (a "ten jobs"
assertion, a hand-maintained `GATE_SUMMARY` table, a test fixture's canned
CI status rollup) goes stale the moment the count changes, and the only way
to find all of them honestly is to run the FULL suite after each
registration step, not just the files a task list names in advance. The
`local-ci-parity.test.mjs` risk (C4) turned out to be a non-event for a
structural reason worth naming: that guard's scope is "the checks
`brain-check.mjs` already runs," a hand-curated subset, not "every
governance job" — so a CI-only gate can be added without ever entering that
guard's field of view. That is a property of `brain-check.mjs`'s own design
(a fixed literal list, not a `GOVERNANCE_JOBS` iteration), stated here so the
next CI-only gate does not have its own local-parity risk overestimated by
this precedent.

**Next**: PR C is ready for the tracker PR (`feature/issue-967` → `main`,
TR1–TR3). The maintainer's post-merge `npm run brain:protect` re-run (C9) is
the one remaining unticked act, blocked on the tracker merging.

---

## PR D — cold review remediation of the tracker PR (round 2), 2026-09-17

**What**: a fresh-context cold review of the tracker PR (`feature/issue-967`
→ `main`, head `fe28b064`) found two REVISE blockers, both fixed strict-TDD
in the same worktree, branch `fix/issue-967-d-tracker-review`. Two local
commits, nothing pushed, no PR opened.

### Blocker 1 — `base-branch.mjs:37`'s prefix short-circuit

**Finding**: `baseBranchRule` classified ANY `headBranch` starting with
`feature/` as "a tracker's own PR" before ever reading the linked issue —
decided on the branch's spelling alone, with zero reads. Measured: issue
declares `parent: 878`, `#878` is `kind: epic` + `tracker: feature/brain-ui`,
`targetBranch: 'feature/brain-ui'` (correct), `headBranch:
'feature/issue-42-my-feature'` (an ordinary slice branch that merely starts
with `feature/`) → `pass: false`, naming a tracker-PR violation. This
rejected a slice already correctly based on its epic's tracker.

**Fix**: the classification now reads THE ONE FACT THE RULE HOLDS — a head
is the tracker's own integration PR only when it equals the LINKED ISSUE'S
OWN declared tracker (the issue is itself `kind: epic` and its `tracker:`
key names `headBranch` exactly). Reordered to: (1) no linked issue → pass;
(2) the issue is `kind: epic` and `headBranch` equals its own declared
tracker → base must be the default branch; (3) otherwise (an ordinary slice,
or the epic's own non-tracker work) → the existing parent → tracker → base
comparison, unchanged. `status/stranded.mjs`'s own `feature/` prefix oracle
answers a different question — "which open branches look like trackers,
before they have a PR at all", where no declaration is yet readable — and
was measured, confirmed correct for that purpose, and left untouched.

**Duplicate found and fixed in the same commit**: `run-check.mjs:516`'s
`runBaseBranchCheck` wrapper carried the SAME bug as its own "no port call"
optimization — skip the fetch entirely for any `feature/…`-named head and
decide on the branch name alone. Fixing the predicate alone would have
broken this wrapper's existing (buggy) pinned test, since it calls
`baseBranchRule` with no `issueBody` at all for such a head; there is no
data-free path left once the classification needs a declaration, so the
shortcut was removed and a `feature/…` head now takes the same fetch every
other head does (still bounded at two calls total).

**Files**: `brain/scripts/governance/checks/base-branch.mjs`,
`base-branch.test.mjs` (2 tests replaced with 3: the two old tests asserted
the bug itself — no `issueBody`, bare branch-name matching — and are
replaced by tests that supply the real declaration); `run-check.mjs`,
`run-check.test.mjs` (1 test replaced with 2, for the same reason).
`openspec/changes/issue-967-tracker-as-data/spec.md` R967-7 amended: the
classification sentence no longer says "matching the declared grammar
`feature/…`"; a new scenario pins the measured slice-head case. The two
doctrine drafts under `brain-drafts/` were checked for the word "prefix" —
neither describes tracker-head classification that way (the one "prefix"
hit is R967-9's unrelated `epic(...)` TITLE prefix), so neither needed
amending.

**TDD evidence**:
- `base-branch.mjs`/`.test.mjs` — RED: 1/14 (the measured case). GREEN:
  14/14. Mutation: reinstated the top-of-function `headBranch.startsWith
  ('feature/')` short-circuit → 12/14 red (the two tracker-head-classification
  tests, including the measured one).
- `run-check.mjs`/`.test.mjs` — RED: 1/125 (the pre-existing "no port call"
  test, broken by the predicate fix alone, as expected). GREEN: 125/125 after
  removing the wrapper's own shortcut and replacing that one test with two.
  Mutation: reinstated the wrapper's shortcut → 1/125 red (the replacement
  "one port call" test).

### Blocker 2 — `epic-graph.mjs:275`'s no-block prose gap

**Finding**: `parseGraphBlock` returns `null` before the prose scan ever
runs whenever the body carries no `brain-graph/1`-tagged fence at all (its
`!body.includes(GRAPH_PROTOCOL)` guard fires first). R967-2's own rule says
the prose fallback applies "block or no block", but the prose scan lived
entirely inside the block-exists branch (the `parentRaw === null` case), so
a body with a line-initial `Parent: #878` and literally no graph block was
invisible to `buildGraph`'s node, to `lib/ticket-base.mjs`'s `parentOf`
(and so to `resolveBase`), and to the gate.

**Fix**: extracted the prose scan into an exported `parentFromProse(body)`
(same `outsideFences`/fenced-region exclusion as before, HTML comments
still unmasked — the standing follow-up), reused both by `parseGraphBlock`
(its no-`parent:`-key fallback, unchanged behaviour) and by a new exported
`declaredParent(body)` returning `{parent, parentSource}` — the block's
answer when a block reads cleanly, else the prose answer, else
`{parent: null, parentSource: null}`. A MALFORMED block (`{ok: false}`)
never falls back to prose — malformed is not absent (#639); this was a
deliberate design choice, not an oversight, consistent with the parser's
existing rule for the block `parent:` key itself. `buildGraph` now resolves
each node's `parent`/`parentSource` through `declaredParent(issue.body)`
rather than through the parsed block alone; `declared` stays keyed on
`g !== null` (the BLOCK's own presence) — a prose-only parent is a relation
the issue stated, not a graph it declared, and the field says so via a
comment at the call site. `lib/ticket-base.mjs`'s `parentOf` now calls
`declaredParent` directly instead of `parseGraphBlock`.

**Files**: `brain/scripts/status/epic-graph.mjs` (new exports
`parentFromProse`, `declaredParent`; `buildGraph`'s node literal changed
from `g?.parent ?? null` / `g?.parentSource ?? null` to `dp.parent` /
`dp.parentSource`), `epic-map.test.mjs` (+7 tests: `declaredParent`'s four
scenarios — prose with no block, prose inside a fence, block-wins, neither
present — plus the malformed-block-never-falls-back case, plus a `buildGraph`
node test), `brain/scripts/lib/ticket-base.mjs` (`parentOf` rewritten),
`ticket-base.test.mjs` (+1 test — `resolveBase` honours a prose parent with
no block at all), `brain/scripts/status/snapshot.test.mjs` (+1 new fixture
case — a fresh `#7` node rather than editing the existing `#5`/`#6` pair,
which already has a block and would not exercise the no-block path).
`spec.md` R967-2 amended: the prose-fallback paragraph now states "block or
no block" explicitly, with the measured `parseGraphBlock`-returns-null-first
fact and a new scenario.

**TDD evidence**: RED: module load failure across all three files
(`declaredParent` did not exist — `epic-map.test.mjs` failed to import
entirely; `ticket-base.test.mjs` 1/28 red; `snapshot.test.mjs` 1/28 red).
GREEN: 137/137 across the three files combined. Mutation: made
`declaredParent` return `{parent: null, parentSource: null}` unconditionally
in its no-block branch (ignoring `parentFromProse` entirely) → exactly the
4 tests exercising the no-block prose path went red (one in each of
`epic-map.test.mjs` ×2, `ticket-base.test.mjs`, `snapshot.test.mjs`); every
other test in all three files stayed green.

### Verification

`GIT_CONFIG_GLOBAL=/dev/null node --test
brain/scripts/governance/checks/base-branch.test.mjs
brain/scripts/status/epic-map.test.mjs brain/scripts/lib/ticket-base.test.mjs
brain/scripts/status/snapshot.test.mjs` — green, three consecutive runs.
`GIT_CONFIG_GLOBAL=/dev/null npm test` — **5674 pass / 0 fail** (baseline
before this batch: 5663; +11 net: base-branch +1, run-check +1, epic-map +7,
ticket-base +1, snapshot +1). `npm run brain:repo:check` green before every
commit. Counted diff (tests and `openspec/changes/**` excluded):
**180** — `base-branch.mjs` 51, `run-check.mjs` 16, `ticket-base.mjs` 18,
`epic-graph.mjs` 95. Tree clean before the record-first memory commit; no
`.memory/**` staged in the two code commits; no AI attribution; nothing
pushed, no PR opened.

**Next**: PR D is ready to open against the tracker branch
(`feature/issue-967`), carrying both blocker fixes as review remediation.
The maintainer's post-merge `npm run brain:protect` re-run (C9) is still the
one remaining unticked act on the whole change, unaffected by this batch.
