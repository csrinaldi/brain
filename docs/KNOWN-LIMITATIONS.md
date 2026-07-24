# Known Limitations — brain 1.0

> **1.0 is a controlled-pilot release.** It is intended for repos the maintainer controls
> (self-hosting + pilot projects), NOT yet for open external adoption. This document states,
> honestly, what is **not** battle-tested so nobody mistakes 1.0 for "stable everywhere."
> Each item links to its tracking issue and lands in the 1.1 line.

## Self-update (the one to read first)

`brain:upgrade` is hardened against the pre-0.8.0 identity-clobber/lockout class, and the
managed/local boundary is enforced in code — **but it is not yet safe for repos you do not
control**:

- **No rollback / atomic write.** A mid-upgrade failure leaves a half-applied tree, recoverable
  only through the consumer's own git. (M4 · un-ticketed → 1.1)
- **Plain-copy clobber asymmetry.** `.gemini/settings.json`, `.github/CODEOWNERS`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `AGENTS.md`, and the workflows are overwritten on upgrade
  (only `.claude/settings.json` and `package.json` are merged). A consumer who edits one of those
  loses it with only a warning. (M4 → 1.1)
- **Corrupt consumer JSON blocks all upgrades.** A broken `.claude/settings.json` or `package.json`
  throws before the managed core copies. (M4 → 1.1)
- **Downgrade silently ratchets `schemaVersion` up**, with no guard/warning/test. (M4 → 1.1)

**Gate:** the self-update safety subset MUST land before 1.0 is opened to any repo the maintainer
does not control.

## Distribution

- Install is a **private GitHub git-tag** (no npm registry / mirror). First install requires a
  manual `package.json` script-alias edit — there is no `npx brain init` / `bin` / `postinstall`
  yet. (M4 → 1.1)
- `brain:adopt` implements inventory/classify only (S1); `--apply` / structural migration /
  openspec reconciliation are not built. (M4 → 1.1)

## Reviewer (`brain:review`)

- **The security boundary is sound** — COMMENT-only, never a merge authorizer.
- But its flow guarantees are currently **inert in production**: `prReviews` returns no comment
  `body`, so `priorVerdicts` is always empty → anti-loop, the rev≥3 bound, and board reconciliation
  do not fire. The v2 refuter (#284) is not wired into the CLI. No inline per-line comments yet.
  (#317 · M3 → 1.1)

## Governance provider parity

- GitLab has PR-time gate parity (issue-link, diff-size, memory-gate, decision-gate), but the
  **release gate (rung-2) and postmerge auto-revert (rung-3) are GitHub-only**. (#130 → 1.1)
- The release gate itself runs after the tag already exists, so it cannot block a bad release
  today. (#210 → 1.1)

## Agent / SDD neutrality

- Real neutrality is n=1 in practice: the only fully-wired SDD engine with per-stage behavior is
  `gentle-ai`. Per-stage agent roles (#312) and per-stage engine routing (M8) are 1.1 work.
- The 3-axis decoupling is resolved in `harness/cli.mjs` but `day:start` still hardcodes the
  engine. (#123 → 1.1)

---

*Full audit, scorecard, and roadmap: `docs/inbox/MASTER-PLAN-1.0.md`.*
