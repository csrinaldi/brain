---
status: tasks
issue: 396
epic: 313
artifact_store: openspec
topic_key: sdd/issue-396-upgrade-rollback/tasks
---

# Tasks — Rollback / atomic apply for `brain:upgrade` (issue 396)

Slice 1 ships in PR #412 (`feat/issue-396-featupgrade-m4-rollback-atomic-apply-for` →
tracker `feature/issue-396-rollback`). Slice 2 is a separate PR on the same chain.

## Phase 0 — Measure before designing

- [x] 0.1 Verify all four defect claims (#396-#399) against code, not issue prose
- [x] 0.2 Measure the real managed payload (366 files / 13 globs / ~23 ms)
- [x] 0.3 Measure signal delivery against a synchronous fs loop (probe: sync vs yielding)
- [x] 0.4 Establish that the stated exit criterion is unachievable, and why (`rename(2)`)
- [x] 0.5 Record the Scope-vs-Exit contradiction in the issue body

## Phase 1 — Restore point (slice 1)

- [x] 1.1 `RESTORE_POINT_DIR` export, inside the consumer root (same filesystem)
- [x] 1.2 `createRestorePoint({ destRoot, relPaths })` — snapshot before the first write
- [x] 1.3 Classify dest state with `lstat`, never `existsSync` (REQ-396-5)
- [x] 1.4 Record ancestor directories the write must create, for pruning (REQ-396-2)
- [x] 1.5 `restore()` — best-effort per path, judged by outcome (REQ-396-3)
- [x] 1.6 `discard()` — drop the snapshot
- [x] 1.7 Refuse ONLY what cannot be rolled back — escaping paths and dangling links; a link resolving inside the repo is protected, not refused (REQ-396-5)
- [x] 1.8 Do not reuse a stale snapshot from an earlier crash (REQ-396-7)

## Phase 2 — Wire it into `copyManaged` (slice 1)

- [x] 2.1 Sort `toMerge` / `toCopy` before use (REQ-396-8)
- [x] 2.2 Wrap `createRestorePoint` itself, so a snapshot-phase throw leaks no partial dir
- [x] 2.3 Wrap the write loop; restore on throw
- [x] 2.4 Discard **only** on a complete rollback — not a `finally` (REQ-396-3)
- [x] 2.5 `annotateRollback()` — never throws, preserves identity, else wraps with `cause` (REQ-396-4)
- [x] 2.6 Confirm `dryRun` / `abortOnCollision` take no snapshot (REQ-396-6)

## Phase 3 — CLI reporting (slice 1)

- [x] 3.1 Wrap the `copyManaged` call in `brain-upgrade.mjs`
- [x] 3.2 Report a complete rollback, scoped: the dependency install is NOT reverted
- [x] 3.3 Report an incomplete rollback, listing the paths AND the surviving snapshot
- [x] 3.4 Test `r.signal` **before** `r.status` at the install step; exit `128+signal`
- [x] 3.5 Register `SIGINT`/`SIGTERM` deferral handlers; document what they do and do not cover
- [x] 3.6 Suppress the interrupt summary under `--dry-run`; `SIGTERM` → 143

## Phase 4 — Tests (slice 1)

- [x] 4.1 REQ-S6-1 merge-phase write rolled back by a copy-phase throw
- [x] 4.2 REQ-S6-2 created files deleted, not left empty
- [x] 4.3 REQ-S6-3 a merge that half-wrote is rolled back
- [x] 4.4 REQ-S6-4 original error re-thrown by identity
- [x] 4.5 REQ-S6-5 snapshot discarded on the success path
- [x] 4.6 REQ-S6-6 drift-guard: snapshot dir matches no real managed glob
- [x] 4.7 REQ-S6-7 created directories pruned
- [x] 4.8 REQ-S6-8 stale snapshot never reused
- [x] 4.9 REQ-S6-9 unrestorable path reported, rest still restored
- [x] 4.10 REQ-S6-10 an EARLIER plain copy is rolled back (the dominant shape)
- [x] 4.11 REQ-S6-11 an incomplete rollback KEEPS its snapshot
- [x] 4.12 REQ-S6-12 a non-`Error` throw still carries rollback state
- [x] 4.13 REQ-S6-13 dangling symlink refused, nothing written
- [x] 4.14 REQ-S6-14 `dryRun` and `abortOnCollision` take no snapshot
- [x] 4.15 REQ-S6-15 a VALID internal symlink is allowed and rolls back (negative control)
- [x] 4.16 REQ-S6-16 a symlinked ANCESTOR that escapes the repo is refused
- [x] 4.17 REQ-S6-17 a failed cleanup never reports a good upgrade as failed
- [x] 4.18 Prove each new test RED against the pre-fix code, and record which pass both ways and why

## Phase 5 — Documentation & record (slice 1)

- [x] 5.1 Rewrite `KNOWN-LIMITATIONS.md` from "no rollback" to partial, enumerating **all four** residual gaps
- [x] 5.2 Draft ADR-0027 (exit criterion is restorability, not atomicity) into `brain-drafts/`
- [x] 5.3 Write this SDD change dir
- [x] 5.4 Materialize the session memory record into PR #412 (`buildRecord` + `validateRecord` + `memory:reindex`; omit `issue` until #404)
- [ ] 5.5 Human ratification of ADR-0027 (Tier-2 / ADR-0013 — agent drafts, human signs)

## Phase 6 — Review remediation (slice 1)

- [x] 6.1 Fresh-context adversarial review of the slice
- [x] 6.2 CRITICAL — `discard()` in `finally` destroyed the snapshot on the incomplete-rollback path
- [x] 6.3 HIGH — error annotation could throw, producing a false clean-rollback report
- [x] 6.4 HIGH — `existsSync` symlink corruption
- [x] 6.5 HIGH — Ctrl-C during install misreported; exit 130 downgraded to 1 (regression this slice introduced)
- [x] 6.6 MEDIUM — partial snapshot leak, dry-run interrupt claim, SIGTERM exit code
- [x] 6.7 Correct the false claim in the PR body and in the follow-up commit message

## Phase 6b — Second adversarial review round (2026-08-02, late)

- [x] 6b.1 Re-review of the remediation: 3 of 5 prior fixes COMPLETE, 1 overbroad, 1 partial
- [x] 6b.2 F1 — unguarded `discard()` reported a fully-applied upgrade as failed, and inside
      the catch replaced the original error. Both call sites guarded.
- [x] 6b.3 C2 — a retry destroyed the snapshot the CLI had just told the operator to restore
      from. Preserved to a name no run auto-clears.
- [x] 6b.4 F2 + C3 — the symlink refusal rested on a premise measured FALSE (a link inside the
      repo round-trips cleanly) and simultaneously missed symlinked ancestors. Narrowed to
      escaping-paths + dangling links.
- [x] 6b.5 F3 — `err.cause` is now surfaced; it was the only line saying WHY
- [x] 6b.6 F4 — deferred SIGTERM exits 143, not 1, at every one of the three sites
- [x] 6b.7 F9 — `failed` entries are all repo-relative
- [x] 6b.8 F11 — a refusal no longer reports "failed while writing" / "was rolled back"
- [x] 6b.9 Tests REQ-S6-15/16/17 + a rewritten REQ-S6-11, each proven RED against the pre-fix code
- [ ] 6b.10 **F6 — `brain-upgrade.mjs` still has ZERO test coverage** for its ~90 new lines
      (signal handling, exit codes, rollback reporting). Phases 3.1-3.6 are verified by reading,
      not by a test. Honest gap, not a checked box.
- [ ] 6b.11 **F7 — REQ-396-8 (deterministic write order) has a scenario and no test**, yet
      REQ-S6-10 depends on the sort to avoid passing vacuously. A sort regression silently
      reopens the hole REQ-S6-10 exists to close.

## Phase 7 — Follow-ups this slice creates (tickets, not code here)

- [ ] 7.1 `.brain-upgrade-backup` cannot be gitignored — `.gitignore` is not a managed path; adding it is **Tier 2, human-promoted**
- [ ] 7.2 `restore()` rewrites all saved files, moving mtimes even when one write happened (cosmetic)
- [ ] 7.3 Extend protection across the whole verb (install + config migration), or record that it stays out of scope
- [x] 7.4 **F12** — `acquireLock()` is `wx`-first with a liveness-checked reclaim, taken by the real CLI (REQ-J-9) and verified under 40-way concurrency: 1 of 40 wins. Sibling of the snapshot dir, so clearing that dir never releases it.
- [ ] 7.5 **F5** — a package manager that TRAPS SIGINT and exits non-zero still lands on
      "install failed — check repo access". Only a signal-killed child is covered.
- [ ] 7.6 **F10** — a directory/FIFO/socket at a managed path yields an opaque EISDIR/ENXIO
      instead of the actionable message the refusal branches were given.

## Phase 8e — Sixth review: the upgrader could not upgrade

Round 5's fix was a no-op; round 6's was a brick. Both shipped green. The invariant
across six rounds was never the bug — it was that **no test asserted a successful
`brain:upgrade`**. Every CLI test asserted a refusal or a recovery, so a total outage
passed 2294 tests.

- [x] 8e.1 **REQ-J-10 first** — spawns the real CLI, lets it FINISH, asserts exit 0, that
      the bytes on disk actually changed, and that neither lock nor snapshot survives.
      Proven RED against the outage before the fix was written. Note it would NOT have
      caught round 5 (the upgrade worked fine without a lock) — REQ-J-9 catches that.
      **Neither is sufficient alone; the pair is the invariant.**
- [x] 8e.2 BLOCKER — the CLI took the lock and then `inspectRestorePoint` read that same
      live lock as a competitor, so every run refused ITSELF. `brain:upgrade` was dead
      100% of the time; `--dry-run` still passed, so an adopter could not self-diagnose.
      Fixed with `lock.mine`.
- [x] 8e.3 MEDIUM — an unreadable lock (empty, garbage, a directory, a dangling link)
      stranded the repo permanently: `Number.parseInt('')` is `NaN` and `NaN === NaN` is
      false, so compare-and-delete never fired. A zero-length lock is the canonical
      post-power-cut residue, so this manufactured a lockout on the exact event the
      feature exists to survive. Presence is now decided by `lstat`, and a lock naming
      no owner is reclaimed. REQ-J-11 covers all four shapes.
- [x] 8e.4 REQ-J-8's fixture used the test's OWN pid to fake a live owner, which
      `lock.mine` correctly suppresses — it now spawns a genuinely foreign process.
- [x] 8e.5 Removed debug fixtures (`lk/c/**`) committed by accident in 837cb0f — third
      instance of collateral from careless file handling on this branch.
- [x] 8e.6 `acquireLock`'s docstring claimed it consults `inspectRestorePoint`; it never did.
- [ ] 8e.7 **OPEN** — REQ-J-9 passes for the right reason but not the stated one: the FIFO
      blocks in the pre-flight collision read, not in the snapshot as its comment says.
      The assertion is still valid (the lock IS held); the comment is wrong.
- [ ] 8e.8 **OPEN** — `--recover` takes no lock, so a TOCTOU window remains between its
      verdict and a concurrent run's `acquireLock`. Narrowed to milliseconds, not closed.
- [x] 8e.9 A run wedged on a hung managed path dies only to SIGKILL — measured, and now in
      KNOWN-LIMITATIONS.

## Phase 8g — Eighth review: the whole feature, judged as a product

Reviewed with no knowledge of what had changed recently. Verdict on the mechanism:
**sound** — 16 SIGKILL points, real races, real hand-edits, all five ADR-0027 symlink
shapes, and "no interruption I could construct is neither detectable, nor reversible,
nor named". Both blocking findings were in how RECOVERY REPORTS itself, not in what it
does.

- [x] 8g.1 HIGH — `recoverFromJournal` returned `saved` and `created` as one `recovered`
      list, printed as "Restored N to their pre-upgrade bytes". But `created` paths are
      DELETED, and on a first adoption they are ~99.9% of the total. An operator who
      hand-repaired a file after a crash, then ran the command the tool recommends, lost
      that repair with no warning. Now reported as two lists, with an explicit warning
      that removals take later edits with them. `--dry-run` previews the same way.
      REQ-J-13 covers it, proven RED.
- [x] 8g.2 HIGH — a SIGKILLed run's lock survived forever: `--recover` never cleared it,
      and the interrupted refusal fires before `acquireLock`, so the one message naming
      the remedy was unreachable. Under pid reuse every surface refused and `--recover`
      said "wait for it to finish" — an instruction that can never come true. Recovery
      now clears a provably-dead lock, and every live-run refusal names the file and the
      escape. KNOWN-LIMITATIONS corrected: it claimed the refusal already said so.
- [x] 8g.3 MEDIUM — the `corrupt` refusal was terminal with no stated exit; it now says
      to salvage what is needed and then delete the directory to unblock upgrades.
- [x] 8g.4 MEDIUM — `fsync` never reached `destRoot`, which holds the snapshot
      directory's own entry, so a power cut could lose the whole restore point while its
      contents were durable. KNOWN-LIMITATIONS had claimed the chain was complete.
- [x] 8g.5 LOW — `proposal.md` and `design.md` still said "four disjoint locations" (five)
      and that ADR-0027 awaited signature (promoted in 32bc8e7).
- [ ] 8g.6 **OPEN, needs the maintainer** — ADR-0027 ships `Status: Accepted` above a
      banner saying the amended Decision #3 has not been separately confirmed. The ADR
      itself rejects "claim it is met" as the M10 failure mode, and no gate catches the
      contradiction. Either confirm the amendment and drop the banner, or return Status
      to Draft. **Not an agent's call.**
- [ ] 8g.7 **OPEN** — `restore()` judges `saved` by whether the copy threw rather than by
      outcome, so a read-only managed path that was never modified is reported as "still
      modified". Errs safe; turns a permission nit into a scary refusal loop.
- [ ] 8g.8 **OPEN (test coverage)** — 5 of 16 mutations survived: `acquireLock`'s `wx`
      → read-then-create, its read-back check, `writeJournal`'s tmp+rename, `discard()`'s
      journal-first ordering, and every `fsyncPath` no-op'd. All are durability/race
      properties no test currently pins.

## Phase 8f — Seventh review: reclaim widened too far

The reviewer judged the defect set "decisively smaller" and the collateral audit came back
CLEAN for the first time on this branch. One real regression, introduced by 8e.3's widening:

- [x] 8f.1 HIGH — `readable: false` meant "we did not obtain a pid", including because the
      READ FAILED. So a live owner's lock that merely could not be read (EACCES from another
      uid's lock, EIO from the failing disk this feature exists for, EMFILE, NFS ESTALE) was
      classified unowned and reclaimed out from under it — inverting this branch's own stated
      property from "it strands, it never permits" to permitting. Only EISDIR/ELOOP/ENXIO/
      ENOENT now mean unowned; every other errno is unknown and fails closed. REQ-J-12 covers
      it and is proven RED against the regression. The same fix closes the `--recover`-reverts-
      a-live-tree variant for free.
- [x] 8f.2 LOW — REQ-J-6/J-7 used pid `424242`, which is below this machine's `pid_max` and
      could be a live process; now `999999999` like REQ-J-5.
- [x] 8f.3 The reclaim race is now named in KNOWN-LIMITATIONS rather than implied away.
- [ ] 8f.4 **OPEN** — `acquireLock` checks `cur.alive` without `cur.mine`, so it is the last
      site reading the lock directly instead of the verdict. Fails safe and self-heals on
      re-run, but it contradicts the one-reader doctrine.
- [ ] 8f.5 **OPEN** — REQ-J-10's fixture has a single managed file, so "copied some, exited 0"
      is unobservable; only "copied nothing" is caught.

## Phase 8d — Fifth review: the verdict was right, the wiring was cut

The round-4 refactor added the right classifier and, in the same commit, deleted the code
that produces the state it classifies. A scripted multi-line replacement removed the
`acquireLock(ROOT)` call site as collateral, and the follow-up `str.replace` that was meant
to restore it silently matched nothing. **2293 tests stayed green**, because every lock test
called the library directly or staged a lock file by hand.

- [x] 8d.1 **REQ-J-9 first** — drives the real CLI, blocks it deterministically on a FIFO at a
      managed path, and asserts the lock is HELD while it works and that a second run is
      refused. Proven RED against the deleted call site before the fix was written.
- [x] 8d.2 CRITICAL — restored `acquireLock(ROOT)` + `release()` in the CLI
- [x] 8d.3 CRITICAL — `copyManaged`'s catch used a deny-list (`!interruptedRun`) and therefore
      cleared on `live-run`, deleting a live run's snapshot AND journal. Now an ALLOW-list: any
      refusal carrying `restorePointState` is re-thrown untouched, because none of them owns
      what is on disk.
- [x] 8d.4 HIGH — `acquireLock` was read→delete→create, three syscalls with no atomicity;
      measured 7 of 40 concurrent processes holding it at once. Now `wx`-first with
      compare-and-delete reclaim and a read-back ownership check. Measured 1 of 40.
- [x] 8d.5 MEDIUM — the journal is written to a temp file and RENAMED into place. A torn
      journal was the most likely `corrupt` producer, and its diagnosis would have been exactly
      backwards — it is written before the first managed write, so nothing had been written.
- [x] 8d.6 Docs corrected: the Concurrency bullet is now earned, the residual count was wrong,
      and pid reuse is named.
- [ ] 8d.7 **OPEN** — pid reuse. A recycled pid reads as a live owner and strands the repo until
      the lock is deleted by hand. Fails safe; a pid+start-time token would close it.
- [ ] 8d.8 **OPEN** — recovery's fsync barrier is a no-op for `created` paths (they are deleted,
      and making an unlink durable needs a parent-directory fsync).

## Phase 8c — Second slice-2 review: one owner for the lifecycle

Four consecutive rounds each produced a NEW defect of one shape: a cleanup that deleted
something another site owned. Round 4's was introduced by round 3's fix. The response was
structural rather than another patch.

- [x] 8c.1 `inspectRestorePoint()` — ONE reader, ONE verdict (`clean` / `debris` /
      `interrupted` / `corrupt` / `live-run`). Every transition obeys it; no site judges locally.
- [x] 8c.2 CRITICAL — `breakStaleLock()` ran unconditionally, so `--recover` broke a LIVE run's
      lock, defeating the mutex and letting recovery revert a tree mid-write while that run
      reported success. Liveness is now read from the pid the lock always stored and nobody read.
- [x] 8c.3 HIGH — a plain `--dry-run` never reached the gate (it lived inside `if (!dryRun)`),
      so the habit the docs recommend was the one path that hid a pending interrupted upgrade.
- [x] 8c.4 HIGH — a torn journal read as ABSENT, and absent means "delete the snapshot". Absent
      and unreadable are opposite evidence; `corrupt` now refuses and never auto-clears.
- [x] 8c.5 MEDIUM — `--recover --dry-run` deleted the lock file. Dry runs now take no lock at all.
- [x] 8c.6 MEDIUM — `lock.release()` deleted whatever was at the path; it now releases only a
      lock this process still owns.
- [x] 8c.7 MEDIUM — `fsync` extended to every intermediate snapshot directory (only the root was
      covered; almost every managed path is nested) and to recovery, which did none at all.
- [x] 8c.8 REQ-J-5 rewritten for the liveness contract; REQ-J-8 added for the live-owner refusal.
      Both proven RED against a build that reads every owner as dead.
- [x] 8c.9 Dead `renameSync` import removed (left by deleting `preserve()`).
- [ ] 8c.10 **OPEN** — `REQ-J-6` was credited with covering the round-3 CRITICAL and does not:
      its fixture writes a lock, so the CLI stops in the lock branch and never reaches
      `copyManaged`. The real coverage is `REQ-S6-11`. Left honest rather than re-credited.
- [ ] 8c.11 **OPEN** — the journal records no checksum, so a snapshot FILE torn by a power cut
      is still restored as-is and reported clean. Named in KNOWN-LIMITATIONS.

## Phase 8b — Slice 2 review remediation

- [x] 8b.1 CRITICAL — `copyManaged`'s snapshot-failure catch deleted the snapshot on the
      `interruptedRun` refusal too, destroying the evidence in the act of pointing at it.
      Third occurrence of the destroy-what-we-protect shape in this issue.
- [x] 8b.2 CRITICAL — the lock was taken before the `--recover` branch, and a SIGKILL always
      leaves it, so the one command that repairs a killed run was always blocked by it.
      Recovery now breaks a stale lock; a real upgrade still yields to it.
- [x] 8b.3 HIGH — no durability barrier: `fsync` on every snapshot file and on the journal
- [x] 8b.4 HIGH — REQ-J-1's timeout path left a busy-spinning child alive, hanging the CI
      runner at 100% CPU. Killed in `finally` on every path.
- [x] 8b.5 MEDIUM — `--recover` ignored `--dry-run` and wrote anyway
- [x] 8b.6 MEDIUM — an incomplete recovery renamed the snapshot, moving the journal out of
      `readJournal`'s sight and disarming the gate over a still-dirty tree. `preserve()` is
      removed entirely: slice 2's refusal supersedes the reason slice 1 needed it.
- [x] 8b.7 MEDIUM — `discard()` removes the journal FIRST, so an interrupted cleanup fails safe
- [x] 8b.8 LOW — `restore()` recreates a missing parent directory (recovery runs long after)
- [x] 8b.9 LOW — drift-guard widened to the lock, `.preserved-N`, and the journal
- [x] 8b.10 REQ-J-6/J-7 drive the REAL CLI over the exact state a kill leaves. Three of the
      defects above were invisible to tests that called the library directly.
- [ ] 8b.11 **OPEN** — the lock is still taken before the `.brain-source` self-host guard, so a
      run that will refuse anyway briefly creates a file in the consumer tree. Released on every
      path; transient residue, not a leak.

## Phase 8 — Slice 2: on-disk journal

- [x] 8.1 Write the journal AFTER the snapshot and BEFORE the first write — its absence is what proves nothing was written
- [x] 8.2 Detect an incomplete journal on a later invocation and REFUSE (explicit recovery, never automatic)
- [x] 8.3 **Inverted** `createRestorePoint`'s entry-time clearing — a leftover snapshot with a journal is evidence, not debris
- [x] 8.4 `recoverFromJournal()` + `brain:upgrade -- --recover`; reports recovered and failed separately
- [x] 8.5 REQ-J-1..5, including a REAL SIGKILL of a child mid-write
- [x] 8.6 `KNOWN-LIMITATIONS.md`: SIGKILL gap CLOSED; power loss NARROWED (fsync ordering) with
      integrity validation named as an outstanding residual — not claimed closed
- [ ] 8.7 Tracker PR carries `Closes #396`

## Gates (slice 1, re-run per push)

- [x] `npm test` — 2285/2285 (2268 baseline on `217b8ab` + 17)
- [x] `npm run brain:repo:check`
- [x] `npm run brain:nav`
- [x] Diff budget — 370/400 (real gate; `governance.ignoreList` excludes `**/*.test.mjs`)
- [ ] `actor-check` — RED until `status:approved` is re-applied **after** the current head, per the `lite` distinct-act evidence (REQ-L5-1′). Human action; never self-applied (#124).
