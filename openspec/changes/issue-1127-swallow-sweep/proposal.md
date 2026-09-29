---
status: draft
issue: 1127
---

# Proposal — no step may report success over a failure it observed (class C sweep)

## What was wrong

A recurring class: a step swallows a failure and the run reports success. Fixed one at a time so
far: #1093 (`Environment ready` after two `Cannot find module`), #1089, #1112 item 3 (every
doctrine save failed and `env:init` still succeeded), #1113, #1119. Each was found by somebody
measuring, never by a check. That contradicts brain's own bet: no gate claims more than its host
enforces.

## What this change does

1. **Inventories every swallow site** in five areas — install, bootstrap, upgrade, the memory CLI,
   the post-merge workflow and the scripts it runs — and gives each a verdict in `design.md`.
2. **Makes the verdict live in the code**, next to the site, in a greppable marker
   (`swallow-ok:`, `surfaced:`, `follow-up:`), and adds a guard test that fails on a NEW
   unexplained swallow in those paths.
3. **Fixes the sites where the failure changed the outcome the step reports**, within the `lite`
   budget, and lists the rest as named slices.

## Scope boundary

- `bootstrap.sh`, `hooks/pre-commit`, `memory/lib/reconcile-pull.mjs` are being rewritten in open
  PRs #1155 and #1154. Their sites are inventoried (guard `OWNED_ELSEWHERE`, each with its owner)
  and NOT edited here; the bootstrap fixes are slice-A, to land on top of #1155's
  `REQUIRED_FAILURES` summary instead of a second mechanism beside it.
- `brain/core/**` and `brain/project/**` are untouched.

## Non-goals

A static scan cannot see a spawn whose exit status is never read, a `console.warn` outside a
`catch`, or a `.then(ok, () => {})`. The guard finds the syntactic swallow; the inventory is where a
human judged the rest. Extending the scan to unread exit statuses is a separate change.
