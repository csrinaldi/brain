# Proposal — Rung-3 Auto-Revert Guardrails (Track D / slice D2)

> **Status:** planned · **Issue:** #259 (owner-triaged: the 3 cron bugs are already diagnosed)
> **Base branch:** `feature/v2.0.0` · **Worktree:** `/home/gandalf/IA/brain-issue-259`
> **Depends on:** the rung-3 workflow (`.github/workflows/governance-postmerge.yml`) + `brain-audit.mjs`
> shipped by #144 (governance-v3). D2 is the HARDENING pass over that machinery, not a rewrite.
> **Siblings (NOT dependencies):** D1 / D3 — separate Track-D slices. Porting rung-3 to GitLab is
> **UNBLOCKED-BY D2**, never part of it (see Non-goals).
> **Exploration (LOAD-BEARING — cite it):** [[sdd/d2-postmerge-guardrails/explore]] (engram #874) — the
> 3 bugs with file:line, the exit-code contract gap, the re-measured fixture reality, and the standing
> GitLab-porting restriction.
> **PLAN reference:** `docs/inbox/PLAN-adapters-v3.md` §D2 (three-exit-code contract, lines 327-335).
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context

The rung-3 post-merge auto-revert (`governance-postmerge.yml`) is brain's last line of governance: it runs
`brain-audit.mjs` over merges that landed on `main` and, on failure, opens an auto-revert PR so bad state
does not persist. It ships today and is LATENT-DOCUMENTED, not on fire — the historic offender self-stopped
when release tags v0.9.4/v0.9.5 moved past it, and the human already deleted the 15 auto-revert *branches*
(explore #874). But that self-stop is exactly the smell: the cascade stopped by ACCIDENT (a tag move that
MASKED the offender), not by a correct guardrail. D2 makes the guardrail correct.

The owner has already triaged THREE mechanical bugs in the workflow, plus the machinery carries a contract
gap that makes the whole ladder dishonest under infrastructure failure. This proposal does not re-derive
them — it structures the fix.

**The 3 owner-triaged mechanical bugs (verbatim scope, with fix direction):**

1. **Window-from-tag** — `governance-postmerge.yml:33-41`. On a cron/`schedule` run there is no push
   payload, so the workflow resolves the audit BASE via `git describe --tags --abbrev=0`. Advancing a
   release tag past an offending merge silently drops that merge out of the audit window FOREVER — masking
   the offender instead of catching it. **Fix direction:** anchor the daily backstop to a **persisted
   audit cursor** (last-audited SHA), not to the last release tag, so a tag move can never shrink the
   window past an un-audited merge.

2. **Revert-of-HEAD** — `:57,76-79`. The workflow reverts `github.sha` (the push HEAD) unconditionally,
   while `brain-audit.mjs:145` audits a **RANGE** of `--first-parent` merges and prints each offender as
   `[FAIL] <sha>` (`:236`). On a multi-merge push this reverts good HEAD work and leaves the real offender
   on `main`. **Fix direction:** revert the **specific failing SHA(s) brain-audit actually flagged**, not
   the range HEAD.

3. **No-dedup-on-offender** — `:60-68`. The idempotency guard keys the auto-revert branch on the current
   HEAD sha (`br="auto-revert/${sha:0:7}"`). Because of bug 2 every cycle computes a new (wrong) target,
   so the branch-exists check can never recognize "we already handled THIS offender" — it mints a fresh
   fossil branch/PR each cycle until a tag move (bug 1) masks it. **Fix direction:** key dedup on the
   **actual offender SHA**, so a re-run recognizes an offender already in flight.

**The contract gap (the reason the ladder is dishonest today):** `brain-audit.mjs:240-244` — and every
evaluator — exits only **0 (pass) or 1 (fail)**. There is zero `process.exit(2)` anywhere in the repo
(explore #874). So an INFRASTRUCTURE failure (VCS unreachable, git range uncomputable, corrupt records) is
indistinguishable from a real governance violation — and, wired to auto-revert, an infra hiccup would
REVERT good code. The PLAN's fix (§D2) is an **additive three-code contract**: `0` pass / `1` violation /
`2` uncomputable-infra; the workflow reverts ONLY on `1`, posts a loud issue on `2` (never revert, never
silent); a drift-guard asserts every check implements it.

**Fixture reality (RE-MEASURED — do NOT use fossils):** 168 closed PRs, **0** with head `auto-revert/*`.
The 15 fossils were BRANCHES ONLY, deleted by the human; they were never persisted as PRs. There is no
real fixture to replay. **All regression fixtures in D2 are 100% SYNTHETIC** — hand-built git ranges that
reproduce each bug's failure shape, RED→GREEN under strict TDD.

## What this ships — a PRE-NAMED CHAINED SPLIT (2 slices, honest forecast)

The full D2 fix cannot honestly fit one ≤400-line slice: the 3 bug fixes + the emission plumbing +
synthetic fixtures already fill a slice, and the three-code contract touches EVERY evaluator plus a
drift-guard plus workflow branching. Rather than discover this mid-apply and scramble for a
`size:exception`, D2 declares the split UP FRONT. Both slices chain into `feature/v2.0.0`; each is
≤400 counted lines; **neither uses `size:exception`.**

### Slice 1 — fix the 3 bugs + make brain-audit emit its offenders + synthetic fixtures + the GitLab draft

1. **Fix bug 1 (window-from-tag → persisted cursor).** Replace the `git describe --tags` BASE for
   `schedule` runs (`governance-postmerge.yml:33-41`) with a persisted audit cursor (last-audited SHA)
   so the daily backstop window is anchored to what was actually audited, immune to tag moves.
2. **Fix bug 2 (revert-of-HEAD → revert the flagged SHA(s)).** The workflow reverts the SPECIFIC SHA(s)
   brain-audit flagged as `[FAIL]`, not `github.sha`. This REQUIRES deliverable 4 (machine-readable
   emission) — the two are one coherent change.
3. **Fix bug 3 (no-dedup-on-offender → dedup on offender SHA).** Key the auto-revert branch/idempotency
   check (`:57-68`) on the actual offender SHA so a re-run recognizes an offender already in flight.
4. **brain-audit emits its failing SHAs machine-readably.** Today `brain-audit.mjs` prints `[FAIL] <sha>`
   to stdout for humans (`:236`) but hands the workflow NOTHING structured to revert. Add an explicit,
   consumable emission of the flagged SHA list (e.g. a `[FAIL-SHA] <full-sha>` marker line or a written
   output) the workflow reads to drive bugs 2 & 3. Additive — human `[FAIL]`/`[PASS]` output unchanged.
5. **Synthetic regression fixtures, RED→GREEN (STRICT TDD).** One synthetic git range per bug (tag-move
   masking; multi-merge push where HEAD is good and a mid-range merge is the offender; a repeated cycle on
   the same offender) that FAILS against today's workflow/emitter behavior and PASSES after the fix. 100%
   synthetic — no fossils.
6. **DRAFT the GitLab-porting-constraint doc (draft zone only).** Author a draft that writes down the
   standing restriction (today it lives ONLY in engram memory, in NO repo file): *rung-3 auto-revert must
   not be ported to GitLab until D2's fixes land; Track A's GitLab port covers PR-time gates
   (`GOVERNANCE_JOBS`) only, not postmerge/auto-revert.* The draft lands under
   `openspec/changes/issue-259-d2/brain-drafts/` (pattern #216, exactly like B0/B1 and #201/#193). **The
   D2 PR carries ONLY the draft; it NEVER commits to the doc zone (ADR/brain/core/PLAN).** A HUMAN
   co-promotes it into the doc zone via a SEPARATE MR (see the co-promotion note below).

### Slice 2 — the additive three-code contract + drift-guard + exit-1/exit-2 workflow branching

7. **Three-code contract across ALL evaluators + brain-audit.** Every evaluator and `brain-audit.mjs`
   returns `0` pass / `1` violation / `2` uncomputable-infra. ADDITIVE: existing `0`/`1` semantics are
   preserved; `2` is carved out of the current fail-closed `1` path for genuine infra-uncomputable cases
   (VCS unreachable, uncomputable range, corrupt records) — the same conditions that today crash to
   `exit(1)` at `brain-audit.mjs:241-244`.
8. **Drift-guard test.** A guard asserts EVERY check implements the three-code contract, so a future check
   that ships binary `0/1` fails CI. This is the anti-regression that keeps the contract honest over time.
9. **Workflow branches on exit code.** `governance-postmerge.yml` reverts ONLY on exit `1`; on exit `2`
   it opens a LOUD infra-alert issue and **never reverts, never stays silent**. Exit `0` is the no-op pass.

## The doc-zone co-promotion note (pattern #216 — explicit)

The GitLab-porting constraint is real and binding, but D2 is a code/CI slice, not a doc-zone edit. Per
pattern #216 (the same human co-promotion used for B0/B1 and issues #201/#193):

- **The agent DRAFTS** the constraint under `openspec/changes/issue-259-d2/brain-drafts/`. That is the
  agent's entire authority over this doc.
- **The HUMAN co-promotes** the draft into the canonical doc zone (an ADR, `brain/core/…`, or the PLAN)
  via a SEPARATE MR the human owns.
- **The D2 PR NEVER touches the doc zone.** Any commit from D2 into ADR/brain/core/PLAN is a STOP-finding,
  not an allowed convenience. This keeps the agent out of the human-owned normative zone by construction.

## Non-goals (explicit)

- **Porting rung-3 auto-revert to GitLab.** This is exactly what D2 UNBLOCKS but does NOT do. `substrate.mjs`'s
  rung-3 detector is GitHub-hardcoded (`GITHUB_ACTIONS`, `.github/workflows/governance-postmerge.yml`
  presence); the GitLab port waits until D2's fixes land. D2 ships the constraint DRAFT that says so.
- **D1 and D3.** Sibling Track-D slices, out of scope, no dependency edge to D2.
- **Rewriting brain-audit's evaluators or the audit semantics.** D2 hardens the workflow's use of the audit
  and adds an exit code; it does NOT change what `diffSize`/`issueLink`/`adrPresence`/`memoryPresence`
  decide.
- **Committing the constraint into the doc zone.** Draft only; human co-promotes (see above).
- **Using real fossil PRs as fixtures.** Re-measured to zero; all fixtures are synthetic.
- **The `brain-audit.mjs` chunk-reader drift** (still imports `readChunkObservations`, explore #874). Real
  but a SEPARATE cleanup; not pulled into D2's guardrail scope unless design finds it blocks the emission
  work.

## Design questions surfaced for the owner (recommend, don't decide)

- **Cursor mechanism for bug 1 (RECOMMEND: a persisted ref/tag written by the audit job).** The cursor
  could be a lightweight git ref/tag advanced on each green audit, a committed marker file, or GitHub
  Actions cache. **Lean: a persisted ref/tag** (survives independently of release tags, visible, no extra
  storage). Design pins the exact mechanism + how it advances and recovers from a missing cursor.
- **Emission channel for the flagged SHAs (RECOMMEND: an explicit stdout marker parsed by the workflow).**
  Options: a `[FAIL-SHA] <sha>` stdout marker, a `GITHUB_OUTPUT` write, or a written artifact file. **Lean:
  the stdout marker** (portable, testable off-CI, no runner coupling) — design confirms.
- **Exit-2 boundary (RECOMMEND: only genuinely uncomputable infra).** Design must pin the EXACT conditions
  that map to `2` vs `1` so infra-`2` never becomes a silent escape hatch for real violations. The
  drift-guard enforces coverage; design enforces the boundary.

## Acceptance criteria (CP-D2 — hard stop, PR-as-review, Part of #259)

**Slice 1:**
- [ ] Bug 1 fixed: `schedule`-run BASE anchored to a persisted audit cursor, NOT `git describe --tags`; a
      tag move cannot drop an un-audited merge from the window (synthetic fixture proves it).
- [ ] Bug 2 fixed: the workflow reverts the SPECIFIC SHA(s) brain-audit flagged, not `github.sha`
      (multi-merge synthetic fixture: good HEAD survives, mid-range offender is reverted).
- [ ] Bug 3 fixed: dedup/idempotency keyed on the offender SHA; a repeated cycle recognizes an offender
      already in flight and no-ops (synthetic fixture proves no new fossil branch).
- [ ] `brain-audit.mjs` emits its flagged SHAs machine-readably (additive; human `[PASS]`/`[FAIL]` output
      unchanged).
- [ ] Synthetic regression fixtures written FIRST, RED→GREEN (STRICT TDD); no real fossils used.
- [ ] The GitLab-porting-constraint DRAFT exists under `openspec/changes/issue-259-d2/brain-drafts/`; the
      PR does NOT touch the doc zone.

**Slice 2:**
- [ ] Additive three-code contract (`0`/`1`/`2`) implemented across ALL evaluators + `brain-audit.mjs`;
      existing `0`/`1` semantics preserved.
- [ ] Drift-guard test asserts EVERY check implements the three-code contract (a binary `0/1` check fails
      CI).
- [ ] `governance-postmerge.yml` reverts ONLY on exit `1`; exit `2` opens a loud infra-alert issue and
      NEVER reverts, NEVER stays silent; exit `0` is a no-op pass.

**Both slices:**
- [ ] Chained into `feature/v2.0.0`; each slice ≤400 counted lines; NO `size:exception`.
- [ ] Docs English (ADR-0009); `npm test`, `brain:repo:check`, `brain:change:verify` green.
- [ ] Design questions (cursor mechanism, emission channel, exit-2 boundary) surfaced for owner decision,
      NOT silently resolved. **STOP at CP-D2.**
