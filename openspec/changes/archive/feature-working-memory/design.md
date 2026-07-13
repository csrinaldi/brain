# Design — Feature-Scoped Working Memory

> How the [proposal](proposal.md) is implemented. Technical decisions.
> Establishes [ADR-0011](../../../brain/project/decisions/adr-0011-feature-scoped-working-memory.md).

## The architectural shape

Two memory layers, structurally separated by **git path**, not by an engram flag:

| Layer | Source of truth (committed) | Flows to `main`? | Lifecycle |
|-------|------------------------------|------------------|-----------|
| **Durable** (ADR-0002) | `.memory/` (chunks + manifest) | Yes, via MR merge | Curated, permanent |
| **Feature** (this change) | `openspec/changes/<feature>/resume.md` | No — distilled into ADRs on close | Branch-local, hydrated per machine |

The hard constraint that forces this shape: `engram sync --export` is **all-or-nothing** (no `--scope`, `--topic`, `--project` filter — confirmed in exploration #239). Therefore feature memory CANNOT rely on engram's sync layer for separation. Separation is achieved by keeping the two layers in **two different committed locations**, and by never letting feature observations reach the durable-exported engram store (see "Keeping feature obs out of `sync --export`").

Same discipline as ADR-0004: a **generic contract** (`resume.md` — backend-agnostic, git-reconstructible) plus a **per-backend adapter** (`scripts/memory/backends/<backend>.mjs`) dispatched by `scripts/memory/cli.mjs`.

## `resume.md` format — the generic contract

YAML frontmatter (the machine-parseable thin pointer) + a prose body (human narrative). Lives at `openspec/changes/<feature>/resume.md`, committed on the feature branch.

```markdown
---
feature: feature-working-memory
checkpointed_at: 2026-06-26T20:55:00Z       # ISO-8601 UTC, stamped by feature-checkpoint
checkpointed_from: hostname-A / feat/issue-12-working-memory   # machine / branch of origin
current_slice: "Slice 2 — engram backend impl"
next_action: "Write the featureResume() projection-loop test (TDD red first)"
blockers:
  - "engram sync --export project-scoping unconfirmed — validate before relying on it"
in_flight_decisions:
  - "resume.md is primary; apply-progress engram obs is best-effort enrichment only"
  - "active feature resolved from the single openspec/changes/<X>/ dir, not the branch name"
---

## Where I am
Free prose. The 'pick up where I left off' narrative a human or agent reads first.

## Notes
Anything that does not fit a frontmatter field.
```

**Fields (frontmatter is the contract):**
- `feature` — change-folder name; the identity key.
- `checkpointed_at` / `checkpointed_from` — provenance, stamped by `feature-checkpoint`.
- `current_slice` — free-text label of the slice in progress.
- `next_action` — the single most important thing to do next.
- `blockers[]` — list; empty list = unblocked.
- `in_flight_decisions[]` — decisions made mid-flight not yet distilled into an ADR.

**Explicitly NOT in `resume.md`:** per-task / per-slice progress. That is **read from `tasks.md` checkboxes** — the existing, already-committed source of truth. Duplicating it here would create a second, drifting copy. `resume.md` is a *pointer into* the work, not a mirror of it.

**Zero-tooling reconstructible:** a `git clone` + any text editor yields the full resume point. No engram, no node, no parser required to read it. The YAML is plain enough to skim by eye.

## Verb contract + signatures

Two symmetric verbs on the dispatcher (`scripts/memory/cli.mjs`), alongside `index` / `share` / `pull` / `setup`:

```
feature-checkpoint [feature]   # dehydrate: stamp + validate + commit resume.md
feature-resume     [feature]   # hydrate: project openspec/changes/<feature>/* into LOCAL engram
```

npm aliases mirror `memory:*`: `feature:checkpoint`, `feature:resume`.

**Dispatcher wiring.** `VALID_OPS` gains both verbs. Because `feature-checkpoint` is not a valid JS export identifier, `cli.mjs` normalizes the op to a camelCase export name and forwards the positional args:

```js
const VALID_OPS = ["share", "pull", "index", "setup", "feature-checkpoint", "feature-resume"];
// ...
const fn = op.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); // feature-checkpoint → featureCheckpoint
await backend[fn](...process.argv.slice(3));                    // pass [feature]
```

Backend exports: `featureCheckpoint(feature)` and `featureResume(feature)`.

**Active-feature resolution** (deterministic precedence):
1. Explicit `[feature]` arg → validate `openspec/changes/<feature>/` exists; else error.
2. Else scan `openspec/changes/*/` (excluding `archive/`). **Exactly one** → use it.
3. **More than one** and no arg → error: "ambiguous active feature, pass [feature]" + list.
4. **Zero** → graceful no-op (exit 0, informational message). Never crash.

> The branch name is deliberately NOT used to resolve the feature: branch names are `<type>/issue-<N>-<slug>` and do not equal change-folder names (e.g. branch `feat/issue-12-working-memory` vs folder `feature-working-memory`). Coupling them would be fragile.

**Empty / exit behavior:**
- `feature-checkpoint` with no resolvable feature → exit 0 + warning (must never break the pre-push path).
- `feature-resume` with no `resume.md` → exit 0 + "no resume point" message.

## `featureCheckpoint()` — source of truth

The live state `feature-checkpoint` materializes into `resume.md` is **`resume.md` itself, authored by the working agent during the session.** Checkpoint does NOT invent state. It:

1. Reads the current `openspec/changes/<feature>/resume.md` (or creates a skeleton if absent).
2. Re-stamps `checkpointed_at` (now, UTC) and `checkpointed_from` (hostname / current branch).
3. Validates the frontmatter shape (required keys present, lists are lists).
4. **Best-effort enrichment:** if the engram binary is present AND a local `sdd/<feature>/apply-progress` observation exists, read it and fold `next_action` / `blockers` into the frontmatter when those fields are empty. Wrapped in try/catch — never fatal.

**Resolved open question (explore Q2 / Q4):** `resume.md` is *primary and agent-authored*; the `sdd/<feature>/apply-progress` engram obs is an *optional enrichment source*, never a hard dependency. Rationale: the automatic pre-push checkpoint MUST work on a machine with no engram and no apply-progress obs. If checkpoint required reading an engram observation, a degraded machine could not checkpoint at all.

**What the automatic pre-push checkpoint actually captures:** exactly what the agent kept in `resume.md` during the session, plus a fresh provenance stamp. Automation guarantees **delivery** (resume.md is committed + pushed before the branch leaves the machine), not content **richness** — keeping the body current is the agent's job, surfaced as a ritual prompt.

## `featureResume()` — projection into the LOCAL engram

Modeled on `scripts/brain-to-engram.mjs`: iterate the change folder, one `engram save` per `.md` file, with the topic as the upsert key.

```
for each openspec/changes/<feature>/*.md:
  engram save <title> <content> --type reference --project <featureProject> --topic sdd/<feature>/<file>
```

**Topic-key scheme:** `sdd/<feature>/<file>` (e.g. `sdd/feature-working-memory/resume`, `sdd/feature-working-memory/proposal`). This matches the SDD topic-key convention and the `--topic = relative-path` idea from `brain-to-engram.mjs`.

### Keeping feature obs OUT of `sync --export` (the critical separation)

The danger: `featureResume()` writes obs into the local engram store; a later `memory:share` (= `engram sync --export`, all-or-nothing) could materialize those obs as new chunks into `.memory/` — and from there into `main`. The design prevents this with a **layered invariant**:

**Invariant:** `.memory/` (and thus `main`) only ever contains durable observations of the `brain` project. Feature observations are re-derivable from `resume.md` and never become durable chunks.

Enforcement, in order of strength:

1. **Separate engram project namespace (primary).** `featureResume()` projects under a distinct project (`<project>·feat·<feature>`), not the durable `brain` project. The durable `share()` exports the `brain` project only. This keeps the two pools disjoint **if** `engram sync --export` honors project scoping.

2. **Validation gate (tasks phase).** Whether `engram sync --export` is project-scopable is UNCONFIRMED (explore Q1). The implementation must verify it empirically (round-trip: project a feature obs, run `share`, assert no feature chunk lands in `.memory/`). This is the #1 risk handed to the tasks phase.

3. **Safe fallback.** If export is NOT project-scopable, `featureResume()` does **not** persist into the exported store at all — it degrades to printing the resume point and the agent reads `resume.md` directly. `resume.md` remains the sole carrier; `mem_search` convenience is sacrificed, the invariant is preserved. Either branch keeps `.memory/` clean.

4. **Push-path asymmetry.** The pre-push hook NEVER calls `feature-resume`. It calls `feature-checkpoint` (a pure file write — no engram save) then `memory:share`. So the push path adds zero feature obs to the store. Projection happens only at session start (`feature-resume`), never at push.

5. **The materialization guard as a backstop.** The (now-functional, post-Slice-0) pre-push guard blocks on ANY uncommitted `.memory/` diff. Were a feature chunk to leak in, it surfaces as a blocking diff a human must consciously resolve — it is never silently committed.

## Slice 0 — `.memory/` ↔ `.engram` migration mechanics

ADR-0002 describes `.memory/` as canonical with `.engram → .memory` as a symlink, but it was **never implemented**: the real committed dir is `.engram/` (`chunks/aa194500.jsonl.gz`, `chunks/4ba339fa.jsonl.gz`, `manifest.json`), `.memory/` does not exist. The proposal chooses to **align reality with ADR-0002** (migrate to `.memory/`), NOT to fix-forward to `.engram/`.

Elegant consequence: `.gitattributes` (`/.memory/manifest.json merge=engram-manifest`) and the pre-push guard (`git status --porcelain -- .memory`) were **already written for the post-migration world** — they simply never matched because `.memory/` never existed. The migration makes both correct *without editing them*.

Precise steps:

1. **`git mv .engram .memory`** — moves the three committed files into `.memory/`, preserving history via rename detection. The committed durable artifact becomes `.memory/chunks/*` + `.memory/manifest.json`.

2. **`.engram` becomes a local symlink → `.memory`**, created at runtime by `setup()`. It is no longer a committed directory, so add `.engram` to `.gitignore` and update the "MEMORIA ENGRAM" comment: `.memory/` is committed; `.engram` is a local symlink; also fix the stale reference (the comment points at `adr-0003-memoria-equipo-git-based.md`, but the real ADR is `adr-0002-memoria-git-based-dos-capas.md`).

3. **`.gitattributes`** — verify only. The line already targets `.memory/manifest.json`; after the rename it matches the real file. No edit needed beyond confirming.

4. **`merge-engram-manifest.mjs`** — no change. It receives temp file paths (`%O %A %B`) and is path-agnostic.

5. **`engram.mjs setup()`** — today it creates the symlink only `if (.memory exists)`, which never held (chicken-and-egg). After migration `.memory/` is committed, so a fresh clone has it and the condition passes. Harden:
   - If `.engram` exists as a **real directory** (legacy/pre-migration local state) → do not clobber; warn to re-run after pulling the migration.
   - If `.memory/` exists and `.engram` is absent → create `.engram → .memory` symlink (the normal post-migration path).
   - Keep the merge-driver registration step as-is.

6. **Pre-push hook** — verify only. `git status --porcelain -- .memory` now inspects the real path and actually blocks. The `command -v node || exit 0` guard already protects node-less environments; the added `feature-checkpoint` call (Slice 4) must sit behind that same guard.

7. **Merge-driver round-trip validation (gate before merging Slice 0):** create two branches that each append a distinct chunk to `.memory/manifest.json`, merge, and assert `merge-engram-manifest.mjs` produced the union (no side dropped). This proves the driver is registered against the now-live `.memory/manifest.json` path.

Keep Slice 0 a single focused PR so the revert is one diff (reverse the `git mv`, drop the symlink + gitignore line, restore prior setup()).

## Graceful degradation (cross-cutting)

No ritual may crash on a degraded environment:

- **Missing / malformed `resume.md`** → `feature-resume` prints "no resume point" and exits 0; `feature-checkpoint` writes a fresh skeleton. A YAML parse error degrades to treating the body as prose-only, never throws.
- **engram binary absent** → `feature-checkpoint` still writes the `resume.md` FILE (pure fs, no binary); enrichment is skipped. `feature-resume` skips projection and prints `resume.md` directly.
- **node absent** (CI, fresh clone) → the pre-push hook already short-circuits on `command -v node`; the checkpoint step inherits that guard.

## Chained PR plan

feature-branch-chain (like cli-i18n); only the tracker merges to `main`.

1. **Slice 0 — Foundation.** `git mv .engram .memory`, symlink + gitignore, harden `setup()`, verify `.gitattributes` / pre-push, merge-driver round-trip test. Riskiest; single focused PR.
2. **Slice 1 — Generic contract.** Document `resume.md` schema + the `feature-checkpoint` / `feature-resume` dispatcher verb contract. Backend-agnostic; no impl.
3. **Slice 2 — engram backend impl.** `featureCheckpoint()` / `featureResume()` in `engram.mjs`, wired into `cli.mjs` (`VALID_OPS` + camelCase normalization). Validation gate for export project-scoping lives here.
4. **Slice 3 — UX.** `ticket-start.mjs` re-checkout path auto-runs `feature-resume` when `resume.md` exists; resume failures isolated from checkout / env-copy / VCS-auth.
5. **Slice 4 — Checkpoint automation.** Pre-push hook runs `feature-checkpoint` after `memory:share`, behind the node guard.
