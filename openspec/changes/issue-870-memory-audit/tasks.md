---
status: applying
issue: 870
---

# Tasks: #870 — memory:audit

- [x] 1.1 RED: `lib/audit.test.mjs` — percentile nearest-rank; latencyStats (buckets, not-landed excluded and counted); classifyActor four shapes; coverage; lineAccounting; backendAccounting with duplicates listed; buildReport shape; renderReport lines; unreadable/refused shapes carry `measured: false` + reason.
- [x] 1.2 GREEN: `brain/scripts/memory/lib/audit.mjs`.
- [x] 1.3 GREEN: `audit` op in `memory/cli.mjs` (records reader, git landing reader, backend export reader with degradation) + `memory:audit` npm script + i18n keys.
- [x] 1.4 Run on `main` with `--since 2026-08-01`, compare with the hand queries; baseline (default window + JSON) pasted on #864.
- [x] 1.5 Replace `(ticket: file)` on 0.2 with #870 in `issue-864-memory-2-0/tasks.md`; tick 0.2; `npm test`, `brain:repo:check`; record via `memory:save --issue 870`.
- [x] 1.6 Cold review rev 1 (PR #871, REVISE) addressed as one work unit: (cold-1, blocker) the engram export row now runs `topicKeysFromExport`'s stdout-vs-file cross-check (#445) before counting — a truncated or drifted export is `measured:false` with the reason; (cold-2) `lib/audit-io.test.mjs` (11 tests through the seams) and `cli.audit.test.mjs` (6 tests through the real CLI against a git-initialised fixture) added; (cold-3) a trailing or flag-swallowed `--since` exits 1 instead of silently using the default window. Also: a git failure degrades latency to `measured:false` instead of aborting the whole report.

## Measured while applying
- Definition correction: the epic's opening p50 (10.9 h) was measured with plain `git log --diff-filter=A`, which after a merge-commit PR sees the branch commit where the record was WRITTEN, minutes after capture. With `-m --first-parent` (when the file reached main's line) the same window reads **p50 21.6 h, ≤1 h 43 (was 113), >24 h 154 (was 136)**. The opening number was optimistic; #864 baseline carries the corrected one.
- Two records carry `actor: "main"` — a bare branch name with no `/`; #738's "refuses a `/`" rule would let it through. Classified as branch here; noted on #738.
- A record that reached main only through a merge commit was invisible to `--name-only` without `-m`; first-parent view gives 2348 landings for 2348 files.

## Review Workload Forecast
- Estimated changed lines: ~180 non-test (lib ~110, cli op ~60, package.json 1, i18n ~6) + tests (ignore-listed).
- 400-line budget risk: Low.
- Chained PRs recommended: No.
- Decision needed before apply: No.

## Micro-decisiones en caliente
- Rows are counted from a list, never a Set — the existing `topicKeysFromExport` is not reused for the backend row.
- Default window 30 d; the baseline on #864 also runs `--since 2026-08-01` so the epic's opening numbers are reproduced by the tool, not remembered.
