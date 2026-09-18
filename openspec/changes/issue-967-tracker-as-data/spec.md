---
status: draft
issue: 967
---

# Spec — an epic's tracker (and the epic itself) as data (#967)

Delta over the tree at `origin/main`. Every requirement below is stated so a
`node:test` case can assert it, and every failure path names what is said —
no requirement is satisfied by an empty result, a silent default, or a throw.

## Requirements

### R967-1: the `brain-graph/1` block carries `kind`, `tracker` and `parent`

`parseGraphBlock` MUST read three further keys beside `track`, `blocks`,
`needs` and `files`:

| Key | Grammar | Absent |
|---|---|---|
| `kind` | a scalar; only the literal `epic` carries meaning | `null` |
| `tracker` | MUST match `/^feature\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/` and MUST NOT contain `..` | `null` |
| `parent` | bare positive digits, **no leading zero** (`/^[1-9]\d*$/`) | `null` |

Everything this requirement calls a **said divergence** MUST be said in a NEW
channel, `declarationDivergences` — entries `{key, value, reason}` per body,
lifted by `buildGraph` to `{number, key, value, reason}`. It MUST NOT reuse the
graph's existing `divergences` array: that array carries `{from, to, only}`
edge entries and is gated on a native relations read that the snapshot path
never performs, so a declaration divergence routed through it would be
invisible in exactly the surface that needs it.

The node literal built by `buildGraph` MUST gain `kind`, `tracker`, `parent`
and `parentSource`. Unknown keys MUST remain ignored — no key-schema
validation is introduced anywhere. A `tracker:` declared on a node whose
`kind` is not `epic` MUST be parsed and carried, MUST NOT be used for base
resolution (R967-5) or by the gate (R967-7), and MUST be reported as a said
`declarationDivergences` entry. A malformed `tracker:` or `parent:` value MUST
NOT throw, MUST NOT be repaired, and MUST NOT fall back to a default: it yields
`null` for that field plus a said `declarationDivergences` entry naming the
issue number and the offending text.

#### Scenario: an epic declares all three
- **WHEN** a body declares `kind: epic`, `tracker: feature/brain-ui` and `parent: 851` in its `brain-graph/1` block
- **THEN** its node carries `kind: 'epic'`, `tracker: 'feature/brain-ui'`, `parent: 851` and `parentSource: 'block'`

#### Scenario: a body that declares none of them parses as today
- **WHEN** a body's block declares only `track`, `blocks`, `needs` and `files`
- **THEN** every pre-existing node field deep-equals the value it had before this change, and `kind`, `tracker`, `parent` and `parentSource` are all `null`
- **AND** all **seven** `parseGraphBlock` full-shape assertions in `epic-map.test.mjs` (`:40`, `:91`, `:97`, `:103`, `:174`, `:180`, `:747-748` — measured, one more than the proposal listed) stay `assert.deepEqual` over the full expected shape: a stray key MUST still fail, so neither `partialDeepStrictEqual` nor per-key `assert.equal` may replace them

#### Scenario: `track` and `tracker` do not collide
- **WHEN** a block declares both `track: UI` and `tracker: feature/brain-ui`
- **THEN** the node carries `track: 'UI'` and `tracker: 'feature/brain-ui'`, each read from its own key

#### Scenario: an unknown key is still ignored
- **WHEN** a block declares a key no reader names (e.g. `colour: red`)
- **THEN** the parse succeeds, the node is unaffected, and no divergence is raised

#### Scenario: a tracker on a non-epic is inert and said
- **WHEN** a node declares `tracker: feature/x` and does not declare `kind: epic`
- **THEN** the node carries `tracker: 'feature/x'`, a divergence names the node and states the tracker is not honoured because the node is not an epic, and no resolution or gate reads that value

#### Scenario: a tracker outside the `feature/` grammar is refused, not repaired
- **WHEN** a block declares `tracker: brain-ui`
- **THEN** `node.tracker` is `null`, a divergence names the issue number and the value `brain-ui`, nothing throws, and the value is never silently rewritten to `feature/brain-ui`

#### Scenario: a non-numeric parent is refused, not coerced
- **WHEN** a block declares `parent: main` or `parent: #878`
- **THEN** `node.parent` and `node.parentSource` are `null`, a divergence names the issue number and the offending text, and the value never becomes `0`, `NaN` or a string

#### Scenario: a leading zero is refused, not normalised
- **WHEN** a block declares `parent: 007`
- **THEN** `node.parent` is `null` and a divergence names `007` with reason `parent-grammar` — `7` is not the byte the body wrote, and R967-1 forbids repairing a declaration for the other two keys on exactly this ground (decided 2026-09-16, review of PR A; `Number()` normalisation was the pre-amendment behaviour and is rejected)

### R967-2: a parent read from prose, one hop, and said as such

The prose fallback applies **block or no block** — a body that never declared
a `brain-graph/1` fence at all MUST still resolve a line-initial `Parent:`
declaration exactly as one that declares a block with no `parent:` key does.
(Amended 2026-09-17, PR D — cold review round 2: `parseGraphBlock` answers
`null` before ever running the prose scan when the body carries no
graph-tagged fence — measured, its `!body.includes(GRAPH_PROTOCOL)` guard
short-circuits first — so the reader is `declaredParent`, not
`parseGraphBlock` alone, for any caller that must see a prose-only parent:
`buildGraph`'s node and `lib/ticket-base.mjs`'s `parentOf` both read through
it. `parseGraphBlock`'s OWN return for a body with no block is unchanged —
still `null` — because its shape has no field to carry a parent without also
carrying the rest of a declaration that was never made.)

When the block declares no `parent:` (or no block exists at all), the reader
MUST look for a **line-initial** `Parent: #<digits>` in the **prose**. A line
DECLARES exactly
when it matches `/^Parent:[ \t]*#[1-9]\d*\b/m` — column zero, exact case, no
leading-whitespace tolerance, arbitrary prose allowed after the number. The
numbers a declaring line names are then read from the WHOLE line, not from the
prefix the anchor matched (see the ambiguity rule below).

The issue-number grammar is the SAME one R967-1 states for the `parent:` block
key — bare positive digits, no leading zero. The two paths read the same fact out
of the same body and MUST NOT disagree about what a number is. They differ only
in what silence means: a `parent:` key present and malformed is SAID
(`parent-grammar`), whereas a prose line that does not match is not a declaration
and says nothing. (Amended 2026-09-16, review of PR A: the prose path carried no
positivity check at all, so `Parent: #0` yielded `parent: 0` — a value the block
key's own refused list already names — and `Parent: #007` yielded `7`.)

The scan MUST run over the body with every **fenced region removed** — every
fence the splitter reports, the `brain-graph/1` fence included, plus an
unterminated fence's run to the end of the document. A fence is the canonical
"this is an example" shape, and #709 already settled that an illustration and a
declaration MUST NOT be byte-identical to a reader; the same rule governs prose.
(Amended 2026-09-16, review of PR A: the code was conformant to the sentence
above and the sentence was the defect. Measured on the pre-amendment tree: a
column-zero `Parent: #999` inside a plain fence declared a parent, as did one
inside the `brain-graph/1` fence itself, and a fenced example standing above a
real `Parent:` line DELETED the real declaration by manufacturing an ambiguity
with it.) Masking an **HTML comment** is NOT part of this requirement — the
splitter reports no span for one — and is recorded as a follow-up.

A block key MUST win over prose, and when it does the prose line MUST NOT be
read at all. The node MUST
state where its parent came from in `parentSource` (`'block' | 'prose' |
null`). `Epic: #N` MUST NOT be read as a synonym for `Parent: #N`. A line the
regex does not match is simply not a declaration: it yields no parent and
says nothing. More than one **distinct issue number** across the line-initial
matches MUST yield no parent plus a said `declarationDivergences` entry — never
a first-match-wins guess.

The count is over the NUMBERS, not over the lines (amended 2026-09-16, review of
PR A). `Parent: #878, #879` on a single line is the same "two values for one
key" fact as the same pair on two lines, and resolved to `878` by writing order
until the rule was stated this way — exactly the guess this requirement refuses.
A line-initial `Parent:` whose remainder carries a second `#<digits>` is
therefore ambiguous. Symmetrically, one number said twice — on one line or on
two — stays a restatement and is read: `Parent: #878 (Brain UI) — slice 3,
Wave B.` carries no second `#<digits>` and is still the body this reader exists
to admit.

#### Scenario: the block key wins and the prose line is never read
- **WHEN** a body declares `parent: 878` in the block and also carries a line-initial `Parent: #879`
- **THEN** `node.parent` is `878`, `node.parentSource` is `'block'`, and nothing is said — the block key is the declaration and the prose line is not a second one to disagree with

#### Scenario: prose parent with trailing text
- **WHEN** the block declares no `parent:` and the body carries a line starting `Parent: #864 (memory 2.0), task 1.2 (Wave 1).`
- **THEN** `node.parent` is `864` and `node.parentSource` is `'prose'`

#### Scenario: a leading zero declares nothing in prose either
- **WHEN** a body carries `Parent: #0`, `Parent: #00` or `Parent: #007` and no block `parent:`
- **THEN** `node.parent` and `node.parentSource` are `null` and nothing is said — the line does not match, so it is not a declaration, and `0` and `7` are values the block key's own grammar already refuses

#### Scenario: `Epic: #N` is not a synonym
- **WHEN** a body carries `Epic: #313` and no `Parent:` line and no block `parent:`
- **THEN** `node.parent` and `node.parentSource` are `null`, and no epic number is inferred from the `Epic:` spelling

#### Scenario: a mid-line match declares nothing, silently
- **WHEN** a body carries `Issue: #337 — M10 Phase 3. Parent: #335. Epic: #313.` and no block `parent:`
- **THEN** `node.parent` and `node.parentSource` are `null` and nothing is said — a line the regex does not match is not a malformed declaration, it is not a declaration

#### Scenario: a fenced `Parent:` line is an illustration, not a declaration
- **WHEN** a body carries a column-zero `Parent: #999` inside a fence — a plain one, the `brain-graph/1` one, or an unterminated one — and a real line-initial `Parent: #878` outside every fence
- **THEN** `node.parent` is `878` with `parentSource: 'prose'`, nothing is said, and the fenced line is neither a second declaration nor a disagreement with the first

#### Scenario: two line-initial matches are refused and named
- **WHEN** a body carries two line-initial `Parent: #N` lines with different numbers
- **THEN** `node.parent` is `null` and a `declarationDivergences` entry names the ambiguity; neither wins

#### Scenario: two numbers on ONE line is the same refusal
- **WHEN** a body carries the single line-initial line `Parent: #878, #879`
- **THEN** `node.parent` is `null`, `parentSource` is `null`, and a `declarationDivergences` entry names `878, 879` with reason `parent-ambiguous` — 878 does not win by being written first

#### Scenario: the prose fallback runs with NO block at all (amended 2026-09-17, PR D)
- **WHEN** a body carries a line-initial `Parent: #878` and no `brain-graph/1` fence anywhere
- **THEN** `declaredParent(body)` resolves `parent: 878`, `parentSource: 'prose'` — the same answer as a body whose block exists but omits `parent:` — and this is what `buildGraph`'s node and `lib/ticket-base.mjs`'s `parentOf` both read; `parseGraphBlock(body)` alone still returns `null`, unchanged

#### Scenario: an ambiguous prose parent with NO block is said too (amended 2026-09-17, PR #1006 review round 1, finding 2)
- **WHEN** a body carries the single line-initial line `Parent: #878, #879` and no `brain-graph/1` fence anywhere
- **THEN** `declaredParent(body)` resolves `parent: null`, `parentSource: null`, `ambiguousValue: '878, 879'`, and `buildGraph`'s own `declarationDivergences` output (not only `parseGraphBlock`'s, which never runs for a blockless body) carries a `{key: 'parent', value: '878, 879', reason: 'parent-ambiguous'}` entry for that node — the same fact the block-bearing path already says, not silently dropped because there was no block to carry it

### R967-3: the snapshot carries all four fields, and an unreadable node carries none

`buildSnapshot`'s graph nodes MUST carry `kind`, `tracker`, `parent` and
`parentSource`. The hand-enumerated unreadable-node reset (`snapshot.mjs:211-212`)
MUST null all four alongside `declared`, `track`, `files` and `sources`, so a
node whose body could not be read never carries a tracker or a parent it never
declared. The parity assertion for these fields MUST run in
`snapshot.test.mjs`, over a graph that has nodes — i.e. with an injected fake
port, as `snapshot.test.mjs:133-215` does. `snapshot-cli.test.mjs` MUST NOT be
touched: it runs with no VCS port and asserts the graph is not computed
(`snapshot-cli.test.mjs:39`), so it never sees a node field at all.

#### Scenario: the fields reach the snapshot
- **WHEN** `buildSnapshot` runs against a fake port whose `issueView` returns an epic body declaring `kind: epic` and `tracker: feature/brain-ui`, and a child body carrying `Parent: #878`
- **THEN** the epic's snapshot node carries `kind: 'epic'` and `tracker: 'feature/brain-ui'`, and the child's carries `parent: 878` and `parentSource: 'prose'`

#### Scenario: the JSON form and the module return are one shape, new fields included
- **WHEN** `snapshot.test.mjs` round-trips the fake-port snapshot through `JSON.parse(JSON.stringify(s))`
- **THEN** it deep-equals the module's return value, the four new node fields included — none of them is a `Map`, an `undefined` or anything else JSON would drop on the way to the verb's `--json` output

#### Scenario: an unreadable node declares nothing
- **WHEN** `issueView` throws for an issue that is in the list
- **THEN** its node has `ok: false`, `status: UNREADABLE`, a `reason` naming the read failure, and `kind`, `tracker`, `parent` and `parentSource` all `null`

### R967-4: a parent that is not an epic is a said divergence, never an inference

A node named as `parent` by another node **that is present in the issue set**
and does not itself declare `kind: epic` MUST produce a said entry in the
graph's `declarationDivergences` output. It MUST NOT be inferred to be an
epic, MUST NOT yield a tracker, and MUST NOT cause any gate to fail. A parent
**absent** from the issue set MUST produce no entry: "not in this list" is not
"not an epic", the same distinction `buildGraph` already makes for a native
read it could not perform.

#### Scenario: the parent declares no kind
- **WHEN** node `#A` declares `parent: B`, node `#B` is in the issue set and declares no `kind`
- **THEN** a `declarationDivergences` entry names `#A` and `#B` and states `#B` does not declare `kind: epic`, `#B.kind` stays `null`, and no gate result changes because of it

#### Scenario: the parent is not in the graph at all
- **WHEN** node `#A` declares `parent: 9999` and no node `#9999` is in the issue set
- **THEN** `node.parent` stays `9999`, no entry is added, nothing throws and no tracker is resolved — the parent may be closed or in another repository, and neither is a divergence to report

### R967-5: `brain:ticket:start` resolves the base from the epic, and fails open

With no `--base`, the verb MUST resolve the base through **one hop**: the
issue's `parent` → that node's `tracker`, honoured only when the parent
declares `kind: epic`. The resolution MUST live in an exported pure function
that decides from injected data (the issue, the parent lookup result, the
parsed args) so it is testable without a repository and without the real
forge. The verb MUST state which base it took and why, following `--in-place`'s
"the verb says which mode it took" precedent. No parent, a parent that is not
an epic, or an epic with no tracker MUST resolve to `main` **with the reason
stated**. An epic that cannot be reached or whose body cannot be read MUST
resolve to `main` with a stated reason and MUST NEVER refuse.

#### Scenario: the tracker is used and named
- **WHEN** `brain:ticket:start -- 881` runs with no `--base`, `#881` resolves to parent `#878`, and `#878` declares `kind: epic` and `tracker: feature/brain-ui`
- **THEN** the base is `feature/brain-ui` and the operator message names both the tracker and the epic (e.g. "base: feature/brain-ui, declared by epic #878")

#### Scenario: one hop only
- **WHEN** the issue's parent declares a `parent` of its own that is an epic with a tracker, and the immediate parent declares none
- **THEN** the base is `main` and no grandparent is fetched or consulted

#### Scenario: no epic, and the reason is stated
- **WHEN** the issue declares no parent, or its parent does not declare `kind: epic`, or that epic declares no `tracker`
- **THEN** the base is `main` and the message states which of those three it was — never a silent `main`

#### Scenario: an unreadable epic fails open
- **WHEN** the parent lookup throws or returns a body that cannot be parsed
- **THEN** the base is `main`, the message states the epic could not be read and quotes the reason, the verb exits successfully, and no refusal is emitted

### R967-6: an explicit `--base main` is refused when the epic declares a tracker

`parseTicketArgs` MUST be able to distinguish "the caller asked for `main`"
from "nobody asked" — a distinction its current return shape cannot express
(`ticket-args.mjs:60-61`). It MUST accept an `--off-tracker` flag. With an
explicit `--base main` on an issue whose epic declares a tracker, the verb MUST
refuse, name the tracker, point at `--off-tracker`, exit non-zero and create no
branch and no worktree. Every operator string this change adds MUST exist as an
`en` key with an `es` twin.

#### Scenario: absent and explicit `main` are distinguishable
- **WHEN** `parseTicketArgs(['881'])` and `parseTicketArgs(['881','--base','main'])` are compared
- **THEN** the two return values differ in a field that states whether `--base` was given, and both still resolve to `main` when no tracker applies

#### Scenario: explicit `main` against a declared tracker refuses
- **WHEN** `--base main` is given for an issue whose epic declares `tracker: feature/brain-ui`
- **THEN** the verb refuses, the message names `feature/brain-ui` and `--off-tracker`, the exit status is non-zero, and no worktree or branch is created

#### Scenario: the override is honoured and said
- **WHEN** `--base main --off-tracker` is given for that same issue
- **THEN** the base is `main` and the message states the run went off tracker

#### Scenario: another explicit base is untouched
- **WHEN** `--base feature/other` is given for an issue whose epic declares `tracker: feature/brain-ui`
- **THEN** the base is `feature/other`, with no refusal and no rewrite

#### Scenario: `--off-tracker` with nothing to override is harmless
- **WHEN** `--off-tracker` is given for an issue with no epic or no declared tracker
- **THEN** the base is `main`, the run succeeds, and nothing throws

#### Scenario: every new string is bilingual
- **WHEN** the i18n coverage test compares `en.mjs` and `es.mjs`
- **THEN** every key added by this change exists in both, in both directions

### R967-7: the `base-branch` gate, required at `lite`

A governance check named `base-branch` MUST exist. Its rule: the PR's linked
issue → that issue's `parent` → the parent's declared `tracker` (honoured only
when the parent declares `kind: epic`) → the PR's base MUST equal that tracker.
A PR whose linked issue has no epic, or whose epic declares no tracker, MUST
pass untouched. The gate MUST be **required** at tier `lite`, not
detection-only (ruling 1). A refusal MUST name the tracker. The gate MUST NOT
enumerate the forge looking for open epics: it reads at most the linked issue
and its parent.

A PR whose **head** is itself a tracker's own integration branch MUST target
the default branch. (Amended 2026-09-17, PR D — cold review round 2: the prior
sentence read "its branch name matching the declared grammar `feature/…`" —
a PREFIX test, decided with no read at all. Measured, that classified EVERY
`feature/…`-named head as a tracker PR, rejecting an ordinary slice whose own
branch happened to start with `feature/` too, even when its base was already
correctly set to its epic's tracker. The one fact the rule holds is narrower:
a head is that PR's tracker's own integration branch ONLY when it equals the
LINKED ISSUE'S OWN declared tracker — the issue is itself `kind: epic` and its
`tracker:` key names `headBranch` exactly. A `feature/…`-named head that is
not the linked issue's own declared tracker is an ordinary slice head, decided
by the normal parent → tracker → base comparison above, not by this rule.
`status/stranded.mjs`'s OWN `feature/` prefix oracle is a different question —
"which open branches look like trackers, to surface them before they have a
PR at all", where no declaration is readable yet to check against — and is
unaffected by this amendment.)

#### Scenario: a slice PR against `main` fails at `lite`
- **WHEN** at tier `lite` a PR links an issue whose epic declares `tracker: feature/brain-ui` and the PR's base is `main`
- **THEN** the check fails (not a warned pass), and the message names `feature/brain-ui` and the epic

#### Scenario: the correct base passes
- **WHEN** that same PR's base is `feature/brain-ui`
- **THEN** the check passes with no warning

#### Scenario: a tracker PR must target the default branch
- **WHEN** a PR's linked issue is itself `kind: epic` and declares `tracker: feature/brain-ui`, its head branch is `feature/brain-ui`, and its base is another `feature/…` branch
- **THEN** the check fails and states a tracker PR targets the default branch

#### Scenario: a slice head that merely starts with feature/ is not the tracker (amended 2026-09-17, PR D)
- **WHEN** a PR's linked issue declares `parent: 878`, `#878` is `kind: epic` with `tracker: feature/brain-ui`, the PR's head branch is `feature/issue-42-my-feature`, and its base is `feature/brain-ui`
- **THEN** the check passes — the head is not the linked issue's own declared tracker, so this is an ordinary slice correctly based on it, not a tracker PR targeting the wrong branch

#### Scenario: a parent declared only via prose (no block) still gets fetched and fails a slice-on-main PR (amended 2026-09-17, PR #1006 review round 1, finding 1)
- **WHEN** a PR's linked issue carries a line-initial `Parent: #878` and no `brain-graph/1` fence at all, `#878` is `kind: epic` with `tracker: feature/brain-ui`, and the PR's base is `main`
- **THEN** the gate fetches the parent (two reads total: the linked issue and `#878`) and fails, naming `feature/brain-ui` — the fetch decision and the predicate's own parent read both go through `declaredParent`, not `parseGraphBlock` alone, so a prose-only declaration is no longer invisible to either

#### Scenario: a lane PR passes untouched — the standing case
- **WHEN** a memory-lane PR with no linked issue, or a PR whose linked issue has no epic, targets `main`
- **THEN** the check passes, unchanged from today's behaviour

#### Scenario: no linked issue at all, but the head looks like a tracker not targeting default — uncomputable, not a pass (amended 2026-09-17, PR #1006 review round 2)
- **WHEN** a PR links no issue at all, its head branch is `feature/brain-ui`, and its base is `feature/other-tracker` (not the default branch)
- **THEN** the check fails as `uncomputable`, naming the head, the base, and the default branch, and asking for the issue link — `fetchIssue` is never called, because the amendment above still requires the LINKED ISSUE's own declaration to decide tracker-vs-slice, and with no issue linked there is no declaration to read; a `feature/…` head with no issue that already targets the default branch still passes (R967-7's rule is satisfied either way), and every other no-issue head (e.g. `fix/…`) is unaffected

#### Scenario: an unreadable epic is uncomputable, never a silent pass
- **WHEN** the gate cannot read the linked issue's parent
- **THEN** the result is `uncomputable` with the reason stated, and it is neither reported as a pass nor as a base violation

#### Scenario: a parent-grammar divergence is uncomputable, never a silent pass (amended 2026-09-17, PR E — tracker PR #1004, round-3 cold review)
- **WHEN** the linked issue's `brain-graph/1` block declares `parent: abc` (fails `PARENT_KEY_GRAMMAR`)
- **THEN** the gate fails as `uncomputable`, the reason names `parent-grammar` and `abc`, and the parent is never fetched — `dp.parent === null` cannot be told apart from "no parent mentioned at all" without the divergence, and this measured case used to return `{pass: true}`

#### Scenario: a parent-ambiguous divergence is uncomputable, never a silent pass (amended 2026-09-17, PR E — tracker PR #1004, round-3 cold review)
- **WHEN** the linked issue's body carries two disagreeing line-initial `Parent: #N` declarations (e.g. `Parent: #878` and `Parent: #879`) and no `brain-graph/1` block at all
- **THEN** the gate fails as `uncomputable`, the reason names `parent-ambiguous` and the two numbers, and the parent is never fetched — this measured case used to return `{pass: true}` for the same reason as the grammar case above

#### Scenario: no forge fan-out
- **WHEN** the gate runs against a PR
- **THEN** it issues no issue-listing call, and at most two per-issue reads (the linked issue and its parent)

#### Scenario: the registration drift guards stay green
- **WHEN** the governance drift guards run after the change
- **THEN** `base-branch` is present in the job-name order guard, in the tier matrix key-set parity in both directions, in the dispatch-manifest parity in both directions, and declares its VCS token in both CI files

#### Scenario: reverting only the check turns exactly its test red
- **WHEN** the `base-branch` rule alone is reverted and the suite runs
- **THEN** the `base-branch` test fails and no other test fails

### R967-8: doctrine ships as drafts; the gate row is code

The doctrine sentence naming the required-at-`lite` exception, the doctrine for
the three new block keys, and the ratified tracker-PR timing ("opened when it
has a diff; `stranded.mjs` reports it until then") MUST ship as drafts under
`openspec/changes/issue-967-tracker-as-data/brain-drafts/` — **two** files, not
three: the tracker-PR timing sentence rides inside the required-at-`lite`
draft, because it targets the same doctrine file
(`brain/core/methodology/workflow-governance.md`). Nothing in this
change MUST be committed under `brain/core/**` or `brain/project/**`. The gate's
tier row is code (`GATE_MATRIX`), not prose, and the change MUST NOT add a test
that asserts a doctrine sentence the maintainer has not yet signed.

#### Scenario: the knowledge half is untouched
- **WHEN** the change's diff is listed
- **THEN** no path under `brain/core/**` or `brain/project/**` appears in it

#### Scenario: the drafts exist and say the exception
- **WHEN** `openspec/changes/issue-967-tracker-as-data/brain-drafts/` is read
- **THEN** it contains exactly two files: one naming the `base-branch` required-at-`lite` exception and carrying the settled tracker-PR timing, and one for the `kind`/`tracker`/`parent` keys

#### Scenario: the tier is derived from code
- **WHEN** the required-job set for tier `lite` is computed
- **THEN** `base-branch` is in it, derived from the matrix, with no doctrine file read

#### Scenario: no oracle for an unsigned sentence
- **WHEN** the tests added by this change are inspected
- **THEN** none of them asserts the content of a doctrine line that does not already exist in `brain/core/**`

### R967-9: nothing is inferred from a title prefix

No code added or changed by this change MUST infer `kind`, epic-ness, or a
parent from an issue **title**. The `epic(...)` title prefix MUST remain
decorative.

#### Scenario: an `epic(...)` title without the key is not an epic
- **WHEN** an issue titled `epic(ui): Brain UI …` declares no `kind: epic`
- **THEN** its node's `kind` is `null`, it yields no tracker, and a slice naming it as parent resolves to `main` with a stated reason

#### Scenario: no title matching exists
- **WHEN** the parser, the resolver leaf and the gate are inspected
- **THEN** none of them matches an issue title against an `epic(` prefix or any other title pattern

### R967-10: out of scope, asserted as absence

#### Scenario: GitHub sub-issues are still not read
- **WHEN** the change's diff is inspected
- **THEN** no sub-issues endpoint is called, no new port verb is added, and the VCS contract's verb table is unchanged

#### Scenario: no `needs`-edge parent fallback
- **WHEN** an issue declares `needs: [879]`, no block `parent:` and no `Parent:` line
- **THEN** `node.parent` is `null` — the `needs` edge is never used to guess a parent

#### Scenario: `brain-ship`'s base is untouched
- **WHEN** `brain/scripts/brain-ship.mjs`'s PR-open base expression is compared before and after
- **THEN** it is unchanged, and the `base-branch` gate is what catches its output at PR time; a follow-up ticket owns the verb-side fix

#### Scenario: the memory lane's base is untouched
- **WHEN** `brain/scripts/memory/lane/ship.mjs`'s `base: 'main'` is compared before and after
- **THEN** it is unchanged, and its PR passes `base-branch` under R967-7's standing case

#### Scenario: `stranded.mjs` is untouched
- **WHEN** `brain/scripts/status/stranded.mjs` is compared before and after
- **THEN** it is byte-identical, including its `feature/` prefix oracle
