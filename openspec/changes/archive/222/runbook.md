# Cutover Runbook — engram chunks → brain records (C2b-2)

> **Operator: @csrinaldi.** The agent does NOT run steps 1–4 against the real store. Execute this ONLY
> after the external CP-C2b-2 APPROVE. Each step has an exact command and an OBSERVABLE verification —
> do not proceed until the current step's verification passes. On any failure, STOP and run Rollback.
>
> **Git materialization (not a direct push):** steps run on a branch `cutover/records-v1`; ONE atomic
> commit carries the migrated store **and** the `dualWrite=true` flip together; the cutover **completes
> when the PR to `feature/v2.0.0` merges**. This preserves rung-1 (no direct push / no bypass), the
> gates pass by design, and the shared world changes at merge — not at the keystroke.
>
> **Why the order is load-bearing:** migrate-without-immediate-dual-write leaves later shares
> chunks-only (a delta the one-shot can never migrate); the atomic commit closes that
> (`sdd/memory-format/c2-migrate-c2b-boundary`).

## ⚠️ EMBARGO — chunk-based `pull` is suspended for the transitional window

Between the **merge of the cutover PR** and the **merge of C4**, do NOT run `memory:pull` (chunk-based)
on ANY clone. The manifest goes stale by design — MEASURED: post-share it references 24 chunks, 23 of
them absent from `chunks/` and now in `legacy/`, so a chunk-based pull cannot find the migrated chunks.
This degradation is **transitional and DECLARED, never silent**; it is NOT data loss (the observations
live in `records/` — the new committed truth — and in `legacy/`; the records-based import reads `records/`).

- **Window minimized by scheduling:** C4 is the NEXT slice, with nothing in between. The window closes at
  C4's merge; **C4 is scheduled immediately** after the cutover merges.
- **Concrete second consumer:** `PCStaFe30-174` (`~/code/brain`, `feature/v2.0.0`) was synced pre-cutover
  on 2026-07-08 (31 chunks in its local engram). That machine MUST NOT run `memory:pull` from the cutover
  merge until the C4 merge — its risk delta is only what is shared from today onward.
- **Enforcement caveat:** a written note relies on human discipline. If any clone's session-start hook
  auto-runs a chunk-based sync/pull, the embargo can be violated silently — confirm the hook does not
  pull (or pause it on `PCStaFe30-174` for the window).

## Step 0 — Preflight + backup + branch (no shared-world change)

```bash
# 0a. records/ MUST be empty/absent — HARD STOP (this is a MANDATORY gate, not a print).
if [ -e .memory/records ]; then echo "ABORT: .memory/records already exists — investigate before cutover"; exit 1; fi
# 0b. full backup of the memory store (the rollback safety net)
cp -a .memory .memory.pre-cutover.bak
# 0c. capture the dry-run forecast to diff against the real run
npm run memory:migrate-v1 -- --dry-run | tee /tmp/cutover-dryrun.txt
# 0d. branch off the integration branch (all cutover work lands via PR)
git fetch origin && git switch -c cutover/records-v1 origin/feature/v2.0.0
```
**Verify:** step 0a exited non-zero if `records/` existed (you are still pre-cutover); `.memory.pre-cutover.bak` exists; the dry-run prints `{recovered:0, fallback:275}`, 3 rejected named (manual×1, preference×2), 4 emptyObservations, 0 unparseable; you are on `cutover/records-v1`.

## Step 1 — The real migration [HUMAN KEYSTROKE]

```bash
npm run memory:migrate-v1        # NO --dry-run — WRITES records/ and moves chunks to legacy/
```
**Verify (report MUST equal the forecast — ANY divergence STOPS the cutover):** `written: 275,
rejected: 3, skipped (personal): 0, unparseable chunks: 0, empty-observations chunks: 4`. `records/`
populated; `legacy/` holds the 47 moved chunks + `migration-rejected.json`. **Expected note:** the
summary's `index: N record(s)` is the DEDUPED unique-id count (content-addressed ids collapse
duplicates — the measurement saw 275 written → 136 unique). The forecast is the 275/3/4/0 report, not
the index count.

## Step 2 — Activate dual-write [committed with step 4, same atomic event]

```bash
#   brain.config.json: set  "memory": { "dualWrite": true }
```
**Verify:** `brain.config.json` shows `memory.dualWrite: true` (do NOT commit yet — it is part of the
single atomic commit in step 4, so the migrated store and the flip land together).

## Step 3 — Verification share + its MEASURED behavior (pinned — do not skip)

```bash
npm run memory:share             # export → chunk scrub → dual-write records/ (now active) → reindex
```

**MEASURED against a copy of the real store (migrate → flip → share; the evidence is in the checkpoint
report). This is what the first post-cutover share ACTUALLY does — verify against THIS, not an
idealized model:**

- engram's export is **manifest-tracked, not chunks/-content-tracked**: it does NOT re-materialize the
  47 migrated-away chunks. It writes only the **delta** (the measurement: one new chunk, ~17
  observations changed since the last export). So `chunks/` ends with only the new delta chunk(s), NOT
  the full set.
- The **manifest becomes stale relative to `chunks/`**: it still references the migrated chunks (the
  measurement: 23 of 24 referenced chunks are absent from `chunks/`, now in `legacy/`). Therefore the
  **old chunk-based cross-machine `pull` is DEGRADED for the transitional window** — it cannot find the
  migrated chunks in `chunks/`.
- **This is NOT data loss.** The migrated observations live in `records/` (the new committed truth) and
  in `legacy/` (the preserved originals). The records-based pull/import (C2b-1) reads `records/`; the
  `pull → records-only` switch that retires this degradation is **C4**.
- `records/` stays idempotent (the dual-write dedups by id — no duplicate physical lines on re-share).
- **Why the index dedups 275 → 136 (MEASURED cause, not a surprise to investigate live):** the repo has
  **47 physical chunk files** but the pre-cutover manifest references only **23** — the other **24 are
  orphans** from manifest churn (superseded snapshots left committed without a reference), carrying
  overlapping observations. `migrate-v1` reads FILES, not the manifest, so it captures everything,
  orphans included (correct behavior), and the reindex collapses the overlap by content-hash → **136
  unique**. The "24 referenced" in the bullet above is the POST-share manifest (23 pre-existing + 1 new
  delta chunk); the "23" here is the pre-cutover manifest — different points in time, NOT a contradiction.
  This same manifest-churn history is why the second consumer reported "31 imported".

**Verify:** the share succeeds (scrub green); `chunks/` contains only the new delta chunk(s);
`records/` gained no duplicate physical lines; the manifest/`chunks/` mismatch is the KNOWN transitional
state above (resolved at C4), NOT a surprise. **If cross-machine chunk-pull IS needed during the window,
STOP — the fix (records-based pull earlier, or migrate copy-not-move) is designed before proceeding.**

## Step 4 — ONE atomic commit + PR (the cutover materializes here)

```bash
# the migrated store AND the dualWrite flip in a SINGLE commit — one atomic cutover event
git add .memory brain.config.json
git commit -m "feat(memory): cutover — migrate chunks→records + activate dual-write (#222)"
git push -u origin cutover/records-v1
# PR body MUST paste the real Step 1 migrate report + the EMBARGO note (naming PCStaFe30-174).
gh pr create --base feature/v2.0.0 --title "cutover: records-v1 (#222)" \
  --body "Part of #222 — the real cutover, per runbook.md.

Real migrate report (Step 1): written 275, rejected 3, skipped 0, unparseable 0, empty 4; index 136 unique.

EMBARGO: between this PR's merge and C4's merge, NO chunk-based memory:pull on any clone (manifest stale
by design — references 24, 23 in legacy/). PCStaFe30-174 (~/code/brain, feature/v2.0.0, synced 2026-07-08)
MUST NOT pull until C4 merges. C4 is scheduled immediately."
```
**Verify:** the commit contains `.memory/records/`, `.memory/legacy/`, the `chunks/` delta, the updated
manifest, AND `brain.config.json` with `dualWrite: true` — all together. The PR body carries the real
migrate report + the embargo. The PR's 5 REQUIRED gates are green (rung-1 preserved; no bypass).
**Opening this PR is the final step of the runbook; the cutover COMPLETES when it merges** — that merge is
the closure of the cutover and the final evidence of CP-C2b-2.

## Step 5 — Post-cutover success criteria (verify on the branch, before/with the merge)

```bash
npm run memory:migrate-v1        # re-run → MUST abort (idempotency)
#   records-based pull/import round-trips (records/ → engram) — the C2b-1 import over real data
rg -c '"type":"decision"' .memory/records/*.jsonl   # smoke grep — ADR-0002's git-clone+grep, made command
```
**Verify (against the MEASURED numbers — any divergence STOPS the cutover and returns to the reviewer):**
the Step 1 report equals **275 written / 3 rejected / 0 skipped / 0 unparseable / 4 empty** AND the index
is **136 unique records** (dedup cause pinned in Step 3 — known, not a surprise to investigate live). The
re-run ABORTS with the "run the cutover runbook" message; the records-based import rebuilds engram
observations from `records/`; the smoke grep returns a real count from the plaintext records. Record each
answer as the cutover evidence (post-merge, human-executed).

## Rollback (its own section — REHEARSED in fixture; run if any step fails)

**Before the PR merges (shared world unchanged):** the cutover is just a branch — `git switch
feature/v2.0.0 && git branch -D cutover/records-v1` (do not merge the PR), then restore the local store:

```bash
npm run memory:migrate-v1 -- --rollback   # restore chunks from legacy/, remove records/, reindex
# final safety net — the Step 0 backup:
#   rm -rf .memory && mv .memory.pre-cutover.bak .memory
```
**After the PR merges:** revert the merge commit via a new PR (`git revert -m 1 <merge-sha>`) + run the
`--rollback` on each affected clone — rung-1 preserved (revert also goes through a PR).

**Restores:** `.memory/chunks/` (from `legacy/`), removes `.memory/records/`, rebuilds the index →
pre-cutover state.

**Rehearsal evidence (fixture, captured at CP-C2b-2 — an unrehearsed rollback is a hope):**

```
$ node brain/scripts/memory/cli.mjs migrate-v1              # (BRAIN_MIGRATE_V1_TEST_ROOT=fixture)
✓ migration complete — written: 1 | rejected: 0 | ... | index: 1 record(s).

$ node brain/scripts/memory/cli.mjs migrate-v1 --rollback
✓ rollback complete — chunk(s) restored: 1 | index: 0 record(s).

# independent function-level rehearsal (sha256 per chunk file):
PRE-CUTOVER   chunks/: c1:a9edb1eb5765 | c2:e9bccc90e203
AFTER ROLLBACK chunks/: c1:a9edb1eb5765 | c2:e9bccc90e203 · records/: removed · {restored:2}
✓ BYTE-IDENTICAL RESTORE — chunks bit-for-bit, records/ gone
```
Automated coverage: `rollbackMigration: restores a migrated fixture to byte-identical pre-cutover
state` (lib) + `migrate-v1 --rollback restores a migrated fixture` (CLI subprocess).
