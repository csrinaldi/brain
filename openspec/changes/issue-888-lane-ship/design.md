---
status: tasked
issue: 888
---

# Design — #888 the lane ships: one push, one PR, and a credential the verb never holds

Implements `proposal.md` (D1–D6) under the ratified ruling `sdd/issue-888-lane-ship/ruling`
(2026-09-09). Parent: #864 task 3.1b, ADR-0034 **L5** with L1's body grammar
(`adr-0034-memory-travels-on-its-own-lane.md:46-59`), L2's tier-gated merge (`:66-75`) and L9's
declared `--no-verify` push (`:188-195`). Enabled by #887 (`collect`, landed `2ec28558`) and #886
(`mrAutoMerge`, landed).

## Approach in one paragraph

`shipLane()` is an orchestration function with **four** injected seams and no imports of its own
that touch the machine: `collect` (default `collectLane`, `lane/collect.mjs:199`), `git` (default
the **already-exported** `defaultGit`, `collect.mjs:44`), a **bound port object** `vcs`, and the
resolved `tier`. Everything it decides is decided from those four; everything it reports is derived
from what they returned. The credential never enters it: the `ship` op on `memory/cli.mjs` reads
`BRAIN_MEMORY_TOKEN` **once**, hands it to `getVcs({identity})` — which wraps every function export
in `runAsIdentity` (`vcs/cli.mjs:148-150,166-175`) — and passes `shipLane` the **bound port**, never
the token. The op is a dispatch block beside `collect` (`cli.mjs:306-359`), exiting before backend
selection, and it is the only user-invocable surface this slice adds.

## Module map and signatures

```
brain/scripts/memory/lane/ship.mjs
  shipLane({ root, project, tier, host, date, dryRun = false, identityBound = false,
             collect = collectLane, git = defaultGit, vcs })
    → { ref, branch, host, date, title, body,
        commit, ahead, behind, remoteRefPresent, pushed, diverged,
        pr: { number: number|null, url: string|null } | null,
        autoMerge: { enabled: boolean, reason?: string, error?: string } | null,
        collected, skipped, duplicates, baseFetched, identityBound, dryRun }
```

`vcs` is the whole bound port (`{ mrList, mrCreate, mrAutoMerge, … }`), **not** three separate
function parameters — see A2. `identityBound` is a **boolean**, never a token — see A5.

**C3 (PR 2's cold review)**: `title`/`body` are **unconditional keys** in the outcome shape, as
declared above — on the "nothing to ship" branch (`commit === null && ahead === 0`) they are
`title: null, body: null`, never simply absent. This was a real gap introduced by the cold-1 fix
(PR #902's review): deferring `buildTitleAndBody()` past the nothing-to-ship check (so a ref that
never existed is never diffed) left that branch's `return` without a `title`/`body` key at all,
contradicting this module map. `null` communicates "nothing to derive a title from" without making
key-presence itself the signal a caller has to special-case.

## Architecture decisions

### A1 — The sequence, and the predicate for "nothing to ship"

```
0 resolve     branch = ref.replace(/^refs\/heads\//,'')      ← after step 1, from collect's own ref
1 collect     collect({ root, host, date, git })             → { ref, commit, collected, … }
2 survey      tip     = git rev-parse --verify --quiet <ref>          → null ⇒ NOTHING TO SHIP
              fetch   = git fetch origin +refs/heads/<branch>:refs/remotes/origin/<branch>
              behind  = git rev-list --count <ref>..refs/remotes/origin/<branch>   (0 if absent)
              ahead   = git rev-list --count refs/remotes/origin/<branch>..<ref>   (all if absent)
              commit === null && ahead === 0  ⇒  NOTHING TO SHIP, exit 0, zero further calls
              behind > 0                      ⇒  diverged, exit 1, nothing else runs
3 push        git push --no-verify origin refs/heads/<branch>:refs/heads/<branch>
                                                              — NEVER --force, NEVER +
4 find        vcs.mrList({ project, state: 'open' })  →  find r.headBranch === branch
5 create      absent ⇒ vcs.mrCreate({ project, title, body, head: branch, base: 'main', labels: [] })
              number = trailing integer of url; on no match, ONE mrList re-scan
6 arm         vcs.mrAutoMerge({ project, number, requiredReviews: tierParams(tier).requiredReviews })
```

**Choice**: "nothing to ship" is `commit === null` **and** the local ref is not ahead of origin —
not `commit === null` alone.
**Rejected**: D2's literal predicate (`commit === null ⇒ exit 0, no push`).
**Rationale**: D2's form makes a **failed push permanently unrecoverable inside the same day**. A
run whose push fails on a flaky network leaves a local ref with unpushed commits; the next run
collects nothing new (`collect` returns `commit: null` because the tree already matches the ref's
tip, `collect.mjs:289-293`), exits before the push, and those records stay on the machine until the
date rolls over. That is exactly the learn→main latency ADR-0034 exists to remove, reintroduced by
the idempotency guard. The refined predicate keeps every one of D2's assertions true — with no local
ref, or with a ref already equal to origin, `ahead === 0` and the run still makes zero push/port
calls. **The proposal's success criterion needs the qualifier**: "`commit: null` ⇒ exit 0, no push"
holds *when the ref is not ahead of origin*, and `sdd-tasks` must carry the qualified form.

### A2 — Inject the bound PORT object, not three functions

**Choice**: one `vcs` parameter carrying the object `getVcs()` returned.
**Rejected**: `{ mrList, mrCreate, mrAutoMerge }` as three parameters (proposal D1's literal shape).
**Rationale**: `bindIdentity` wraps the module **exhaustively rather than by a list of verb names**,
and says why in its own words (`vcs/cli.mjs:156-161`): the hand-maintained list is the shape that
failed on #413. Destructuring the port into three parameters at the ship seam rebuilds that list one
layer up — a fourth verb tomorrow is a parameter someone must remember. Test ergonomics are
unchanged: a fake is the object literal `{ mrList: async () => [], … }`, exactly as plain as
`brain-ship.test.mjs:37-40`'s function fakes.

### A3 — The push argv, and why divergence is safe before it is checked

**Choice**: `git push --no-verify origin refs/heads/<branch>:refs/heads/<branch>` — full ref on both
sides, no `--force`, no leading `+`.
**Rejected**: ADR-0034 L4's sketch form `<commit>:refs/heads/memory/<host>-<date>` (`:114`).
**Rationale**: the sketch is the *collector's*, written when a run always had a fresh commit sha to
name. A1's recovery case has none — only a ref that is ahead — so the ref-to-ref form is the single
form that covers both, and it is what the CAS in `collect.mjs:320` just moved. Full refs on both
sides remove any tag/branch ambiguity in the source.

**Divergence is refused by git, not by us.** A non-fast-forward push without `--force` is rejected
by git itself; the step-2 pre-check exists to produce an *honest report*, not to provide the safety.
So a fetch that fails for a reason other than an absent remote ref (offline, transport) degrades
like `collect`'s `baseFetched` — `behind: null`, the run proceeds, and the push's own stderr is the
authoritative classifier: `/non-fast-forward|fetch first|rejected/` ⇒ `diverged`, anything else ⇒
`pushFailed`. An absent remote ref is recognised from fetch stderr (`/couldn't find remote ref/`)
and means `remoteRefPresent: false`, `behind: 0` — the push is a create.

**Why `--no-verify` is the correct absence of a hook, restated with the measurement.** `pre-push`
(`hooks/pre-push:70,90,93`) runs `memory:share` — which re-materializes `.memory/` **in whatever
worktree the push is issued from** — then `feature-checkpoint`, then `check-refs.mjs`, which
`exit 1`s hard. None of the three has anything to say about a *computed* ref that was never checked
out, and the first would mutate an unrelated tree in the middle of a ship. ADR-0034 L9 (`:188-195`)
rules it; the `PreToolUse` guard still blocks a hand-typed `git push --no-verify` in a Bash tool
call, so `npm run memory:ship` is the only sanctioned route.

### A4 — Title, body, and the record list: derived from the ref, never re-derived from the clock

**Choice**: parse `branch` with `/^memory\/(?<host>[a-z0-9][a-z0-9-]*)-(?<date>\d{4}-\d{2}-\d{2})(?:-\d+)?$/`
— L1's own grammar (`adr-0034:49`), tolerating its optional `-\d+` suffix — and build:

```
title: memory lane: <host> <date>
body:  Memory lane: <host> <date>
       Records: <n>
       - .memory/records/<file>.jsonl        (one line per path, sorted)
```

`n` and the list come from **one** source: `git diff --name-only origin/main...<ref>` (three-dot,
matching what the forge's own PR diff shows). `n` is `paths.length`, never `collected` — #887 hit
exactly this and left the reason in the code (`collect.mjs:298-310`: `collected` counts *this run's*
additions, not the lane's).
**Rejected**: recomputing `host`/`date` from `hostname()`/`new Date()`. A second clock read can cross
midnight and name a PR after a ref that does not exist — 887's A4 rationale, one layer up.
`labels: []` is passed **explicitly** so the "a lane carries no label" claim is readable at the call
site.

**Measured, and it settles the open question for #889**: no CI gate requires a `type:*` label. The
governance surface has exactly four checks — `memory-gate`, `decision-gate`, `issue-link`,
`diff-size` (`run-check.mjs:454-459`) — none reads a `type:*` label; `type:*` is applied by
`brain-ship` at creation (`brain-ship.mjs:152-190`) and never demanded by a check. `diff-size` reads
labels only for `size:exception` (`run-check.mjs:405-412`), and `.memory/**` is in
`governance.ignoreList` (`brain.config.json:21`), so a lane PR of any size passes it unlabelled.
**#889 therefore needs no label exemption**; its work is `issue-link` + `actor-check` recognition
and the two required contexts, unchanged.

**Residual, stated not hidden**: the body is written **once**, at `mrCreate`. A same-day re-run
appends commits to a PR whose body still lists the first run's paths. Updating it would need an
`mrUpdate`/`mrEdit` verb — new port surface, out of scope (D6). The PR's own diff is authoritative
and the body says so by being evidence for a human, not an oracle for a gate (L1).

### A5 — The credential: read once in the op, threaded as a binding, never as a value

**Choice**: `MEMORY_TOKEN_ENV = 'BRAIN_MEMORY_TOKEN'` is exported from `lib/credential-env.mjs` and
added to `credentialEnvNames()`'s **default** set (`credential-env.mjs:135-138`). The `ship` op does:

```js
const identity = process.env[MEMORY_TOKEN_ENV] ?? null;   // ONE read, in ONE place
const vcs = dryRun ? null : await getVcs({ config, identity });
await shipLane({ …, vcs, identityBound: identity !== null });
```

**Test seam (added during implementation, cold-reviewed twice)**: `cli.mjs`'s `ship` op is the only
in-process caller of `getVcs()`, and it has no seam of its own reachable through a CLI subprocess —
so `BRAIN_VCS_TEST_MODULE` lets a test point it at a fake port module instead, constrained by
`resolveVcsTestModulePath()` to resolve inside a committed `__fixtures__/` directory before any
`import()` is attempted. Containment is checked against the **real path** (`realpathSync`, with a
best-effort fallback to the lexical path when the target does not exist), not the lexical one — a
symlink planted inside `__fixtures__/` pointing outside it would otherwise pass a lexical-only
check while `import()` still follows the link (re-review finding M1). A set-but-blank value is
refused rather than silently falling through to the real port (L1); the fixture module's own
`BRAIN_VCS_TEST_SCRIPT` data file never echoes its content on a parse failure (L2). See `cli.mjs`'s
own comment above `resolveVcsTestModulePath()` and `__fixtures__/fake-vcs-port.mjs`.

**Rejected**: passing `identityToken` into `shipLane`.
**Rationale**: once `getVcs` has bound the port, the token has no remaining job — `bindIdentity`
carries it in an `AsyncLocalStorage` frame (`vcs/lib/identity-context.mjs:28,41-44`) and
`ghOpts()` turns it into `GH_TOKEN` on the wire at the single chokepoint
(`providers/github.mjs:62-66`). Handing the string to `shipLane` as well would put a live credential
in the scope of the function that builds the result object, one careless spread away from stdout.
With `identityBound: boolean`, the leak-regression test is a **structural** claim, not a hopeful
one: the token string is never in `ship.mjs`'s scope at all. `identity: null` falls through to
`_token(name)` = the generic `VCS_TOKEN`, else the ambient `gh` session — L5's `lite` developer path
(`adr-0034:143-147`).

**The pinned test moves by one name.** `credential-env.test.mjs:92-101` pins the set as a **sorted
name list**, not a count (its own comment says why: *"a test asserting `=== 8` goes green on a
rename"*). `'BRAIN_MEMORY_TOKEN'` sorts **first**, before `'BRAIN_REVIEWER_TOKEN'`; the array goes
from 8 entries to 9. That single edit is the intended red-then-green signal, and no other test or
prose in the tree pins the count numerically.

### A6 — Which failures are fatal, and why the two transport failures differ

| step | outcome | exit | key |
|---|---|---|---|
| `collect` throws (`raced` / `badHost` / git) | nothing shipped | 1 | `memory.ship.failed` (+ `raced`/`badHost` passthrough) |
| nothing to ship (A1's predicate) | no push, no port call | 0 | `memory.ship.nothing` |
| `--dry-run` | plan only, `pushed:false`, `pr:null` | 0 | `memory.ship.dryRun` |
| push rejected non-fast-forward | **nothing forced** | 1 | `memory.ship.diverged` |
| push failed otherwise | ref stays local | 1 | `memory.ship.pushFailed` |
| **`mrList` throws** | pushed; PR existence **uncomputable** | **1** | `memory.ship.prLookupFailed` |
| `mrCreate` → `{url:null,error}` | pushed, no PR | 1 | `memory.ship.prCreateFailed` |
| PR number underivable after re-scan | PR open, unarmable | 1 → **0** | `memory.ship.prNumberUnknown` |
| `mrAutoMerge` refuses — **any** reason | PR open, correct | **0** | `memory.ship.autoMergeRefused` |
| armed | done | 0 | `memory.ship.done` |

**Choice**: `mrList` failure is fatal; `mrAutoMerge` failure never is.
**Rationale, and it rests on a measurement**: the port's never-throws discipline does **not** cover
`mrList`. `github.mjs:458` calls `ghJson` → `runJson`, which **throws** on non-zero exit
(`vcs/lib/exec.mjs:39-43`); `gitlab.mjs:614` is the same shape. `mrCreate` and `mrAutoMerge` each
catch (`github.mjs:593-595,631-644`), `mrList` does not. So `shipLane` must wrap step 4 — and when
that lookup fails, the precondition for a **mutating write** is unreadable and creating a PR blindly
risks a duplicate. Fail closed, exit 1, retry next run: the push already landed and is durable. A
refused `mrAutoMerge`, by contrast, leaves a correct open PR that the very next run re-arms (step 6
is unconditional, D2), so failing the ship on it would convert a self-healing state into a red exit.

**Reconciled during apply (#901):** this table originally listed "PR number underivable after
re-scan" as exit 1. `spec.md`'s own scenario for the identical case ("both derivations fail, arm is
skipped") says exit 0. The implementation follows `spec.md`: the state self-heals the same way an
`mrAutoMerge` refusal self-heals one row below — the very next run's `mrList`-based idempotent find
recovers `number` without any manual intervention, so treating it as fatal would convert a
self-healing state into a red exit for no operational gain. This row is corrected to exit 0 above.

### A7 — `--dry-run` means zero **mutating** calls, and D5's wording gets a qualifier

Under `dryRun`, the op passes `vcs: null` and `shipLane` reaches steps 3–6 **never** — proven by the
unit test passing `vcs: null` plus a `git` fake that throws on any argv containing `push`. Its own
`git fetch` of the lane is skipped too (`behind: null`, `remoteRefPresent: null`).

**But `collect` still runs**, because D5 says a dry run collects and reports the plan — and `collect`
makes its own best-effort `git fetch origin main` (`collect.mjs:211`) and writes blobs and moves a
local ref. So the honest form of D5's criterion is **"zero network calls *of ship's own*, and no
push"**, not "zero network calls". Flagged here so `sdd-verify` checks the claim that is true.

## Data flow

```
memory/cli.mjs "ship"                                     [before backend selection]
  │  loadBrainConfig() → project.slug, vcs.provider, governance.tier
  │  identity = process.env.BRAIN_MEMORY_TOKEN ?? null            ← ONE read
  │  vcs = dryRun ? null : await getVcs({ config, identity })     ← bindIdentity wraps every export
  ▼
lane/ship.mjs shipLane({ root, project, tier, dryRun, identityBound, collect, git, vcs })
  │
  ├─ collect ──→ lane/collect.mjs  ── git ──→ refs/heads/memory/<host>-<date>   (local)
  ├─ git ──────→ fetch / rev-list / push --no-verify ──→ origin                 (remote ref)
  ├─ git ──────→ diff --name-only origin/main...<ref> ──→ the body's record list
  └─ vcs ──────→ mrList → mrCreate → mrAutoMerge      ──→ the PR, armed or refused
                    ▲
                    └── every call runs inside runAsIdentity(<token>) — nothing here holds it
```

## Output and exit contract

Follows `collect` (`cli.mjs:306-359`) exactly: human i18n lines on stdout, `--json` prints the
result object on stdout **instead**, evidence always on stderr (`reportDuplicates(result.duplicates,
{ surface: 'the lane commit' })`, plus `memory.collect.offline`-style notes), so `--json` stdout
stays parseable. `--dry-run` and `--json` are read from `process.argv.slice(3)` — E4's scoping
(`cli.mjs:309-314`), never bare `process.argv.includes`.

**i18n — 14 keys in `en.mjs` and `es.mjs` in the same commit** (`coverage.test.mjs` fails `npm test`
on a missing Spanish entry): `memory.ship.` + `done` · `nothing` · `dryRun` · `pushed` ·
`prExisting` · `armed` · `autoMergeRefused` · `identityAmbient` · `diverged` · `pushFailed` ·
`prLookupFailed` · `prCreateFailed` · `prNumberUnknown` · `failed`.

## File changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/memory/lane/ship.mjs` | Create | `shipLane` — survey, push, find/create, arm; pure title/body builders (~200) |
| `brain/scripts/memory/lane/ship.test.mjs` | Create | unit, all fakes (~260, uncounted) |
| `brain/scripts/memory/lane/ship.integration.test.mjs` | Create | temp repo + bare origin, real push, fake port (~240, uncounted) |
| `brain/scripts/memory/cli.mjs` | Modify | `"ship"` in `VALID_OPS` (`:103-119`) + a dispatch block after `collect` (`:359`) (~60) |
| `brain/scripts/memory/cli.ship.test.mjs` | Create | the op end to end under `BRAIN_MEMORY_TEST_ROOT` (~180, uncounted) |
| `brain/scripts/lib/credential-env.mjs` | Modify | `MEMORY_TOKEN_ENV` + default-set membership (~14) |
| `brain/scripts/lib/credential-env.test.mjs` | Modify | the pinned name list 8 → 9, + the leak regression (~25, uncounted) |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modify | `memory.ship.*` × 14, shape of `en.mjs:319-327` (~30) |
| `package.json` | Modify | `"memory:ship": "node ./brain/scripts/memory/cli.mjs ship"` |
| `lane/collect.mjs`, `lane/plan.mjs`, `vcs/**`, `hooks/**`, `.claude/settings.json`, `brain/core/**` | **Untouched** | D4/D6 — no trigger, no port change, no doctrine write |

## Testing strategy — STRICT TDD, red before green, in this order

| # | Layer | File | Asserts |
|---|---|---|---|
| 1 | unit | `lane/ship.test.mjs` | `commit:null` + `ahead:0` ⇒ zero push/list/create/arm; **`commit:null` + `ahead:1` ⇒ the run pushes and opens/arms** (A1's recovery case); PR already open by `headBranch` ⇒ `mrCreate` never called, `mrAutoMerge` still called; `behind>0` ⇒ `diverged`, exit 1, zero port calls; push argv contains `--no-verify`, and `--force`/`+` appear on **no** argv and in no source line; `requiredReviews:1` ⇒ refusal reported, result exit 0; **every** `mrAutoMerge` refusal reason is non-fatal; `mrList` throwing ⇒ fatal, `mrCreate` never called; number from `…/pull/123` and `…/-/merge_requests/12`, unparseable url ⇒ one re-scan ⇒ `number:null` + no arm; title/body match L1's grammar byte for byte and `Records:` equals the path count |
| 1a | unit | " | `dryRun:true` with `vcs: null` and a `git` fake that **throws** on any `push`/`fetch` argv completes and returns `pushed:false, pr:null` |
| 1b | unit | " | the result object, JSON-stringified, contains no value of `BRAIN_MEMORY_TOKEN` under either credential path (`identityBound` is a boolean) |
| 2 | unit | `lib/credential-env.test.mjs` | the pinned sorted list gains `'BRAIN_MEMORY_TOKEN'` at index 0 (8 → 9); `withoutCredentials` strips it from a spawned child's env by **default**, with no `extra:[]` |
| 3 | integration | `lane/ship.integration.test.mjs` | `testTmp('brain-lane-ship-')` + bare origin + real `git` + recording fake port: the ref lands on the remote with the expected tree; a second same-day run **fast-forwards** and opens **no** second PR (`mrCreate` call count stays 1); a remote ref moved behind our back ⇒ `diverged`, exit 1, remote sha **unchanged**; a killed push (remote ref absent, local ref ahead) recovers on re-run |
| 3a | integration | " | the main checkout's `git status --porcelain -uall` and `rev-parse HEAD` are byte-identical before and after (the ship touches no working tree) |
| 4 | cli | `memory/cli.ship.test.mjs` | under `BRAIN_MEMORY_TEST_ROOT` with `cli.collect.test.mjs:44-71`'s bare-origin fixture — **network-free by construction**: exit 0 + `nothing`; `--dry-run` prints the plan, `--json` parses on stdout only; a pre-seeded divergent origin lane ⇒ exit 1 + `diverged` (this path never reaches the port); `BRAIN_MEMORY_TOKEN=<sentinel>` appears in neither stdout nor stderr on any path; `memory:ship` resolves from `package.json` |
| 5 | i18n | `i18n/coverage.test.mjs` | unmodified — green only once both catalogs carry all fourteen keys |

```bash
node --test brain/scripts/memory/lane/ship.test.mjs
node --test brain/scripts/lib/credential-env.test.mjs
node --test brain/scripts/memory/lane/ship.integration.test.mjs
node --test brain/scripts/memory/cli.ship.test.mjs
node --test brain/scripts/i18n/coverage.test.mjs
npm test                                                    # before handing over
```

## Changed-line forecast and the delivery recommendation

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**`; the counter is
additions **+** deletions.

| counted path | lines |
|---|---|
| `brain/scripts/memory/lane/ship.mjs` | ~200 |
| `brain/scripts/memory/cli.mjs` (dispatch block + `VALID_OPS`) | ~60 |
| `brain/scripts/i18n/en.mjs` + `es.mjs` (14 keys × 2) | ~30 |
| `brain/scripts/lib/credential-env.mjs` | ~14 |
| `package.json` | ~1 |
| **counted total** | **~305 — Medium risk** (~24 % headroom) |
| uncounted, reviewer-visible: 3 new test files + one extension | ~705 |

**Recommendation: ONE PR, with the proposal's split line pre-agreed.** ~305 is inside the 400
budget; the design's decisions (A6's ten-row exit table, A4's body builder, four more i18n keys than
the proposal assumed) raised it from ~258 without crossing. If apply overruns, split exactly where
A2/A5 already draw the seam:

| slice | contents | counted | rollback |
|---|---|---|---|
| **PR 1 — the library** | `lane/ship.mjs`, `lib/credential-env.mjs`, tests 1–3 | ~214 | delete one file, revert one denylist entry; nothing is invocable |
| **PR 2 — the verb** | `memory/cli.mjs`, both i18n catalogs, `package.json`, test 4 | ~91 | revert the PR; the op disappears, PR 1 stays inert and green |

Chain strategy if it splits: **stacked-to-main**, per the epic's rule that each slice is its own PR
to `main` (`archive/862/design.md:240-241`).

## Migration / rollout

None. No config key, no state file, no hook, no CI context, no caller — **by design (D4)**: nothing
invokes `npm run memory:ship` until #889. A run's durable side effects are a remote branch and
possibly a PR; `git push origin --delete memory/<host>-<date>` plus closing the PR removes both.
The only new default is one env-var name in a **denylist**, whose failure mode after a revert is a
scrub that removes one variable too few — no credential is granted by it.

## Risks and residuals

| risk | mitigation |
|---|---|
| **Re-arming an already-armed PR may return a refusal — still UNMEASURED.** No Bash tool was available in this phase, so `gh pr merge --help` could not be probed | `mrAutoMerge` never throws and **no** refusal reason is fatal (A6). The reason is reported verbatim in `autoMerge.reason` and the next run re-arms. **#889 must record the observed stderr on the first real lane PR** |
| **`mrList` reads ONE page**: `per_page=100` with no `--paginate` (`github.mjs:458`), `per_page=50` on GitLab (`gitlab.mjs:614`). Past that page an open lane PR is invisible and a **duplicate** PR is created | Named as a scan, not a lookup. Holds at this repo's scale; widening it is port surface, not this slice's. A duplicate is visible, closable by hand, and cannot double-merge — both PRs carry identical additive records, so the second squash is a no-op |
| **The merged-lane residual.** After a squash merge the merge base is unchanged, so a same-day re-run's PR re-lists already-merged records | Harmless **by construction**: identical bytes, still additions under `.memory/records/`, so `lane-paths` still passes and the merge adds nothing. Reported, never silently absorbed. Pruning merged lane refs is `day:start` sweep work (#889/#890); this slice **never** deletes a ref |
| The body's record list is a first-run snapshot on a re-run (A4) | Accepted: no `mrUpdate` verb exists and inventing one is out of scope (D6). The PR diff is authoritative; the body is evidence for a human (L1) |
| `BRAIN_MEMORY_TOKEN` widens the surface ADR-0033 narrowed (the ADR's own Risk 5, `adr-0034:149-152`) | Default membership in `credentialEnvNames()` + the 8→9 pinned list + a leak regression; the token is read once, never enters `shipLane`'s scope (A5) |
| A lane PR opened by hand before #889 is refused by `issue-link` and lingers | No automatic trigger ships here (D4); `--dry-run` is the documented pre-#889 exercise; the stale PR is closed by hand |
| `--no-verify` reads as a governance bypass | ADR-0034 L9 rules it, and A3 names the three things it skips and why each has nothing to check. The `PreToolUse` guard still blocks a hand-typed one |
| The verb ships and nothing calls it | Intended (D4), same as #887. `npm run memory:ship` makes it provable before its callers exist |

## Open questions

- [ ] **The ticket body of #888 was never read.** This phase had no Bash tool, so
      `gh issue view 888` could not be run — the proposal phase hit the same wall. Every requirement
      here is derived from ADR-0034, `archive/862/{design,spec}.md` and the ratified ruling. If the
      ticket carries an acceptance criterion those three do not, it is unrepresented. **`sdd-tasks`
      or `sdd-apply` must read it and reconcile before implementing.**
- [ ] `gh pr merge --auto` idempotency (Risk 1) — unmeasurable here, mitigated rather than resolved;
      the first real lane PR (#889's exit criterion) measures it.
