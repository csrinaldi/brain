# Proposal: a fresh consumer's post-merge cursor bootstraps itself (#1162)

## Problem
In a fresh consumer, `governance-postmerge` fails on every merge to `main` at
"Resolve the audit window from the governance cursor" (`.github/workflows/governance-postmerge.yml`,
window step; `cursor.mjs window` -> `ABSENT`, exit 2) and files `governance:cursor-missing`.
Nothing in install or bootstrap creates `refs/governance/audit-cursor`. The run halts
before the archive sweep, so the sweep never runs in a new consumer. Evidence: 6/6 runs
in csrinaldi/brain-test-plainfiles and brain-test-engram (1.9.0 phase-1 demo).

## Intent
A missing cursor on a repository that never had one is a bootstrap state, not an alarm.
The product creates the cursor itself, at a base that cannot skip an unaudited commit.
A missing cursor on a repository that HAD one still alarms.

## Scope
- `cursor.mjs`: new `bootstrapCursor` + `bootstrap` CLI verb.
- `governance-postmerge.yml`: the window step calls it on `ABSENT`.
- GitHub only. The GitLab fragment (`brain/scripts/ci/gitlab-governance.yml`) has no post-merge job and no cursor: nothing to fix.

## Non-goals
No change to fail-closed behavior for `UNKNOWN`, to the audit-then-advance order, or to `docs/adoption.md`.
