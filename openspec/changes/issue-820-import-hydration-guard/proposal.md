---
status: applying
issue: 820
---

# Proposal: #820 — a hydration guard around `import` that skips and says so

Slice of #864 (memory 2.0), Wave 0 — task 0.1 in `openspec/changes/issue-864-memory-2-0/tasks.md`.

## What

Serialize the read→write window of `importMemory` (the engram adapter's `cli.mjs import`) behind a machine-scoped, non-blocking
guard. A second hydration that finds the guard held **skips, says so on stderr, and returns
`deferred`** — it never waits and never blocks a `git pull`. The header comment at
`engram.mjs:917-940`, which today explains the unreadable-store hazard, gains its twin: the
concurrent-reader hazard, and the statement that the fix is #863's contract, not this guard.

## Why

`importMemory` computes its delta from a snapshot (`_engramExistingTopicKeys()`,
`engram.mjs:944`) and writes it later (`_engramImport`, `:969`). `engram import` INSERTS.
Two importers through one snapshot double the batch, permanently. It fired three times on
2026-09-01 — one instance the record about #820 itself — on a path that runs at every
session start and every `post-merge`, with sixty worktrees sharing one store.

## Scope

- Includes: `brain/scripts/memory/lib/hydration-guard.mjs` (pure, seam-injected), its
  wiring into `importMemory`, one i18n key (`en`/`es`), the amended header comment, tests —
  including the one #820's acceptance names: two importers through one snapshot, one row.
- Does not include: the detector for duplicated backend keys (shipped as `memory:audit`, #870 —
  the baseline on #864 already lists the three), the idempotent hydration itself (→ #863), any
  change to `post-merge`'s `|| true`.

## Non-goals

- Waiting on the guard. Contention is a skip, never a queue.
- A lock in the repo tree. The contended resource is the backend store, which is per
  machine; a per-worktree lock would guard nothing.
