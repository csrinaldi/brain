# Proposal — Install-time HOME.md Scaffold

> **Status:** Archived (merged to main via PR #187; follow-up PR #188 resolved REQ-7 CRITICAL) · **Relates to:** [check-brain-nav.mjs](../../../brain/scripts/check-brain-nav.mjs) (the nav invariant this must satisfy), [managed-paths.mjs](../../../brain/core/managed-paths.mjs) (why HOME.md stays consumer-owned), [brain-config.mjs](../../../brain/scripts/lib/brain-config.mjs) (`ensureBrainConfig` — the create-if-absent contract to mirror), [project-bootstrap-adrs.md](../../../.claude/commands/project-bootstrap-adrs.md) (the Claude *adapter* rewired to call the new index helper), [ADR-0013](../../../brain/project/decisions/adr-0013-auto-adr-onboarding.md) (Bootstrap Notices / Agent Drafts / Human Signs — the governing doctrine; "never orphan an accepted ADR"), [ADR-0012](../../../brain/project/decisions/adr-0012-harness-init-adapter.md) (adapter pattern — logic lives in agnostic helpers, not in the agent/harness surface), [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md) (core is always English).

> **Agent-agnostic invariant (load-bearing).** brain is agnostic of the AI agent (Claude today, Codex or another tomorrow — cf. open issue #123: "not hardcoded to claude"). Neither part of this change may add agent-specific logic. Part 1 is pure infra. Part 2 **extracts** the HOME.md index mechanics into an agnostic, `managed`, unit-tested helper in `brain/scripts/lib/` and merely **rewires** the Claude adapter to call it — it removes logic from `.claude/`, it does not add to it. Any future agent adapter calls the same helper.

## Context

A consumer repo that adopts brain never gets a `brain/HOME.md`. HOME.md is consumer-owned by design — it holds the consumer's curated ADR links and project navigation — but **nothing creates it**. It is deliberately in neither the `managed` nor `local` arrays of `brain/core/managed-paths.mjs`: adding it to `managed` would clobber the consumer's curated links on every `brain:upgrade`, and `local` only protects files that already exist. So it falls through the cracks and is simply never scaffolded.

Three concrete breakages follow from that gap:

1. **`bootstrap.sh`** (the `brain:env:init` entrypoint) prints a "Next steps" banner (~line 302-310) that says *"Read brain/HOME.md"* — but no step ever creates the file it points at.
2. **`check-brain-nav`** only carries a v0.9.1 stopgap guard (lines 32-37) that detects HOME.md's absence and tells the user to run adoption/`brain:env:init` — a band-aid for a file the pipeline should have produced.
3. **The `project-bootstrap-adrs` skill** drafts starter ADRs, but its Phase 4 patch **aborts** when it tries to link them into HOME.md — there is no HOME.md with the expected `### Architecture decisions` structure to patch. Even once a HOME.md exists, a *second* defect in the skill's fail-safe (below) keeps the first run aborting.

This is internal dev-tooling. The fix is a create-if-absent scaffold plus one fail-safe correction — nothing more.

## What to build

Two coupled parts, both explicitly confirmed in scope.

### Part 1 — Scaffold `brain/HOME.md` at `brain:env:init`

- **New template** `brain/core/templates/HOME.template.md`. It lives under the `brain/core/**` managed glob, so it ships to every consumer via `brain:upgrade` and stays upstream-improvable (typos/new core-doc links fix forward for future scaffolds).
- **New module** `brain/scripts/lib/home-scaffold.mjs` exporting `ensureHome(root, opts)`, mirroring the contract of `ensureBrainConfig` in `brain-config.mjs`: **absent → write the template; present → leave byte-for-byte untouched**; returns `{ created: boolean }`; injectable `root` for tests; a main-module CLI guard so `node brain/scripts/lib/home-scaffold.mjs ensure` is runnable from bash.
- **Wire into `bootstrap.sh`** near line 20, next to the existing `node brain/scripts/lib/brain-config.mjs ensure` call, so it runs on every `env:init` and can read `docs.language` from `brain.config.json` if a future project-facing line ever needs it.

**Template content constraints (hard):**
- Contains the exact heading `### Architecture decisions`, **empty** (zero ADR links) — a ready insertion point.
- Links **no** `project/**` path. A fresh consumer has `brain/core/**` and `brain/scripts/**` but no `brain/project/` directory at all (it is `local`, never copied by upgrade, never scaffolded by env:init). Any `project/README.md` or `project/decisions/*` link would be a dead link and fail `check-brain-nav` on first run.
- Safe content = a "Generic core" section: Methodology + Anti-patterns links pointing only at `core/**` files every consumer receives. Per ADR-0009 this section stays hardcoded **English** regardless of `docs.language`.
- Passes `npm run brain:nav` with exit 0 on a fresh install (zero dead links; every reachable `brain/**/*.md` linked from HOME.md).

### Part 2 — Extract an agnostic HOME.md index helper, then rewire the Claude adapter

**The defect.** The Claude adapter's "Locate the insertion point" logic (`.claude/commands/project-bootstrap-adrs.md`, ~lines 506-525) does two checks: (1) require the `### Architecture decisions` heading, else abort; (2) find the **last existing** `- [ADR-NNNN](...)` link line to append after — **and abort if none exists**. A freshly scaffolded HOME.md passes (1) but fails (2), so the first run aborts. This over-strict abort **violates ADR-0013's own invariant** — *"never leave an accepted ADR unindexed"* — by orphaning an ADR it could safely index (the heading unambiguously marks where the link goes).

**Why not just fix the prose.** The adapter file lives in `.claude/` — it is Claude-specific and is **not** a `managed` path, so a prose fix reaches neither other agents nor consumers through brain's channel. Patching prose deepens agent coupling, the opposite of the project's direction (ADR-0012 adapter discipline; issue #123).

**The fix (agnostic).** Extract the mechanical index operation into a new **agnostic, `managed`, unit-tested** helper `brain/scripts/lib/home-index.mjs` exporting `insertAdrLink(homeText, { number, slug, description })` (pure string→string):
- Locates the `### Architecture decisions` section.
- If the section already has ADR link lines → append after the **last** one (unchanged existing behavior).
- If the section exists but is **empty** → insert the first link **immediately after the heading** (fixes the orphan-on-fresh-consumer case).
- If the anchor cannot be located / is ambiguous → **fail-safe**: return the input untouched plus the exact lines to add (honors ADR-0013 "never orphan"), the caller reports them.
- Idempotent: re-inserting an already-present ADR link is a no-op.

Then **rewire** the Claude adapter's Phase 4 to *call* this helper (via `node brain/scripts/lib/home-index.mjs …` or an equivalent documented invocation) instead of describing the patch algorithm in prose. The adapter keeps only its Tier-2 human-confirmation UX; the mechanics move to agnostic core. Any future agent adapter (Codex, …) calls the same helper.

## Out of scope (non-goals)

- **HOME.md drift re-sync.** Once created, HOME.md is never touched by `brain:upgrade` (consumer-owned by design). A future core-doc add/remove could orphan or dead-link a consumer's already-scaffolded HOME.md, with no automatic re-sync (the machinery that exists for `brain.config.json` has no HOME.md equivalent). Acknowledged as a **known limitation**, not solved here.
- **`openspec/config.yaml` stale `strict_tdd: false`** vs engram — a separate doc-sync change.
- **Reworking the `check-brain-nav` guard message.** The scaffold makes the missing-HOME case moot for fresh installs; leave the guard as-is.
- **Adding `brain/HOME.md` to `managed` or `local`** in managed-paths.mjs — it stays out of both, intentionally (managed would clobber curated ADR links every upgrade; local only guards pre-existing files).

## Acceptance criteria

Strict TDD applies (`npm test` = `node --test`). Every code change is RED → GREEN.

**Part 1 — Scaffold**
- [ ] `brain/scripts/lib/home-scaffold.test.mjs`: `ensureHome(root)` on an **absent** HOME.md creates `brain/HOME.md` with the expected heading structure and returns `{ created: true }`.
- [ ] Same test: `ensureHome(root)` on a **present** HOME.md (arbitrary content) returns `{ created: false }` and leaves content **byte-identical** — no overwrite.
- [ ] A fixture test (check-brain-nav pattern) proves a freshly scaffolded HOME.md combined with a real `brain/core/` copy passes `check-brain-nav.mjs` with **exit 0** — template is nav-clean, not merely present.
- [ ] Template contains the exact heading `### Architecture decisions` with zero ADR links, and links no `project/**` path.
- [ ] `bootstrap.sh` invokes the scaffold near the brain-config ensure step; re-running env:init on a repo that already has HOME.md does not overwrite it.
- [ ] (Optional, Docker-gated) `test/fresh-install/in-container.sh` asserts `brain/HOME.md` exists after env:init and `npm run brain:nav` exits 0 immediately after fresh install.

**Part 2 — Agnostic index helper + adapter rewire**
- [ ] `brain/scripts/lib/home-index.test.mjs`: `insertAdrLink()` into an **empty-but-headed** section inserts the first link immediately after the heading — no abort/orphan.
- [ ] Existing behavior preserved: with links already present, appends after the **last** ADR link line.
- [ ] Fail-safe: with no locatable `### Architecture decisions` anchor, returns input untouched + the exact lines to add (never a partial/orphaning write).
- [ ] Idempotent: re-inserting an already-present ADR link is a no-op.
- [ ] `home-index.mjs` is pure (string→string), has a CLI guard for shell invocation, and is added to a `managed` glob so it distributes to consumers.
- [ ] The Claude adapter (`project-bootstrap-adrs.md`) Phase 4 is rewired to **call** the helper; no HOME.md-patch algorithm remains described in adapter prose. No agent-specific mechanics added anywhere.
- [ ] After a patch, `npm run brain:nav` reports no orphans and no dead links.

**Epic-wide**
- [ ] `npm test` green. Conventional commits, no AI-attribution trailers.

## Risks

- **Drift (accepted).** A consumer's scaffolded HOME.md is never re-synced by upgrade; future core-doc churn can silently orphan/dead-link it. Flagged as a known limitation and a candidate follow-up (a HOME.md consolidation/migration mechanism analogous to config-migrations).
- **Fresh-consumer reachability.** The template must link only `core/**` files guaranteed to exist on a fresh install. A single stray `project/**` link fails `check-brain-nav` immediately — mitigated by the nav-clean fixture test as a hard gate.
- **Empty-section insertion correctness.** The helper must insert *after* the heading line without disturbing the section or duplicating on repeat runs — covered by the Part 2 acceptance tests (empty, non-empty, idempotent, fail-safe paths). Extracting to a pure tested helper is what makes this verifiable; the prior in-prose logic was not.
- **Adapter rewire completeness.** The rewire must leave *no* HOME.md-patch mechanics in the Claude adapter prose (else the agnostic helper is bypassed and the coupling persists). Verified by an acceptance check that the adapter's Phase 4 delegates to the helper. Distribution of the helper to non-managed adapter files (`.claude/**`) is out of brain's channel by design — the helper is the reusable, distributed surface; each agent ships its own thin adapter.
