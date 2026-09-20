---
status: applying
issue: 870
---

# Proposal: #870 — `memory:audit`, the epic's numbers as one command

Parent: #864 (memory 2.0), task 0.2, Wave 0. The baseline this produces is pasted on #864
before any other slice merges.

## What

One backend-agnostic command that prints the five numbers that opened memory 2.0, from
`.memory/records/` and `git log` alone: learn→main latency percentiles over a window,
physical lines vs distinct ids, `actor` shape distribution, `issue`/`supersedes` coverage,
and — only when the active backend can be exported — `rec-` rows vs distinct keys.

## Why

Every number on #864, #862, #863, #820 and #738 was a hand query nobody can re-run. The
exit of the epic re-measures them; a slice that wants to know whether it moved one has no
instrument. design.md §7 rows 9–10 replaced `brain:change:verify` as the exit with this
command.

## Scope

- Includes: `brain/scripts/memory/lib/audit.mjs` (pure), the `audit` op in `memory/cli.mjs`
  dispatched like `reindex`, the `memory:audit` npm script, tests for every number and both
  failure shapes, the baseline on #864, the marker replaced in the epic's tasks.md.
- Does not include: any gate, any write to the store, any change to how records are captured.

## Non-goals

- Branching on the output. It reports; a human reads it.
- A backend requirement. The backend row degrades to a stated reason.
