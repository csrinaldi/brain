---
status: draft
issue: 138
---

# Proposal: session:start — universal session context loader

## Intent

`day:start` is heavy, manual, and networked (VCS auth, git fetch/merge, gentle-ai
update, memory export, ticket board) — meant to run once a day. It does NOT survive
context compaction, and nobody re-runs it after a compact, so a resuming agent loses
brain's operational context. There is no fast, automatic, read-only "load my brain
context now" entry point. Issue #138 adds one.

## Scope

### In Scope
- `brain/scripts/session-start.mjs` + `npm run session:start`: universal, read-only,
  LOCAL-ONLY context loader, runnable by any agent or human.
- Loader steps: (a) restore `.memory/manifest.json` churn; (b) hydrate local engram via
  `memory/cli.mjs import` (local); (c) resolve openspec change(s) for the current git
  branch via a NEW `deriveChangeFromBranch()` (`issue-<N>` token → `openspec/changes/*`);
  (d) load active-ticket operational memory via the EXISTING `tryFeatureResume()`;
  (e) print a compact context block to stdout.
- Claude Code adapter: a `SessionStart` hook in `.claude/settings.json` (brain
  managed-path) that only runs `npm run session:start`.
- Extract shared libs `lib/git-branch.mjs` (current-branch detection) and
  `lib/memory-manifest.mjs` (manifest restore); make `day:start` a consumer.
- i18n `session.*` keys in `en.mjs` (canonical) + `es.mjs`; colocated tests.

### Out of Scope
- Any network call on the session-start path — `memory/cli.mjs pull` MUST NEVER run here.
- Export-on-compact / `feature-checkpoint` writes — this path is read-only.
- Adapters for Cursor, Cline, Codex (YAGNI — document the seam only).
- Changes to `day:start`'s networked workflow beyond consuming the new libs.

## Capabilities

### New Capabilities
- `session-start`: universal local-only session context loader and its agent-agnostic
  adapter seam (Claude Code `SessionStart` hook).

### Modified Capabilities
- None (`day:start` refactor is implementation-level reuse of extracted libs).

## Approach

Agent-agnostic core: all logic in `session-start.mjs` (universal floor); the per-agent
adapter is a thin, optional hook — mirroring brain's existing tool-agnostic governance.
Reuse verified-local ops only (`import`, `feature-resume`). Build the missing
branch→openspec mapping. Extract duplicated current-branch + manifest-restore logic into
shared libs so `day:start` and `session:start` share one source of truth.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/session-start.mjs` | New | Universal loader |
| `brain/scripts/lib/git-branch.mjs` | New | Extracted branch detection |
| `brain/scripts/lib/memory-manifest.mjs` | New | Extracted manifest restore |
| `brain/scripts/day-start.mjs` | Modified | Consume new libs |
| `.claude/settings.json` | Modified | `SessionStart` hook |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modified | `session.*` keys |
| `package.json` | Modified | `session:start` script |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Accidental network op on hot path | Med | Allowlist local ops; never call `pull`; test asserts no network |
| Branch→change mapping ambiguity | Med | Match `issue-<N>` token; handle 0/N matches gracefully |
| Extraction regresses `day:start` | Low | Strict TDD; lib tests + day-start consumer test |

## Rollback Plan

Remove `session-start.mjs`, the `session:start` script, the `SessionStart` hook, and the
new libs; revert `day-start.mjs` to inline logic. No data migration — path is read-only.

## Dependencies

- Builds on the merged `feature-working-memory` change (resume.md / feature-resume infra).

## Success Criteria

- [ ] `npm run session:start` runs read-only, LOCAL-ONLY, no network, fast.
- [ ] Restores manifest, hydrates engram, resolves branch change, loads ticket memory,
      prints context block.
- [ ] Claude Code `SessionStart` hook invokes it on startup/resume/compact.
- [ ] `day:start` consumes shared libs; no behavior regression.
- [ ] `session.*` i18n keys covered; tests green.
