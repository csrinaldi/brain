# Cutover Runbook — engram chunks → brain records (C2b-2)

> **Operator: @csrinaldi.** The agent does NOT run steps 1–3 against the real store. Execute this ONLY
> after the external CP-C2b-2 APPROVE. Each step has an exact command and an OBSERVABLE verification —
> do not proceed to the next step until the current step's verification passes. If any verification
> fails, STOP and run the Rollback section.
>
> **Why the order is load-bearing:** running the migrate without immediately activating dual-write would
> leave every later `share` writing chunks-only → a delta the one-shot (abort-if-populated) can never
> migrate; and chunks in `legacy/` break the old cross-machine `pull` for the window. The order closes
> both (`sdd/memory-format/c2-migrate-c2b-boundary`).

## Step 0 — Preflight + backup (no mutation)

```bash
# a. records/ MUST be empty/absent (else the migrate will abort — investigate first)
test ! -e .memory/records || { echo "records/ already exists — STOP, investigate"; }
# b. full backup of the memory store
cp -a .memory .memory.pre-cutover.bak
# c. capture the dry-run forecast to compare against the real run
npm run memory:migrate-v1 -- --dry-run | tee /tmp/cutover-dryrun.txt
```
**Verify:** `records/` absent; `.memory.pre-cutover.bak` exists; the dry-run prints `{recovered:0,
fallback:275}`, 3 rejected named (manual×1, preference×2), 4 emptyObservations, 0 unparseable.

## Step 1 — The real migration [HUMAN KEYSTROKE]

```bash
npm run memory:migrate-v1        # NO --dry-run — this WRITES records/ and moves chunks to legacy/
```
**Verify (must equal the forecast — ANY divergence STOPS the cutover):** the report prints
`275 fallback, 3 rejected named, 4 emptyObservations, 0 unparseable`; `.memory/records/` is populated;
`.memory/legacy/` holds the moved chunks + the persisted rejection report.

## Step 2 — Activate dual-write [IMMEDIATE, committed state marker]

```bash
# flip the committed cutover marker so every subsequent share dual-writes records/
#   brain.config.json: set  "memory": { "dualWrite": true }
git add brain.config.json && git commit -m "chore(memory): activate dual-write — cutover step 2 (#222)"
```
**Verify:** `brain.config.json` shows `memory.dualWrite: true`; the commit exists in git history
(auditable marker).

## Step 3 — Verification share (dual-write now active)

```bash
npm run memory:share             # export → chunk scrub → (now) dual-write records/ + reindex
```
**Verify:** the share succeeds (scrub green — no secret); `.memory/records/` gains the run's records with
no duplicate physical lines (idempotent); `.memory/index.jsonl` is consistent.

## Step 4 — Post-cutover success criteria

```bash
npm run memory:migrate-v1        # re-run → MUST abort (idempotency)
# pull/import round-trips against the new world (records → engram):
#   verify memory:pull / import rebuilds engram observations from records/
# smoke grep — ADR-0002's promise made command (git clone + grep answers a real question):
rg -c '"type":"decision"' .memory/records/*.jsonl
```
**Verify:** the re-run ABORTS with the "run the cutover runbook" message; pull/import works; the smoke
grep returns a real count from the plaintext records. Record each answer as CP-C2b-2 evidence.

## Rollback (its own section — REHEARSED in fixture; run if any step's verification fails)

```bash
npm run memory:migrate-v1 -- --rollback   # restore chunks from legacy/, remove records/, reindex
# if dual-write was already flipped, also revert step 2:
git revert --no-edit HEAD   # (the dualWrite=true commit)
# final safety net — the Step 0 backup:
#   rm -rf .memory && mv .memory.pre-cutover.bak .memory
```
**Restores:** `.memory/chunks/` (from `legacy/`), removes `.memory/records/`, rebuilds the index →
pre-cutover state.

**Rehearsal evidence (fixture, captured at CP-C2b-2):**

Fixture: a temp root with `.memory/chunks/chunk1.jsonl.gz` (1 observation), driven through
`brain/scripts/memory/cli.mjs migrate-v1` with `BRAIN_MIGRATE_V1_TEST_ROOT` pointed at the fixture
(never the real `.memory/` — see `cli.migrate-v1.test.mjs`).

```
$ find .memory -type f | sort              # pre-cutover
.memory/chunks/chunk1.jsonl.gz

$ node brain/scripts/memory/cli.mjs migrate-v1
✓ migration complete — written: 1 | rejected: 0 | skipped (personal): 0 | unparseable chunks: 0 | empty-observations chunks: 0 | index: 1 record(s). Next: commit memory.dualWrite=true (runbook step 2).

$ find .memory -type f | sort               # post-migration
.memory/index.jsonl
.memory/legacy/chunk1.jsonl.gz
.memory/legacy/migration-rejected.json
.memory/records/2026-07.jsonl

$ node brain/scripts/memory/cli.mjs migrate-v1 --rollback
✓ rollback complete — chunk(s) restored: 1 | index: 0 record(s).

$ find .memory -type f | sort               # post-rollback — matches pre-cutover
.memory/chunks/chunk1.jsonl.gz
.memory/index.jsonl                          # regenerated, deterministically empty (0 records)

$ diff <(gunzip -c pre-cutover-chunk1.jsonl.gz) <(gunzip -c .memory/chunks/chunk1.jsonl.gz)
(no diff — byte-identical)
```

Automated coverage of this exact sequence: `brain/scripts/memory/cli.migrate-v1.test.mjs` (CLI-level,
subprocess against a fixture) and `rollbackMigration: restores a migrated fixture to byte-identical
pre-cutover state` in `brain/scripts/memory/lib/migrate-v1.test.mjs` (function-level, byte comparison).
