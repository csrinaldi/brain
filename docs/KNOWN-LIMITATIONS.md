# Known Limitations — brain 1.0

> **1.0 is a controlled-pilot release.** It is intended for repos the maintainer controls
> (self-hosting + pilot projects), NOT yet for open external adoption. This document states,
> honestly, what is **not** battle-tested so nobody mistakes 1.0 for "stable everywhere."
> Each item links to its tracking issue and lands in the 1.1 line.
>
> **Re-synced 2026-08-02** against `main` @ `5ef85df` (post-M3 merge). Struck items are shipped;
> see the epic #313 coordination notes for the verification evidence.

## Self-update (the one to read first)

`brain:upgrade` is hardened against the pre-0.8.0 identity-clobber/lockout class, and the
managed/local boundary is enforced in code — **but it is not yet safe for repos you do not
control**:

- **Rollback covers the managed-path copy only — the steps around it are still not atomic.**
  `copyManaged` now snapshots every path it may write before its first write and restores those
  bytes if any write throws, so a failure *the process survives* (ENOSPC, EACCES, an unreadable
  source, a merge rejecting malformed consumer JSON) leaves the managed paths at their pre-copy
  bytes and says so. When the rollback itself cannot finish, the snapshot is **kept** and its
  location printed. Ctrl-C is safe too, though not by rolling back: the copy is one synchronous
  batch (~23ms for 366 files) that a signal cannot interrupt, so it completes rather than dying
  midway. Precisely what is **not** covered:
  - **SIGKILL and power loss** — no in-process handler runs at all; surviving these needs an
    on-disk journal replayed by the next invocation.
  - **The dependency install (step 1)** — it rewrites `package.json`, the lockfile and
    `node_modules/` *before* any snapshot exists, and is never reverted.
  - **The config migration (step 3)** — `brain.config.json` is a `local` path and is outside the
    restore point, so a failure there leaves new managed files beside an un-migrated config.
  - **Symlinked managed paths** — refused up front (a write would follow the link out of the
    repo, beyond any rollback's reach) rather than silently mishandled.

  (M4 · #396 → 1.1; first half landed, journal outstanding)
- **Plain-copy clobber asymmetry.** `.gemini/settings.json`, `.github/CODEOWNERS`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `AGENTS.md`, and the workflows are overwritten on upgrade
  (only `.claude/settings.json` and `package.json` are merged). A consumer who edits one of those
  loses it with only a warning. (M4 · #397 → 1.1)
- **Corrupt consumer JSON blocks all upgrades.** A broken `.claude/settings.json` or `package.json`
  throws before the managed core copies. (M4 · #399 → 1.1)
- **Downgrade silently ratchets `schemaVersion` up**, with no guard/warning/test. (M4 · #398 → 1.1)

**Gate:** the self-update safety subset MUST land before 1.0 is opened to any repo the maintainer
does not control. The gate is now checkable: the danger-path e2e suite (#401) must be green.

## Distribution

- Install is a **private GitHub git-tag** (no npm registry / mirror). First install requires a
  manual `package.json` script-alias edit — there is no `npx brain init` / `bin` / `postinstall`
  yet. (M4 · #400 → 1.1)
- `brain:adopt` implements inventory/classify only (S1); `--apply` / structural migration /
  openspec reconciliation are not built. (M4 → 1.1)

## Reviewer (`brain:review`)

- **The security boundary is sound** — COMMENT-only, never a merge authorizer.
- ~~Its flow guarantees are inert in production (#317)~~ **Fixed.** `prReviews` carries `body`
  on both providers, so `priorVerdicts`, the anti-loop, the rev≥3 bound, and board reconciliation
  are live. The refuter and `brain-review/2` causal admission are wired and tier-activated
  (lite/standard→`/1`, regulated→`/2`; M3 core, merged `5ef85df`).
- **Still open after the M3 core merge** (the M3 milestone exit — "a developer sees inline code
  review in the PR" — does not hold yet):
  - **No inline per-line comments** — the verdict is a single fenced block. (M3 residual → 1.1)
  - **Findings do not round-trip**: `renderVerdict` emits a YAML list, `parseVerdict` reads a
    JSON scalar — real rendered findings are dropped on re-parse. (#381)
  - **Self-review abstention is fail-open in code** — active only because `reviewer.handle` is
    set in config; an unset handle warns and proceeds. (#382)
  - **`follow_ups[]` is wired but unreachable** — no evaluator emits `pre-existing`/`base-only`
    dispositions yet. (#284 follow-on)
  - **`/2` is not dogfoodable**: brain declares `tier: "lite"`, so its own PRs get `/1`; `/2`
    runs only in tests until a `regulated` fixture/e2e exists.

## Governance provider parity

- **GitLab MR-time gates have full parity and all 8 are blocking** (Q5 Phase 5 promoted
  phase-order / actor-check / brain-writes-reviewed out of detection; a drift-guard pins the
  job set). The remaining gap: the **release gate (rung-2) and postmerge auto-revert (rung-3)
  are GitHub-only**. (#130 → 1.1)
- ~~The release gate runs after the tag already exists (#210)~~ **Fixed.** `release.yml` is
  audit-then-tag (`workflow_dispatch`): the tag is created only after `brain-audit` exits 0.
- Live provider asymmetries under the M10 seam-coverage epic: #348 (GitLab `requiredReviews`
  accepted but unenforced), #349 (GitHub `branchProtect` throws on undefined `checks`),
  #386/#387/#388 (clone/PAT URL host + encoding), #361 (index reindex asymmetry engram vs
  plainfiles).

## Agent / SDD neutrality

- Real neutrality is n=1 in practice: the only fully-wired SDD engine with per-stage behavior is
  `gentle-ai`. Per-stage agent roles (#312, M5) and the per-stage `stage → engine` map (#323, M8)
  are 1.1 work — M8 depends on M5, and its ADR decision (amend vs supersede ADR-0019) is
  deliberately taken first, in design.
- The 3-axis decoupling is resolved in `harness/cli.mjs` but `day:start` still hardcodes the
  engine and the personal upgrade remote. (#123 → 1.1)
- Branch protection on brain's own `main` is not armed (#94 — tier decision pending): the 8 gates
  report on every PR but nothing requires them to merge yet.

---

*Full audit, scorecard, and roadmap: `docs/inbox/MASTER-PLAN-1.0.md` (snapshot; the epic #313 and
its coordination notes are the source of truth).*
