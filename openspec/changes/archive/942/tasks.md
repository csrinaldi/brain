# Tasks: A Deny List That Cannot Be Read Is Not an Empty Deny List (#942)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~128 counted (tests/draft excluded by `governance.ignoreList`) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr (decided) |
| Chain strategy | pending (not applicable) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `loadBrainConfigOrThrow` primitive (T1-T3) | PR 1 | Base: `fix/issue-942-deny-fail-closed` off main |
| 2 | `actor-check.mjs` deny hardening (T4-T5) | PR 1 | Depends on Unit 1 |
| 3 | `brain-writes-reviewed.mjs` fail-closed catch (T6-T8) | PR 1 | Depends on Unit 1 |
| 4 | `approve/cli.mjs` refusal shape (T9-T11) | PR 1 | Depends on Unit 1 |
| 5 | Mutation guard verification | PR 1 | Depends on Units 2-4 |
| 6 | R2 doctrine draft | PR 1 | Independent of 2-4 |
| 7 | Closing record commit | PR 1 | Last, depends on all |

## Phase 1: Foundation — shared primitive (R3, D1)

- [x] 1.1 RED: `lib/brain-config.test.mjs` T1 — no file → `loadBrainConfigOrThrow(dir)` returns `{}`.
- [x] 1.2 RED: T2 — `{oops` → throws, message has path + "could not be parsed".
- [x] 1.3 RED: T3 — config path is a directory → throws "could not be read".
- [x] 1.4 GREEN: implement `loadBrainConfigOrThrow(root = REPO_ROOT)` in `lib/brain-config.mjs` (D1); `loadBrainConfig()` untouched (R8).
- [x] 1.5 Commit "primitive": verify `node --test lib/brain-config.test.mjs`; rollback = drop the new export.

## Phase 2: `actor-check.mjs` deny hardening (R1, R4)

- [x] 2.1 RED: `vcs/actor-check.test.mjs` T4 — unparseable config, no reader injected → `fail`, reason matches `/brain\.config\.json/`.
- [x] 2.2 RED: T5 — no config → not `fail` for this reason, deny set empty (R11).
- [x] 2.3 GREEN: `defaultReadDenyActors` (`:1099-1108`) calls `loadBrainConfigOrThrow(cwd)`, drop its `catch`.
- [x] 2.4 GREEN: reword `gatherActorCheckInputs` catch reason to `could not gather inputs (gh/api or brain.config.json failure) — ${err.message}`; confirm throw already routes through the existing tiered catch (D4.1) — no new plumbing.
- [x] 2.5 Verify ALLOW readers `defaultReadBotAllowlist` (`:1058-1066`) and `defaultReadAgentActors` (`:1146-1155`) are byte-unchanged and still degrade to empty.
- [x] 2.6 Commit "actor-check deny hardening": verify `node --test vcs/actor-check.test.mjs`; rollback = revert this file only.

## Phase 3: `brain-writes-reviewed.mjs` fail-closed (R6, R7, D3)

- [x] 3.1 RED: `vcs/brain-writes-reviewed.test.mjs` T6 — unparseable config, no reader injected → `fail`, not `warn`.
- [x] 3.2 RED: T7 — no config → `botAllowlist: []`, normal verdict (R11).
- [x] 3.3 RED: T8 — unparseable config + `deps.tier` forced to a detection-tier cell → `warn` arm reachable.
- [x] 3.4 GREEN: `defaultReadBotAllowlist` (`:249-258`) and `defaultReadApprovalActors` (`:269-278`) call `loadBrainConfigOrThrow`, drop `catch`. Docblock note: the latter is allow-direction (D3), hardened in-scope, unobservable because `readBotAllowlist()` throws first at `:354`.
- [x] 3.5 GREEN: add own never-throwing `resolveTierForFailure` helper (~10 lines, deliberately duplicated — R4 forbids an L5→L6 import edge); make `:407-415` tier-aware via `resolveGatePolicy('brain-writes-reviewed', tier)` → `fail` when `required`, else `warn`.
- [x] 3.6 GREEN: correct the `:365-370` "detection-only (DETECTION_JOBS)" docstring to state the tier-aware rule (R7).
- [x] 3.7 Commit "brain-writes-reviewed fail-closed": verify `node --test vcs/brain-writes-reviewed.test.mjs`; rollback = revert this file only.

## Phase 4: `approve/cli.mjs` refusal shape (R5, D4.3)

- [x] 4.1 RED: `approve/cli.test.mjs` T9 — exported `defaultReadDenyActors(tmpDir)` with unparseable config → throws, message names the file.
- [x] 4.2 RED: T10 — same, no config → returns `[]` (R11).
- [x] 4.3 RED: T11 — `runApprove` with `readDenyActorsFn: () => { throw }` → `exitCode === 1`, stdout matches `/^✗/m`, promise does not reject, `prReviewComment` call count 0.
- [x] 4.4 GREEN: `defaultReadDenyActors`/`defaultReadAgentActors` (`:116-140`) gain optional `root` param, call `loadBrainConfigOrThrow(root)`, drop `catch`, export both.
- [x] 4.5 GREEN: wrap the unguarded call at `:234` in `try/catch` → `say('✗ could not read the approval deny list: ${err.message}')` + explanatory line + `return done(1)`, mirroring `:220-227`.
- [x] 4.6 Verify `approve/cli.test.mjs:252-266` (agent-list guard lock) stays green byte-for-byte — no edit there.
- [x] 4.7 Commit "approve/cli refusal": verify `node --test approve/cli.test.mjs`; rollback = revert this file only.

## Phase 5: Mutation guard (T12)

- [x] 5.1 Per hardened reader, temporarily restore `catch { return [] }` and confirm the matching test (T4/T6/T9) goes red, then re-apply the fix. Verification pass, no commit.

## Phase 6: R2 doctrine draft

- [x] 6.1 Write `openspec/changes/issue-942-deny-fail-closed/brain-drafts/deny-readers-fail-closed.draft.md`; fenced block opens ` ```brain-amendment/1 ` (format version, not an amendment number — #931); target `brain/core/anti-patterns/evidence-reader-empty-on-failure.md`; `amend-replace` anchored on the unique `cannot fetch labels` line (D6).
- [x] 6.2 Body: `## Direction decides whether empty is safe (issue #942)` — R1's rule, deny/allow table shape, exemption for ratified tier defaults.
- [x] 6.3 Embedded `brain:promote` command names the post-archive path `openspec/changes/archive/942/brain-drafts/deny-readers-fail-closed.draft.md`, or states the pre-archive path is correct until then.
- [x] 6.4 Commit "R2 doctrine draft": verify the uniqueness check the draft tooling runs (`assessEdit`, `free === 1`); rollback = delete the draft file only.

## Phase 7: Closing record commit

- [x] 7.1 Run `npm run memory:save -- "<title>" "<content>" --issue 942 --type decision` — `title`/`content` are POSITIONALS, not flags (#928). Parse the `rec-` id from stdout.
- [x] 7.2 Stage only that record file and `.memory/index.jsonl`; verify exactly one net new id; commit as the closing work unit, `Closes #942`.
