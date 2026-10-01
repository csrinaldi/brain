---
status: draft
issue: 1113
---

# Proposal — the archive sweep crashes when `openspec/changes/` does not exist

## What was wrong

`brain/scripts/governance/postmerge/sweep.mjs`'s CLI entrypoint (`--apply`) read the changes
root with a bare, unguarded call:

```js
const dirEntries = readdirSync(join(process.cwd(), changesRoot), { withFileTypes: true });
```

A consumer with no `openspec/changes/` directory yet (any fresh adopter that has not started an
SDD change) makes this throw `ENOENT`. The throw is uncaught — the process crashes before
`runSweep`'s own fail-closed handling ever runs, and before anything reaches stdout.

The workflow (`.github/workflows/governance-postmerge.yml`) treats the non-zero exit as a real
failure and files `governance:archive-sweep-failed` on every clean post-merge run, with text that
claims "the selector could not read every issue state, or an archive write itself failed" —
neither happened — and an empty "Sweep output" block, because `sweep_out="$(...)"` captures only
stdout and the crash's diagnostic went to stderr (the stack trace) with nothing logged via
`console.log` first.

Reproduced live: `csrinaldi/brain-test`, `@logikas/brain@1.7.0`, post-merge run `36013454454` on
`22f23cd`, 2026-09-24 (brain-test issue #1). Root-caused in #1081's exit audit (`findings.md` F5).

## Why now

Every fresh consumer that adopts brain and has not yet run an SDD change hits this on their very
first clean merge. It is not a corner case — it is the default state for a brand-new adopter, and
it fires a false alarm on every single merge until the consumer starts a change.

## What changes

1. `sweep.mjs` gains an exported, unit-tested `listChangeFolders(absPath)` helper: a missing
   changes root (`ENOENT`) returns `[]` (zero eligible changes — the correct, quiet outcome for a
   fresh consumer); any other read failure still throws. The CLI entrypoint calls this instead of
   the bare `readdirSync`.
2. The workflow's `--apply` invocation now merges stderr into the captured output (`2>&1`), so the
   alarm's "Sweep output" block carries the real diagnostic text on a genuine fail-closed failure
   (design D3's exit code 3) instead of being empty — this was already misleading independent of
   the crash, since `runSweep`'s fail-closed path logs via `console.error` only.

## What does not change

- `archiveChange`, `selectSweep`, and every other module `sweep.mjs` composes are untouched.
- The fail-closed contract (design D3: an incomplete selection or a write failure archives
  nothing) is unchanged — this fix only stops a THIRD case (a missing root) from being
  misclassified as a failure at all.
- `archive.mjs --backfill` (`brain/scripts/archive.mjs:225`) has the identical unguarded
  `readdirSync` call, but it is a human-invoked command (`npm run brain:change:archive --
  --backfill`), not the automated post-merge path this issue is about, and is out of scope here.
- The GitLab governance fragment (`brain/scripts/ci/gitlab-governance.yml`, ADR-0018) does not run
  the archive sweep at all — it implements only the eight MR-time governance jobs. There is
  nothing to fix on the GitLab side for this issue.

## Rollback

Revert the commit(s) touching `sweep.mjs`, `sweep.test.mjs`, and
`.github/workflows/governance-postmerge.yml`. No other module depends on the new export.
