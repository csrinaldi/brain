# Proposal — Feature-Scoped Working Memory

> **Status:** Draft for implementation · **Relates to:** [ADR-0002](../../../brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md) (two-layer durable memory), [ADR-0004](../../../brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md) (memory adapter), [ADR-0001](../../../brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md) (replaceable harness) · **Likely produces:** a new ADR-0011 "Feature-scoped working memory" (to be authored in the design/spec phase).

## Context

Brain has exactly ONE kind of memory today: **durable team memory** (`.memory/` → main, per ADR-0002). It is curated, flows to `main`, and is reconstructible from git.

What brain does NOT have is **feature working memory**: the in-flight state of a multi-slice feature — `next_action`, current slice, blockers, in-flight decisions. Today that state lives **only in engram** (topic `sdd/<change>/apply-progress`) and is **never committed**. The consequence is concrete and painful:

- Switch machines mid-feature, or hand the feature off to another person/agent, and **everything is lost except the `tasks.md` checkboxes**. The "where was I, what's next, what's blocking me" context evaporates because it never left the local engram store on the other machine.

The exploration (engram obs #239) confirmed a hard constraint that shapes the entire design: **`engram sync --export` is all-or-nothing.** `scripts/memory/backends/engram.mjs` calls `engram sync --export` with zero flags — no `--scope`, no `--topic-prefix`, no `--project` filter exists in the CLI. Therefore feature memory **must not** live in the engram sync layer: if it did, `memory:share` would leak ephemeral feature state into `.engram/` and on to `main`.

The exploration also surfaced a foundational defect (#234, obs #234): ADR-0002's `.memory/`↔`.engram/` abstraction was **never implemented**. The real committed dir is `.engram/`; `.memory/` does not exist; and the pre-push hook guards `git status --porcelain -- .memory` — a path that never exists — so the memory-materialization guard has been **silently non-functional**. Feature working memory has to be built on a sound abstraction, so restoring it is the foundation of this change.

## What to build

A second, structurally-separated memory layer that travels **with the feature branch**, following the same generic-contract + per-backend-adapter discipline as ADR-0004. Feature working memory lives ONLY in a committed `openspec/changes/<feature>/resume.md` (the generic, backend-agnostic, git-reconstructible source of truth) and is projected into the per-machine **local** engram on resume — never synced back out (approach B3 from the exploration).

Delivered as a chained-PR epic (feature-branch-chain strategy, like the cli-i18n epic):

1. **Slice 0 — Foundation: restore the `.memory/`↔`.engram/` abstraction (#234).** Rename `.engram/` → `.memory/` in-place (git mv), make `.engram` a symlink → `.memory`, fix `.gitattributes`/merge-driver registration to track the canonical path, and fix the pre-push hook guard to inspect `.memory/` after the rename (it currently guards a path that never exists, so the guard does nothing). This is the riskiest slice and the foundation for everything below.

2. **Slice 1 — Generic contract.** Document the `resume.md` schema (a THIN resume-pointer: `next_action`, `current_slice`, `blockers`, in-flight decisions — task/slice progress is NOT duplicated, it is read from `tasks.md` checkboxes) and the backend-agnostic dispatcher verb contract (`feature-checkpoint` / `feature-resume`). Backend-agnostic, no implementation.

3. **Slice 2 — engram backend implementation.** Implement `featureCheckpoint()` / `featureResume()` in `scripts/memory/backends/engram.mjs`, wired into `scripts/memory/cli.mjs`. `featureResume()` projects `openspec/changes/<feature>/*` into the local engram (modeled on the per-file `engram save --topic` projection in `scripts/brain-to-engram.mjs`); `featureCheckpoint()` materializes live feature state into `resume.md`.

4. **Slice 3 — UX.** Make `scripts/ticket-start.mjs` feature-aware: on the re-checkout path (branch already exists), when a `resume.md` exists, auto-run `feature-resume` — pull + checkout + hydrate local engram + show the resume point.

5. **Slice 4 — Checkpoint automation.** Hook `feature-checkpoint` into the pre-push hook, right after `memory:share`, so the live feature state is materialized into `resume.md` before every push. Capture is automatic, not a thing the human must remember.

## Out of scope (non-goals)

- **The `env:init` / `sdd-init` unification (#240).** Separate follow-up issue; not touched here.
- **Implementing an engram `--dir` flag.** Engram has none; the `.engram → .memory` symlink stays the mechanism (Slice 0).
- **Full implementation of openspec `state.yaml`.** It is spec-not-code today (no tooling creates it). `resume.md` is purpose-built and can migrate into `state.yaml` later.
- **Any non-engram backend implementation.** The contract (Slice 1) is generic, but only the engram adapter is implemented now.
- **Flowing feature memory to `main`.** When a feature closes, its working memory does NOT merge to main — it is distilled into ADRs/decisions (durable memory) and the openspec change is archived via `sdd-archive`.

## Acceptance criteria

Strict TDD applies (`npm test` = `node --test`). Each slice ships its own tests.

**Slice 0 — Foundation**
- [ ] `.memory/` is the real committed directory; `.engram` is a symlink → `.memory` (verified after `setup()`).
- [ ] `.gitattributes` / merge-driver registration tracks the canonical `.memory/` path.
- [ ] The pre-push hook guards `.memory/` and actually blocks a push when materialized memory is uncommitted (tested — previously the guard was a no-op).
- [ ] `memory:share` / day-start logs name the real path; no "Exporting to .memory/" message while writing elsewhere.

**Slice 1 — Generic contract**
- [ ] `resume.md` schema is documented: `next_action`, `current_slice`, `blockers`, in-flight decisions; explicitly NO duplication of `tasks.md` progress.
- [ ] The `feature-checkpoint` / `feature-resume` dispatcher verb contract is documented as backend-agnostic.

**Slice 2 — engram backend impl**
- [ ] `feature-checkpoint <feature>` writes/updates `openspec/changes/<feature>/resume.md` from live state (tested).
- [ ] `feature-resume <feature>` projects `openspec/changes/<feature>/*` into the local engram, one observation per file, modeled on `brain-to-engram.mjs` (tested).
- [ ] Both verbs are dispatched through `scripts/memory/cli.mjs`; feature observations never enter the `sync --export` path.

**Slice 3 — UX**
- [ ] On re-checkout of an existing feature branch with a `resume.md` present, `ticket-start.mjs` runs `feature-resume` and prints the resume point.
- [ ] Resume failures are isolated — they do not break checkout / env copy / VCS-auth steps (tested).

**Slice 4 — Checkpoint automation**
- [ ] The pre-push hook runs `feature-checkpoint` after `memory:share`; `resume.md` is checkpointed before push (tested).

**Epic-wide**
- [ ] `npm test` green across all slices; no ephemeral feature observation reaches `.memory/` via `memory:share`.

## Rollback plan

Each slice is independently revertible.

- **Slice 0** is the riskiest. The rename is a structural git change: revert means reversing the `git mv .engram .memory`, removing the `.engram → .memory` symlink, restoring the previous `.gitattributes`/merge-driver registration, and reverting the pre-push hook guard. Keep this slice as a single focused PR so the revert is one diff. Validate the merge-driver round-trips on a real `.memory/` chunk before merging.
- **Slices 1–4** are additive. Slice 1 is documentation only. Slices 2 and 4 add new dispatcher verbs / a new hook step with no existing callers depending on them — reverting removes the verb or the hook line. Slice 3 only augments the re-checkout branch of `ticket-start.mjs`; reverting restores the prior checkout-only behavior. A missing or malformed `resume.md` must degrade gracefully (skip resume), never crash the ritual.

## Note on a new ADR

This change establishes a second memory layer with its own lifecycle (committed-to-branch, hydrated-locally, distilled-on-close, never-merged-to-main). That is an architectural decision distinct from ADR-0002 (durable memory) and ADR-0004 (adapter). It warrants a dedicated **ADR-0011 "Feature-scoped working memory"**, to be authored in the design/spec phase — not in this proposal.
