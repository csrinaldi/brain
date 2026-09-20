# Proposal: observability fixes for #921 and #923

Part of `issue-864-memory-2-0`, tasks 4.7 and 4.9. The GitHub issues are the
specification — this proposal only records scope and non-goals.

## #921 — collectLane() silently drops unreadable worktrees

`collect.mjs`'s per-worktree `git status` call, when it fails, used to
`continue` with no record — "nothing pending" and "part of the scan universe
could not be inspected" were indistinguishable.

**Fix**: a new `skippedWorktrees: [{path, reason}]` field on `collectLane()`'s
return value, forwarded through `shipLane()`'s outcome shape (`ship.mjs`),
reported on stderr (never gated by `--json`) by both the `collect` and `ship`
CLI ops (`cli.mjs`), and therefore captured by the SessionEnd trigger's log
(`session-end-ship.mjs` redirects the `ship --json` child's stdout+stderr
verbatim — no code change needed there once `ship` prints the line).

**Out of scope** (per the issue): retrying/auto-repairing the unreadable
worktree; the intentional `bare`/`prunable` stanza skip (unrelated, already
correct).

## #923 — session-start.mjs: hydration cause discarded, step 5 never wired

Two independent defects, not conflated:

**A — hydration failure cause preserved.** `step2HydrateEngram()` returns
`{ok:false, reason}` instead of a bare `{ok:false}` on a non-zero exit or a
thrown exception. `runSessionStart()` still always resolves `exitCode: 0`.
`renderContextBlock()` surfaces the reason when present, additively (a model
with no `reason` still renders the old generic line).

**B — step 5 wiring: recorded, not resolved.** `step5SynthesizeContext` stays
unwired. Wiring it in changes `runSessionStart()`'s output shape and (being
`async`, unlike steps 1-4b) its performance profile — both consumer-facing
product decisions, not something an observability bug fix should decide
silently. The open question is now recorded as a comment on `runSessionStart`,
linked to #267, so it has one canonical home.

**Non-goal**: wiring `step5SynthesizeContext` into `runSessionStart()`. That
is explicitly deferred to whoever answers the #267 triage question.

## Consumers checked for shape consistency (#921's `skippedWorktrees`)

| Consumer | Change |
|---|---|
| `memory/lane/collect.mjs` | Produces the field. |
| `memory/lane/ship.mjs` | Forwards it into the outcome shape (dry-run and full run), defaulted to `[]` for older `collect` fakes. |
| `memory/cli.mjs` (`collect`, `ship` ops) | Prints it on stderr when non-empty; always present in `--json`. |
| `memory/session-end-ship.mjs` | No change — already redirects the `ship` child's stdout+stderr verbatim into the log. |
| `memory/day-start-sweep.mjs` | No change — `laneSweepLine()` treats `sweep.outcome` as an opaque parsed object; the new field is available to any future caller without modification. |
