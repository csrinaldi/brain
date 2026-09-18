# Proposal: Lane-Ship Invoker Guard (#1012)

## Intent

In #1007, `npm test` ran `session-end-ship.test.mjs`, which spawned the real `cli.mjs ship`; with an authenticated `gh` it pushed the lane and opened a PR. #1013 fixed that test (seams `_spawn`, `_tmpdir`, `_loadConfig`). The class remains: `ship` cannot tell a legitimate invoker from a test, and nothing stops the next test that spawns a real entrypoint.

## Scope

### In Scope
- `cli.mjs ship` refuses unless it receives `--invoker <hook|sweep|manual>`. Each legitimate caller declares itself in its own code: `session-end-ship.mjs` passes `hook`, `day-start-sweep.mjs` passes `sweep`, and the `brain:memory:ship` npm script passes `manual`.
- `ship` also refuses when `NODE_TEST_CONTEXT` is set (independent signal), whatever `--invoker` says.
- Both refusals are bypassed only by `BRAIN_VCS_TEST_MODULE` or `--dry-run`.
- New sibling meta-test of `brain/scripts/test-hygiene.test.mjs`: scans tests that spawn `brain/scripts/**` entrypoints; allowlist reasons come from a closed list the scanner enforces.
- Anti-pattern draft in `brain-drafts/` plus the `brain/core/anti-patterns/README.md` index line (Tier 2; maintainer moves them).

### Out of Scope
- Running `npm test` without an authenticated `gh`; the repository `allow_auto_merge` setting; `collect` and other ops; #1024; #936.
- `settings-hooks.mjs` and the compiled hook command (`npm run brain:memory:session-end` is unchanged).
- The environment the ship child receives: A2 still passes `process.env` through unchanged; the marker travels on argv, not in the environment.

## Decision record (maintainer, 2026-09-18)

The first draft set the marker as `BRAIN_SHIP_INVOKER=…` inline in two `package.json` scripts. Verification found two defects: `day-start-sweep.mjs:40-43` spawns `cli.mjs ship --json` from `npm run day:start`, outside both scripts, so the day-start sweep would have been refused; and inline `VAR=x node …` is POSIX-only, with no precedent in `package.json`, so on Windows `npm run` through `cmd` would drop the marker and the hook would stop shipping silently. The maintainer chose an argv marker (`--invoker`) declared by each caller: portable, visible at the spawn line a reviewer reads, and testable through the existing `_spawn` / `_spawnSync` seams. The cost is one argv item in `session-end-ship.mjs` and one in `day-start-sweep.mjs`.

## Defense Layers (independent)

| Layer | Stops |
|---|---|
| `--invoker` marker | any caller that does not declare itself as hook, sweep or manual |
| `NODE_TEST_CONTEXT` | anything under `node --test`, including a test that copies `--invoker` (verified to reach children) |
| Test seams | a test that uses them (`BRAIN_VCS_TEST_MODULE`, `--dry-run`) |
| Repo `allow_auto_merge: false` (origin unknown) | the merge, not the push or the PR |

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `governance-v3`: ADDED requirements for the ship-op invoker refusal (sibling of REQ-SCAN-4, which already governs `brain:memory:ship` refusals) and for the spawn-hygiene meta-test. No existing spec owns lane-ship behavior; the spec phase may split it out.

## Approach

Guard in `cli.mjs` before any token read or VCS call; the refusal names the missing marker and the accepted values. Existing `cli.ship.test.mjs` calls already carry `BRAIN_VCS_TEST_MODULE` and need no change. `session-end-ship.mjs` and `day-start-sweep.mjs` each add one argv item. The meta-test mirrors `test-hygiene.test.mjs` (source scan, reviewed `ALLOWLIST`, self-proving fixtures).

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| A caller loses its marker and the hook or sweep stops shipping silently (exit 0, tmp log) | Med | End-to-end tests through the real `npm run brain:memory:session-end` and day-start sweep paths, fixture root, fake VCS port |
| A human running `node cli.mjs ship` directly is now refused | Low | The refusal message names `npm run brain:memory:ship`; the npm script is the sanctioned manual surface |
| `NODE_TEST_CONTEXT` is not a public Node contract | Low | Second signal only |
| Allowlist becomes decorative | Med | Closed reason list |

## Rollback Plan

Revert the PR: removes the guard, the three caller markers and the meta-test. The drafts stay in `openspec/changes/**`.

## Success Criteria

- [ ] `node cli.mjs ship` without `--invoker`, seam or `--dry-run` exits non-zero before any VCS call.
- [ ] Same with a valid `--invoker` but `NODE_TEST_CONTEXT` present.
- [ ] End-to-end: the SessionEnd hook path and the day-start sweep each reach the fake VCS port.
- [ ] Manual `npm run brain:memory:ship` behaves as today, including `-- --dry-run`.
- [ ] The meta-test fails on a new unallowlisted spawn and on an out-of-list reason.

## Correction

The "#850 orphan-test guard" cited on #1012 does not exist. The precedent is `test-hygiene.test.mjs` (#1022).
