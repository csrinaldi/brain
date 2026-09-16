# Tasks — issue #975

## Review Workload Forecast
- 400-line budget risk: Low (tier `lite`, budget 1000, never 400)
- Chained PRs recommended: No
- Decision needed before apply: No
- Estimated production changed lines: 74 (`brain/scripts/lib/brain-config.mjs`:
  69 insertions, 5 deletions; tests and `openspec/**` excluded per
  `governance.ignoreList`)

## Phase 1: RED

- [x] 1.1 Add `T4`-`T7` to `brain/scripts/lib/brain-config.test.mjs`: `loadBrainConfigOrThrow` against a temp fixture (never the real clone) for `null`, `[]`, `42`, `"x"` — each asserts a throw naming the path and the JSON type found.
- [x] 1.2 Add `T8`-`T9` (unchanged-case regression pins): absent file → `{}`; a valid object → returned unchanged.
- [x] 1.3 Add a fixture test to `brain/scripts/brain-audit.test.mjs` driving `brain-audit.mjs` through a temp repo with a non-object (`[]`) `brain.config.json`, asserting non-zero exit naming the config and the type — modeled on the `#962` precedent (genuinely-empty git range so no sibling reader ever runs).
- [x] 1.4 Add three tests to `brain/scripts/approve/cli.test.mjs`: `defaultReadDenyActors`/`defaultReadAgentActors` against a non-object config (direct, modeled on `T9`/`T9b`), plus a `runApprove` fixture test wiring the REAL `defaultReadDenyActors` (not a stub) against a fixture dir — the real entry point, not the loader alone.
- [x] 1.5 Confirm RED: revert only the production fix (`git stash push -- brain/scripts/lib/brain-config.mjs`), run all four new/touched test files, record exactly which tests go red.

## Phase 2: GREEN

- [x] 2.1 Add `isPlainObject`/`describeJsonType` helpers and the shape check to `loadBrainConfigOrThrow` (`brain/scripts/lib/brain-config.mjs`). Error message: `brain.config.json at <path> must contain a JSON object, got <type>` (verbatim from the issue's "Expected" section).
- [x] 2.2 Confirm GREEN: restore the fix (`git stash pop`), run the same four test files, confirm 0 failures.

## Phase 3: Classification + doctrine draft

- [x] 3.1 List every `loadBrainConfigOrThrow` call site (measured via `rg`, not assumed from the issue's non-exhaustive evidence list) with key, direction, and how it is proven — written into `proposal.md`.
- [x] 3.2 Classify `loadBrainConfig()` (issue #975, Expected item 3) for the same gap. Re-derive its full caller list from source, classify each, and record the decision (leave unchanged, with justification) in `proposal.md`.
- [x] 3.3 Draft (never promote) `brain-drafts/loader-shape-gap-closed.draft.md`, anchored on the doctrine paragraph text as it will stand after PR #980 (issue #976) merges — read directly from `gh pr diff 980`, not assumed.
- [x] 3.4 Prove the draft parses and its edit assesses as `blocked` against the CURRENT (pre-#980) doctrine text and `pending` against a simulated post-#980 text, with a throwaway script, and note explicitly that the anchor will only match after #980 merges (so promotion, if ever done, must wait).

## Phase 4: Verification

- [x] 4.1 Mutation table: revert the production fix only (`brain-config.mjs`), confirm exactly the 8 new RED tests fail (4 loader-level, 3 in `approve/cli.test.mjs`, 1 in `brain-audit.test.mjs`) and nothing else; restore, confirm full green.
- [x] 4.2 Run the full suite (`GIT_CONFIG_GLOBAL=/dev/null npm test`) and record pass/fail counts, both post-revert and post-restore.
- [x] 4.3 Record the counted production diff against `governance.ignoreList` and the repo's `governance.tier` (`lite`, budget 1000).

## Phase 5: Commit + record

- [x] 5.1 Commit the tests + fix together (one work unit, strict TDD).
- [x] 5.2 Commit the SDD docs (`proposal.md`, `spec.md`, `tasks.md`, `apply-progress.md`) and the doctrine draft separately.
- [x] 5.3 Record-first commit: `npm run brain:memory:save -- "<title>" "<content>" --issue 975 --type bugfix` (both positionals required — a single positional silently appends "undefined", #928), staging only the new `.memory/records/*.jsonl` plus `.memory/index.jsonl`.
