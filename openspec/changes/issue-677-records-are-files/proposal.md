---
status: draft
issue: 677
---

# Proposal — the durable log stops needing a merge driver

## The ruling, first

#677 offered four options and left the ruling to whoever owns ADR-0017. This PR takes **option
1 — one record per file** (`records/<yyyy-mm>-<id>.jsonl`), because it is the only one that makes
the conflict *impossible* rather than survivable, and because the objection that would have
counted against it turned out, when measured, not to hold.

Options 3 (enforce the local-merge path) and 4 (fail closed on a bad resolution) were rejected as
*primary* fixes for the same reason: both leave the durable append-only log as a file two humans
resolve by hand, on the one path where a dropped record is indistinguishable from one never
written. Option 2 (capture on merge) moves the record out of review, which is a larger doctrinal
change than the one this ticket needs.

## Measured before writing anything

**The mechanism, isolated.** Two branches, two different records, one shared base, no
`.gitattributes` — the condition the forge merges under. Same inputs both times; the only
variable is the layout:

```
one month file      →  CONFLICT (3 stages on 2026-07.jsonl)
one file per record →  clean, 32 files, both records present
```

Both are now tests (`records-merge.integration.test.mjs`), running real `git merge`, because the
whole point of this ticket is that reading `.gitattributes` proves nothing.

**The objection ADR-0017 raised against sharding, priced.** The rejected-alternatives passage
objected to fragmenting the layout. Measured on this repository's real store (2052 records),
exploded into 2052 files:

```
read the whole store   3 month files  ≈133 ms      2052 record files  ≈70 ms   (1.9× FASTER)
packed repository      2.34 MiB                     2.68 MiB                    (+15%, one-off)
20 further records     +11 KiB                      +13 KiB                     (equivalent)
git status             6 ms                         6 ms
```

The read result was the surprise, and it is not subtle: `split('\n')` over a 7 MB string costs
more than 2051 small reads. I expected the incremental cost to favour the split layout too (a
month-file append rewrites the whole blob); measured, delta compression absorbs it and the two
are equivalent. Reported because it was measured, not because it helps.

**The migration, proved lossless on the real corpus before it was run on it.** Applied to a copy
first:

```
old physical lines 2052 → new 2052 · unique byte-strings 2052 → 2052
bytes in old but not new: 0     bytes in new but not old: 0
filenames != <month>-<id>.jsonl: 0     files with != 1 line: 0
index: 2052 entries, non-`file` fields changed: 0, `file` changed: 2052
```

Then on the real store, with `brain:metrics` byte-identical before and after and the record
id-set hash unchanged. The one observable difference is record *iteration order* (filename order
instead of append order); no consumer reads order — checked, then confirmed by the identical
metrics output.

## What ships

- `appendRecord` writes `records/<yyyy-mm>-<id>.jsonl` — one record, one file, one line. It is
  idempotent and **says so** (`written: false`), and it never overwrites a file that already
  exists, because that file may be what another branch merged in.
- `recordFilename` is the single statement of the layout, and it refuses to build a path out of
  an `id` that is not `rec-<16 hex>` — the `id` is a filename now.
- **Readers are untouched.** They already glob `*.jsonl` and parse line by line, so month-file,
  per-record and half-migrated stores read identically. That is what makes the migration
  opt-in rather than a forced rewrite of a store brain does not own.
- `memory:split-records` — report-only unless `--apply`; refuses any corrupt or tampered line
  before writing anything; deletes a month file only after every record it held has been read
  back out of the new layout.
- `.gitattributes` keeps `merge=union`, with the comment saying plainly that it is no longer
  load-bearing. Proved by mutation: removing it turns nothing red.

## Deliberately not done

**`.memory/manifest.json`'s custom driver stays.** The acceptance allows this if the reason is
stated. It indexes the legacy engram *chunk* transport (`.memory/chunks/`, gitignored), not the
durable records; it is derived and regenerable — `day-start` already discards its local churn as
safe — so a bad merge loses a pointer `memory:share` rebuilds, not a record nothing can recover.
Retiring it belongs with the chunks decommission (C4/D1, #247).

**A store that does not run the migration is not fixed.** By design: `.memory/**` is
consumer-owned. Stated in the ADR draft rather than left for someone to discover.

## The one-time cost this PR imposes, stated up front

Every currently-open PR that captured memory appends to `2026-08.jsonl`, which this PR deletes.
Merging this first turns those into **delete/modify** conflicts. That failure is loud — it cannot
be merged past by accident — and the resolution is mechanical: drop the month file, re-add the
branch's own record as `.memory/records/<yyyy-mm>-<id>.jsonl`, or simply re-run
`npm run memory:split-records -- --apply` after taking main's side. Sequencing this after the
currently-open memory PRs, or accepting one round of mechanical resolutions, is the maintainer's
call.

## Acceptance

- [x] Two records captured on two branches merge with **no driver at all** — proven by running
      real `git merge`, in a test, both directions (the month layout still conflicts).
- [x] The residual case is named rather than claimed away: a same-`id` pair with divergent bytes
      still conflicts, on one file holding one record whose two sides are the same record.
- [x] A hand-resolution can no longer silently lose records it did not touch — the blast radius
      of any records conflict is now exactly one record.
- [x] `.memory/manifest.json` is addressed explicitly, with the reason for deferring it.
- [ ] **The forge-side half**: `mergeable` reported clean by GitHub for a second memory-capturing
      branch in the new layout. Recorded in `tasks.md` with what was actually observed.

## Links

- #677 · ADR-0017 (+ Amendment 1, #635) · ADR-0002 (where the drivers are registered) · #574/#598
  (the duplicate report) · #636 (the reconciliation a bad hand-resolution would reverse) ·
  `evidence-reader-empty-on-failure`
