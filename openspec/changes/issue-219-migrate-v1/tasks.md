# Tasks — migrate-v1 real-run CODE (C2-migrate, #219)

> Dry-run code already present (cherry-picked from `wip/c2-migrate` onto the merged `feature/v2.0.0`).
> This slice adds the real-run CODE, fixture-tested. Real execution against the true store = C2b.

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Counted so far (dry-run) | ~225 (migrate-v1.mjs 149 + cli 55 + i18n 20 + pkg 1) |
| Real-run code budget | ~175 remaining to stay ≤400 — keep tight, split if it exceeds (never size:exception) |
| Delivery | Standalone PR-as-review into feature/v2.0.0, Part of #219 |

## Phase 1: real-run orchestration (RED → GREEN, fixtures only)
- [x] 1.1 Test (RED): a synthetic fixture store (temp dir) → `runMigration()` writes accepted records to `records/<yyyy-mm>.jsonl`, moves source chunks to `legacy/`, persists the rejection report, rebuilds the index.
- [x] 1.2 `runMigration()` in `migrate-v1.mjs` (GREEN) — deps injected; uses `appendRecord` + `rebuildIndex` + `exportObservation`; accepted written, rejected/skipped persisted, chunks moved to `legacy/`.
- [x] 1.3 Test (RED) + GREEN: **idempotency abort FIRST** — populated `records/` → throws, message contains `run the cutover runbook` + the records dir. Re-run over a just-migrated fixture aborts.

## Phase 2: CLI + i18n
- [x] 2.1 `cli.mjs` — replace the `realRunPending` guard (no `--dry-run`) with the real run; print a summary (records written, rejected, legacy path, report path). `--dry-run` unchanged.
- [x] 2.2 i18n en + es for every new string (real-run header/summary, the abort message with "run the cutover runbook", the persisted-report path line).

## Phase 3: evidence + baseline
- [ ] 3.1 `--dry-run` over a temp COPY of the real `.memory/chunks/` → `{recovered:0, fallback:275}`, 3 rejected named, 4 emptyObservations (verbatim capture for the checkpoint).
- [x] 3.2 `npm test` green (1001/1001) · `brain:nav` green · `brain:repo:check` green. Note: `brain:repo:check` initially failed on a PRE-EXISTING gap unrelated to this slice's code (`openspec/changes/issue-219-migrate-v1/` had no `proposal.md`; S-1 requires one in every non-archived change dir, and the commit-msg hook enforces `brain:repo:check`, blocking any commit). Added a minimal `proposal.md` (modeled on issue-217's) to unblock the mandatory hook — see proposal.md's "Risks" section for the disclosure.
- [x] 3.3 Counted diff ≤400 (excl. `*.test.mjs`, `openspec/changes/**`): net +144 lines (migrate-v1.mjs +117, cli.mjs +27, i18n net 0). Slice total ≈369/400.

## Out of scope → C2b
Import · scrub re-point · dual-write · THE CUTOVER (real execution + runbook).
