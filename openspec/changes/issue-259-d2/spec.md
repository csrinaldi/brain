# Spec Delta — Rung-3 Auto-Revert Guardrails (Track D / slice D2)

> Hardens `.github/workflows/governance-postmerge.yml` + `brain/scripts/brain-audit.mjs` (shipped by
> #144/governance-v3). **Spec v2** — amended in place per design v2 (`design.md`, engram
> `sdd/issue-259-d2/design` #881) and the owner ruling that **REPLACED R-1** (engram
> `decision/issue-259-d2-R1-replacement-tree-effect` #901): automatic resolution of a flagged offender is
> proved by **TREE EFFECT ONLY** (REQ-D2-10) — never by a commit trailer, ancestry
> (`merge-base --is-ancestor`), an author identity, a signature, or a branch name. The **only** other
> resolution path is the recorded human gate (`accept --reason`, REQ-D2-10). This supersedes any
> trailer/dual-path detail from the prior checkpoint rulings (engram #886), which are withdrawn where they
> conflict. Cursor state is remote-authoritative tri-state (`present`/`absent`/`unknown`, REQ-D2-2/11) and
> the audit window is `cursor..HEAD` on **every** trigger (REQ-D2-1). Emission = stdout `[FAIL-SHA] <sha>`
> via one shared parser (REQ-D2-5). Exit contract = 0 pass / 1 violation / 2 uncomputable-infra, fail-closed
> (REQ-D2-6/7/12). Chain = **5 PRs stacked to `feature/v2.0.0`**, each <400 counted lines, no
> `size:exception` (design §9.2 — see Gate). Every security-relevant scenario below follows the
> adversarial-test doctrine (engram `doctrine/adversarial-test-derivation` #900, REQ-D2-14): each fixture is
> derived from the attack and MUST redden against the prior ancestry-only fix (commit `eff4560`), not
> merely against un-fixed code. See [proposal.md](proposal.md) / [design.md](design.md) / [tasks.md](tasks.md).
> Cross-cutting: every requirement is written GitLab-port-ready — nothing below may be born GitHub-coupled.

## REQ-D2-1: The audit window is ALWAYS `cursor..HEAD`; the advance is a CAS from that same cursor value

(Previously: the window derived from the cursor only on `schedule` runs, with `push` falling back to
`github.event.before` — two different intervals for the audited range and the advanced range.)

On **every** trigger (push AND schedule) the audit window MUST resolve as `cursor..HEAD`. The workflow MUST
NOT read `github.event.before` and MUST NOT special-case push vs. schedule. The cursor value used to
resolve the window MUST be the exact value threaded into the advance step (`from`, §REQ-D2-15), so the
audited interval and the advanced interval are the same interval **by construction**. A run MUST advance
the cursor only when the window resolved to `present` (§REQ-D2-2) and the audit reaches exit 0; a run that
reverts an offender, exits 1, or exits 2 MUST NOT advance the cursor.

#### Scenario: a tag move does not drop a present offender

- GIVEN a persisted cursor at SHA C and an offending merge M landing after C
- WHEN a release tag is advanced past M before the next audit run
- THEN the run's audit window still starts at C (not the tag) and includes M

#### Scenario: the audited interval and the advanced interval are identical by construction (skip-over fix)

- GIVEN cursor at C, offender M lands (exit 1, cursor pinned at C), then a clean merge P2 lands
- WHEN the next run resolves its window
- THEN the window is exactly `C..P2` (still containing M, never `M..P2`) — the run exits 1 again and the
  cursor does not advance past M, because push and schedule share the identical `cursor..HEAD` resolution
  with no `github.event.before` special case

#### Scenario: the advance is CAS'd from the exact value the window was audited from

- GIVEN a run whose window resolved from cursor value C
- WHEN the audit reaches exit 0
- THEN the advance uses `from=C` (§REQ-D2-15) — never a different or inferred base

## REQ-D2-2: Cursor state is a remote-authoritative tri-state — present / absent / unknown

(Previously: cursor state was read via local `git rev-parse` only, collapsing three distinct worlds —
present-and-fetched, absent-on-origin, present-but-never-fetched — into a single present/missing binary.)

After the explicit fetch (§REQ-D2-11), cursor state MUST be determined by `git ls-remote --exit-code` as
the authority, never by a local-only `rev-parse`. The result MUST be one of three states: `present` (origin
has the ref AND the local ref resolves after fetch) → audit `cursor..HEAD`; `absent` (`ls-remote --exit-code`
returns status 2, git's documented "no matching refs") → exit 2, a labeled `governance:cursor-missing`
issue containing the exact init command, never audit, never revert, never auto-create; `unknown` (any other
`ls-remote` status, OR origin reports present but the local ref fails to resolve after a successful fetch)
→ exit 2, a labeled `governance:cursor-unknown` issue with **no** init command, never audit, never revert.
`absent` and `unknown` MUST NEVER be conflated.

#### Scenario: absent cursor is proven, not guessed

- GIVEN a bare origin with no cursor ref
- WHEN `readCursor` resolves state after the explicit fetch
- THEN it returns `absent` (`ls-remote` exit code 2) and the workflow opens the `governance:cursor-missing`
  issue with the init command — never auto-creates the ref

#### Scenario: a never-fetched-but-present ref is not reported as absent (the tautological-test trap)

- GIVEN a bare origin repo with the cursor ref SET on it, cloned via a plain `git clone` that (exactly like
  `actions/checkout`) fetches only `refs/heads/*` + tags — first, a local `rev-parse` against the unfetched
  ref FAILS, reproducing the exact production shape the prior fix could not distinguish
- WHEN `readCursor` runs after the explicit `refs/governance/*` fetch
- THEN it returns `present` — proving the state machine distinguishes "correctly gated because truly
  absent" from "the ref was simply never fetched, so every run would wrongly bootstrap"

#### Scenario: an unreachable origin resolves to unknown, never absent

- GIVEN an origin URL pointing at a nonexistent path (network/auth unreachable)
- WHEN `readCursor` attempts `ls-remote --exit-code`
- THEN it returns `unknown` (not `absent`) → exit 2 with the `governance:cursor-unknown` issue and no init
  command

## REQ-D2-3/4: Revert idempotency is keyed on the PR, with orphan-branch cleanup on failed creation

(Previously: dedup keyed on offender SHA via branch-existence check, with no stated cleanup for a branch
left behind by a failed `gh pr create`.)

`brain-audit.mjs` MUST print one `[FAIL-SHA] <full-sha>` line per offending merge to stdout, additive to
the existing `[FAIL]`/`[PASS]` output. The auto-revert loop MUST key idempotency on the **PR**, not the
branch: `gh pr list --head "auto-revert/<full-sha>" --state all`. If `gh pr create` fails after the branch
was pushed, the workflow MUST delete the pushed branch so no orphan branch can permanently suppress a
retry. A revert PR a human closed without merging (`--state all`) MUST NOT be re-opened or duplicated —
the offender stays flagged until a genuine revert or `accept --reason`.

#### Scenario: a failed PR creation does not leave an orphan that suppresses retries

- GIVEN `gh pr create` fails for offender O's auto-revert branch after the branch is pushed
- WHEN the loop handles the failure
- THEN the pushed branch is deleted and O is recorded as failed so the next cycle can retry cleanly — no
  orphan branch survives to permanently suppress it

#### Scenario: distinct offenders get distinct branches

- GIVEN two different offending SHAs O1 and O2 detected in separate cycles
- WHEN both are processed
- THEN each gets its own uniquely offender-keyed branch, with no collision between them

#### Scenario: closing a revert PR without merging does not clear the offender

- GIVEN a human closes the auto-revert PR for offender O without merging it
- WHEN a later cycle re-evaluates O
- THEN `--state all` finds the closed PR and neither reopens it nor creates a new one — O remains flagged

## REQ-D2-5: One shared, tested parser function — no inline YAML grep

(Unchanged.)

Parsing of `[FAIL-SHA]` lines MUST live in exactly one tested function, consumed by both the GitHub
wrapper (today) and the future GitLab wrapper. No workflow YAML may contain inline shell grep/parsing of
the marker.

#### Scenario: the GitHub wrapper consumes the shared parser

- GIVEN `brain-audit` stdout containing `[FAIL-SHA]` lines
- WHEN `governance-postmerge.yml` needs the offender list
- THEN it calls the shared parser function — no inline grep appears in the YAML

#### Scenario: the parser is platform-agnostic and independently testable

- GIVEN the shared parser module
- WHEN it is unit-tested against synthetic stdout outside any CI runner
- THEN it returns the correct SHA list with zero GitHub-Actions-specific dependency

## REQ-D2-6: The 0/1/2 exit contract is fail-closed on every unmapped or inconsistent outcome

(Previously: 0/1/2 wired via captured numeric exit code, with only a narrow `brain-audit`
range-uncomputable → exit-2 site carved out; the general cross-evaluator contract and normalization rules
were deferred.)

Every evaluator and `brain-audit.mjs` MUST exit 0 (pass), 1 (violation, with ≥1 `[FAIL-SHA]` line on
stdout), or 2 (uncomputable-infra). The workflow MUST branch on the captured NUMERIC exit code, never an
Actions boolean `outcome`. In addition: (a) any exit code outside `{0,1,2}` (3+, 127, SIGKILL/137, empty)
MUST be normalized to 2 before branching; (b) `code == 1` MUST correspond to ≥1 parsed `[FAIL-SHA]`
offender — zero offenders parsed on code 1 is itself uncomputable and MUST resolve to exit 2, never a
silent no-op; (c) a final `if: always()` terminal-state assertion step MUST fail the job unless the
captured exit code is exactly 0, 1, or 2 — including the case where the audit step was killed and produced
no output at all.

#### Scenario: exit 1 drives the revert path only

- GIVEN `brain-audit` exits 1 with `[FAIL-SHA]` lines
- WHEN the workflow reads the captured numeric exit code
- THEN it proceeds to the revert path and opens no infra issue

#### Scenario: exit 2 opens a loud issue and never reverts

- GIVEN `brain-audit` exits 2 (e.g., an uncomputable git range)
- WHEN the workflow reads the captured numeric exit code
- THEN it opens a labeled infra-alert issue and performs no revert, even if stray `[FAIL-SHA]`-like text is
  present in stdout

#### Scenario: an unmapped exit code is normalized to 2, never silently ignored

- GIVEN the audit step exits with code 137 (SIGKILL) or produces no output at all
- WHEN the workflow evaluates the captured code
- THEN it is normalized to 2 before branching and the terminal-state assertion step fails the job — this
  MUST redden against a workflow with no `case … *)` catch-all arm, where an unmatched `if:` condition
  skips every step and the job goes green

#### Scenario: zero parsed offenders on code 1 is treated as uncomputable, not a silent pass

- GIVEN `brain-audit` exits 1 but the parser returns zero SHAs (a crash mid-emission)
- WHEN the workflow cross-checks the count against the exit code
- THEN it treats the run as uncomputable (exit 2, loud issue) rather than reverting nothing and going green

## REQ-D2-7: Drift-guard asserts every evaluator implements 0/1/2 with both fixtures

(Unchanged.)

A drift-guard test MUST assert every check/evaluator exits only 0/1/2 (a binary 0/1 implementation fails
CI) and MUST require each check to ship BOTH a violation (→1) fixture and an uncomputable (→2) fixture.

#### Scenario: a binary 0/1 evaluator fails the drift-guard

- GIVEN a hypothetical evaluator exiting only 0 or 1
- WHEN the drift-guard test runs
- THEN it fails, naming the evaluator missing the 2 path

#### Scenario: an evaluator missing its exit-2 fixture fails the drift-guard

- GIVEN an evaluator with correct 0/1/2 logic but no fixture exercising its 2 path
- WHEN the drift-guard runs
- THEN it fails, naming the missing fixture

## REQ-D2-8: Fixtures are 100% synthetic — no real fossils

(Unchanged.)

All D2 regression fixtures MUST be synthetic git ranges/data hand-built to reproduce each failure shape.
Fixtures MUST NOT replay or reference the real historic fossils (re-measured: 168 closed PRs, 0 with an
`auto-revert/*` head).

#### Scenario: a synthetic fixture is RED under pre-fix behavior

- GIVEN a synthetic fixture reproducing a target defect
- WHEN run against the pre-fix code
- THEN it fails (RED), proving the bug shape without referencing real repo history

#### Scenario: no fixture derives from real fossils

- GIVEN the full D2 fixture suite
- WHEN audited for provenance
- THEN none reference or replay the deleted real auto-revert branches or real closed-PR history

## REQ-D2-9: GitLab-porting constraint is drafted, never committed to the doc zone by this PR

(Unchanged.)

D2 MUST author a draft under `openspec/changes/issue-259-d2/brain-drafts/` stating that rung-3
auto-revert must not be ported to GitLab until D2's fixes land, and that the GitLab port covers PR-time
gates (`GOVERNANCE_JOBS`) only. The D2 PR MUST NOT commit this constraint to the doc zone
(ADR/`brain/core/`/PLAN); a human co-promotes it via a separate MR (pattern #216).

#### Scenario: the draft exists in the drafts zone

- GIVEN D2 is complete
- WHEN `openspec/changes/issue-259-d2/brain-drafts/` is inspected
- THEN it contains the GitLab-porting-constraint draft document

#### Scenario: the doc zone shows zero changes from D2

- GIVEN the D2 PR diff
- WHEN any ADR, `brain/core/`, or PLAN file is inspected
- THEN it shows zero changes attributable to D2 — any such change is a STOP-finding

## REQ-D2-10 (NEW): Automatic revert resolution MUST be proved by tree effect only

Automatic resolution of a flagged offender MUST be proved by **tree effect ONLY**: the offender's touched
paths are byte-identical at HEAD to their pre-offender state (`P ∩ D = ∅`, design §3.2), subject to the
anti-vacuity guard — an offender with an EMPTY changed-path set MUST NOT be auto-resolved; it is refused,
loudly, as `not resolved`. A commit trailer (`This reverts commit <sha>.`), ancestry
(`git merge-base --is-ancestor`), an author identity, a cryptographic signature, or a branch name (e.g.
`auto-revert/*`) MUST NEVER be sufficient to resolve an offender automatically — not as a hint, a
pre-filter, or a tiebreaker. `brain-audit` MUST read no commit body for resolution. The ONLY other path by
which an offender leaves the flagged set is the recorded human gate:
`cursor.mjs accept <to-sha> --reason "<justification>"`, which requires a non-empty reason and performs the
same CAS advance (§REQ-D2-15). There is no third path.

#### Scenario: a forged revert trailer on a real descendant does not resolve the offender

- GIVEN offender M lands on `main` adding a payload file, and an ordinary commit X — a REAL descendant of M
  (forked AFTER M, the realistic linear-main shape) — whose body contains `This reverts commit <M>.` but
  whose diff touches NONE of M's paths
- WHEN the audit runs at X
- THEN M is still `[FAIL]`ed, no `[SKIP] resolved by revert` fires, and exit is 1. This fixture MUST redden
  against the ancestry-only fix (`eff4560`): X is a descendant of M, so `merge-base --is-ancestor` PASSES
  and the prior code wrongly skips M — proving RED here is what proves ancestry is defeated

#### Scenario: a genuine revert resolves the offender (liveness)

- GIVEN offender M, then a real `git revert -m 1 M` merged onto main
- WHEN the audit runs
- THEN `[SKIP] … resolved by revert` fires and exit is 0 — the mechanism must not pin on a genuine revert

#### Scenario: a partial revert does not resolve the offender

- GIVEN M touches paths P1 and P2, and a revert restores only P1
- WHEN the audit runs
- THEN M is still `[FAIL]`ed

#### Scenario: an empty-diff offender is never auto-resolved (anti-vacuity)

- GIVEN M is a merge with zero changed paths
- WHEN the automatic resolution predicate runs
- THEN it does NOT fire — never a vacuous pass

#### Scenario: re-introduction after revert is not resolved

- GIVEN M reverted by R, then a later commit re-adds the payload to the same path
- WHEN audited at that later tip
- THEN M is NOT `[SKIP]`ped — the predicate is anchored at the tip and sees the re-introduction

## REQ-D2-10a (NEW): Every violation class maps to exactly one resolution mechanism; forward-fix classes are never tree-effect-resolvable

Each violation class `brain-audit` emits (`diffSize`, `issueLink`, `adrPresence`, `memoryPresence`) MUST
map to exactly one of: automatic tree-effect (revert, §REQ-D2-10), automatic re-evaluation (a mutable
input — e.g. a PR label or PR body re-fetched via `prView` — makes the check pass on the next run), the
human gate, or exit-2. A class whose real-world resolution is a FORWARD-FIX (adding a missing artifact,
not restoring a prior state) MUST NOT be resolvable by tree-effect — tree-effect MUST fail closed on it
(the offender's touched path is still on disk, so `P ∩ D ≠ ∅` forever) and the class MUST fall to the
human gate or automatic re-evaluation instead. No class may ever be marked "resolved" by a commit message.
The tree-effect skip MUST be evaluated only for merges that already failed, as a pre-evaluation skip before
any of the four checks run, so a reverted offender is skipped wholesale — while the repo-global gap
`memoryPresence` measures remains enforced on every un-reverted merge.

#### Scenario: `adrPresence` has no automatic forward-fix path

- GIVEN an offender M flagged for `adrPresence` (added an ADR without `brain/HOME.md`), and a LATER commit
  adds the missing `HOME.md` as a forward fix (never touching M's own paths)
- WHEN the audit re-runs at that later tip
- THEN tree-effect returns `not resolved` (M's own changed path is still on disk, `P ∩ D ≠ ∅`) and M remains
  flagged via tree-effect/re-eval forever — the ONLY way to clear it is the human gate (`accept --reason`)

#### Scenario: `memoryPresence` self-heals only through re-evaluation, never tree-effect

- GIVEN the repo has zero `session_summary` files at HEAD, causing every merge to fail `memoryPresence`
- WHEN a later commit adds a `session_summary` at HEAD
- THEN every subsequent un-reverted merge PASSES `memoryPresence` on its next audit run (automatic
  re-evaluation) — tree-effect on any individual offender's paths never fires for this class, and no
  offender is falsely marked "resolved" by tree-effect

#### Scenario: the reverter-skip closes the revert-of-revert loop without a new mechanism

- GIVEN an `adrPresence` offender M and its genuine tree-effect-verified auto-revert R land in the SAME
  audit window (R would otherwise itself fail `adrPresence`, since removing an ungoverned ADR without
  `HOME.md` re-triggers the XOR)
- WHEN the audit evaluates R
- THEN R is `[SKIP] revert of M` via the SAME `isResolvedAt` predicate reused (no new mechanism, no
  forgeable signal) — AND a merge that merely CLAIMS to be a revert of M in its message but has no tree
  effect on M's paths is NOT skipped

## REQ-D2-11 (NEW): `refs/governance/*` MUST be explicitly fetched before cursor state is read

The workflow/core MUST run an explicit `git fetch --prune origin '+refs/governance/*:refs/governance/*'`
before any cursor-state read. `actions/checkout` fetches only `refs/heads/*` and tags, so a custom-namespace
ref is never fetched by checkout alone. A run MUST distinguish "the cursor ref is absent on origin" from
"the cursor ref exists on origin but was never fetched locally" — the latter MUST NEVER collapse into the
former (§REQ-D2-2). A run MUST NOT bootstrap (auto-create the cursor) on an `unknown` result — bootstrapping
on a guess is refused.

#### Scenario: the fetch step runs on every trigger before any cursor read

- GIVEN a workflow run (push or schedule)
- WHEN it reaches the cursor-resolution step
- THEN `git fetch --prune origin '+refs/governance/*:refs/governance/*'` has already executed — no code
  path reads cursor state without first fetching this refspec

#### Scenario: an unknown state is never treated as license to auto-create

- GIVEN a cursor state resolves to `unknown` (§REQ-D2-2, e.g. an unreachable origin)
- WHEN the workflow evaluates whether to bootstrap the cursor
- THEN it does NOT create `refs/governance/audit-cursor` — bootstrapping only ever happens through the
  documented human init command after a PROVEN `absent`, never after `unknown`

## REQ-D2-12 (NEW): No error path produces a PASS verdict or a cursor advance; every loud path exits non-zero

No error, exception, or infra failure MAY be interpreted as a clean audit or trigger a cursor advance.
Every code path that cannot produce a verdict MUST produce exit 2. The git seam underlying every core
function MUST return a status (`{status, stdout, stderr}`), never throw-only, so `git ls-remote` exit 2
("no such ref") is distinguishable from exit 128 ("cannot reach origin"), and `git diff --quiet` exit 1
("differs") is distinguishable from exit 128 ("bad rev"). An unmapped git status MUST be treated as
`uncomputable`, never as a verdict. No label-creation, issue-creation, or alerting call on a loud (exit 1 or
2) path may be suffixed with `|| true` or otherwise swallow its own failure — if `gh` itself fails, the step
MUST fail, and the resulting red job IS the loud signal.

#### Scenario: a crash in the window resolver produces exit 2, never an empty range

- GIVEN the window-resolving process throws, is killed, or prints unrecognized output
- WHEN the wrapper reads its result
- THEN it produces exit 2 — it MUST NOT fall back to inferring an empty range (e.g. `origin/main..HEAD`)
  that could pass as a clean audit

#### Scenario: `brain-audit`'s top-level catch is exit 2, message on stdout, never silently swallowed

- GIVEN `brain-audit` crashes with an injected throw
- WHEN the top-level catch handles it
- THEN it exits 2 (never 1 or 0) and writes the uncomputable message to STDOUT (captured by the wrapper) —
  no revert and no cursor advance occur

#### Scenario: a loud alerting call never has `|| true`

- GIVEN `gh label create` or `gh issue create` fails on a loud path
- WHEN the step runs
- THEN the step itself fails (no `|| true` swallows it) — the red job is the alert; it is never allowed to
  vanish silently

## REQ-D2-13 (NEW): The revert loop has a per-offender failure boundary; a blocked revert is a named, loud, human-owned outcome

Each offender MUST be processed inside its own failure boundary (its own subshell/trap). A `git revert`
conflict MUST trigger `git revert --abort`, reset to a clean detached HEAD, record the offender as failed,
and continue to the next offender — never abort the whole loop. After the loop, if any offenders failed,
the workflow MUST open exactly one loud, labeled `governance:revert-blocked` issue naming every offender
that could not be auto-reverted, with the manual revert command, and exit 1; the cursor MUST stay pinned.

#### Scenario: a revert conflict on one offender does not drop the rest of the loop

- GIVEN a push with two offenders O1 and O2, where reverting O1 raises a merge conflict
- WHEN the loop runs
- THEN O1's revert is aborted (`git revert --abort`), the workspace resets to a clean detached HEAD, O1 is
  recorded as failed — but O2 is STILL reverted in its own independent boundary

#### Scenario: a blocked revert is named, loud, and human-owned, never a silent drop

- GIVEN the loop finishes with one failed offender O1
- WHEN the workflow finalizes
- THEN it opens exactly one labeled `governance:revert-blocked` issue naming O1 with the manual revert
  command, exits 1, and the cursor stays pinned — never a silent drop of the remaining offenders

## REQ-D2-14 (NEW): Adversarial-test contract — fixtures derived from the attack, must redden against the ancestry-only fix, never authored by the patch author

For every security-relevant requirement in this spec (REQ-D2-10, REQ-D2-10a, REQ-D2-11, REQ-D2-2), the
corresponding test MUST state, and construct, the SHAPE the adversarial fixture builds — not merely the
assertion. Each resolution fixture (design §7.1 A1–A6, §7.3 C1) MUST be shown to REDDEN against the prior
plausible-but-wrong fix — the shipped ancestry-only `merge-base --is-ancestor` code at commit `eff4560` —
not merely against un-fixed code; a test that stays GREEN against `eff4560` is not a valid proof and MUST
be rejected as coverage. Adversarial fixtures MUST be derived from how the system is broken (the attack),
never from what the patch happens to handle, and MUST be authored by the finder of the defect or an
independent third party — NEVER by the author of the patch under test. Any test that extracts and executes
a workflow script MUST run it with `cwd` outside the repository worktree and MUST set
`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_SYSTEM=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, and an isolated
`HOME` — never inheriting a real `GH_TOKEN`.

**PR binding for the harness-isolation half of this requirement (fixtures D1, D2):** **PR 4** fixes the
isolation contract and PROVES it — the workflow-extracting tests it adds are born isolated from their first
RED, plus fixture D1 (a drift-guard proving that PR's own test file complies) and fixture D2 (the
real-repository identity-unchanged regression proof). **PR 5** GENERALIZES that guard into a standing
registry (tasks.md Phase 5.4) so any FUTURE workflow-extracting test file is caught automatically — PR 5
does not re-fix or duplicate PR 4's work. This split is owner-confirmed and logged as a Plan Deviation in
`design.md` §14 (2026-07-14); `design.md` §9.2's Gate table and this Gate table are reconciled to state it
identically.

#### Scenario: the A1 fixture reddens against the ancestry-only fix, proving it is defeated

- GIVEN the A1 fixture (offender M, then a real descendant commit X forked AFTER M carrying a forged
  revert trailer that touches none of M's paths) is run against `eff4560`'s `cursor.mjs`
- WHEN the test executes
- THEN it FAILS (RED) against `eff4560` because X is a descendant of M so `merge-base --is-ancestor`
  wrongly passes — this RED result is the proof the ancestry approach is defeated, not merely that
  unfixed code fails

#### Scenario: a test harness never mutates the real repository or leaks a real token

- GIVEN a test extracts and executes a workflow's `run:` block (which includes
  `git config user.name`/`user.email` lines)
- WHEN the test runs
- THEN it executes with `cwd` set to a fresh temp directory (never the repo worktree),
  `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM` pointed at `/dev/null`, and no inherited `GH_TOKEN` — the real
  repository's git identity is unchanged before and after the full suite runs twice

## REQ-D2-15 (NEW): The cursor is advanced by an atomic compare-and-swap; it can never be created or moved backward by this mechanism

`advanceCursor` MUST require a 40-hex `from` value (the exact cursor value the window was resolved from,
§REQ-D2-1) — without it, the function MUST throw and MUST NOT create the ref. It MUST verify `from` is an
ancestor of `to` before advancing. The LOCAL advance MUST use
`git update-ref refs/governance/audit-cursor <to> <from>` — git fails the update if the ref's current value
does not equal `<from>`, and an absent ref (null OID) can never equal a real 40-hex value, so the ref
cannot be created by this path. The REMOTE advance MUST use
`git push --force-with-lease=refs/governance/audit-cursor:<from> origin <to>:refs/governance/audit-cursor`
— a remote CAS the server verifies, so two concurrent runs cannot both advance and the cursor can never
move backward regardless of the forge's fast-forward policy on non-`refs/heads` namespaces. A
`concurrency:` group on the workflow is defense-in-depth ONLY — it MUST NOT be relied upon as the actual
guarantee.

#### Scenario: `advanceCursor` without a valid `from` never creates the ref

- GIVEN a repo with NO cursor ref
- WHEN `advanceCursor` is called requiring a 40-hex `from`
- THEN it throws and the ref does NOT exist afterward — asserted directly in the core, not against the YAML

#### Scenario: two concurrent advances with the same `from` — only one wins

- GIVEN two `advanceCursor` calls issued with the SAME `from` value, the second issued after the first
  already succeeded
- WHEN both attempt the CAS
- THEN the second FAILS (CAS mismatch, local and/or remote) — the cursor cannot move backward or be
  double-advanced by a race

## Out of scope (non-goals)

- **Porting rung-3 auto-revert to GitLab.** D2 unblocks it, does not do it.
- **D1 and D3.** Sibling Track-D slices, no dependency edge.
- **Rewriting evaluator semantics.** `diffSize`/`issueLink`/`adrPresence`/`memoryPresence` decisions are
  unchanged; only the resolution/exit contract is added.
- **Committing the GitLab constraint into the doc zone.** Draft only (REQ-D2-9).
- **Using real fossil PRs as fixtures.** Re-measured to zero; all fixtures synthetic (REQ-D2-8).
- **`brain-audit.mjs`'s chunk-reader drift.** Separate cleanup, not in scope unless design finds it blocks
  emission.

## Gate

`npm test`, `brain:repo:check`, `brain:change:verify` MUST stay green. Docs in English (ADR-0009). STRICT
TDD: synthetic fixtures for every scenario above are written FIRST (RED→GREEN), and every adversarial
fixture (REQ-D2-14) MUST additionally be shown RED against the ancestry-only `eff4560` code before it
counts as coverage.

**Chain (design §9.2 — supersedes the prior 2-slice split): 5 PRs, stacked to `feature/v2.0.0`, each <400
counted lines, no `size:exception`.**

| PR | Deliverable | REQs bound |
|---|---|---|
| **1** | `git-seam.mjs` + `cursor.mjs` — tri-state cursor, always-`cursor..HEAD` window, CAS advance | REQ-D2-1, REQ-D2-2, REQ-D2-11, REQ-D2-15; REQ-D2-9 (draft re-lands here, 0 counted lines) |
| **2** | `resolution.mjs` — tree-effect proof (the security-critical PR, kept small for an isolated hostile review) | REQ-D2-10, REQ-D2-10a; REQ-D2-14 (fixtures A1–A6) |
| **3** | `parse-failures.mjs` + `brain-audit.mjs` — `[FAIL-SHA]` emission, resolved-skip, reverter-skip, top-level catch → 2 | REQ-D2-3 (emission), REQ-D2-5 |
| **4** | Workflow rewrite — explicit fetch, window CLI, fail-closed branching, PR-keyed dedup, per-offender boundary, `concurrency:`, terminal-state assertion | REQ-D2-3/4 (dedup + orphan cleanup), REQ-D2-6 (workflow-side normalization + assertion), REQ-D2-12, REQ-D2-13; REQ-D2-14 (fixture C1; D1/D2 harness-isolation fix + proof, born isolated per §7.4 — see design.md §14 Plan Deviation) |
| **5** | `exit-codes.mjs` + `run-check.mjs` + both-fixtures drift-guard + standing harness-isolation registry | REQ-D2-6 (cross-evaluator contract), REQ-D2-7; REQ-D2-14 (standing harness-isolation registry, generalizing PR 4's D1/D2 fix — see design.md §14 Plan Deviation) |

**Cross-cutting across all 5 PRs:** REQ-D2-8 (every PR's fixtures are 100% synthetic).

No slice/PR uses `size:exception`. Fix-forward on the current 8-commit branch is rejected (design §9.3);
the branch resets to `feature/v2.0.0` and re-lands as this 5-PR chain.
