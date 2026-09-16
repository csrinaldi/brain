---
status: draft
issue: 967
---

# Design — an epic's tracker (and the epic itself) as data (#967)

The proposal's four rulings are closed and restated below. This document closes
Q1–Q8, then states the decisions the implementation is bound to. Every claim
carries a `file:line`, read from the worktree `/home/gandalf/IA/brain-issue-967`
(no shell in this phase; the four ticket bodies come from the session's verbatim
scratchpad dumps, named where used).

## The rulings, restated

| # | Ruling (maintainer, 2026-09-16) | Where it lands |
|---|---|---|
| 1 | `base-branch` is **required at `lite`**, not detection — a deliberate exception to "lite only detects" for this one gate. | D8 (`GATE_MATRIX` row), D12 (the doctrine draft that says so) |
| 2 | **A `parent:` key wins; absent, a line-initial `Parent: #N` is read and the node SAYS it came from prose.** No GitHub sub-issues (`github.mjs:183-187`, ADR-0029 D2). | D3, D4 |
| 3 | An explicit `--base main` on an issue whose epic declares a tracker **refuses**, names the tracker, and requires `--off-tracker`; with no `--base` the verb resolves the tracker and says so. | D6, D7 |
| 4 | A parent that does not declare `kind: epic` is a **said divergence** — shown, never inferred as epic, never a gate failure. | D2, D5, D10 |

---

## Q1 — `--base` disambiguation: `baseExplicit`, not `baseBranch: null`

`parseTicketArgs` defaults `baseBranch` to `'main'` (`ticket-args.mjs:60-61`), so
"the caller asked for main" and "nobody asked" are the same value.

**Chosen: add `baseExplicit: boolean` and keep `baseBranch`'s default.** Blast
radius on `ticket-args.test.mjs`: **zero existing assertions change** — `:24`,
`:56`, `:71` and `:80` all read `baseBranch`, and all keep their values. Three
tests are added.

**Rejected — `baseBranch: null` when absent.** It turns those four assertions red
for no gain and pushes the default back into `ticket-start.mjs`, which is exactly
the direction #782 moved it away from (`ticket-args.mjs:22-26`: "a default nobody
can test is a default nobody checks").

## Q2 — the seam: a new leaf, not an importable script

`ticket-start.mjs` reads `process.argv` at module scope (`:35`), calls
`process.exit` on every error path, and does git and network work at import time;
there is no `ticket-start.test.mjs`. **Chosen: extract
`brain/scripts/lib/ticket-base.mjs`** and make the verb a thin caller — #782's
own precedent, cited in the file it created (`ticket-args.mjs:22-26`).
**Rejected — making `ticket-start.mjs` importable**: it would need an
`if (import.meta.url === argv[1])` guard plus the removal of eight
`process.exit` sites, a larger diff than the leaf, in the one file this change
most wants to leave alone.

## Q3 — the parent regex: anchored at column zero, trailing prose allowed

**The proposal's `^Parent:\s*#(\d+)\s*$` is wrong, and the measurement says so.**
#881's body reads, verbatim (`scratchpad/issue-881.md:3`):

```
Parent: #878 (Brain UI) — slice 3, Wave B.
```

A `$`-anchored regex matches nothing there — the one real body this ticket exists
to read would parse to `null`. (The proposal flagged this line as unverified; it
is now verified against the forge dump, and it fails the proposed shape.)

**Chosen:** `/^Parent:[ \t]*#[1-9]\d*\b/m` — column zero, exact case, trailing
prose free. (Amended 2026-09-16, review of PR A: `#(\d+)` admitted `Parent: #0`
and `Parent: #007`, which the block key's own grammar refuses. One grammar for an
issue number, not two.) It admits #881 and refuses `issue-337-efficacy-probes/proposal.md:3`
(`Issue: #337 — M10 Phase 3. Parent: #335. Epic: #313.`), where the parent is not
the epic. No leading-whitespace tolerance: a quoted or list-item `> Parent: #999`
inside an example must not declare anything. Exact case follows the block's own
rule — `BRAIN-GRAPH/1` does not declare (`epic-map.test.mjs:165-170`, "no
whitelist of near-misses to forgive").

**`Epic: #N` is NOT a synonym** (#337 is the counterexample: parent #335, epic
#313, one line). **More than one distinct issue number is ambiguity, not a
first-match**: parent stays `null` and a divergence is recorded — the rule
`parseGraphBlock` already holds for two graph blocks (`epic-graph.mjs:170-175`).

**The scan runs over PROSE, not over the whole body** (amended 2026-09-16, review
of PR A). Every fenced region is removed first, the `brain-graph/1` fence
included. #709 had already settled for the fence SELECTOR that an illustration
and a declaration must not be byte-identical to a reader; this document left
prose out of that ruling, and the measured cost was not only a fabricated parent
but a DELETED one — a fenced example above a real `Parent:` line manufactured an
ambiguity with it, and the refusal fell on the real declaration.

## Q4 / Q5 — B2 confirmed; the gate never scans the forge

B2 (a new `base-branch` job) is confirmed: the acceptance demands that reverting
only the check turns exactly its own test red, and #564 refuses touching
`issue-link`'s policy. The gate makes **at most two `issueView` calls** (linked
issue → parent), never an `issueList`; the "is this head a tracker" question is
answered by the `feature/` prefix (`stranded.mjs:19-28`), not by a forge scan.

## Q6 — where the doctrine drafts land

Verified: `rg brain-graph brain/core` matches **one** file,
`brain/core/methodology/vcs-contract.md:33`, and only inside an `mrCreate` row —
there is no `brain-graph/1` spec under `brain/core/**`. The block's doctrine home
is `brain/project/decisions/adr-0032-graph-block-declared-by-its-tag.md` (also
Tier 3). Two drafts, D12.

## Q7 — `tracker:` on a non-epic

Parsed and carried; honoured only when `kind === 'epic'`; the mismatch is a said
divergence. Nothing is refused (ruling 4's shape, applied to the same key).

## Q8 — the test bill, measured

`parseGraphBlock`'s return shape is deep-equalled at **seven** sites, not six:
`epic-map.test.mjs:40`, `:91`, `:97`, `:103`, `:174`, `:180` and **`:747-748`**
(the last one missing from the proposal's list). D11 says how they change without
weakening.

---

## Decisions

### D1 — the three keys and the parent enter `parseGraphBlock`'s return

`parseGraphBlock` (`epic-graph.mjs:164-274`) gains four values and one array,
read after the existing `track` read at `:272`:

```js
{ track, kind, tracker, parent, parentSource, blocks, needs, files,
  declarationDivergences }
```

- `kind` — `scalar(block,'kind')`, verbatim string or `null`. Any value parses;
  only `'epic'` is honoured. No validation, for the same reason `scalar()` reads
  only the keys a caller names (`yaml-block.mjs:65-68`): forward compatibility is
  free and unknown-key validation is nowhere in this parser.
- `tracker` — `scalar(block,'tracker')`, grammar-checked (D2). `^track:` cannot
  match a `tracker:` line, so the two keys cannot collide in either direction.
- `parent` / `parentSource` — D3.
- `declarationDivergences` — D2's channel, `[]` in the ordinary case.

**Rejected — a second parser function for the new keys.** One body, one reader;
a second selector would have to re-run the fence selection (`:167-255`), the most
guard-heavy code in the module.

### D2 — malformed declarations are SAID, never silently dropped and never guessed

New per-body array, entries `{key, value, reason}`:

| Condition | Entry | `tracker`/`parent` value |
|---|---|---|
| `tracker:` does not match `/^feature\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/` or contains `..` | `tracker-grammar` | `null` |
| `tracker:` present, `kind !== 'epic'` (Q7) | `tracker-without-kind-epic` | carried, not honoured |
| `parent:` key is not `/^[1-9]\d*$/` | `parent-grammar` | `null` |
| more than one distinct issue number across the `^Parent:` lines | `parent-ambiguous` | `null` |

**Two rows above are amended (2026-09-16, review of PR A); this table's original
wording is overruled by `spec.md` and `tasks.md`, which were right.**

1. The parent grammar was written `#?<digits>`, which ADMITS `parent: #878`.
   `spec.md` R967-1's scenario and `tasks.md` A2a both demand that exact value be
   REFUSED, and the implementation refuses it — the `#` belongs to the prose
   spelling, not to the block key. The grammar is bare positive digits, and since
   the same review it also refuses a LEADING ZERO: `parent: 007` was normalised to
   `7` by `Number()`, and `7` is not the byte the body wrote. One repair is the
   same defect class as another.
2. The ambiguity row counted LINES. `Parent: #878, #879` is two values for one key
   on one line, and the line-counting rule resolved it to `878` by writing order —
   the first-match-wins guess this very row exists to refuse. The count is now over
   the SET of issue numbers, so the one-line and two-line shapes cannot disagree.

`buildGraph` lifts them to a graph-level `declarationDivergences:
[{number, key, value, reason}]` and appends the one cross-node entry,
`parent-not-epic` (ruling 4).

**Rejected — reusing the existing `divergences` array.** Two reasons, both
measured: `renderSummary`'s formatter reads `d.from`/`d.to`/`d.only`
(`epic-render.mjs:115-117`), so a differently-shaped entry prints
`#undefined→#undefined`; and `divergences` is gated on a native read having
happened (`epic-graph.mjs:419-423`), which in the snapshot path never happens —
`readForge` passes no `relations` (`snapshot.mjs:208`), so the array is always
`[]` there. A declaration divergence routed through it would be invisible in
exactly the surface #878 needs it in. The new array is ungated and unconditional;
`renderSummary` gains one optional parameter defaulting to `[]`, so every current
caller is untouched.

### D3 — parent resolution: block key, else the prose line, else null. One hop.

`parent: 878` in the block wins and sets `parentSource: 'block'`. Absent, the
regex of Q3 over the whole body sets `parentSource: 'prose'`. Neither → `parent:
null, parentSource: null`. The `needs`-edge fallback is **dropped**: #881 declares
`needs: [879]`, a sibling (`scratchpad/issue-881.md:27`), and #878 declares
`needs: []` (`scratchpad/issue-878.md:65`) — measured, it resolves to the wrong
node.

**A body with no readable block declares no parent either.** `parseGraphBlock`
returns `null` before any of this when the protocol string is absent (`:165`), and
`{ok:false}` when the block is hidden or duplicated. Salvaging a prose parent out
of an unreadable declaration would contradict the module's own rule — "an
unreadable block asserts NOTHING — it is not half a declaration to be salvaged"
(`epic-graph.mjs:369-371`) — and would make `declared: false` a lie. Measured
cost: of the five bodies this change has read (#967, #564, #713, #878, #881),
every one carries a block. Risk R3.

**Rejected — GitHub sub-issues** (A3): a new port verb ×2 providers, two fixtures,
a Tier-3 `vcs-contract.md` row and contract tests, against a standing ruling
(`github.mjs:183-187`).

### D4 — the node carries four new fields; nothing else in the tree reads them yet

`buildGraph`'s node literal (`epic-graph.mjs:394-407`) gains `kind`, `tracker`,
`parent`, `parentSource`, each `g?.x ?? null` beside `track` at `:399`. Confirmed
by grep: the only readers of `node.track` in the tree are `epic-graph.mjs:451`
itself and two test assertions — no renderer projects node fields by name.

### D5 — `parent-not-epic` is computed in `buildGraph`, where the set exists

After the node loop: for each node with a `parent` present in the set, if that
node's `kind !== 'epic'`, push `{number, key:'parent', value: parent, reason}`. A
parent **absent from the set** (closed, or another repo) produces no entry — "not
in this list" is not "not an epic", the same distinction `:415-421` makes for
native reads. Ruling 4: said, never a failure, never inferred.

### D6 — the snapshot: four fields in the reset, `declarationDivergences` free

`snapshot.mjs:211-212` enumerates the block-derived fields it nulls on an
unreadable node. It gains `kind: null, tracker: null, parent: null,
parentSource: null` — without it an unreadable node would carry a tracker it never
declared, the `evidence-reader-empty-on-failure` shape the comment at `:198-207`
was written to close. `declarationDivergences` needs **no** snapshot line: `graph`
is built with `...g` (`snapshot.mjs:224`), and an unreadable body enters
`buildGraph` as `body: ''` (`:208`), so it contributes no divergence.

**The parity test is `snapshot.test.mjs`, not `snapshot-cli.test.mjs`.** The
latter runs with no VCS port and asserts "graph not computed"
(`snapshot-cli.test.mjs:39`), so it never sees a node field; it is **not
touched**. Coverage lands in the fake-port tests at `snapshot.test.mjs:133-167`
(declare `kind: epic` + `tracker:` on #5, assert the node) and `:169-214` (assert
the unreadable node carries `tracker === null`, beside the existing
`declared === null`). `JSON.parse(JSON.stringify(s))` at `:166` keeps the new
fields JSON-safe for free.

**`ui/lib` needs nothing here.** `canvas-model.mjs` and `drawer-model.mjs` do not
exist in `main`; they live unlanded in the #881 worktree, and `canvas-model.mjs`
projects node fields by name (`:59-63`), so carrying `kind`/`tracker`/`parent`
there is **three added lines in #881 slice 4 / #882** (H6), not in this change.
Naming it so it is a boundary, not an omission.

### D7 — `resolveBase`: a pure leaf that returns a message KEY, never a message

`brain/scripts/lib/ticket-base.mjs`:

```js
export async function resolveBase({ issue, args, fetchIssue, defaultBranch = 'main' })
// → { ok: true,  base, say: { key, params } }
// → { ok: false, refusal: { key, params } }
```

| # | Input | Result | Message key |
|---|---|---|---|
| 1 | no `--base`, epic declares a tracker | `base = tracker` | `ticket.base.fromEpic` (names the epic and `block`/`prose`) |
| 2 | no `--base`, no parent / parent is not an epic / epic declares no tracker | `base = defaultBranch` | `ticket.base.noEpic` |
| 3 | no `--base`, the epic fetch **throws** | `base = defaultBranch` | `ticket.base.epicUnreadable` — **fail open** |
| 4 | `--base main` (= `defaultBranch`), tracker declared, no `--off-tracker` | **refuse** | `ticket.error.baseIsTracked` |
| 5 | `--off-tracker` | `base = defaultBranch` | `ticket.base.offTracker` (names the tracker bypassed) |
| 6 | explicit `--base <other>` | `base = <other>`, **no port call at all** | — (today's behaviour, byte-identical) |

Two deviations from the proposal's sketch, both deliberate:

- **`fetchIssue`, not `port`.** A leaf given the whole port would have to know
  `project` and `provider`; a one-argument closure keeps it a function of data and
  its test needs no port stub. This is the shape `runIssueLinkCheck` already uses
  (`run-check.mjs:388`).
- **No `_now`.** Nothing in this resolution is time-dependent; an unused
  injection is a contract that lies about what the function reads.

**The leaf never calls `t()`.** `t()` is async and locale-bound; returning
`{key, params}` keeps the resolver testable without i18n and keeps every string in
the catalogs. `ticket-start.mjs` awaits `t(say.key, say.params)` and prints it.

**Fail-open (row 3) is the ruling and the house precedent**: the freshness check
one screen away warns and does not refuse, for the reason written at
`ticket-start.mjs:151-154` — "a wrong warning is noise; a wrong refusal is a
stopped session".

### D8 — `ticket-args.mjs` and the verb's wiring

`parseTicketArgs` returns `baseExplicit: baseIdx >= 0` and
`offTracker: args.includes(OFF_TRACKER_FLAG)` with
`export const OFF_TRACKER_FLAG = '--off-tracker'`. The id rule at `:66` is
unaffected — `--off-tracker` takes no value.

`ticket-start.mjs` calls `resolveBase` between the `issueView` at `:93` and the
`ticket.updatingBase` line at `:132`, using the same `vcs`/`project` already in
scope for its `fetchIssue` closure — one extra `issueView`, no new port verb. A
refusal prints `t(refusal.key, params)` and `process.exit(1)`, the file's own
error shape. ≈ 20 added lines.

**Six new i18n pairs** in `en.mjs` (after `:289`) and `es.mjs`:
`ticket.base.fromEpic`, `.noEpic`, `.epicUnreadable`, `.offTracker`,
`ticket.error.baseIsTracked`, plus the `--off-tracker` spelling in
`ticket.error.usage` (`en.mjs:262`). `i18n/coverage.test.mjs:96-98` enforces the
pairing.

**No new doctrine-oracle test.** `ticket-args.test.mjs:88-118` reads
`harness-contract.md`; the row this change needs is already written
(`harness-contract.md:28`: `<tracker>` "is the integration base … not `main`,
while an epic is in flight"). Adding an oracle for an unsigned sentence would
ship red (proposal R4).

### D9 — the gate: B2, five registration sites

| # | File:line | Edit |
|---|---|---|
| 1 | `governance-checks.mjs:41-54` | append `'base-branch'` after `'lane-scrub'` — the order guard asserts YAML order equals this array exactly |
| 2 | `governance-tiers.mjs:225-234` | append a `GATE_MATRIX` row after `lane-scrub`; REQ-TIER-8 asserts the key set equals `GOVERNANCE_JOBS` both ways |
| 3 | `.github/workflows/governance.yml` | a job block **last**, shaped like `issue-link:` (`:46-75`) minus `fetch-depth: 0` |
| 4 | `brain/scripts/ci/gitlab-governance.yml` | the mirror stanza, shaped like `:122-126` |
| 5 | `run-check.mjs:483-488` + `:542-547` | `'base-branch': true` in `SUBCOMMAND_PORT_REACH`, plus the dispatch branch; T7 asserts manifest sorted-equals the dispatched names |

The `GATE_MATRIX` row, **ruling 1**:

```js
'base-branch': Object.freeze({
  lite:      Object.freeze({ policy: 'required', evidence: 'declared-tracker' }),
  standard:  Object.freeze({ policy: 'required', evidence: 'declared-tracker' }),
  regulated: Object.freeze({ policy: 'required', evidence: 'declared-tracker' }),
}),
```

`required` at `lite` makes `mapDetectionToWarning` a no-op for this gate
(`detection-policy.mjs:50-51`), which is the point: detection would have *warned*
on the #881 PR, and a warning is what let #953 land on `main`. Same shape
`lane-paths`/`lane-scrub` already have (`governance-tiers.mjs:225-234`), so the
six-gate `NEVER_TIERED` core is untouched.

**Workflow auth**: the step declares `VCS_TOKEN: ${{ github.token }}` or
`workflow-auth.mjs:566-567` reports it. Env block: `VCS_TOKEN`, `PR_NUMBER`,
`PR_BODY`, `BASE_BRANCH`, `DEFAULT_BRANCH` — **no `BASE_SHA`/`HEAD_SHA` and no
`fetch-depth: 0`**, because the check runs no git (D10). `sourceBranch` needs no
env line: ci-context reads the ambient `GITHUB_HEAD_REF` (`ci-context.mjs:94`)
and `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` (`:183`).

**Operational step the maintainer owes (Tier 2, AGENTS.md:145-147)**: a new
REQUIRED context is not enforced until `npm run brain:protect` is re-run after
merge — `checkContexts(tier)` derives from the same matrix
(`governance-checks.mjs:127-129`). Between merge and that run the gate reports and
does not block; H2 refuses at creation time meanwhile (risk R2).

### D10 — the check: a pure predicate, a wrapper that reuses `issue-link`'s reader

`governance/checks/base-branch.mjs` — pure, ~45 lines, `issue-link.mjs`'s shape:

```js
baseBranchRule({ targetBranch, defaultBranch, sourceBranch,
                 linkedIssue, parentIssue })  // → {pass, reason?}
```

`runBaseBranchCheck(ctx, deps)` in `run-check.mjs` does the IO, in this order:

1. `typeof ctx.body !== 'string'` → `{pass:false, uncomputable:true}` — the
   wrapper's own self-diagnostic, verbatim in shape from `:321-327`.
2. `requiresClosingKeyword(ctx) === null` (target or default branch uncomputable)
   → **fail closed**, `:359-369`'s exact reason shape. The base *is* the subject
   here, so an unreadable base can never be a pass.
3. **Tracker head**: `ctx.sourceBranch` starts with `feature/` → the PR is a
   tracker's own integration PR; `targetBranch` must equal `defaultBranch`, else
   fail. No port call. The oracle is `stranded.mjs:19-28`'s, unchanged — one
   definition of "a branch that is a tracker", named as the fallback it is, and it
   agrees with the declaration by construction because the grammar is
   `feature/<name>` (D2).
4. `extractIssueNumber(ctx.body, closingRequired)` (`:235-247`, module-private,
   reused in place) → `null` → **pass untouched**, reason "no linked issue".
5. `fetchIssue(linked)` via the same `defaultFetchIssue(ctx, deps)` closure
   (`:197-207`) — injectable in tests, `ctx.provider`-dispatched, GitLab-aware.
   Throws → fail closed, uncomputable.
6. `parseGraphBlock(issue.body)` → `parent`. `null` → pass. Linked issue is itself
   `kind: epic` → pass (an epic's own work obeys no parent tracker).
7. `fetchIssue(parent)` → throws → **fail closed**. Parent not `kind: epic` →
   pass, stating the divergence (ruling 4). No `tracker` → pass. Malformed
   `tracker` → **fail**, naming the epic and the bad value.
8. `tracker` declared → `targetBranch === tracker` ? pass : **fail**, naming the
   tracker, the epic, and the actual base.

**The reuse is code, not calls.** `run-check.mjs` is "entry point, never a
library" (`detection-policy.mjs:5-15`), so nothing is exported: the handler lives
in the same file and calls the same module-private `defaultFetchIssue`,
`extractIssueNumber` and `requiresClosingKeyword`. `base-branch` is a separate CI
job in a separate process, so it makes its own `issueView` calls — one, or two
when a parent exists. Bounded, never an `issueList`.

**Fail-closed vs fail-open, resolved by the deny-reader rule (#942).** A reader
whose failure would let a wrong base through fails closed: steps 1, 2, 5 and 7 are
that reader. The verb (D7 row 3) fails **open** because its failure mode is the
opposite — a stopped session, and the gate is the backstop that catches the
consequence at PR time. A gate's `exit 2` is re-runnable; a refused
`brain:ticket:start` is not.

**Rejected — recomputing `classifyLane` for a lane exemption** (the shape
`runIssueLinkCheck:335-353` uses). It would cost `fetch-depth: 0`, two more env
vars and two diff closures, to cover a case step 4 already covers: a `memory/*`
lane PR carries no issue reference, so it passes at step 4 untouched. And a
slice PR with no reference is **already red** on `issue-link`, which is `required`
at every tier (`governance-tiers.mjs:152-156`) — so "pass on no reference" lets no
wrong base through.

**Rejected — B1, extending `issue-link`**: #564 refuses touching that job's
policy, and "reverting only the check turns exactly its own test red" is not
provable inside a shared handler.

### D11 — updating seven deep-equals without weakening one

A helper in `epic-map.test.mjs` returns the **full** expected shape with the new
keys at their defaults:

```js
const graphShape = (o = {}) => ({ track: null, kind: null, tracker: null,
  parent: null, parentSource: null, blocks: [], needs: [], files: [],
  declarationDivergences: [], ...o });
```

Each of the seven sites keeps `assert.deepEqual` and passes `graphShape({...})`.
The assertion stays a **full-shape** comparison, so a stray key still fails.
**Rejected — `partialDeepStrictEqual` or per-key `assert.equal`**: both stop
noticing an extra key, which is precisely what these assertions have been catching
since #459.

### D12 — two doctrine drafts, nothing committed to `brain/core/**`

`openspec/changes/issue-967-tracker-as-data/brain-drafts/` (AGENTS.md:158-159):

| Draft file | Target | The sentence |
|---|---|---|
| `lite-required-base-branch.md` | `brain/core/methodology/workflow-governance.md` | "`base-branch` is required at every tier, `lite` included: it is the one gate whose detection mode would only have warned about the failure it exists to prevent." |
| `graph-block-kind-tracker-parent.md` | `brain/project/decisions/adr-0032-graph-block-declared-by-its-tag.md` (amendment) | "A `brain-graph/1` block may declare `kind: epic`, `tracker: feature/<name>` on an epic, and `parent: <issue>`; absent a `parent:` key a line-initial `Parent: #N` is read and the node records that the answer came from prose." |

---

## Data shapes

```js
// parseGraphBlock(body) — success
{ track: 'UI', kind: 'epic', tracker: 'feature/brain-ui',
  parent: null, parentSource: null,
  blocks: [882], needs: [], files: ['brain/scripts/ui/**'],
  declarationDivergences: [] }

// buildGraph(issues).nodes[i] — the four new fields beside `track`
{ number: 881, …, track: 'UI', kind: null, tracker: null,
  parent: 878, parentSource: 'prose', … }

// buildGraph(issues).declarationDivergences
[{ number: 881, key: 'tracker', value: 'main', reason: 'not a feature/<name> branch' }]

// resolveBase → the verb prints t(say.key, say.params)
{ ok: true, base: 'feature/brain-ui',
  say: { key: 'ticket.base.fromEpic',
         params: { base: 'feature/brain-ui', epic: 878, source: 'prose' } } }
```

## Test plan, mapped to acceptance

| Statement | Test file → what it asserts |
|---|---|
| An epic with `tracker:`/`kind: epic` parses; a body with none of the keys parses exactly as today | `epic-map.test.mjs` — the seven `graphShape()` deep-equals (D11) plus a new "declares none of the three keys" case |
| Malformed values are said, never guessed | `epic-map.test.mjs` — `tracker: main`, `tracker:` on a non-epic, `parent: abc`, two `Parent:` lines → one `declarationDivergences` entry each, field `null` |
| `parent:` and prose `Parent: #N` both yield `parent` + `parentSource`; #337's mid-line shape yields `null` | `epic-map.test.mjs` — three cases, the #881 and #337 lines verbatim |
| A parent that is not an epic is a said divergence, never a tracker | `epic-map.test.mjs` — `buildGraph` over two issues |
| The snapshot carries all four; an unreadable node carries none | `snapshot.test.mjs:133-167` and `:169-214`, fake port. `snapshot-cli.test.mjs` untouched |
| The verb resolves, says, refuses, and fails open | `ticket-base.test.mjs` (new) — the six rows of D7 plus a throwing `fetchIssue`; `ticket-args.test.mjs` +3 for `baseExplicit`/`--off-tracker` |
| The messages exist in both locales | `i18n/coverage.test.mjs:96-98`, unchanged, six new pairs |
| `base-branch` fails a slice PR against `main` at `lite`; no epic / no tracker passes untouched | `run-check.test.mjs` — the eight steps of D10 with an injected `fetchIssue`, plus `mapDetectionToWarning` proving `lite` does not soften it |
| Reverting only the check turns exactly its own test red | `base-branch.test.mjs` (new) — the pure predicate alone |
| The five registration sites agree | existing guards, no new test: `governance-checks.test.mjs` (order), `governance-tiers.test.mjs` (REQ-TIER-8), `run-check.test.mjs` T7 (manifest), `workflow-auth` (VCS_TOKEN) |

## Delivery — a feature-branch chain on `feature/issue-967`

Counted lines exclude `**/*.test.mjs` and `openspec/changes/**`
(`brain.config.json:18-29`); `lite`'s budget is 1000 (`:17`, AGENTS.md:447). The
binding constraint is the 400-line **review** budget.

| PR | Base | Contents | Counted | Review |
|---|---|---|---|---|
| **A — the block is data** | `feature/issue-967` | `epic-graph.mjs` (parse, node, `declarationDivergences`), `epic-render.mjs` +1 line, `snapshot.mjs:211-212` | 65–85 | ≈ 290 |
| **B — the verb resolves** | A's branch | `ticket-base.mjs` (new), `ticket-args.mjs`, `ticket-start.mjs` wiring, `en.mjs`+`es.mjs` | 155–185 | ≈ 360 |
| **C — the gate** | B's branch | `checks/base-branch.mjs` (new), `run-check.mjs` handler/dispatch/manifest, `governance-checks.mjs`, `governance-tiers.mjs`, both CI files | 150–175 | ≈ 370 |
| **tracker → `main`** | `main` | the union of A+B+C | 370–445 | ≈ 1020 — `size:exception` |

Order: create `feature/issue-967` off `main` and push it; rebase this worktree's
branch onto it (it was cut off `origin/main`); PR A targets the tracker; B and C
each target the immediately previous PR's branch so the review diff stays the
slice; retarget to the tracker as each parent merges. The tracker PR to `main`
opens once A has landed on it and it has a diff — `stranded.mjs` reports the
tracker until then, which is this change's own ratified answer to the
tracker-PR-timing question.

**Rollback.** A is additive (absent keys read `null`; `scalar()` ignores keys
nobody names). B is one verb, one PR. C is the only slice with CI wiring:
reverting it means all five sites together **plus** a `brain:protect` re-run to
drop the now-absent required context, or every PR blocks on a check that never
reports.

## Risks left open

1. **R1 — a wrong refusal stops a session.** Closed by D7 row 3 (fail open on an
   unreadable epic) and bounded by D7 row 6 (an explicit non-default `--base`
   makes no port call at all).
2. **R2 — the gate cannot block between merge and `brain:protect`.** A maintainer
   step nobody can automate away (`governance-checks.mjs:127-129`). H2 refuses at
   creation time meanwhile; the window is stated in the tasks, not assumed.
3. **R3 — a child with a `Parent:` line and no graph block declares no parent**
   (D3). Zero measured instances across five bodies. Escape if one appears: read
   the prose line in `buildGraph` from `issue.body` — one call site, later, not
   two readers now.
4. **R4 — `defaultBranch` is `'main'` by default in `resolveBase`.** A consumer
   whose default branch is `master` gets no refusal on `--base master`. The
   parameter exists so `ticket-start.mjs` can pass the real value once it has one
   without a port call; today it does not. Fail-open, named, not hidden.
5. **R5 — the fields are inert until bodies declare them.** Accepted; activation
   is #878 declaring `kind: epic` + `tracker: feature/brain-ui`
   (`scratchpad/issue-878.md:62-67` currently declares neither).
6. **R6 — `brain-ship.mjs:259` and `memory/lane/ship.mjs:206` still open PRs
   against the default branch.** The first is a follow-up ticket (it needs the
   same resolution, refusal, messages and tests as H2 in a second verb); the
   second is correct as it stands — a lane PR has no epic. C catches the first at
   PR time.
7. **R7 — `declarationDivergences` has no renderer beyond `renderSummary`'s one
   line** until #882 (H6). The data exists and is JSON-visible in
   `brain:snapshot --json`; the canvas mark is that slice's three lines.
