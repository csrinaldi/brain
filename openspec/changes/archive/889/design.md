---
status: tasked
issue: 889
---

# Design — #889 the lane is recognised: one predicate, three callers, and two contexts that report before they block

Parent: #864 task 3.1c (ADR-0034 L1 / L3 / L6 / C1). Ruling: engram
`sdd/issue-889-lane-governance/ruling` (D1–D8 taken as recommended). Inputs: `proposal.md`,
`explore.md`. Sub-tickets: **#905** = slice A + C (PR 1); **#906** = the deferred triggers (D6).
PR 2 closes **#889**.

## Approach in one paragraph

One pure module — `brain/scripts/governance/checks/lane.mjs` — owns the lane predicate, and three
IO wrappers ask it three different questions. `runIssueLinkCheck` (`run-check.mjs:313`) asks *"may I
skip the issue-link rule?"* and gets `lane === true` only when branch **and** paths agree (D1a).
A new `lane-paths.mjs` asks *"is this branch claiming a lane it has not earned?"* and needs the
`laneBranch` half separately, so it can pass a non-lane PR and refuse a lane branch carrying code.
`brain-audit.mjs`'s walk (`:289-332`) asks the same question of a merged commit, plus the
`Memory lane:` body marker, and prints `[LANE]` instead of a false `issueLink` `[FAIL]`. A second
new script, `lane-scrub.mjs`, is deliberately *not* a lane consumer: it scans every added
`.memory/records/*.jsonl` path on every PR. Both new scripts become jobs — therefore contexts —
registered in `GOVERNANCE_JOBS`/`GATE_MATRIX`/`governance.yml` in one commit, and armed afterwards
by the maintainer's `npm run brain:protect`.

## Module map and signatures

```
brain/scripts/governance/checks/lane.mjs            NEW  pure
  export const LANE_BRANCH_RE                        /^memory\/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/
  export const LANE_PATH_RE                          /^\.memory\/records\/[^/]+\.jsonl$/
  export function classifyLane({ sourceBranch, changedFiles, addedFiles })
      -> { lane, laneBranch, lanePaths: boolean, offending: string[], reason: string }

brain/scripts/governance/run-check.mjs               MOD  runIssueLinkCheck gains a lane branch
brain/scripts/governance/lane-paths.mjs              NEW  pure core + main() + CLI guard
brain/scripts/governance/lane-scrub.mjs              NEW  pure core + main() + CLI guard
brain/scripts/memory/index-lag.mjs                   NEW  compareIndexToRecords() + main() (always 0)
brain/scripts/brain-audit.mjs                        MOD  [LANE] short-circuit in the walk loop
brain/scripts/vcs/governance-checks.mjs              MOD  two names appended to GOVERNANCE_JOBS
brain/scripts/vcs/governance-tiers.mjs               MOD  two GATE_MATRIX rows + one surface entry
brain/scripts/vcs/contributor-scaffold.mjs           MOD  the L6 sentence (`:274-277`)
.github/workflows/governance.yml                     MOD  2 jobs, issue-link env, local-checks step
```

## Architecture decisions

### A1 — `classifyLane` returns the decomposition, because three callers ask three questions

Three booleans (`lane`, `laneBranch`, `lanePaths`) plus `offending` and `reason`.
`{ lane }` alone cannot serve `lane-paths`: on a `feat/x` branch and on a
`memory/host-2026-09-10` branch carrying `src/index.js`, `lane` is `false` both times, and the job
must **pass** the first and **fail** the second. `laneBranch` (the branch-name half, on its own) is
what discriminates them; `offending` carries every path that broke the conjunction so the job names
them all at once instead of one per push.

| caller | reads | on `false` |
|---|---|---|
| `runIssueLinkCheck` | `lane` | ordinary issue-link rules — a loud, well-understood refusal |
| `lane-paths` | `laneBranch`, then `lane` + `offending` | `laneBranch:false` ⇒ exit 0 "not a lane"; `laneBranch:true, lane:false` ⇒ exit 1, paths named |
| `brain-audit` walk | `lane` (+ the body marker, A8) | falls through to `evaluateMerge`, unchanged |

Rejected: three fields spelled as three exported predicates (`isLaneBranch`, `isLanePaths`,
`isLane`). Three functions means three call sites can compose them in three orders; one function
that returns the decomposition keeps the conjunction unforgeable — ADR-0034 L1's "either alone is
not enough" is then a property of the module, not of its callers' discipline.

### A2 — The evidence is `changedFiles` + `addedFiles`, never `git diff --name-status -M`

The predicate is: **every** entry of `changedFiles` matches `LANE_PATH_RE` **and** appears in
`addedFiles`. A modification, a deletion and a rename each appear in `--name-only` and are absent
from `--diff-filter=A`, so the set inclusion already refuses all three — no status letter needs
parsing. `.memory/index.jsonl` fails on the prefix alone (L3's default, with no special case), and
`.memory/records/sub/x.jsonl` fails on `[^/]+`.

That shape is not a preference; it is what both callers already hold. `run-check.mjs` has
`defaultDiffNameOnly`/`defaultDiffNameOnlyAdded` (`:108-138`, three-dot `base...head` from
`ctx.baseSha`/`ctx.headSha`), and the audit walk has `readMergeDiff` returning
`{numstat, changedFiles, addedFiles, body}` (`lib/merge-walk.mjs:242-254`). A `--name-status -M`
predicate would force a **third** diff spelling into the repo and a second diff into the audit walk.
`changedFiles.length === 0` ⇒ `lane:false, reason:'empty diff'`: absent evidence is never an
exemption.

### A3 — The branch grammar is the producer's, and it has no `-N` suffix

ADR-0034 L1 (`adr-0034…:49`) writes `…-\d{4}-\d{2}-\d{2}(-\d+)?$`. The collector cannot produce
that: `plan.mjs:42`'s `REF_GRAMMAR_RE` is
`/^refs\/heads\/memory\/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/`, with no suffix group, because
#887's D2 makes a same-day second `collect` **append to the same ref** rather than mint a second
one. `LANE_BRANCH_RE` therefore matches the producer, not the ADR's wider draft: accepting a
suffix nothing can build widens the exemption for free. A `memory/host-2026-09-10-2` branch is
simply not a lane, and is refused by the ordinary rule — the safe direction.

Not enforced by importing `plan.mjs` (a gate importing the producer is the wrong dependency
direction, and `plan.mjs` does not export its constant). Enforced behaviourally: a test drives the
planner over a host/date table and asserts every ref it returns satisfies
`LANE_BRANCH_RE` after `refs/heads/` is stripped. The producer, not a copied regex, is the oracle.

### A4 — `issue-link`: the branch goes at `:327`, and the seam already exists

Placement: after the non-string-body guard (`run-check.mjs:320-326`), before `issueLink(ctx.body)`
(`:327`). `runCheck` already builds `diffNameOnly`/`diffNameOnlyAdded` closures at `:473-474` and
hands them only to `decision-gate`; the change at `:514` is to pass the same two closures into
`runIssueLinkCheck`. **No new plumbing, and no new test seam** — `run-check.test.mjs` already
injects `deps.diffNameOnly`/`deps.diffNameOnlyAdded`.

Two properties the wrapper must have:

1. **Short-circuit on the branch regex before touching git.** If `LANE_BRANCH_RE` does not match
   `ctx.sourceBranch` (`ci-context.mjs:94`, `GITHUB_HEAD_REF` — ambient on `pull_request` only),
   the wrapper never calls the diff at all. Non-lane PRs — every PR today — pay nothing and cannot
   be affected by a diff failure. This is why the module exports the regex as well as the function.
2. **An uncomputable diff is caught and demoted to "not a lane", never returned as `uncomputable`.**
   `defaultDiffNameOnly` throws by contract (`:111-113`, `:119-121`). Returning `uncomputable:true`
   here would turn a shallow-clone consumer's every `memory/*` PR into exit 2; falling through to
   the standard rules refuses it with the message the repo already understands.

### A5 — Two standalone entry scripts, not two `run-check` subcommands

`GOVERNANCE_JOBS` already contains both shapes: four `run-check` subcommands and two standalone
entry scripts (`vcs/actor-check.mjs`, `vcs/brain-writes-reviewed.mjs`).

| option | cost |
|---|---|
| **standalone `governance/lane-paths.mjs` + `lane-scrub.mjs`, pure core + `main()` + CLI guard** | each re-states ~8 lines of `main()`; mirrors the other two required contexts |
| subcommands of `run-check.mjs` | two `SUBCOMMAND_PORT_REACH` keys (`:454-459`, T7 asserts the key set equals the dispatch), and every verdict routes through `main()`'s `mapDetectionToWarning` (`:554`) |

**Chosen: standalone.** The deciding argument is C1. ADR-0034 calls `lane-scrub` non-waivable; if it
returned through `run-check.main()`, non-waivability would be a property of a `GATE_MATRIX` cell
that a future tier edit could soften. A standalone `main()` that **never imports
`governance-tiers.mjs`** makes "fail-closed at every tier, no flag" a property of the code. A source
guard in `lane-scrub.test.mjs` pins the absent import. Both scripts still reuse the shared
`resultToExit` (`governance/postmerge/exit-codes.mjs`) so the 0/1/2 contract is not re-invented —
what they skip is the *softening*, not the contract.

Shell is not an option: `governance.yml:29-43` records what a second bash implementation of one rule
already cost this repo (#130/#340).

### A6 — `lane-scrub` scans added record paths on **every** PR (departure from D3's wording, stated)

D3 says both jobs print "not a lane — nothing to check" on a non-lane PR. `lane-paths` does exactly
that. `lane-scrub` does not, and the departure is deliberate: the five feature-PR surfaces #890
retires are **still live**, so contributors are still told to commit records on feature branches
(`contributor-scaffold.mjs:274`). A scrub that only looks at lane PRs leaves the transition window
unguarded on exactly the path the repo still recommends. ADR-0034's C1 wording — "over every added
`.memory/records/*.jsonl` path" — is satisfied more literally this way.

So `lane-scrub` needs no lane input at all: it scans `addedFiles.filter(p => LANE_PATH_RE.test(p))`
and prints `no added record paths — nothing to scan` when that set is empty (behaviourally the
ratified exit-0-on-a-non-lane-PR). **Revert path if the maintainer prefers D3 verbatim: gate the
filter on `classifyLane(...).laneBranch` — one condition, one test.** Raised in Open Questions.

Output discipline (C1's own): the wrapper destructures `{pattern, lineNumber}` and **drops `.line`**,
which `scanTextForSecrets` does return (`memory/lib/secret-scrub.mjs:87`). Patterns come from
`resolveSecretConfig(config)` (`:56-66`) so `memorySecretAllowPatterns` is honoured and nothing else
is. `scrubRecordsFile` is fail-fast (first hit per file, `:137-139`) — accepted and named, since
either way the merge stops.

**Two distinct UNCOMPUTABLE reasons (cold-1, PR #907 cold review, fixed ahead of PR 2):**
`main()` can fail closed (exit 2) for two different causes, and they must never share one message.
(1) **config failure** — `resolveSecretConfig(config)` + `compilePatterns(...)` (A6, `secret-scrub.mjs:42-44`)
run OUTSIDE the per-record read loop, in their own try/catch, before any file is read; an invalid
regex source reports `lane-scrub: invalid secret pattern in config — failing closed (uncomputable):
<message>`. (2) **read failure** — an added record deleted between the diff and the run throws
inside `readFile`, caught by a separate try/catch around the loop itself, reporting `lane-scrub:
cannot read an added record — failing closed (uncomputable): <message>`. The original single
try/catch wrapped both steps together, so a broken secret-config pattern was misreported as an
unreadable record — a config author's mistake read as a corrupted checkout. Splitting the two
try/catches (and passing pre-compiled `patterns`/`allowPatterns` into `evaluateLaneScrub` from
`main()`, bypassing its internal config-compile path) makes the two failures independently
diagnosable while both still exit 2.

### A7 — Registration order is asserted; `NEVER_TIERED` is not touched

`governance-checks.test.mjs:91` asserts the **order** of `governance.yml`'s job `name:` fields equals
`GOVERNANCE_JOBS`, and `:64` asserts `GOVERNANCE_JOBS === [...REQUIRED_JOBS, ...DETECTION_JOBS]`.
`requiredJobs()` iterates `Object.keys(GATE_MATRIX)` (`governance-tiers.mjs:489-493`), and at
`standard` every gate is required, so `DETECTION_JOBS` is `[]`. Therefore: **append the two names at
the end of `GOVERNANCE_JOBS`, at the end of `GATE_MATRIX`, and at the end of `governance.yml` — the
same relative order in all three.** Anything else turns the order guard red for a reason that reads
like a bug.

Both rows are `policy:'required'` at all three tiers; evidence tags `lane-path-restriction` and
`secret-scan`. `NEVER_TIERED` (`:76-83`) stays at six: its test (`governance-tiers.test.mjs:36`)
pins that enumeration as the REQ-TIER-2 doctrinal core, and REQ-TIER-7's guard (`:100`) only runs
the other direction (position-tiered ⇒ not in the core). Widening a ratified doctrine list is a
change this slice does not own; `required` at every tier comes from the matrix rows, which is what
`requiredJobs`/`checkContexts` actually read.

### A8 — `[LANE]` classifies on `issueLinkBody`, the value the walk already computes

`fetchPrMeta` exposes no head branch (`lib/merge-walk.mjs:296-298`), so the walk classifies on paths
plus the body marker (D4). The marker is read from **`issueLinkBody`** — `selectIssueLinkBody(prBody,
body)`, `brain-audit.mjs:324` — not from the raw commit body. That choice removes the open question
about GitHub's squash-message setting entirely: when the PR is reachable, `prBody` is the body
`ship.mjs:108` wrote (`Memory lane: <host> <date>`); when it is not, the commit body is the
fallback. The classifier reads exactly the evidence `issueLink` would have read, so it can never
exempt a merge on evidence the gate itself would not have seen.

Placement: after `issueLinkBody` is computed (`:324`), before `evaluateMerge` (`:326`) — never
inside it (ADR-0016 keeps the evaluator context-unaware). Shape mirrors the existing `[SKIP]`
short-circuits (`:266-282`): print `[LANE] <sha7> <subject>` and `continue`. It sits **after** the
`[UNCOMPUTABLE]` guard (`:315-319`), so a merge whose PR metadata failed is never classified as a
lane on a fallback body.

```js
const laneMerge = classifyLane({ sourceBranch: null, changedFiles, addedFiles });
if (laneMerge.lanePaths && /^Memory lane: /m.test(issueLinkBody ?? '')) { … }
```

Because the walk has no branch name, the audit needs the **paths half without the branch half** —
which is why `lanePaths` is exported as its own field rather than being folded into `lane` (A1).
The walk passes `sourceBranch: null` and reads `lanePaths`: the same conjunction, minus a branch
claim that does not exist post-merge. `lane === laneBranch && lanePaths` is asserted in the unit
test so the three booleans cannot drift apart.

**Operational fact (for the release note):** `[LANE]` depends on `gh pr view` actually returning
the PR body — an unauthenticated `brain:audit` run over a window that contains a lane merge does
NOT silently treat it as a plain merge. `fetchPrMeta` sets `prMetaError` on that failure, the
`[UNCOMPUTABLE]` guard (above `laneMerge`) fires first, and the run prints `[UNCOMPUTABLE]` and
exits 2 — fail-closed, by design, not a defect to file. And a `[LANE]` row skips ALL of
`evaluateMerge` — diff-size, memory presence, AND the human-review gate — for that merge; that is
the surface the `[LANE]` ruling deliberately trades away in exchange for not rendering a
governance verdict on a shipped memory lane (D4). Anyone auditing "what did `[LANE]` actually
exempt" should read it as those three checks, not as "nothing was checked."

### A9 — Index-lag compares **id sets**, never bytes, and the script must join the verification surface

There is no non-mutating rebuild today: `rebuildIndex` writes at `store.mjs:238-239`. The
composition that is non-mutating already exists — `readRecords({ recordsDir })`
(`store.mjs:349`, never throws, dedupes first-wins by id, the same winner `rebuildIndex` picks,
`:339-343`) — so `compareIndexToRecords({ indexLines, records })` compares the **set of `id`s** in
the committed `.memory/index.jsonl` against the set `readRecords` returns, and reports
`{ lagged, indexed, rebuilt, missingFromIndex, staleInIndex }`.

Ids, not bytes: `serializeIndex` (`lib/format.mjs:268-272`) is deterministic, so a byte compare
would *work*, but it would also call a key-order or trailing-newline difference "lag" and this
warning must never cry wolf. A missing `index.jsonl` reads as an empty index (warn), never a throw.

**Discovered requirement (not in the proposal):** `engine-blind-gates.test.mjs:143-157` asserts that
every `brain/scripts/**` path a forge config invokes is declared in
`governance-tiers.mjs`'s `VERIFICATION_SURFACE`. `brain/scripts/governance/**` is covered by the
`dirs` entry (`:123`), so `lane-paths.mjs`/`lane-scrub.mjs` need nothing — but
`brain/scripts/memory/index-lag.mjs` is outside every declared dir, so **PR 2 must add it to
`VERIFICATION_SURFACE.scripts`**, beside `check-refs.mjs` (`:128`), which is in that list for
exactly this reason. Without it, `npm test` goes red the moment the `local-checks` step lands.

## Interfaces

```js
// governance/checks/lane.mjs — pure, no fs, no child_process (ADR-0016)
export const LANE_BRANCH_RE = /^memory\/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/;
export const LANE_PATH_RE   = /^\.memory\/records\/[^/]+\.jsonl$/;

/**
 * @param {{sourceBranch: string|null, changedFiles: string[]|null, addedFiles: string[]|null}} input
 * @returns {{lane: boolean, laneBranch: boolean, lanePaths: boolean,
 *            offending: string[], reason: string}}
 *   lane === laneBranch && lanePaths. A null/absent diff yields lanePaths:false
 *   ('diff uncomputable'); an empty changed set yields lanePaths:false ('empty diff').
 */
export function classifyLane({ sourceBranch, changedFiles, addedFiles }) { … }
```

```js
// governance/lane-paths.mjs — the loud half
export function evaluateLanePaths({ sourceBranch, changedFiles, addedFiles })
  -> { pass: boolean, uncomputable?: boolean, reason: string }
// governance/lane-scrub.mjs — C1, tier-blind by construction
export function evaluateLaneScrub({ addedFiles, config, readFile })
  -> { pass: boolean, uncomputable?: boolean, reason: string }
// memory/index-lag.mjs — warns, never fails
export function compareIndexToRecords({ indexLines, records })
  -> { lagged: boolean, indexed: number, rebuilt: number,
       missingFromIndex: number, staleInIndex: number }
```

## Data flow

```
pull_request ──► ci-context.loadContext()  ──► ctx{ sourceBranch, baseSha, headSha, body, … }
                                                │
        ┌───────────────────────────────────────┼───────────────────────────────┐
        ▼                                       ▼                               ▼
  issue-link job                          lane-paths job                  lane-scrub job
  runIssueLinkCheck                       evaluateLanePaths              evaluateLaneScrub
    LANE_BRANCH_RE? ──no──► standard rules   classifyLane                  addedFiles ∩ records/
    yes ► diff (try) ► classifyLane            ├ laneBranch:false ► exit 0    └► scrubRecordsFile
      lane:true  ► pass, no issue needed       ├ lane:true       ► exit 0        hit ► exit 1
      lane:false ► standard rules              └ else ► names paths, exit 1      (pattern+line no.)

post-merge:  brain-audit walk ──► readMergeDiff ─┐
                                  fetchPrMeta ───┴► issueLinkBody
                                     classifyLane(paths) && /^Memory lane: /m ─► [LANE], continue
                                     otherwise ─────────────────────────────► evaluateMerge
```

## File changes

| File | Action | What |
|---|---|---|
| `brain/scripts/governance/checks/lane.mjs` | Create | the one pure predicate (A1–A3) |
| `brain/scripts/governance/lane-paths.mjs` | Create | pure core + `main()` + CLI guard |
| `brain/scripts/governance/lane-scrub.mjs` | Create | pure core + `main()`; no tier import (A5) |
| `brain/scripts/governance/run-check.mjs` | Modify | lane branch at `:327`; pass the two diff closures at `:514` |
| `.github/workflows/governance.yml` | Modify | 2 jobs appended; `issue-link` gains `fetch-depth: 0` + `BASE_SHA`/`HEAD_SHA`; `local-checks` gains the index-lag step (PR 2) |
| `brain/scripts/vcs/governance-checks.mjs` | Modify | 2 names appended to `GOVERNANCE_JOBS` (`:41-50`) |
| `brain/scripts/vcs/governance-tiers.mjs` | Modify | 2 `GATE_MATRIX` rows appended (`:150-219`); PR 2 adds 1 `VERIFICATION_SURFACE.scripts` entry |
| `brain/scripts/vcs/contributor-scaffold.mjs` | Modify | `:274-277` — the L6 sentence |
| `.github/PULL_REQUEST_TEMPLATE.md` | Modify | the regenerated emission (never hand-edited) |
| `brain/scripts/brain-audit.mjs` | Modify | `[LANE]` short-circuit at `:325` (PR 2) |
| `brain/scripts/memory/index-lag.mjs` | Create | L3's warning (PR 2) |
| branch protection on `main` | Maintainer act | `npm run brain:protect` — never in the diff |

**The template sentence** replaces `contributor-scaffold.mjs:274-277`, keeping the last three lines
verbatim and taking ADR-0034's ratified wording (`:158-160`, `archive/862/spec.md:93-94`):

```
- [ ] Session memory captured as a record (\`memory:save --issue N\`); it reaches \`main\`
      on the lane. Where the pipeline hands \`memory-gate\` this description, an unscoped
      record does NOT satisfy it. \`skip:memory-gate\` is named in the docs but no gate
      reads it — applying it exempts nothing.
```

## Workflow wiring — the two constraints that are not obvious

1. **`lane-paths` and `lane-scrub` must NOT declare `PR_NUMBER` in their step `env:`.**
   `lib/workflow-auth.mjs:57-64`: `ci-context.mjs` is a cut vertex; an entry point reaching the port
   only through it requires `VCS_TOKEN` **iff** the step declares `PR_NUMBER` (presence, not value).
   Both jobs need only `BASE_SHA`/`HEAD_SHA` (+ ambient `GITHUB_HEAD_REF`), so with no `PR_NUMBER`
   and no `VCS_TOKEN` they are offline by construction and the auth guard proves it. Both need
   `- uses: actions/checkout@v4` with `fetch-depth: 0`.
2. **`issue-link` gains `fetch-depth: 0` and `BASE_SHA`/`HEAD_SHA`** (it has neither today,
   `governance.yml:44-63`). It already declares `PR_NUMBER` + `VCS_TOKEN` for `fetchIssue`, so its
   auth verdict does not change. Per A4 the diff only runs on `memory/*` heads.

## Testing strategy — STRICT TDD, red before green, in this order

### PR 1 (#905) — slice A + C

| # | file | pins | command |
|---|---|---|---|
| 1 | `governance/checks/lane.test.mjs` (new) | branch+paths ⇒ lane; branch only ⇒ `laneBranch:true, lane:false` with `offending`; paths only ⇒ `lane:false`; M/D/R under the prefix ⇒ not (changed ⊄ added); `.memory/index.jsonl` ⇒ not; nested path ⇒ not; empty diff ⇒ not; null diff ⇒ not; `sourceBranch:null` ⇒ not; **no `-N` suffix** (A3); `lane === laneBranch && lanePaths` | `node --test brain/scripts/governance/checks/lane.test.mjs` |
| 2 | `governance/checks/lane.test.mjs` (same file) | the producer oracle: every `plan.mjs` ref over a host/date table satisfies `LANE_BRANCH_RE` | ditto |
| 3 | `governance/run-check.test.mjs` (extend) | a lane ctx passes with no closing keyword and `issueLink` is never consulted; a `memory/*` head carrying one code path is refused by the ordinary rule; a THROWING `diffNameOnly` ⇒ standard rules, **never** `uncomputable`; a non-`memory/*` head never calls the diff closures (spy asserts zero calls) | `node --test brain/scripts/governance/run-check.test.mjs` |
| 4 | `governance/lane-paths.test.mjs` (new) | the offending paths are **named**; exit 1 on a foreign path; exit 0 + "not a lane" on a non-lane head; exit 2 on an uncomputable diff **for a lane head**; three-dot argv asserted on the default dep | `node --test brain/scripts/governance/lane-paths.test.mjs` |
| 5 | `governance/lane-scrub.test.mjs` (new) | a planted `ghp_…` fails closed; output carries `pattern` + `lineNumber` and **never** the matched line; `memorySecretAllowPatterns` honoured; exit 0 with "nothing to scan" when no record path was added; **source guard: the file does not import `governance-tiers.mjs`** | `node --test brain/scripts/governance/lane-scrub.test.mjs` |
| 6 | `vcs/governance-checks.test.mjs` + `governance-tiers.test.mjs` (extend) | ten jobs, same order, in all three surfaces; `checkContexts('lite')` contains both names — **red until array + matrix + YAML all land** (the intended signal) | `node --test brain/scripts/vcs/governance-checks.test.mjs brain/scripts/vcs/governance-tiers.test.mjs` |
| 7 | `vcs/actor-check.test.mjs` (extend) | D2's two pins, **no production code**: a lane-shaped PR (no issue number in the body) ⇒ `warn`, exit 0 (`:722-729`, `:1359`); a labeled PR whose approver is in `denyActors` ⇒ `fail`, exit 1 (`:779`) | `node --test brain/scripts/vcs/actor-check.test.mjs` |
| 8 | `vcs/workflow-auth.test.mjs` + `vcs/engine-blind-gates.test.mjs` | the two new steps need no credential; the two new scripts are inside the declared surface | `node --test brain/scripts/vcs/lib/workflow-auth.test.mjs brain/scripts/vcs/engine-blind-gates.test.mjs` |
| 9 | `vcs/contributor-scaffold.test.mjs` (extend) | the emitted template matches the committed one byte-for-byte with the new sentence | `node --test brain/scripts/vcs/contributor-scaffold.test.mjs` |

### PR 2 (#889) — slice B

| # | file | pins | command |
|---|---|---|---|
| 10 | `brain-audit.test.mjs` (extend) | a synthetic temp-repo merge, records-only additions + `Memory lane:` in the commit body ⇒ `[LANE]`, no `[FAIL]`; the same merge **without** the marker ⇒ evaluated normally; a merge mixing a code path ⇒ evaluated normally | `node --test brain/scripts/brain-audit.test.mjs` |
| 11 | `memory/index-lag.test.mjs` (new) | lag ⇒ warning naming both counts, exit 0; in sync ⇒ silent, exit 0; missing index ⇒ warning, exit 0; **no file is written** (bytes + mtime asserted before/after) | `node --test brain/scripts/memory/index-lag.test.mjs` |
| 12 | `vcs/engine-blind-gates.test.mjs` | `index-lag.mjs` is declared in `VERIFICATION_SURFACE.scripts` (A9) | `node --test brain/scripts/vcs/engine-blind-gates.test.mjs` |

Full suite before each PR: `npm test`.

## Changed-line forecast and delivery

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**`.
`.github/**` is **not** excluded.

| PR | contents | counted |
|---|---|---|
| **1 (#905)** | `checks/lane.mjs` ~55; `run-check.mjs` ~30; `lane-paths.mjs` ~50; `lane-scrub.mjs` ~60; `governance.yml` ~50; `GOVERNANCE_JOBS` + 2 matrix rows ~22; scaffold + template ~10 | **~277** |
| **2 (#889)** | `brain-audit.mjs` ~30; `memory/index-lag.mjs` ~50; `governance.yml` step ~5; `VERIFICATION_SURFACE` ~2 | **~87** |

Both are inside the `lite` CI budget (`diffBudget: 1000`, `governance-tiers.mjs:259`) and inside the
400-line reviewer budget. Reviewer-visible with tests: ~760 (PR 1), ~270 (PR 2).
`stacked-to-main`: PR 1 closes #905 and must land **before** branch protection is re-armed; PR 2
closes #889 and carries the exit evidence. The forecast lines belong to `sdd-tasks`.

## Maintainer acts and the D7 exit sequence

Nothing in this design arms a context; arming is a human act with an admin token.

```bash
# 1 — after PR 1 merges. Re-derives contexts from the new GATE_MATRIX (brain-protect.mjs:154-168)
npm run brain:protect
npm run brain:governance-status     # must list lane-paths and lane-scrub among the 8

# 2 — the first REAL lane PR, from this machine
npm run memory:ship                 # merged BY HAND (allow_auto_merge is false today)
#    record: PR number, the 8 green contexts, the merge SHA

# 3 — the same day, a second time, while the PR is already armed
npm run memory:ship -- --json       # step 5 re-calls mrAutoMerge unconditionally;
#    the already-armed response lands verbatim in autoMerge.reason.
#    Store it as a fixture with `recorded: true` for #886's classifier, quoted in verify.

# 4 — over the window containing that merge
npm run brain:audit                 # prints [LANE], never [FAIL]
```

**No real `memory:ship` run before step 1 reports both contexts armed.** In the window between the
merge and step 1, D1(a) is the only thing keeping a `memory/*` branch carrying code out — which is
the whole reason `issue-link` recomputes the predicate instead of trusting the branch name.

## What the apply phase must measure live (no Bash was available here)

1. `git diff --name-only A...B` vs `git diff --diff-filter=A --name-only A...B` over a **rename**,
   a modification and a deletion under `.memory/records/` — confirm the rename's new path appears
   in the first and not the second (A2's whole predicate rests on it).
2. The exact current byte range of `contributor-scaffold.mjs:274-277` and the committed
   `.github/PULL_REQUEST_TEMPLATE.md` block, so the regeneration is byte-equal.
3. `npm test` job order after appending the two jobs (the `governance-checks.test.mjs:91` order
   guard is the first thing that will complain if the append lands anywhere but the end).
4. Real counted diff via `npm run brain:governance-status` / `run-check.mjs diff-size` before
   opening each PR, against the ~277 / ~87 forecast.
5. At step 2 of D7 only: how this repo squashes (title/body) — recorded for the verify report, **not**
   depended on by A8.

## Risks and residuals

| risk | mitigation |
|---|---|
| A `memory/*` branch carrying code merges before `brain:protect` runs | D1(a)/A4 — `issue-link` recomputes the conjunction itself; the exemption never outruns its evidence |
| **Rollback trap**: reverting PR 1 stops two *required* contexts from reporting, which blocks every PR | the revert is only complete once the maintainer re-runs `npm run brain:protect` (re-deriving contexts from the reverted matrix) or removes the two contexts by hand. Same act, in reverse, as the arming — the one non-obvious step |
| The three-dot diff is uncomputable (shallow clone / vendored workflow without `fetch-depth: 0`) | `issue-link` ⇒ not a lane ⇒ loud ordinary refusal; `lane-paths` ⇒ exit 2 for a lane head, exit 0 for a non-lane head. Never a silent exemption |
| `GITHUB_HEAD_REF` absent (non-`pull_request` trigger) ⇒ `sourceBranch` null | not a lane, everywhere. `governance.yml:12-14` triggers on `pull_request` only |
| Two more required contexts block every PR if either is flaky | both offline: checkout + one `git diff` + file reads, no token, no API (A7's env rule makes that checkable) |
| `lane-scrub` on every PR is a new blocking surface for feature PRs | A6 — deliberate, matches C1's wording, one-condition revert path, raised as an open question |
| `lane-scrub` reports only the first hit per file | accepted and named — `scrubRecordsFile` is fail-fast and the merge stops either way |
| `[LANE]` swallows a genuine records-only PR with no issue link | the `Memory lane:` marker is required alongside the paths, and it is read from `issueLinkBody` — the same evidence `issueLink` would have used (A8) |
| The index-lag check dirties `index.jsonl` in CI | non-mutating by construction (A9); test 11 asserts no write |
| The L6 sentence departs from ADR-0034's 3.1d assignment | ruled in D5; #890 keeps the L7 retirements |

## Open questions

- [ ] **A6** — `lane-scrub` scanning added record paths on **every** PR, not only lane PRs. It is a
      widening of a required context beyond D3's wording, with a one-condition revert. Confirm or
      revert to D3 verbatim.
- [ ] **A3** — `LANE_BRANCH_RE` drops ADR-0034 L1's `(-\d+)?` because `plan.mjs:42` cannot produce
      it. If a suffixed ref is ever intended, the ADR and the planner must move together; this
      slice matches the planner.
