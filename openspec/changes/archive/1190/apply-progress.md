# Apply progress: issue-1190 (lane re-ship after squash)

Status: all tasks done (Phases 0-8). Not pushed, no PR.

## Commits
- 2035d243 fix(memory): replace a merged remote lane branch under a lease when two keys hold (#1190)
- CLI/catalog/docs commit: map the replace failures, retire the #1190 limitation (#1190)
- final commit: chunk-boundary line pin, openspec artifacts, amendment draft (Closes #1190)

## Deviations from design.md
- Catalogs live in `brain/scripts/i18n/{en,es}.mjs` (design said `i18n/` under memory/).
- `surveyRef`, `decidePr` and `classifyReplaceFailure` are exported (needed for the pinned unit tests).
- `chunk-boundary.test.mjs:176` allowlist line for `cli.mjs` moved 777 to 782 (cli.mjs grew by 5 lines).
- Task 4.5 (sweep mapping of leaseStale/replaceRefused) passed at once: a pin, the existing mapping already satisfies it.

## Measured stderr (git 2.53.0, bare remote receive.denyNonFastForwards=true)
```
remote: error: denying non-fast-forward refs/heads/lane (you should pull first)
 ! [remote rejected] lane2 -> lane (non-fast-forward)
error: failed to push some refs to '...'
```
Stale lease: ` ! [rejected]        lane2 -> lane (stale info)`.

## Mutations (each restored after)
- Remove the merged-PR key (accept any `create`): fails `#1190 remote delivered, no PR` and the sweep no-merged-PR test.
- Remove the content key: fails the extra-unmerged-commit integration test, `behind > 0 ... zero port calls`, `merged but remote tip pending`, `baseFetched:false`, and the sweep undelivered test.
- Remove the lease from the argv: fails the replace unit test, 3 integration tests, 2 CLI tests and the sweep both-keys test.

## Success-criteria mapping
Spec REQ-1/2/3/4/5: ship.test.mjs, ship.integration.test.mjs, sweep.test.mjs. REQ-7: ship.integration.test.mjs and cli.ship.test.mjs. REQ-8: docs/KNOWN-LIMITATIONS.md (no `1190`). Amendment: brain-drafts/adr-0034-amendment-5.draft.md validated by planAmendment (ok:true).

## Final checks
npm test: 7161 tests, 7158 pass, 0 fail, 3 skipped. brain:repo:check green.
Governed diff (excluding tests, .memory, openspec/changes): 105 added, 27 deleted.
