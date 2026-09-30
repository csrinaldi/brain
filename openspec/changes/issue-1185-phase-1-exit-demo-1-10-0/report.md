# Report — phase-1 exit on 1.10.0 (2026-09-30)

## Exit clauses

| Clause | Result | Evidence |
|---|---|---|
| Fresh plainfiles and engram installs need no step outside install, bootstrap or upgrade | **No** | #1186/#1187 (`brain:ship` refused, `gh pr create` fallback): `evidence/brain-test-plainfiles-13`…`-17`, `evidence/brain-test-engram-12`, `-13`. #1188 (first real merge fails post-merge): `evidence/brain-test-plainfiles-20-postmerge-failure.txt`, `-21-postmerge-alarm.txt`, and its recovery once a record reached main, `-35-postmerge-after-lane.txt` |
| No credential committed | **Yes** | `evidence/credential-scan.txt`; `.env` untracked in both repos |
| #1081's four seams recover | **Yes** | Per seam in the table below |

## The stretch that ran clean

- Install; `env:init`; the adoption commit, with no ticket and no `--no-verify` (#1161).
- `brain:protect`.
- The first post-merge run: the cursor was bootstrapped at the adoption commit, with no alarm (#1162).
- Labels (#1163) and `brain.actor` (#1164) were set by `env:init`.
- Checkout B had no `.env` and took its backend from tracked config (#1165).
- The lane notice (#1166).

## What still needed a human

| Issue | What needed a human |
|---|---|
| #1186 | `brain:check`/`brain:ship` resolve issue-link as `repos/undefined`; an undocumented `git remote set-head origin -a` was needed |
| #1187 | `brain:ship`'s local gates (`npmTest`, `memoryPresence`) cannot pass on a fresh consumer's first PR |
| #1188 | The first real merge fails post-merge as `audit-unrevertible`; the alarm never closes |
| #1189 | (noise) plainfiles callers invoke an unsupported `import` op |
| #1190 | (candidate) a same-day re-ship after a squash merge diverged |

## Seams

| Seam | Where it ran | Result | Evidence |
|---|---|---|---|
| 1. hydration deferred, then recovered | engram | recovered | `brain-test-engram-30`–`32` |
| 2. `mrCreate` failure after the push, then retry | plainfiles | recovered | `brain-test-plainfiles-61` (injection), `-62` (retry), `-63`/`-64` (checks, merge). `-60` first hit `memory.ship.diverged` (#1190) and the stale lane branch was deleted by hand before the injection |
| 3. foreign path makes a gate red, then revert | plainfiles | recovered | `brain-test-plainfiles-50`–`53` |
| 4. index lag in checkout B, then `pull` | both | recovered | plainfiles `-40`…`-42`; engram `-40`, `-41` |
| #1118, the capturing checkout pulls its own lane merge | both | recovered | plainfiles `-43`; engram `-42` |

## Expected-open, still failing

- #1115: `session:start` delivers no memory content.
- #1117: search does not mark superseded records.
- #1167: `ship` prints no PR URL.
- #1168: `.memory` tracking differs by backend.

## A note on what the evidence contains

The transcripts carry the operator's hostname, in lane branch names and record provenance, and absolute home paths. They contain no credential: the token scan returns 0. The hostname is already public in this repository's own `memory/<host>-<date>` lane branches.
