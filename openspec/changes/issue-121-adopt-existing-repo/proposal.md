# Proposal: Adopt brain into an existing repo — S1 inventory + classify (read-only)

## Intent

Adopting brain into a repo that ALREADY has docs/scripts (especially a flat `brain/**`) is today a 100% manual migration. The catastro consumer proved it works (migration #145) but at high cost and with 8 edge cases that bit during the work. `brain:upgrade` + `installer.copyManaged()` already handle the back half (copy core+scripts, merge settings, detect collisions, run config migrations). The GAP is the FRONT half: inventory the existing repo, classify each file generic-vs-project (language-aware), and produce an approved plan before anything moves. This proposal delivers that front half as a READ-ONLY first slice.

## Scope

### In Scope (S1 — this deliverable)
- New `brain:adopt` inventory command (read-only) that scans flat `brain/**` and root `scripts/**`.
- Classify every file generic-vs-project by **logical name** against the `managed[]` manifest in `brain/core/managed-paths.mjs` (matched logical path = generic; otherwise project-owned).
- Language-aware classification: detect ES-vs-EN divergence as translation, not content loss (ADR-0009); flag, never silently drop.
- Emit a machine-readable JSON plan (per-file: classification + proposed action) AND a human-readable Markdown report.
- Support two target shapes: flat-brain consumers (classify by divergence vs manifest) and no-brain repos (inventory consumer docs, propose `brain/project/**` placement; no generic replacement).
- Validate against the catastro case as a reference fixture.

### Out of Scope (deferred to S2–S5)
- ANY file mutation, restructure, or move (S2).
- Relative-link repair on moved files (S2).
- `scripts/` reconciliation and reference repointing — package.json, CI, hooks, Makefile, Dockerfile, docs (S3).
- `HOME.md` repoint + `brain:nav`/`repo:check` validation (S4).
- Stack-token leak harvest → route upstream (S5).
- Touching `core.hooksPath` (cross-cutting guard: NEVER in a worktree, #6).

## Capabilities

### New Capabilities
- `adopt-inventory`: read-only inventory + generic-vs-project, language-aware classification of an existing repo, emitting an approvable JSON plan plus human report.

### Modified Capabilities
- None (S1 reuses the existing manifest and installer without changing their requirements).

## Approach

A new script under `brain/scripts/` (`adopt.mjs`) walks the consumer tree and, for each file, resolves a **logical name** and tests membership against `managed[]`/`local[]` from `managed-paths.mjs` — the authoritative definition of "generic". For matched-but-divergent files it runs a language heuristic (ADR-0009) to decide drift vs translation. Output is a JSON plan (the artifact later slices consume and the human approves between phases) and a rendered Markdown report listing every proposed action and every replaced translation. S2–S5 are documented as the follow-on slice roadmap; the full `brain:adopt` family eventually orchestrates S1→S4 then hands off to `brain:upgrade` + `env:init`.

## Decisions (locked with user)
1. First slice = S1 only: inventory + classify, READ-ONLY. PR #1 mutates nothing; emits a report. Validated against catastro as reference fixture.
2. Language divergence default = adopt upstream EN + flag (ADR-0009): discard consumer translation, adopt English generic, but LIST every replaced file. Never silent loss.
3. S1 output = machine-readable JSON plan + human-readable Markdown report. JSON plan = the approvable artifact later slices consume.
4. Targets = flat-brain consumers (hard case, classify by divergence) AND no-brain repos (inventory own docs, propose `brain/project/**`; every file project-owned by default).
5. "Generic" = present in `brain/core/managed-paths.mjs` manifest, matched by logical name. Not in manifest = project-owned.
6. Command name = `brain:adopt` (single verb, consistent with the `brain:*` family and the future namespace unification). S1 ships it read-only/plan-by-default; later slices add `--apply` (same pattern as `brain:upgrade --dry-run`). Script: `brain/scripts/adopt.mjs` (hosts the eventual S1→S4 family).

## Slice roadmap (epic → auditable PRs, each <400 lines, human-signed per #124)
- **S1** (this proposal) — inventory + classify, read-only; JSON plan + MD report. (edge cases #1, #2)
- **S2** — restructure flat→core/project + relative-link repair; dry-run + apply. (#3)
- **S3** — reconcile `scripts/` + repoint EVERY reference to moved generics. (#4, #5, #8)
- **S4** — repoint `HOME.md` + validate (`brain:nav` + `repo:check` green, no orphans). (#7)
- **S5** — harvest leaks: stack-token scan of `core/**`+`scripts/**` → report + route upstream (consolidation-protocol).
- Cross-cutting guard — never touch `core.hooksPath` in a worktree (#6).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/adopt.mjs` | New | Read-only inventory + classify script (S1; hosts the S1→S4 family). |
| `brain/core/managed-paths.mjs` | Reused | Authoritative generic manifest (read-only consumer). |
| `package.json` scripts | New | New `brain:adopt` verb registered (read-only/plan default in S1). |
| `brain/scripts/lib/installer.mjs` | Reused later | Back-half adopt step S2+; untouched in S1. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Logical-name resolution misses a flat→core divergence (#1) | Med | Compare by logical name not path; cover with catastro fixture. |
| Language heuristic misflags drift as translation (#2) | Med | Conservative default: flag + list every replacement; human approves plan. |
| Scope creep into mutation | Med | S1 is read-only by contract; mutation gated to S2+. |
| No-brain repo has no manifest match | Low | Expected: all files project-owned; no generic replacement proposed. |

## Rollback Plan

S1 is read-only — it writes only a JSON plan + Markdown report to a chosen output path and never mutates the repo. Rollback = delete the generated report files and remove the new script + `package.json` verb. No git history, hooks, config, or content is touched.

## Dependencies

- `brain/core/managed-paths.mjs` manifest (`managed[]`/`local[]`).
- ADR-0003 (core/project split), ADR-0009 (language policy), ADR-0007 (VCS_TOKEN — relevant S3+).
- Node 22 ESM, `node --test`.

## Open Questions (for spec phase)
- JSON plan schema shape (per-file fields: logical name, classification, divergence kind, proposed action, language flag).
- Output location/naming convention for the JSON plan + Markdown report.
- Language-detection heuristic boundary (what counts as translation vs genuine drift).

## Success Criteria

- [ ] Running the inventory on a flat-brain repo classifies every file generic-vs-project by logical name and emits a JSON plan + Markdown report.
- [ ] Divergent-but-translated files are flagged and listed, never silently dropped (ADR-0009).
- [ ] A no-brain repo produces a plan with all files project-owned and no generic replacement.
- [ ] The command mutates nothing (read-only) and validates against the catastro reference fixture.
