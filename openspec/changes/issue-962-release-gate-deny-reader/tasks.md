# Tasks — issue #962

## Review Workload Forecast
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No
- Estimated production changed lines: 30 (`brain/scripts/brain-audit.mjs`: 23 insertions, 7 deletions; tests and `.md` docs excluded per `governance.ignoreList`)

## Phase 1: RED

- [x] 1.1 Add a fixture test to `brain/scripts/brain-audit.test.mjs` driving `brain-audit.mjs` through a temp repo (never the real clone) with an unparseable `brain.config.json`, asserting a non-zero exit that names the config as the cause. Use a genuinely-empty git range so `loadConfig`'s throw is the ONLY thing that can flip the assertion — no sibling reader (issueLink, memoryPresence, etc.) ever runs.
- [x] 1.2 Add a companion test asserting an ABSENT `brain.config.json` keeps exiting 0 (`R11`, unchanged) — the acceptance criterion's second bullet.
- [x] 1.3 Confirm RED: run the new tests against the unmodified `brain-audit.mjs` and record the failure output.

## Phase 2: GREEN

- [x] 2.1 Replace `loadConfig` (`brain-audit.mjs:159-165` pre-fix) to delegate to `loadBrainConfigOrThrow(cwd)` (`brain/scripts/lib/brain-config.mjs`) instead of `try { … } catch { return {}; }`. Do not catch locally — let the throw reach the existing top-level `.catch` (REQ-D2-12).
- [x] 2.2 Remove the now-unused `readFileSync` import from `brain-audit.mjs` (only consumer was the replaced `loadConfig`).
- [x] 2.3 Confirm GREEN: the two new tests pass; the absent-config test still passes (behaviour unchanged).

## Phase 3: Classification + doctrine draft

- [x] 3.1 Classify every config consumer in `brain-audit.mjs` as deny or allow, with file:line and the key read — written into `proposal.md` and mirrored below in `apply-progress.md`.
- [x] 3.2 Draft (never promote) `brain-drafts/deny-readers-roster-sixth.draft.md` — a `brain-amendment/1` draft moving `brain-audit.mjs` into the fixed-reader roster and reclassifying `approved-label.mjs` as a fixed-fallback exemption, not an ALLOW-list reader. Verify the `approved-label.mjs` claim by reading the source first.
- [x] 3.3 Prove the draft parses and its edit assesses as `pending` with a throwaway script (`/tmp/.../scratchpad/sim-roster-962.mjs`) that imports the real `brain/scripts/lib/amendment-draft.mjs`. Never run `brain:promote`.

## Phase 4: Verification

- [x] 4.1 Mutation table: revert the production fix only (keep the new tests), confirm exactly the new RED test (#962 unparseable-config test) fails and nothing else does; restore the fix, confirm full green.
- [x] 4.2 Run the full suite (`GIT_CONFIG_GLOBAL=/dev/null npm test`) and record pass/fail counts, both post-revert and post-restore.

## Phase 5: Commit + record

- [x] 5.1 Commit the test + fix together (one work unit, strict TDD).
- [x] 5.2 Commit the SDD docs (`proposal.md`, `spec.md`, `tasks.md`, `apply-progress.md`) and the doctrine draft separately.
- [ ] 5.3 Record-first commit: `npm run memory:save -- "<title>" "<content>"`, staging only the new `.memory/records/*.jsonl` plus `.memory/index.jsonl`.
