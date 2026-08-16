# Tasks: `scalar()` must not read a trailing space as a value (#612)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~15-20 production lines (`**/*.test.mjs` and `openspec/**` are on `governance.ignoreList`, so the 6 modified/created test files are NOT counted toward review budget) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

The counted reviewable diff is effectively the one-line regex repair plus JSDoc in
`yaml-block.mjs`, and a small comment removal in `parse-verdict.mjs`. Everything else
(test files) is governance-ignored. No chaining needed.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full repair: regex, JSDoc, all consumer tests, F2 rewrite, drift header | PR 1 | Base `main`; rebase (not merge) past PR #695 if it has landed — unpushed branch, safe to rebase |

## Phase 1: Pre-flight

- [x] 1.1 Run `npm test` on branch tip; confirm baseline. Measured: 3821 tests, 0 failures unmodified (the F2 pin passes because it documents the pre-repair behavior). Re-measured with the regex-only change applied: 3821 tests, exactly 1 failure (`#452/#478-F2`), matching the design's prediction. See apply-report for exact counts.
- [x] 1.2 Checked PR #695 status (`gh pr view 695`): OPEN, not merged. No rebase performed — flagged for whoever lands second, per design.

## Phase 2: Core repair (RED then GREEN)

- [x] 2.1 [RED] Created `brain/scripts/review/lib/yaml-block.test.mjs` with the design D-A boundary table: `key: v`, `key:v`, `key:`, `key: ` → `null`, `key:\t` → `null`, `key:   \t  ` → `null`, `key: v  ` → `'v'`, CRLF `key:\r` → `null`.
- [x] 2.2 [RED] Added the NBSP row: `key: <NBSP>v` → `null`. Confirmed required — kills axis-2 mutant `(\S.*)`→`(.*)`.
- [x] 2.3 [RED] Added the trailing-trim row: `head_sha: <sha>  ` → parsed and trimmed. Confirmed required — kills axis-5 mutant (removed `.trim()`).
- [x] 2.4 [GREEN] In `brain/scripts/review/lib/yaml-block.mjs`, changed `^${key}:[ \t]*(.+)$` → `^${key}:[ \t]*(\S.*)$`. Kept `[ \t]*` and `.trim()` unchanged. Added JSDoc stating the three-state contract.

## Phase 3: Consumer pins (no consumer code changes)

- [x] 3.1 Rewrote `#452/#478-F2` in `parse-verdict.test.mjs:331` in place per design D-D — same id and comment trail, assertion inverted. Added the nothing-follows row (`findings: ` alone → `[]`) and the axis-11 invariant row (`sequencing:`, `controls:`, `controls_not_applied:` stay `malformed`).
- [x] 3.2 Added the six-key governance-invariance table to `brain/scripts/vcs/actor-check.test.mjs` (design D-C, colocated with the consumer): `protocol`, `decision`, `head_sha`, `actor`, `at`, `in_reply_to`. Includes the `sniffDecisionProtocol('protocol: ')` → not-addressed pin (through its one caller, since the function is private).
- [x] 3.3 Added whitespace-only refusal rows to `decision-block.test.mjs` (`decision: `, `head_sha: `, `actor: `).
- [x] 3.4 Added `track: ` → null/`'?'`-group and `blocks: ` → `[]` rows to `epic-map.test.mjs`.
- [x] 3.5 Added the new "missing key" error-text row to `checkpoint-block.test.mjs` for `counted_lines: `.
- [x] 3.6 Edited `yaml-block.drift.test.mjs` header comment ONLY — one paragraph pointing to `yaml-block.test.mjs`. Zero assertion changes (verified: 8 tests, 8 pass, identical to before).
- [x] 3.7 Dropped the stale "not repaired" claim in `parse-verdict.mjs:127-136`.

## Phase 4: Verification & delivery

- [x] 4.1 Re-ran `npm test`; 3847 tests, 0 failures (up from 3821 baseline — 26 new test rows added).
- [x] 4.2 Ran `npm run brain:repo:check` before each commit — both commits passed.
- [x] 4.3 Committed as two work units (conventional commits, no AI-attribution trailer), referencing #612. Did NOT push and did NOT open a PR per instructions.
