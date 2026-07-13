# Design — CLOSE THE WINDOW (slice C4)

Make `records/` the sole read+write truth. Retire the `memory.dualWrite` flag and the transitional
chunks path, switch `pull`/`import` to records-only, pin the round-trip contract on the real store, and
END the embargo. All artifacts English (ADR-0009).

## Decision 1 — `memory.dualWrite` retires BY DELETION (pre-release ruling, HUMAN-DECIDED)

The C4 PR makes **three moves** — this is the human ruling, encoded verbatim in intent (it supersedes
the exploration's earlier lean toward "tolerate-and-ignore"; that mechanism belongs to the FUTURE
post-release case, not this one):

1. **Delete the gate** at `engram.mjs:176` (`if (_loadConfig(root)?.memory?.dualWrite === true) …`
   inside `share()`, engram.mjs:153-179) → record-write becomes **UNCONDITIONAL**. Records-only is the
   only path; there is no flag to condition on. This is the sole runtime read site in the whole repo —
   `migrate-v1.mjs` never reads it — so deleting it fully de-wires the flag.
2. **Delete `memory.dualWrite`** from this repo's root `brain.config.json` in the SAME PR. It propagates
   to clones via `git pull` (the config file is committed).
3. **REMOVE the entire 0.6.0 migration entry** from `brain/core/config-migrations.mjs:86-99`.

### Why move 3 is honest: the never-shipped verification (CP-C4 evidence)

Removing a migration entry is normally forbidden (destructive to consumers who ran it). It is honest
HERE, and ONLY here, because the entry was **never shipped to any consumer** — verified and CLEAN:

- The 0.6.0 migration (`memory.dualWrite`) was added by commit **654e86c** (C2b-1, #223).
- `git tag --contains 654e86c` → **NONE**. The commit is only on `feature/v2.0.0`, **never on `main`**,
  and **not an ancestor of tag `v0.6.0`**.
- Therefore no released consumer ever ran this migration; deleting it strands nobody. Capture this
  verification output in the PR body as CP-C4 evidence.

**Fallback (documented, not taken):** if any tag HAD shipped the entry, we would NOT delete it — we would
leave an inert key with a "RETIRED at C4" marker in the entry description. The verification is the gate
between "delete" and "mark inert."

### Doctrine established (state it, do not over-generalize)

- **Never-shipped keys retire BY DELETION.** Pre-release, removal is free — there is no consumer to
  honor. This is the C4 case.
- **Post-release retirement** (the FIRST real one, whenever it comes) will use **tolerate-and-ignore +
  deprecation warning** — stop reading the key, warn if present, leave it in place. This is stated as
  future doctrine, **NOT invented or built speculatively now**.
- **Destructive-migration + schemaVersion-bump is REJECTED.** It contradicts the additive-only doctrine
  (`config-migrations.mjs`: all 6 entries additive; `mergeDefaults` structurally cannot remove a key),
  and — critically — it does **not self-apply** to this repo (see Decision 5).

### No new ceremony for touching `brain/core/`

C4 is the **THIRD** slice to touch `brain/core/config-migrations.mjs` (after #215 C1b and #223 C2b-1).
Both prior slices PASS+warn on `brain-writes-reviewed` — `brain/core/` code is authored by the agent
under the L6 gate + human review of the merge. No new ceremony is introduced; this edit rides the same
established path.

## Decision 2 — D2 pull/import is GREENFIELD, records-only, and IDEMPOTENT

`importRecord()` (`engram-import.mjs:56-74`, shipped dormant in C2b-1) is a pure transform NOT wired into
`pull`/`import`. Today `importMemory`/`pullMemory` (engram.mjs:477-533) are 100% chunk-based
(`engram sync --import`). C4 wires the record path:

- **Read** `.memory/records/*.jsonl` via `readRecordObservations`/`parseRecordLine`.
- **Transform** each via `importRecord()`.
- **Write** per-record via `execFileSync("engram", ["save", …])` — the exact per-observation verb already
  used by `_defaultEngramSave()` (engram.mjs:916-922). Batching = per-record save with **progress
  reporting** for the ~275 records (no bulk verb exists; per-record is the honest primitive).
- **IDEMPOTENT (MANDATORY):** re-running pull over an already-populated engram MUST NOT duplicate. Dedup
  by id or content, whichever the engine allows, with an **explicit re-run-no-duplicate test**. Records
  are content-addressed (ids collapse duplicates), which is the natural dedup key.

## Decision 3 — D4 memory-gate goes records-only, and finding 7 (id:388) is fixed in the same slice

`run-check.mjs` currently UNIONS `readChunkObservations` (chunk-reader.mjs:23-42) + `readRecordObservations`
(store.mjs:151-176) — the #227 OR was explicitly transitional ("Retire the chunks-path once fully
decommissioned — tracked for C4/D1"). C4 drops the chunk reader from the union → **records-only**.

Folded in: **cutover finding 7 (id:388)** — a LIVE bug now that the real store moved chunks to `legacy/`.
`_defaultChangedChunkFiles` (engram.mjs:352-372) runs unfiltered `git status --porcelain` on
`.memory/chunks`, filtering only by the `.jsonl.gz` suffix. A deletion line (`D `/` D`) whose path ends
in `.jsonl.gz` PASSES the filter → `scrubChunkFile()` (secret-scrub.mjs:104-115) does `readFileSync` with
no existence guard → **ENOENT throw** in `scrubMaterializedChunks()`. Fix: exclude porcelain deletions
(and/or guard existence before read), with a regression test. This is grouped with D4 because both
concern the dying chunks path.

## Decision 4 — D5 ends the embargo with PRECISE wording

The embargo (from the cutover runbook) suspended chunk-based `pull` because the manifest went stale by
design. C4 removes the chunk path entirely, so the correct END wording is: **"the chunk path no longer
exists, so there is nothing left to go stale."** Do NOT write "chunk-based pull is safe again" — the path
is GONE, not re-secured (kickoff correction). Declared in the PR body.

## D1/D4 sequencing coupling (why order matters in tasks.md)

The memory-gate unions BOTH readers until D4 lands. Retiring/deleting the dualWrite path (D3) or asserting
the records-only contract (D1) while the gate still reads chunks would leave the gate coupled to a path
we are removing. Therefore tasks.md sequences **D4 (+finding 7) FIRST**, then D3, then D2, then D1 — so by
the time D1 pins the records-only round-trip, the gate is already records-only and no transitional
dual-reader remains.

## Open question — this repo's `schemaVersion` is STALE at 0.3.0 (data point, not decided here)

This repo's own `brain.config.json` carries `"memory":{"dualWrite":true}` but `"schemaVersion":"0.3.0"` —
**three versions behind** the 0.6.0 migration that key belongs to. This proves `dualWrite:true` was set by
a MANUAL edit (the cutover keystroke), NOT via `migrateConfig`/`brain-upgrade`. Relevant to Move 2:
because the config was never migrated forward, removing the key locally is a manual edit regardless of
what happens in `config-migrations.mjs`, and removing the 0.6.0 entry is consistent (this repo never ran
it). **OPEN QUESTION — not decidable from the ruling:** should C4 also reconcile/bump this repo's stale
`schemaVersion`? The ruling addresses the key's retirement, not the schemaVersion drift. Flagged for
human decision; C4 does NOT bump it unless directed (default: leave it, note the drift).

## Inconsistency surfaced (issue vs. grounding)

The exploration (obs #391) RECOMMENDED option (b) "tolerate-and-ignore / stop reading it." The HUMAN
RULING chose the stronger **retire-by-deletion** (all three moves). This is not a contradiction in facts —
it is the human deciding beyond the explore recommendation, which the never-shipped verification makes
safe. This design encodes the RULING; the explore recommendation is preserved above as the future
post-release doctrine.
