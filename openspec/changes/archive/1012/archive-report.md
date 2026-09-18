---
status: archived
issue: 1012
archived_at: 2026-09-18
archived_against: 2c0cead1 (origin/main; PR #1027 squash-merged as 0253f4bd)
---

# Archive report — issue-1012-lane-ship-invoker-guard

**The change is closed.** Issue #1012 (the class behind PR #1007, where `npm test`
shipped the memory lane for real and the platform merged it) shipped as PR #1027,
squash-merged into `main` as `0253f4bd` on 2026-09-18. All 24 tasks are `[x]`, the
5 requirements and 10 scenarios of the delta spec carry passing runtime coverage or,
for the drafts requirement, source inspection, and the post-merge verify report
returned **pass** with 0 CRITICAL and 0 WARNING.

## What was archived

`npm run brain:change:archive -- issue-1012-lane-ship-invoker-guard` moved the change
folder to `openspec/changes/archive/1012/` (the path owned by `archivePath(iid)`) and
appended the delta spec body, under an `[issue-1012]` provenance header, to its
central spec:

| Delta | Central spec | Requirements |
|---|---|---|
| `specs/governance-v3/spec.md` | `openspec/specs/governance-v3/spec.md` | REQ-SHIP-1 … REQ-SHIP-5 (added) |

The archived folder keeps `explore.md`, `proposal.md` (with the maintainer's
argv-marker decision record), `design.md`, `tasks.md`, `apply-progress.md` (two
batches), `verify-report.md` (post-merge, `gentle-ai.verify-result/v1` envelope,
evidence revision
`sha256:8fc4abf172294e05986bc01d49bd5065f4c1dc81efbb827e97a957e96715fa27`), `specs/`
and `brain-drafts/`.

## Delivery

`0253f4bd` — PR #1027 (`fix(memory)`, closes #1012):

- `cli.mjs ship` calls `decideShipInvoker()` (`brain/scripts/memory/lib/ship-invoker.mjs`)
  as its first statement, before any module load, credential read or VCS call. It
  refuses unless `--invoker` is `hook`, `sweep` or `manual`, and independently whenever
  `NODE_TEST_CONTEXT` is set; `BRAIN_VCS_TEST_MODULE` and `--dry-run` are the only
  bypasses.
- The callers declare themselves on argv: `session-end-ship.mjs` (`hook`),
  `day-start-sweep.mjs` (`sweep`), the `memory:ship` and `brain:memory:ship` scripts
  (`manual`). The child environment is unchanged (A2). `--json` echoes the invoker.
- `brain/scripts/test-spawn-hygiene.test.mjs` requires every test spawn of a
  `brain/scripts/**` entrypoint to carry an allowlist reason from a closed set.

## Decisions recorded during the change

- The maintainer chose an argv marker over an environment marker set inline in
  `package.json`: the day-start sweep also spawns `ship` outside both scripts and would
  have been refused, and inline `VAR=x node` is POSIX-only.
- `NODE_TEST_CONTEXT` is a second, independent signal: `node --test` sets it and it
  survives `spawn`, `spawnSync` and `npm run` (verified empirically, value `child-v8`).
- Each allowlist reason names the mechanism that makes a spawn safe; a
  seam-presence check alone was rejected because the seven spawns the #1013 review
  flagged were safe for three structural reasons, none of them a seam variable.

## Verification at archive time

- `npm test` on `2c0cead1`: 5852 passed, 0 failed (includes #1004 and #1028, merged
  after the branch point; the meta-test is green because none of their 39 new test
  files spawns a runtime entrypoint).
- `npm run brain:repo:check && npm run brain:nav`: clean.
- Lane safety around every full run: no `memory/*` ref and no pull request appeared on
  `origin`.
- Mutation checks during apply: removing either caller's marker turned its
  end-to-end case red; moving a module load above the guard turned the source-order
  test red.

## Open follow-ups

- **Maintainer promotion:** `brain-drafts/anti-patterns/test-spawns-a-live-entrypoint.md`
  and its promotion notes (the `## Registered` line for
  `brain/core/anti-patterns/README.md`). Nothing under `brain/**` was touched.
- **Release ordering:** `brain:memory:ship` is not in v1.5.0 and the installer merge
  only adds missing scripts; the next release that ships it carries `--invoker manual`.
- `--dry-run` still runs `collect` (`lane/ship.mjs`), so a dry-run spawn without
  `BRAIN_MEMORY_TEST_ROOT` can write a local commit on a `refs/heads/memory/*` ref in
  the real repository.
- Scanner gaps named by the cold review: aliased or promisified spawn imports, spawns
  inside shared non-test helper modules, and multi-hop path construction that resolves
  to `<unresolved>`.
- #1024 (memory-gate never receives the PR description in CI) is unrelated but in the
  same governance area.
