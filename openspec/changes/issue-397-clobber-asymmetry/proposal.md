---
status: draft
issue: 397
epic: 313
artifact_store: openspec
topic_key: sdd/issue-397-clobber-asymmetry/proposal
---

# Proposal: Per-path upgrade strategy for the managed manifest (#397)

Issue #397. Epic #313 (M4 — Distribution & self-update, hard gate).
**Design-first: the classification is a Tier-2 change and no code ships until it is signed.**

## Intent

`brain:upgrade` merges exactly two of thirteen managed globs. The other eleven are
plain-copied, so a consumer who edited one loses it with a single warning line.
Measured on the real CLI — four consumer edits destroyed, exit 0:

| file | before | after |
|---|---|---|
| `.github/CODEOWNERS` | `* @my-team` | `* @brain-team` |
| `.gemini/settings.json` | `{"context":{"mine":true}}` | `{"context":{"brainOnly":1}}` |
| `AGENTS.md` | `MY AGENTS (from my HOME)` | `BRAIN AGENTS` |
| `.github/PULL_REQUEST_TEMPLATE.md` | `my PR template` | `brain PR template` |

## What the issue does not contain, and it changes the shape

`AGENTS.md` is **generated**, from inputs split across the ownership boundary:
`brain/HOME.md` is consumer-owned (matches neither `managed` nor `local`), while the
four methodology docs are brain's. Plain-copying it therefore does not lose an edit —
**it hands every consumer brain's `AGENTS.md`, compiled from brain's `HOME.md`.** A file
describing the wrong repository, in every consumer, from the first upgrade. It should
not be copied at all.

## Why the existing collision check cannot fix this

`copyManaged`'s check compares destination against the INCOMING package, which conflates
"the consumer edited it" with "brain changed it". Both read as "differs", so it can only
warn. The missing third point costs no new state: before the install, `node_modules/brain`
still holds **what brain shipped last time** — the same pre-install read #398 already
performs.

## Non-goals

- Semantic YAML merging for workflows. Not cheap, not safe.
- Retroactively repairing consumers already clobbered by earlier upgrades (open question 2).
- Any change to `brain/core/**` or `brain/scripts/**` handling — ADR-0003 keeps core read-only.

## Impact

- **Tier 2 (blocked, human-promoted):** `brain/core/managed-paths.mjs` — the classification.
- `brain/scripts/lib/installer.mjs` — three-way modification detection.
- `brain/scripts/brain-upgrade.mjs` — `--force-managed <path>`, `AGENTS.md` regeneration.

## Decision requiring ratification

`brain-drafts/managed-path-strategy.md` — the per-path table plus three open questions.
