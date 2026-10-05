---
status: draft
issue: 1147
---

# Tasks — adoption docs for the current release (issue #1147)

- [x] Read #1147, parent #1126, epic #1121, and the #1081 findings (#1112, #1113,
      #1115–#1119, #1106, #1107) in full.
- [x] Verify the npm-install commands, `brain:*` script names and file paths
      against `npm pack --dry-run --json`, `MANAGED_SCRIPT_KEYS`
      (`brain/core/managed-paths.mjs`), and `package.json`'s own `scripts` block.
- [x] Rewrite `docs/adoption.md`: new vs existing repo, what `init`/`env:init` do
      and ask, `lite` tier default, `claude` default platform, memory backend and
      VCS provider choice, `.gitignore` before any credential, the first-commit
      gap (linked, not invented), the archive sweep's automation identity,
      `brain:protect`, `brain:upgrade`, what to do when a step fails.
- [x] Rewrite `docs/KNOWN-LIMITATIONS.md`: remove the 1.0 pilot framing, list open
      consumer-path defects with issue links and workarounds.
- [x] Write `docs/definition-of-done.md`: epic #1121's five properties and phase
      exits in plain words, ADR-0036's rule, linking rather than duplicating.
- [x] Check whether `AGENTS.md` / `README.md` / other indexes need a pointer to the
      new docs; `README.md` already documents the same install flow accurately and
      needed no change; `AGENTS.md` is generated from `brain/HOME.md` (Tier 3) —
      drafted the addition under `brain-drafts/` instead of editing either directly.
- [x] Run `npm run brain:nav`, `npm run brain:repo:check`, and `npm test`; record
      exit codes.
- [x] Commit with conventional commits referencing `(#1147)`, no AI attribution.

## Micro-decisions made in flight

- `docs/methodology-map/index.html` is left untouched — it's a much larger,
  separately-maintained artifact whose "Install" node still shows the retired
  git-tag flow; bringing it current is out of this slice's scope (see design.md).
- `docs/KNOWN-LIMITATIONS.md` is a near-total rewrite rather than a strike-through
  edit, because the old frame (an internal milestone scorecard) doesn't match the
  task's ask (a consumer-facing defect list with workarounds).
