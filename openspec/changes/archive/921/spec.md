# Spec: issue-921-923-observability

Tier: `lite`. The GitHub issues (#921, #923) are the specification; this file
is the structural minimum the `lite` tier requires, restating their
acceptance criteria as testable requirements.

## REQ-921-1 — an unreadable worktree is reported, never dropped

`collectLane()`'s return value MUST carry `skippedWorktrees: [{path, reason}]`.
A worktree whose `git status` invocation exits non-zero MUST appear there,
excluded from `candidates`, WITHOUT excluding any other worktree's own
candidates.

**Acceptance**: `collected: 0` with a non-empty `skippedWorktrees` MUST be
distinguishable from `collected: 0` with an empty one, in the return shape,
in `memory:ship`'s outcome, and in `--json` output on both the `collect` and
`ship` CLI ops.

## REQ-921-2 — the failure is surfaced, not just carried

Both the `collect` and `ship` CLI ops MUST print a stderr line naming the
count and paths when `skippedWorktrees` is non-empty. The SessionEnd trigger
MUST NOT need its own code change to surface this — it already redirects the
`ship` child's stdout+stderr verbatim into its log file.

## REQ-923-1 — the hydration failure cause is preserved

`step2HydrateEngram()` MUST return `{ok:false, reason}` — never a bare
`{ok:false}` — on a non-zero exit (stderr, or `exited <status>` when stderr
is empty) or a thrown exception (the exception's message). This MUST NOT
make `runSessionStart()` fail: it always resolves `{exitCode: 0}`.

**Acceptance**: `renderContextBlock()` surfaces `engram.reason` when present.
A model with no `reason` renders exactly the previous generic line (additive,
not a breaking change to the render contract).

## REQ-923-2 — step 5 wiring is a recorded decision, not a silent fix

`step5SynthesizeContext` MUST remain unwired by this change. The open
question ("dead code, or an intended-but-unwired stage?", linked to #267)
MUST be recorded where a future reader will find it (a comment on
`runSessionStart`), not resolved by this fix.

## Non-goals

- Retrying or auto-repairing an unreadable worktree (#921, explicit).
- The `bare`/`prunable` stanza skip in `collect.mjs` (#921, unrelated,
  already correct).
- Wiring `step5SynthesizeContext` into `runSessionStart()` (#923 acceptance
  B — a product decision, not a bug fix).
- Any change to `synthesizeContext()`'s own return shape, or to steps 1/4
  (#923, explicit out of scope).
