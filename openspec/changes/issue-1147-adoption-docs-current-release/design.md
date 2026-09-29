---
status: draft
issue: 1147
---

# Design — adoption docs for the current release (issue #1147)

## Technical decisions

- **Verification method (ADR-0036 discipline applied to docs).** Every command
  named in `docs/adoption.md` was checked against `npm pack --dry-run --json` run
  in this worktree (package `@logikas/brain@1.7.0`, 761 files), cross-referenced
  against `MANAGED_SCRIPT_KEYS` in `brain/core/managed-paths.mjs` (the single
  source `mergePackageJson` in `brain/scripts/lib/installer.mjs` filters brain's
  own `package.json` scripts to before merging them into a consumer's), and against
  `package.json`'s own `scripts` block. A command that exists only as a `brain:*`
  script not in `MANAGED_SCRIPT_KEYS`, or that needs `brain:doctor` (unshipped,
  #1130), is not used.
- **Source of the "choices env:init makes" table.** Read directly from
  `brain/scripts/bootstrap.sh` (tier notice via `brain/scripts/lib/tier-notice.mjs`,
  platform resolution §6, memory backend prompt §7, VCS provider resolution) rather
  than assumed from ADR prose, since the ADRs describe the ruling and the script is
  what a consumer actually runs.
- **The first-commit gap is stated, not solved.** Per the task's explicit
  constraint, `docs/adoption.md` names the only real mechanism available today
  (`git commit --no-verify`, the hook's own hint) as a stopgap and links #1112,
  rather than presenting an untested "create a branch first" flow as supported —
  that flow also collides with the pre-commit hook's task-branch-in-main-checkout
  refusal for a repo with no prior commit to branch from cleanly, and was never
  measured.
- **`docs/KNOWN-LIMITATIONS.md` is a near-total rewrite, not an edit.** The old
  document was ~280 lines of mostly self-hosting/internal-development concerns
  (upgrade rollback internals, reviewer protocol gaps, post-merge audit history).
  The task's acceptance criterion is a list of open *consumer-path* defects with
  issue links and workarounds; keeping the old content would bury that list and
  misrepresent scope readers actually hit on a fresh install.
- **`brain/HOME.md` and `AGENTS.md` are not edited.** `AGENTS.md` carries a
  generated-file header (regenerate via `env:init`, drift-guarded by
  `antigravity.drift.test.mjs`) and its source is `brain/HOME.md`, under `brain/`
  (Tier 3 — never a direct agent edit per `agent-authorities.md`). A one-line
  addition drafting the sibling docs under "Getting started" is written to
  `openspec/changes/issue-1147-adoption-docs-current-release/brain-drafts/` instead,
  for a human to move.
- **`docs/methodology-map/index.html` is left untouched.** It is a large,
  hand-maintained interactive artifact whose "Install" node still shows the
  superseded git-tag command. Bringing it current is a separate, much larger pass
  (every lane, not just adoption) and is out of this issue's scope; noted in the
  proposal instead of silently ignored.

## Contract / API impact

None — documentation only. No script, config key, or schema changes.

## Alternatives considered

- **Patch `docs/KNOWN-LIMITATIONS.md` in place (strike old items, add new ones).**
  Rejected: the old document's frame (a scorecard against brain's own internal
  milestones) doesn't fit the task's ask (a consumer-facing defect list), and
  patching would keep dozens of lines a fresh consumer has no reason to read.
- **Fold `docs/definition-of-done.md` into `docs/adoption.md`.** Rejected: they
  answer different questions for different readers (how do I adopt vs. what does
  "done" mean for the product) and the issue asks for a separate file.
- **Update `docs/methodology-map/index.html`'s adoption-related nodes only.**
  Considered, rejected for this slice: the map's "Install" node, `upgrade` node and
  others reference ADR-0006 and the git-tag flow throughout, and a partial edit
  would leave it internally inconsistent (some nodes current, others not).
