# ADR-0011 — Feature-Scoped Working Memory

**Status**: Accepted  
**Date**: 2026-06-26

## Context

brain has exactly one kind of memory: **durable team memory** (`.memory/` → `main`, ADR-0002). It is curated, flows to `main`, and is reconstructible with `git clone`.

It has no **feature working memory**: the in-flight state of a multi-slice feature — `next_action`, current slice, blockers, in-flight decisions. Today that state lives only in engram (topic `sdd/<change>/apply-progress`) and is never committed. Switch machines mid-feature, or hand the work to another person/agent, and everything is lost except the `tasks.md` checkboxes.

The naive fix — store feature state in engram and exclude it from sharing — is blocked by a hard constraint. `engram sync --export` is **all-or-nothing**: it has no `--scope`, `--topic`, or `--project` export filter (confirmed in exploration #239). Any feature observation present in the exported engram store would leak into `.memory/` and on to `main`. Separation cannot be expressed at the engram layer.

This is a distinct architectural concern from ADR-0002 (durable memory) and ADR-0004 (the `MEMORY_BACKEND` adapter), with its own lifecycle: committed-to-branch, hydrated-locally, distilled-on-close, never-merged-to-main.

## Decision

Introduce a **second memory layer**, structurally separated from durable memory, with the same generic-contract + per-backend-adapter discipline as ADR-0004.

1. **Generic contract — `resume.md`.** Feature working memory's source of truth is a committed `openspec/changes/<feature>/resume.md`: backend-agnostic, human-readable, reconstructible with `git clone` and zero tooling. YAML frontmatter (`feature`, `checkpointed_at`, `checkpointed_from`, `current_slice`, `next_action`, `blockers[]`, `in_flight_decisions[]`) plus a prose body. It is a *pointer into* the work, not a mirror of it — per-task progress is read from `tasks.md` checkboxes and never duplicated here.

2. **Per-backend adapter — symmetric verbs.** Two ops on `scripts/memory/cli.mjs`, dispatched to `scripts/memory/backends/<backend>.mjs` exactly like `index` / `share` / `pull` / `setup`:
   - `feature-checkpoint [feature]` (dehydrate): stamp + validate the live `resume.md` and ensure it is committed before push.
   - `feature-resume [feature]` (hydrate): project `openspec/changes/<feature>/*` into the **local** engram so each machine re-hydrates its own store (`~/.engram` is not in git).

3. **Two locations, not one filter.** Because engram cannot filter its export, separation is structural: durable memory's committed artifact is `.memory/`; feature memory's committed artifact is `openspec/changes/<feature>/resume.md`. They never share a git path. Feature observations are kept out of the exported engram store by a distinct project namespace (validated empirically), with a safe fallback of file-only hydration if export project-scoping cannot be guaranteed.

4. **Distinct lifecycle.** Feature memory is branch-local and ephemeral. On close it is **distilled into ADRs / durable memory** (via `sdd-archive`) — it is never merged to `main` as-is.

This decision builds on the foundation restored in the same change: ADR-0002's `.memory/` ↔ `.engram` abstraction, which had never been implemented (the real dir was `.engram/`; the pre-push guard and merge-driver targeted a `.memory/` path that did not exist). The migration to a real `.memory/` with a local `.engram → .memory` symlink is a prerequisite, not a side effect.

## Consequences

- **Positive**: feature work survives a machine switch or hand-off — `next_action`, blockers, and in-flight decisions travel with the branch in a plain committed file.
- **Positive**: the same adapter discipline as ADR-0004 — switching memory backend or adding one means implementing the two verbs in `scripts/memory/backends/<name>.mjs`; the `resume.md` contract is untouched.
- **Positive**: zero-tooling recovery — the resume point is readable with any text editor after `git clone`.
- **Negative**: the engram-projection convenience (`mem_search` over feature context) requires saving feature observations under a distinct project namespace — local `engram sync --export` is project-scoped (confirmed: "exports project-scoped chunks to `.engram/` by default"), so feature obs in their own namespace are not materialized by `memory:share`. The cost is that recall must target that namespace rather than the default `brain` project. File-only hydration remains the backstop for backends without project isolation.
- **Negative**: the automatic pre-push checkpoint guarantees *delivery* of `resume.md`, not its *richness* — keeping the body current remains the working agent's responsibility.
- **Negative**: a second working-state location (`resume.md`) coexists with the convention-specified-but-unimplemented `state.yaml`; if `state.yaml` is implemented later, `resume.md` should migrate into it.

## Never do

- **Never write feature observations into the `sync --export` path** (the durable `brain` project / `.memory/`). Feature memory never becomes a durable chunk; it is re-derivable from `resume.md`.
- **Never let feature working memory merge to `main` as working memory.** Distill it into ADRs / durable memory on close, then archive the openspec change.
- **Never duplicate `tasks.md` progress into `resume.md`.** Checkbox state has one source of truth.
- **Never make `feature-checkpoint` depend on engram being present.** Writing `resume.md` is pure filesystem work; engram enrichment is best-effort only.
- **Never let a missing or malformed `resume.md` crash a ritual** (resume, checkpoint, `ticket:start`, pre-push). Degrade gracefully, exit 0.

## References

- ADR-0001 — 3-layer architecture with replaceable harness (the adapter principle this mirrors).
- ADR-0002 — two-layer git-based team memory (durable layer; the foundation restored by Slice 0).
- ADR-0004 — memory adapter (`MEMORY_BACKEND` selector + dispatch; the symmetric discipline applied here).
