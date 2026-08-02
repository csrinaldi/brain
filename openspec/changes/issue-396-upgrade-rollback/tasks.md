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
- [x] 7.4 **F12** — fixed in slice 2: `acquireLock()` takes an exclusive `wx` lock, sibling to the snapshot dir so clearing that dir never releases it (REQ-J-5)
- [ ] 7.5 **F5** — a package manager that TRAPS SIGINT and exits non-zero still lands on
      "install failed — check repo access". Only a signal-killed child is covered.
- [ ] 7.6 **F10** — a directory/FIFO/socket at a managed path yields an opaque EISDIR/ENXIO
      instead of the actionable message the refusal branches were given.

## Phase 8 — Slice 2: on-disk journal

- [x] 8.1 Write the journal AFTER the snapshot and BEFORE the first write — its absence is what proves nothing was written
- [x] 8.2 Detect an incomplete journal on a later invocation and REFUSE (explicit recovery, never automatic)
- [x] 8.3 **Inverted** `createRestorePoint`'s entry-time clearing — a leftover snapshot with a journal is evidence, not debris
- [x] 8.4 `recoverFromJournal()` + `brain:upgrade -- --recover`; reports recovered and failed separately
- [x] 8.5 REQ-J-1..5, including a REAL SIGKILL of a child mid-write
- [x] 8.6 `KNOWN-LIMITATIONS.md`: SIGKILL / power-loss gap CLOSED
- [ ] 8.7 Tracker PR carries `Closes #396`

## Gates (slice 1, re-run per push)

- [x] `npm test` — 2285/2285 (2268 baseline on `217b8ab` + 17)
- [x] `npm run brain:repo:check`
- [x] `npm run brain:nav`
- [x] Diff budget — 370/400 (real gate; `governance.ignoreList` excludes `**/*.test.mjs`)
- [ ] `actor-check` — RED until `status:approved` is re-applied **after** the current head, per the `lite` distinct-act evidence (REQ-L5-1′). Human action; never self-applied (#124).
