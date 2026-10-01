---
status: draft
issue: 1165
---

# Proposal — the team's memory backend is declared in tracked config

## Problem

`MEMORY_BACKEND` is read from process env, then the untracked `.env`, then a hard-coded
`engram`. The team's choice therefore lives on one machine. A second checkout — a teammate, a CI
job, a fresh clone — has no `.env`, so it silently runs engram while the team uses plainfiles.
Measured in the 1.9.0 phase-1 demonstration: plainfiles checkout B failed with
`engram.search() failed — 'search' is not a cli verb for the 'engram' backend`.

The selector is read in two places that each re-implement the precedence: `memory/cli.mjs`
(`env ?? .env ?? 'engram'`) and `bootstrap.sh` (`.env` only, it ignored process env). A third,
`resolveMemory` in `harness/cli.mjs`, is exported, dead, and wrong (it reads `config.memory` as a
string; that key is an object). This is the "selection outside the port" class of #1114.

## Change

1. Declare `memory.backend` in `brain.config.json` (migration 1.9.1). Empty by default: `''` is
   *undeclared*, so an existing consumer's behaviour does not change on upgrade.
2. ONE resolver — `memory/lib/backend-resolve.mjs`, built on a generic
   `lib/axis-selector.mjs` — with precedence **process env → `.env` → `brain.config.json` →
   undeclared**. `cli.mjs` and `bootstrap.sh` (through the resolver's CLI) both ask it. The dead
   `resolveMemory` is deleted.
3. Undeclared is a REFUSAL naming the fix, never `engram`.
4. `env:init` is where the declaration is created: it prompts on a TTY and writes the answer to
   `brain.config.json`.

## Out of scope

- The cross-axis resolver (#1114). `axis-selector.mjs` is shaped so #1114 can adopt it for
  `SDD_ENGINE` and `AGENT_PLATFORM`; nothing here migrates those.
- `docs/adoption.md` and `brain/core` edits (Tier 3): drafted under `brain-drafts/` and
  `release-notes.md`.
