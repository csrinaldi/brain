# Tasks: Retire Feature-PR Memory Transport

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 360–400 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | One atomic retirement PR |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain (preselected; unused for one PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Atomic feature-PR transport retirement | PR #1 base = feature/tracker | `node --test brain/scripts/hooks/pre-push.test.mjs brain/scripts/brain-next.test.mjs` | Mocked pre-push push forms | Revert retirement surfaces together |

## Phase 1: RED Coverage

- [x] 1.1 Add RED cases in `brain/scripts/hooks/pre-push.test.mjs` for relative/root failure, staged/`commit -a`/empty index, tracking/first/refspec pushes, checkpoint presence/absence, and zero `share`, `ship`, or `brain:save` calls.
- [x] 1.2 Add RED state tests in `brain/scripts/brain-next.test.mjs` for no branch, failed checks, issue-record capture, no PR, open PR, enabled lane, and no porcelain `.memory/` input.
- [x] 1.3 Add regression assertions in `brain/scripts/governance/checks/memory-presence.test.mjs` and `brain/scripts/harness/backends/plain.test.mjs` that memory-gate verdicts and lane behavior remain unchanged.

## Phase 2: Atomic Runtime Retirement

- [x] 2.1 Set `memory.lane.enabled: true` in `brain.config.json` and update its tests without changing migration defaults.
- [x] 2.2 Update `brain/scripts/hooks/pre-push` to retain canonical-root resolution, checkpointing, repository checks, and size warning while deleting durable-record transport and dirty-`.memory/` blocking.
- [x] 2.3 Delete `brain/scripts/brain-save.mjs` and `brain/scripts/brain-save.test.mjs`; remove its `package.json` command, all callers, and the obsolete `brain:next` materialization state with no shim.
- [x] 2.4 Update `brain/scripts/brain-next.mjs` to use branch issue provenance, existing record-reader evidence, VCS PR state, and lane configuration; recommend `brain:memory:save --issue N` or `brain:ship` as specified.
- [x] 2.5 Replace retired wording in `brain/scripts/{bootstrap.sh,i18n/en.mjs,i18n/es.mjs}`, `brain/scripts/hooks/commit-msg`, and `brain/scripts/governance/checks/memory-presence.mjs` without changing memory-gate semantics.

## Phase 3: Guidance and Promotion Drafts

- [x] 3.1 Update `docs/workflow-guide.md` and active `docs/methodology-map/**` guidance to capture with `brain:memory:save --issue N` and ship through the lane.
- [x] 3.2 Create maintainer-only drafts under `openspec/changes/issue-890-retire-feature-pr-memory-surfaces/brain-drafts/` for ADR-0034, consolidation/harness doctrine, and `MANAGED_SCRIPT_KEYS`; do not edit canonical `brain/core/**` or `brain/project/**`.

## Phase 4: Verification

- [x] 4.1 Run the focused hook, next, config, gate, and plain-backend tests; run mocked pre-push scenarios proving checkpoint/checks remain and transport is absent.
- [x] 4.2 Run a caller scan for executable `brain:save`, then `npm test` and `npm run brain:repo:check`; measure the authored diff before opening the atomic PR.
