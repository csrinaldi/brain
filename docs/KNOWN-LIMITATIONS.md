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
  - ~~**SIGKILL**~~ — **CLOSED.** A journal is written after the snapshot and before the first
    write, so a killed run leaves replayable evidence: the next run refuses rather than writing
    over it, and `brain:upgrade -- --recover` puts the covered paths back. The kernel keeps the
    page cache when a process is killed, so the snapshot bytes are intact by construction.
    Recovery is explicit by design — between the crash and the next run the consumer may have
    repaired things by hand, and replaying stale bytes over that would destroy work while
    reporting success.
  - **Power loss — narrowed, not closed.** The snapshot files, every intermediate directory on
    the way to them, the snapshot directory's own entry in the repo root, the journal, and the restored files during recovery are all `fsync`ed. A
    journal that cannot be read is REFUSED rather than treated as absent, so a torn journal can
    no longer cause the snapshot to be auto-deleted. **One residual remains and is NOT covered:**
    the journal records no size or checksum, so a snapshot *file* torn by a power cut would be
    restored as-is and reported as a clean recovery. `fsync` is also best-effort — a filesystem
    that refuses it does not abort the upgrade. And an unlink made during recovery is not
    barriered (that needs a parent-directory fsync, which is not done). Integrity validation is
    the next step, not a shipped one.
  - **Concurrency** — a second `brain:upgrade` is refused while the first is alive, decided by
    reading the owner's pid, not by the lock file merely existing. A lock whose owner is provably
    gone is reclaimed rather than stranding the repo. Residual: **pid reuse**. If a killed run's
    pid has been recycled by an unrelated live process, the lock reads as held and every command
    refuses until the file is deleted by hand — the refusal says so. It fails safe — it strands rather than
    permits — and a pid+start-time token would close it. A lock that cannot be READ (wrong
    owner's permissions, EIO, fd exhaustion) also fails closed, refusing rather than guessing.
    **Residual:** reclaiming a lock whose owner is provably gone is a read-then-delete, not an
    atomic operation, so two runs racing that exact path can both proceed. Measured: never from
    a clean start, ~1.2-1.9 winners per 40 when a reclaim is required. The downstream verdict
    re-check and the journal gate caught every case (20 concurrent real upgrades x 10 rounds:
    0 bad final states), so this is a defect in the primitive, not an observed data loss.
  - **A wedged run needs SIGKILL.** The deferred SIGINT/SIGTERM handlers are queued behind
    synchronous work, so a run blocked on a hung managed path (a FIFO, a stalled network
    mount, a dead device) ignores both signals and can only be ended with SIGKILL —
    which the journal is built to survive. Measured, not theorised.
  - **The dependency install (step 1)** — it rewrites `package.json`, the lockfile and
    `node_modules/` *before* any snapshot exists, and is never reverted.
  - **The config migration (step 3)** — `brain.config.json` is a `local` path and is outside the
    restore point, so a failure there leaves new managed files beside an un-migrated config.
  - **Managed paths that resolve OUTSIDE the repo, and dangling symlinks** — refused up front.
    A write landing outside `destRoot` is beyond any rollback's reach, and a link with no target
    cannot be snapshotted at all. A symlink resolving *inside* the repo is fine and is protected
    like any other path — measured: the snapshot, the write and the restore all follow the link,
    so the target ends at its original bytes with the link untouched.
  - **The rollback's own cleanup** — if removing the snapshot fails (EACCES/EPERM/EBUSY), the
    directory is left behind rather than reported as an upgrade failure. Cosmetic residue is
    preferable to telling an operator a completed upgrade failed.

  (M4 · #396 → 1.1; both slices landed — SIGKILL closed, power-loss integrity outstanding)
- ~~**Plain-copy clobber asymmetry.**~~ **Closed (#397).** Every managed path now carries an
  explicit, signed strategy in `brain/core/managed-paths.mjs` instead of one inferred from three
  call sites. `.gemini/settings.json` is MERGED like its `.claude` sibling; `CODEOWNERS`, the PR
  template and the four workflow files REFUSE when the consumer changed them, aborting the run
  and requiring `--force-managed <path>` per path; `AGENTS.md` is REGENERATED from the consumer's
  own `brain/HOME.md` and never copied at all.

  Modification detection is three-way — destination against the OUTGOING package, not just
  against the incoming one — so "the consumer edited it" and "brain changed it" stop being the
  same observation. A file brain updated and the consumer never touched is still written without
  prompting.

  **Residual 1 — degraded detection under `--no-install`.** The outgoing and incoming package are
  then the same tree, so consumer modification cannot be established and the REFUSE guard cannot
  fire. The run says so explicitly rather than looking like a clean three-way pass, but a file you
  edited *can* be overwritten on that path. Drop `--no-install` to get the real check.

  **Residual 2 — already-clobbered detection covers `AGENTS.md` only, and only against the
  current release.** A consumer who customised `brain/HOME.md` and whose `AGENTS.md` is
  byte-identical to the incoming package's is told, and pointed at `git log --follow`. Two gaps:
  a consumer clobbered by an *older* release carries an artifact that matches nothing
  reconstructible, and the non-generated paths (`CODEOWNERS`, the workflows) have no detector at
  all. Both need a manifest of every hash brain has historically shipped — a new Tier-2 artifact
  and its own decision, so it is tracked separately rather than assumed here.

  Git history was measured and rejected as the mechanism: brain's own `AGENTS.md` changed 16
  times across 17 tags, so "this file once differed and now matches brain's" is true for almost
  every consumer who upgraded more than once. A detector that fires for everyone is noise, and
  noise is how a real warning gets ignored.

  **Residual 3 — the REFUSE gate is not covered end-to-end.** It needs `outgoing !== incoming`,
  which needs a real install, so it is proven at `copyManaged` level and via the container harness
  in #401 rather than by the unit suite. (M4 · #397 → 1.1)
- ~~**Corrupt consumer JSON blocks all upgrades.**~~ **Closed (#399).** Both merge targets are
  parsed before anything is installed, snapshotted or written; the refusal names every broken
  file at once and `--skip-merge <path>` upgrades everything else, leaving the named file
  untouched rather than clobbering it. **Residual:** an unparseable `package.json` still stops
  `npm run` itself, so no flag can get past it — the refusal says repair is the only route.
  throws before the managed core copies. (M4 · #399 → 1.1)
- ~~**Downgrade silently ratchets `schemaVersion` up**~~ **Closed (#398).** Installing an older
  tag than the config schema is refused before anything is installed or written, naming both
  versions and the config keys that would be left ahead of the target. `--allow-downgrade`
  proceeds and prints the same list as a warning. A tag that is not semver (`latest`, a branch,
  a sha) is never read as a downgrade.

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
  are live. The refuter and `brain-review/2` causal admission are wired at **every tier** — the
  tiered `/1` default was retired by the #743 ruling of 2026-08-20 (M3 core, merged `5ef85df`;
  untiered by #743).
- **Still open after the M3 core merge** (the M3 milestone exit — "a developer sees inline code
  review in the PR" — does not hold yet):
  - **No inline per-line comments** — the verdict is a single fenced block. (M3 residual → 1.1)
  - **Findings do not round-trip**: `renderVerdict` emits a YAML list, `parseVerdict` reads a
    JSON scalar — real rendered findings are dropped on re-parse. (#381)
  - **Self-review abstention is fail-open in code** — active only because `reviewer.handle` is
    set in config; an unset handle warns and proceeds. (#382)
  - **`follow_ups[]` is wired but unreachable** — no evaluator emits `pre-existing`/`base-only`
    dispositions yet. (#284 follow-on)
  - ~~**`/2` is not dogfoodable**: brain declares `tier: "lite"`, so its own PRs get `/1`~~
    **Fixed.** #442 made the protocol overridable and brain set it; the #743 ruling then made
    `/2` the only produced protocol, so no repo at any tier can end up on `/1` without asking.
  - **The judgment half is on and cannot run.** After #743 `reviewer.inferential.enabled`
    defaults ON, and #682 slice 3 has not yet supplied a transport — so every verdict, in every
    repo, carries the condition `the judgment half is enabled but no transport is configured`.
    It is a condition and not a blocker: `buildVerdict` never reads `conditions[]`, so it cannot
    move a verdict. Declared here because the ruling declared it rather than discovering it.

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

## Post-merge audit coverage

- **CLOSED by #518 (2026-08-10).** Kept here as a record, because the shape of the defect is
  more useful than its absence.

  The audit used to see MERGE COMMITS ONLY. `listMerges` selected
  `git log --first-parent --merges`, so a squash — a single-parent commit — was never
  enumerated: none of `diffSize` / `issueLink` / `adrPresence` / `memoryPresence` /
  `writesGoverned` ever ran on it. On a clean window the cursor then advanced to the tip, and
  because the cursor only moves forward, those commits fell outside every future window.
  Permanently un-re-auditable.

  Measured on `origin/main`, 60 days to 2026-08-10:

  | | before | after |
  |---|---|---|
  | first-parent commits | 112 | 112 |
  | enumerated by the walk | 79 | **112** |
  | never audited | **33** (32 carrying a `(#N)` PR reference) | **0** |

  **The fix was not a filter edit**, which is why it stood open through three PRs. Every
  exemption predicate is built on `<sha>^1..<sha>`, and the question was what that means with no
  second parent. The answer turned out to make the model *simpler*, not harder: `^1` resolves for
  any non-root commit, and for a linear one it is just its own diff. `sign`, `netPresent`,
  `netAddFull` and `addedPathsAbsentAt` needed no change. What had to move — together — were the
  three ENUMERATORS: the offender walk, and `firstParentMerges{After,Inclusive}` on the revert
  side. Widening one alone leaves the two disagreeing about what a window contains, which is
  worse than either narrow one.

  **The `[WARN] N first-parent commit(s) … were NOT audited` line is gone**, along with the
  operator instruction to disable *Squash merging* in the repository settings. Both were option
  (a) — a stopgap the ticket recorded as not durable: it rested on a platform setting nobody
  enforces and a warning nobody had to act on, and it bought nothing for a consumer who
  squash-merges by policy, which is most of them.

  **J-2 is closed in the same change.** It was the same `--merges` filter on the *revert* side —
  fail-CLOSED, so a genuine revert was simply never seen and the offender never auto-cleared. Its
  docstring's premise had also expired: "brain merges PRs with `--merge` … the gap is currently
  unexercised here", measured at 0 non-merge reverts. Re-measured: 33.

- **A range that reaches the ROOT commit is uncomputable.** The widened walk rests on `<sha>^1`
  resolving, which is true of every commit except the root, so `brain:audit HEAD` over a
  repository's entire history fails closed rather than silently narrowing. Every production
  caller already excludes it — the cursor is seeded at `rev-list --max-parents=0` and
  `release.yml` falls back to the same, both of which produce `root..HEAD`.

- **Every commit on the integration line is now governed, including direct pushes.** This is the
  intended consequence and worth stating plainly: a commit pushed straight to the default branch
  with no issue reference now fails `issueLink`, where before it was invisible. `--first-parent`
  is untouched, so a `Part of #N` commit inside a merged feature branch is still not audited as
  though it had landed on its own.

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
