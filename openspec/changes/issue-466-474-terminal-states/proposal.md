# Proposal — no terminal state may be both red and silent (#466 + #474)

**Issues**: #466 (`status:approved`), #474 (`status:approved`) · **Base**: `main` @ `e812d04`

## Problem

Rung 3 (post-merge auto-revert) has two terminal states with no handler, and they
are wired in series.

1. **#466 — a failure nothing can revert.** `brain-audit` legitimately exits **1**
   with **zero** `[FAIL-SHA]` lines: when every surviving violation is
   `issueLink`/`memoryPresence` (not tree-keyed), or when §15.5 suppresses
   nomination because a revert would resurrect a payload absent at HEAD.
   `governance-postmerge.yml` calls that state "incoherent" and exits 2 *from the
   revert step* — but the alarm step is gated on the **audit step's output**
   (`== '2'`), which is `1`. Result: job red, nothing reverted, **no alarm**,
   cursor frozen. Observed live in run `31094912872` over `c724942`.

2. **#474 — a merge nothing can evaluate.** `fetchPrMeta`'s bare `catch {}`
   discards the fact that the PR fetch failed, so `issueLink` renders a confident
   FAIL on the auto-generated merge-commit body. "I could not reach the API" and
   "this gate failed" become the same verdict — the
   `evidence-reader-empty-on-failure` class in the authentication layer, and what
   made #467 report a governance verdict instead of an outage.

They compose: an unauthenticated run turns every PR-shaped merge into an
`issueLink` FAIL, which is exactly #466's unhandled state. The whole rung goes
red and silent, and it does not self-heal — every later merge accumulates into
the same failing window.

## Why one change

#474's unanswered policy question ("does one unfetchable PR poison the window?")
lands inside #466's answer ("what does the run do when it cannot remediate?").
Answered separately they produce contradictory dispositions for the same
situation. Answered together they are one rule: *when the machine cannot safely
act, it freezes and tells a human.* See `design.md` §3–§5 for the elimination and
the authority that excluded each alternative.

## Approach

- **#474** — `fetchPrMeta` returns `prMetaError`; a merge whose PR fetch failed is
  **not evaluated** and is reported `[UNCOMPUTABLE]`; ≥1 such merge drives the run
  to exit **2** (window-level fail-closed, per `exit-codes.mjs`'s "uncomputable
  DOMINATES"). `brain-metrics` routes the same signal into its existing
  `uncomputable` bucket without changing its exit code.
- **#466** — the workflow's zero-offender branch stops calling a documented state
  "incoherent" and files a `governance:audit-unrevertible` alarm; the cursor stays
  pinned.
- **Structural** — every alarm path records that it fired, and the `always()`
  terminal step files a backstop alarm if the job is red and nothing was recorded.
  This is the half that makes the invariant hold for states nobody enumerated.

The published 0/1/2 exit contract is **unchanged in shape** — no fourth code
(`design.md` §3).

## Non-goals

- `refs/governance/audit-cursor` is not touched.
- `release.yml`'s missing token / `permissions` scope is **#475**, not this.
- The API-token drift guard is **#480** (`design.md` §8).
- `vcs === null` (adapter unconfigured) stays evaluate-normally, recorded as a
  named residual in `design.md` §4.
