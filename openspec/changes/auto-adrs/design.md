# Design — Auto-ADRs Onboarding

> How the [proposal](proposal.md) is implemented. Technical decisions.
> Establishes [ADR-0013](../../../brain/project/decisions/adr-0013-auto-adr-onboarding.md).

## The architectural shape

The feature splits along a hard governance line: **bootstrap detects, an agent drafts, a human signs**. The split is forced by `agent-authorities.md` — `brain/project/decisions/` is the durable, human-signed source of truth (Tier 2/3), so no script and no autonomous agent step may write there.

| Stage | Actor | Authority | Writes to |
|-------|-------|-----------|-----------|
| Detect the gap | bootstrap (`gentle-ai.mjs init()`) | N/A (human-run shell) | stdout notice only |
| Explore + draft | agent (`/project:bootstrap-adrs`) | Tier 1 (autonomous) | `openspec/changes/auto-adrs/brain-drafts/` |
| Review + accept | human + agent | Tier 2 (confirm per action) | `brain/project/decisions/` + `brain/HOME.md` |
| Auto-commit to `brain/` | — | Tier 3 (prohibited) | never |

Same discipline already used by ADR-0012 (harness `init()` gap-detection with injectable seams) and ADR-0011 (generic contract + per-backend adapter): the detection lives in a unit-testable seam, the intelligence lives in a conversational command — never the reverse.

## Slice 1 — the `_checkDecisionsDir` seam

Mirrors `_checkEngram` / `_runEngramSearch` exactly: a `_resolve*` seam that returns the path, a `_check*` seam that returns a boolean, both injectable via `init()`'s `opts`.

```js
function _defaultResolveDecisionsDir() {
  return join(repoRoot, 'brain', 'project', 'decisions');
}

function _defaultCheckDecisionsDir(dir) {
  // Returns true when at least one .md exists in dir (ADRs present).
  // Mirrors _runEngramSearch's "found" shape: notice fires on !present.
  try {
    if (!existsSync(dir)) return false;
    return readdirSync(dir).some((f) => f.endsWith('.md'));
  } catch { return false; }
}
```

**Condition (absent OR empty):** `existsSync(dir) === false` **OR** no `.md` entries → gap. Returning `hasAdrs` (true = present) keeps the same `found` / `!found` shape as the engram check; the notice fires on `!hasAdrs`.

**Placement.** The current Step 3 (engram context) uses bare `return`s that would skip anything after it. Extract Step 3 into an internal `checkSddContext()` helper so its early returns scope to the helper, then add **Step 4** below it. Step 4 is pure filesystem — it does **not** depend on `engramPresent` or `project`, so it always runs (this is why it cannot sit behind the engram early-returns). New import: `readdirSync` from `node:fs`. New `init()` seams: `_resolveDecisionsDir`, `_checkDecisionsDir`.

```js
// ── Step 4: Project-ADR gap check (pure fs, engram-independent) ───────────
const adrsPresent = (() => {
  try { return _checkDecisionsDir(_resolveDecisionsDir()); } catch { return false; }
})();
if (!adrsPresent) {
  console.log(`  ${t('bootstrap.sdd.noProjectAdrs')}`);
  console.log(`    ${t('bootstrap.sdd.noProjectAdrsHint')}`);
}
```

**i18n keys (ADR-0010), added to `scripts/i18n/en.mjs` §6:**

```js
'bootstrap.sdd.noProjectAdrs':     'No project ADRs found (brain/project/decisions/ is empty or absent).',
'bootstrap.sdd.noProjectAdrsHint': 'Run /project:bootstrap-adrs in your AI agent to draft the starter ADR set (Stack, Testing, Build).',
```

**Fresh-install assertion.** `test/fresh-install/in-container.sh` gains a `[4]` block after the `brain.config.json` check: re-run `env:init` capturing stdout, `grep -q "No project ADRs"`. The consumer repo (`samples-of-html5`) has no `brain/project/decisions/` → notice fires. Brain self-hosting has 12 ADRs → never fires (the directory test is the guard).

## Slice 2 — the descriptive ADR template

Each draft leads with `## Decision` (the detected fact — the only thing the agent knows) and leaves `## Context` and `## Consequences` as `<TODO>` stubs for the human. `Status: Proposed` until a human accepts and flips it to `Accepted`. The agent never invents rationale.

Concrete example for a React + Vitest + Vite + pnpm repo:

```markdown
# ADR-0001 — Frontend Stack: React + TypeScript

**Status**: Proposed
**Date**: 2026-06-27

## Decision

Built on **React 18** with **TypeScript** (detected: `react@18.3.1` and
`typescript@5.x` in package.json; `.tsx` components under `src/`).

## Context

<TODO: why React + TypeScript here? What alternatives were weighed (Vue, Svelte,
plain JS), and what constraints drove the choice?>

## Consequences

<TODO: what does this commit the team to — tooling, hiring, ecosystem, upgrade path?>
```

`ADR-0002 — Testing: Vitest` (detected `vitest`, `vitest.config.ts`, `*.test.tsx`) and `ADR-0003 — Build & Package Manager: Vite + pnpm` (detected `vite`, `vite.config.ts`, `pnpm-lock.yaml`) follow the identical shape: one detected-fact `## Decision`, `<TODO>` `## Context` and `## Consequences`.

## Slice 2 — detection → ADR mapping

| ADR | Primary signals | Package manager / build |
|-----|-----------------|-------------------------|
| **Stack** | framework dep (`react`/`vue`/`svelte`/`angular`/`next`/`nest`/`express`); language (`typescript` dep or `tsconfig.json`); `src/` / `app/` layout | — |
| **Testing** | test-runner dep (`vitest`/`jest`/`mocha`/`@playwright`/`cypress`/`node:test`); config (`vitest.config`, `jest.config`); `test` script; `*.test.*` / `*.spec.*` files | — |
| **Build** | bundler dep (`vite`/`webpack`/`rollup`/`esbuild`/`tsup`); `build` script | lock file → manager: `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn, `package-lock.json`→npm, `bun.lockb`→bun |

Stack data is read first from engram `sdd-init/<project>` (sdd-init already detects language/test-runner/build — no re-detection); direct file detection is the fallback.

**Graceful degradation (weak-signal stacks).** Non-Node repos read `go.mod` / `pyproject.toml` / `Cargo.toml` / `Gemfile` / `composer.json` for language and build. If a topic yields **no** signal, the agent does **not** emit an empty stub — it **skips** that ADR and reports which topics had no signal, so the human is never handed a placeholder masquerading as a decision.

## Slice 2 — ADR numbering

Scan `brain/project/decisions/` for `adr-(\d{4})-*.md`, parse `NNNN`, take the max, next = max + 1 (zero-padded 4 digits); empty dir starts at `0001`. Numbers are assigned **at draft time**, sequentially (Stack = N, Testing = N+1, Build = N+2), so draft filenames carry their real target number. **Resolved open question:** rejects leave numbering gaps (e.g. accept Stack=N, reject Testing, accept Build=N+2). We **do not** renumber on accept — gaps are normal in an ADR log (superseded ADRs leave them too), and renumbering mid-flow would risk `HOME.md` drift. Collision-safe by construction.

## Slice 3 — the command structure

`.claude/commands/project-bootstrap-adrs.md` — a **conversational Claude command** (like `sdd-onboard`, `delegate_only: false`), **not** an SDD pipeline skill and **not** a harness verb. This resolves explore Risk #5 (where the command lives).

```
Phase 0 — Preflight / idempotency
  resolve repoRoot; read brain.config.json (docs.language, project.slug)
  scan decisions/ → coverage + next free NNNN
  fully covered → augment mode (Slice 4) or clean exit

Phase 1 — Detect (Tier 1)
  mem_search "sdd-init/<project>" → mem_get_observation  (fallback: direct detection)
  map signals → {Stack, Testing, Build}

Phase 2 — Draft (Tier 1, autonomous, no confirmation)
  write 3 descriptive+stub ADRs → openspec/changes/auto-adrs/brain-drafts/adr-NNNN-<slug>.md
  language follows brain.config.json docs.language (ADR-0009), default en

Phase 3 — Interactive review (per ADR)
  present each draft + 2–3 sentence summary
  protocol: accept | edit [feedback] | reject | accept-all
    edit   → revise draft in brain-drafts/, re-present
    reject → discard, no brain/ write
    accept-all → offered ONLY after the user explicitly states they reviewed the drafts

Phase 4 — Tier 2 writes (each gated by explicit confirmation)
  per accepted ADR → write brain/project/decisions/adr-NNNN-<slug>.md
  patch brain/HOME.md (Tier 2)
  recommend `npm run brain:nav` to confirm no orphans
```

**accept-all "I reviewed" gate.** `accept-all` is **never surfaced as an option** until the user has explicitly asserted they reviewed the drafts. Once asserted, `accept-all` collapses the remaining accepted drafts into **one batched Tier 2 confirmation**. This satisfies the Tier 2 spirit (explicit human gate before any `brain/` write) without forcing N separate prompts. **Resolved open question:** batching is allowed, but only behind this gate.

## Slice 3 — the HOME.md patch (fail-safe, never orphan)

The agent reads `HOME.md`, locates the `### Architecture decisions` list, and appends after the **last** `- [ADR-NNNN](...)` line in the **exact** existing format:

```
- [ADR-NNNN](project/decisions/adr-NNNN-slug.md) — {short description}
```

**Fail-safe:** if the `### Architecture decisions` anchor or the trailing ADR line cannot be located unambiguously, the agent **aborts the HOME.md patch, leaves HOME.md untouched, and reports the exact lines to add manually**. It never produces an orphan (a `brain/` ADR with no `HOME.md` entry → `npm run brain:nav` red). A malformed patch fails safe to "untouched + reported", never to a half-written index.

## Slice 4 — idempotency / augment mode

On re-run against a non-empty `decisions/`, the command computes **topic coverage** (not just count) by keyword-matching existing ADR titles/filenames:

| Topic | Covered when an ADR title/slug matches |
|-------|----------------------------------------|
| Stack | `stack`/`framework`/`frontend`/`backend`/`language`/known framework names |
| Testing | `test`/`testing`/`coverage`/`tdd`/known runner names |
| Build | `build`/`bundl`/`package manager`/known bundler or PM names |

It **presents its coverage assessment for the user to confirm or override** (never silently skips), then drafts **only** for uncovered topics. Full coverage → clean exit, no drafting. **Resolved open question:** coverage is a user-confirmed keyword heuristic, not a machine registry — over-engineering an index for a 3-topic set is unwarranted; the false-positive risk is mitigated by human confirmation.

## File changes

| File | Action | Slice |
|------|--------|-------|
| `scripts/harness/backends/gentle-ai.mjs` | Modify — extract `checkSddContext()` helper, add Step 4 + `_resolveDecisionsDir` / `_checkDecisionsDir` seams, import `readdirSync` | 1 |
| `scripts/i18n/en.mjs` | Modify — add `bootstrap.sdd.noProjectAdrs` + `…Hint` keys | 1 |
| `scripts/harness/backends/gentle-ai.test.*` | Modify/Create — unit-test the seam (absent / empty / populated) | 1 |
| `test/fresh-install/in-container.sh` | Modify — add `[4]` notice assertion | 1 |
| `.claude/commands/project-bootstrap-adrs.md` | Create — the conversational command | 2–4 |
| `openspec/changes/auto-adrs/brain-drafts/*` | Create (Tier 1, disposable) — draft ADRs | 2 |
| `brain/project/decisions/adr-NNNN-*.md` | Create (Tier 2, per consumer repo) — accepted ADRs | 3 |
| `brain/HOME.md` (consumer) | Modify (Tier 2) — index accepted ADRs | 3 |

## Testing strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `_checkDecisionsDir` (absent / empty / populated); `checkSddContext()` still fires its notices | inject seams into `init()`, assert console output (`node --test`, strict TDD) |
| Integration | `env:init` emits the notice when `decisions/` is missing | `test/fresh-install/in-container.sh` `[4]` assertion (headline acceptance) |
| Manual / conversational | command drafts 3 ADRs, per-ADR review, Tier 2 writes, `brain:nav` green | the agent command is not headless-testable; validated by acceptance criteria in the proposal |

## Migration / rollout

No data migration. Chained-PR epic (feature-branch-chain); only the tracker merges to `main`. Slice 1 is additive and independently revertible (notice degrades to silence). Slice 2 writes only to `brain-drafts/` (disposable Tier 1). Slice 3 is the only slice touching `brain/`, and only via human-confirmed Tier 2 writes — already-accepted ADRs are human-owned and survive a command revert.

## A new ADR

This change establishes a governance pattern (bootstrap notices → Tier 1 draft → Tier 2 human accept, rationale stays a human stub) distinct from existing ADRs. It is recorded as **ADR-0013 "Auto-ADR onboarding"** (this change). A companion entry in `agent-authorities.md` documenting auto-ADR bootstrapping as a sanctioned Tier 2 pattern is **recommended as a follow-up**, but `agent-authorities.md` is human-authored under CODEOWNERS — that edit is a human Tier 2 action, not part of this design's writes.

## Open questions

- [ ] None blocking. Augment-mode coverage heuristic (Slice 4) is intentionally conservative + user-confirmed; refine keyword set during apply if false positives appear.
