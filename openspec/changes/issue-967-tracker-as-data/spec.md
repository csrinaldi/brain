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
| `parent` | a bare positive integer | `null` |

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

### R967-2: a parent read from prose, one hop, and said as such

When the block declares no `parent:`, the reader MUST look for a
**line-initial** `Parent: #<digits>` in the **prose**, matched with exactly
`/^Parent:[ \t]*#(\d+)\b/m` — column zero, exact case, no leading-whitespace
tolerance, arbitrary prose allowed after the number.

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

A block key MUST win over
prose, and when it does the prose line MUST NOT be read at all. The node MUST
state where its parent came from in `parentSource` (`'block' | 'prose' |
null`). `Epic: #N` MUST NOT be read as a synonym for `Parent: #N`. A line the
regex does not match is simply not a declaration: it yields no parent and
says nothing. More than one line-initial match with different numbers MUST
yield no parent plus a said `declarationDivergences` entry — never a
first-match-wins guess.

#### Scenario: the block key wins and the prose line is never read
- **WHEN** a body declares `parent: 878` in the block and also carries a line-initial `Parent: #879`
- **THEN** `node.parent` is `878`, `node.parentSource` is `'block'`, and nothing is said — the block key is the declaration and the prose line is not a second one to disagree with

#### Scenario: prose parent with trailing text
- **WHEN** the block declares no `parent:` and the body carries a line starting `Parent: #864 (memory 2.0), task 1.2 (Wave 1).`
- **THEN** `node.parent` is `864` and `node.parentSource` is `'prose'`

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
A PR whose **head** is itself a tracker (its branch name matching the declared
grammar `feature/…`) MUST target the default branch. A PR whose linked issue
has no epic, or whose epic declares no tracker, MUST pass untouched. The gate
MUST be **required** at tier `lite`, not detection-only (ruling 1). A refusal
MUST name the tracker. The gate MUST NOT enumerate the forge looking for open
epics: it reads at most the linked issue and its parent.

#### Scenario: a slice PR against `main` fails at `lite`
- **WHEN** at tier `lite` a PR links an issue whose epic declares `tracker: feature/brain-ui` and the PR's base is `main`
- **THEN** the check fails (not a warned pass), and the message names `feature/brain-ui` and the epic

#### Scenario: the correct base passes
- **WHEN** that same PR's base is `feature/brain-ui`
- **THEN** the check passes with no warning

#### Scenario: a tracker PR must target the default branch
- **WHEN** a PR's head branch is `feature/brain-ui` and its base is another `feature/…` branch
- **THEN** the check fails and states a tracker PR targets the default branch

#### Scenario: a lane PR passes untouched — the standing case
- **WHEN** a memory-lane PR with no linked issue, or a PR whose linked issue has no epic, targets `main`
- **THEN** the check passes, unchanged from today's behaviour

#### Scenario: an unreadable epic is uncomputable, never a silent pass
- **WHEN** the gate cannot read the linked issue's parent
- **THEN** the result is `uncomputable` with the reason stated, and it is neither reported as a pass nor as a base violation

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
