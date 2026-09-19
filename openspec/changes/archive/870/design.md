---
status: applying
issue: 870
---

# Design: #870 — memory:audit

## D1 — pure core, thin I/O

`lib/audit.mjs` takes plain data and returns a report object: `percentile`, `latencyStats`,
`classifyActor`, `actorShape`, `coverage`, `lineAccounting`, `backendAccounting`,
`buildReport`, `renderReport`. No `fs`, no `child_process`. Every number is tested here.

`lib/audit-io.mjs` does the reading behind seams, and `cli.mjs`'s `audit` op dispatches to it:
records lines with their file names; `git log -m --first-parent --diff-filter=A --format="COMMIT
%ct" --name-only -- .memory/records` for the landing time of each file (the first-parent
line — see D3 for why the plain form is wrong); the backend export through the active
backend, run through `topicKeysFromExport`'s stdout-vs-file cross-check (#445) before any
count. Mirrors the `reindex` precedent — backend-agnostic ops are dispatched directly.

## D2 — the backend row degrades, it does not lie

engram: `engram export <tmp>` → observations → `topic_key` starting `rec-`, **as a list**, not
a Set (`topicKeysFromExport` returns a Set on purpose; a Set cannot count rows). plainfiles:
`index.jsonl` entries vs distinct ids, labelled `vacuity`. Any failure → `{measured: false,
reason}` and one printed line. Never a zero.

## D3 — definitions fixed here so the numbers are comparable

- window: `--since <ISO>`; default now − 30 d. Latency uses records whose `ts` ≥ since.
- landing time: the commit at which the record's file reached the **first-parent** line of
  the current branch (`git log -m --first-parent --diff-filter=A`). Measured: plain
  `--diff-filter=A` repeats side-branch adds (2383 lines for 2348 files) and misses a record
  that arrived only through a merge commit; first-parent gives exactly one landing per record.
- percentiles: nearest-rank on ascending hours.
- actor shapes: `@legacy` exact → legacy; contains `/` or is a bare default-branch name
  (`main`, `master`, `develop`, `trunk`; measured: two records carry `main`) → branch; `^@[A-Za-z0-9][A-Za-z0-9-]*$` → handle; else other.
- coverage: `issue` is a number; `supersedes` is a non-empty string.

## Delivery

Single PR to `main`: `Closes #870`, `Parent: #864` in prose. ~180 non-test lines. Strict TDD.
