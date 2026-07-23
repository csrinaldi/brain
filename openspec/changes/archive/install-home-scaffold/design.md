# Design — Install-time HOME.md Scaffold

> **Status:** Archived · How the [proposal](proposal.md) is implemented. Technical decisions.
> Governed by [ADR-0013](../../../brain/project/decisions/adr-0013-auto-adr-onboarding.md)
> ("never orphan an accepted ADR"), [ADR-0012](../../../brain/project/decisions/adr-0012-harness-init-adapter.md)
> (logic in agnostic helpers, not the agent surface), [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md)
> (core is English). Satisfies [check-brain-nav.mjs](../../../brain/scripts/check-brain-nav.mjs).

## The architectural shape

Two agnostic, `managed`, unit-tested helpers under `brain/scripts/lib/` plus one
managed template under `brain/core/templates/`. Nothing agent-specific is added.

| Concern | Where it lives | Contract mirrored |
|---------|----------------|-------------------|
| Create `brain/HOME.md` if absent | `home-scaffold.mjs` `ensureHome(root)` | `ensureBrainConfig` (create-if-absent, never overwrite) |
| Index one ADR into HOME.md | `home-index.mjs` `insertAdrLink(text, adr)` (pure) | new — pure string→string, CLI does I/O |
| The scaffolded content | `core/templates/HOME.template.md` | ships via `brain/core/**`, upstream-improvable |
| Claude adapter | `.claude/commands/project-bootstrap-adrs.md` Phase 4 | thin — calls the helper, keeps only Tier-2 UX |

Distribution (verified): `brain/core/**` covers the template, `brain/scripts/**`
covers both helpers and the modified `check-brain-nav.mjs`. **No `managed-paths.mjs`
edit is required.** `brain/HOME.md` stays out of both `managed` (would clobber
curated ADR links on upgrade) and `local` (only protects pre-existing files) —
consumer-owned by design.

## Decision 1 — `ensureHome(root, opts)`

**Choice.** Byte-verbatim copy of the template — no token substitution.

```js
// brain/scripts/lib/home-scaffold.mjs
const __filename = fileURLToPath(import.meta.url);            // scripts/lib/
const REPO_ROOT     = join(dirname(__filename), '..','..','..');            // repo root
const TEMPLATE_PATH = join(dirname(__filename), '..','..','core','templates','HOME.template.md');

export function ensureHome(root = REPO_ROOT, { templatePath = TEMPLATE_PATH, write = true } = {}) {
  const homePath = join(root, 'brain', 'HOME.md');
  if (existsSync(homePath)) return { created: false };        // present → untouched
  const template = readFileSync(templatePath, 'utf8');
  if (write) { try { writeFileSync(homePath, template, 'utf8'); } catch { return { created: false }; } }
  return { created: true };
}

// Main-module guard — `node brain/scripts/lib/home-scaffold.mjs ensure`
if (process.argv[1] === __filename && process.argv[2] === 'ensure') {
  if (ensureHome().created) console.log('  ✓ brain/HOME.md: created from template');
}
```

**Seams:** `root` (fixture dir), `templatePath` (point at a fixture), `write:false`
(dry run) — mirrors `ensureBrainConfig`'s injectable style. Template is located
relative to `import.meta.url`, never `cwd`, so `bootstrap.sh` and tests agree.

**Alternatives rejected:** `{{PROJECT_NAME}}` substitution (adds a code path and
breaks the byte-identical no-overwrite assertion; nav-correctness needs no project
name — defer); reading `docs.language` to translate (Decision 3 keeps this section
English per ADR-0009).

**Wiring.** `bootstrap.sh` gains one line beside the existing brain-config call
(~L20): `node brain/scripts/lib/home-scaffold.mjs ensure || true`. Non-fatal,
idempotent — re-running `env:init` on a repo that already has HOME.md is a no-op.

## Decision 2 — `HOME.template.md` (the nav-critical content)

A fresh consumer has exactly `brain/core/**` (13 `.md`) and `brain/scripts/**` —
**no `brain/project/`, no `docs/`**. `check-brain-nav` requires every reachable
`brain/**/*.md` be linked from HOME.md and **zero** dead links. Verified reachability:

- `core/methodology/` has **no README** → all 6 files must be linked **directly**.
- `core/anti-patterns/README.md` **indexes all 6 leaves** (incl. `pre-v0-8-0-upgrade-clobber-lockout.md`) → linking the README reaches them transitively. Template links only the README (auto-covers future leaves; no inline duplication).

**Strip (brain-specific / dead on a fresh consumer):** the `../docs/adoption.md`
"Getting started" link (`docs/` is not `managed`), the self-hosting narrative, the
whole `Project knowledge` ADR list and every `project/**` link.

Exact template body:

```markdown
# Knowledge Base

Entry point for the living documentation of this project.
Start here and follow the links to reach every durable document.

---

## Generic core (`brain/core/`)

Reusable documentation distributed by brain — applies to any project that adopts
this system. `brain/core/` is upstream and treated as read-only here.

### Methodology

- [Consolidation protocol](core/methodology/consolidation-protocol.md) — how generic improvements flow upstream
- [Agent authorities](core/methodology/agent-authorities.md) — what AI agents can and cannot do
- [Harness contract](core/methodology/harness-contract.md) — abstract SDD verbs any harness must implement
- [VCS contract](core/methodology/vcs-contract.md) — abstract VCS verbs any provider must implement
- [Feature-working-memory contract](core/methodology/feature-working-memory-contract.md) — resume.md schema + checkpoint/resume verbs
- [Workflow governance](core/methodology/workflow-governance.md) — invariants, CI gates, lockout recovery

### Anti-patterns (generic)

- [Anti-patterns index](core/anti-patterns/README.md) — indexes every generic anti-pattern

---

## Project knowledge (`brain/project/`)

Decisions and domain knowledge specific to this project, added as it grows.

### Architecture decisions

---

> Active changes → `openspec/changes/`
> Durable decisions → `brain/project/decisions/`
```

The `### Architecture decisions` heading is **empty** (zero ADR links, no dead
links) — a ready insertion point. After `project-bootstrap-adrs` writes an ADR to
`brain/project/decisions/` and inserts its link, the link resolves.

## Decision 3 — the `/templates/` nav exclusion (LANDMINE)

The template file **itself** lives at `brain/core/templates/HOME.template.md` — a
`.md` under `brain/`. Without action `check-brain-nav` breaks **in the brain repo
and every consumer**: (a) the file is an **orphan** (HOME.md must not link its own
template), and (b) its links (`core/methodology/…`) resolve relative to
`brain/core/templates/` → **dead**. Both are triggered merely by the file existing.

**Fix:** one line in `check-brain-nav.mjs` (managed → ships to consumers), mirroring
the existing `/__fixtures__/` skip:

```js
const brainFiles = walk(BRAIN).filter((f) =>
  f.endsWith('.md') && !f.includes('/__fixtures__/') && !f.includes('/templates/'));
```

**Alternative rejected:** rename the template to a non-`.md` extension
(`HOME.template` / `.tmpl`) to dodge the walker — loses markdown ergonomics and
contradicts the proposal's fixed filename. The exclusion is the smaller, clearer
change and templates are scaffolding sources, not navigable docs.

## Decision 4 — `insertAdrLink(homeText, adr)` (pure) + CLI

```js
// brain/scripts/lib/home-index.mjs
export function insertAdrLink(homeText, { number, slug, description }) {
  // returns { text, inserted: boolean, reason?, linesToAdd?: string[] }
}
```

Line format (matches existing HOME entries):
`- [ADR-NNNN](project/decisions/<slug>.md) — <description>` (NNNN = zero-padded).

Branches:
1. **Idempotent** — a line already contains `](project/decisions/<slug>.md)` → `{ text: homeText, inserted: false, reason: 'already-present' }`.
2. **Anchor** — locate the single `### Architecture decisions` heading; bound the section by the next `^---$` or `^## `. Missing/duplicate → **fail-safe** `{ text: homeText, inserted: false, reason: 'anchor-not-found'|'anchor-ambiguous', linesToAdd: [line] }` (input untouched).
3. **Append-after-last** — section has ≥1 `- [ADR-\d{4}](project/decisions/…` line → insert immediately after the last one.
4. **Insert-after-empty-heading** — section has no ADR line (fresh scaffold) → insert after the heading, preserving one blank line before the list. **This is the branch that fixes the ADR-0013 orphan-on-fresh-consumer abort.**

**CLI (I/O only — keeps the function pure):**
`node brain/scripts/lib/home-index.mjs insert --home <path> --number <n> --slug <s> --desc <d>`
reads the file, calls `insertAdrLink`, then:
- `inserted` → writes file, prints `HOME.md patched: inserted ADR-NNNN`, exit 0.
- `already-present` → prints no-op notice, exit 0.
- fail-safe → prints `linesToAdd` under "add manually", leaves file untouched, exit 3.

## Decision 5 — adapter rewire (Phase 4)

Replace the two prose subsections **"Locate the insertion point (fail-safe)"** and
**"Append the links"** (`project-bootstrap-adrs.md` ~L506–546) with a single call
per accepted ADR (in order): `node brain/scripts/lib/home-index.mjs insert …`, then
branch on exit code:

| Result | Adapter reports |
|--------|-----------------|
| exit 0, "patched" | `HOME.md patched: appended ADR-NNNN` |
| exit 0, "no-op" | `HOME.md: ADR-NNNN already indexed` |
| exit 3, fail-safe | surface the printed `linesToAdd` as "add manually — HOME.md unchanged" |

The Tier-2 confirmation prompt (before) and Post-write verification + `brain:nav`
recommendation (after) stay in the adapter unchanged. **No HOME.md-patch algorithm
remains in adapter prose** — the coupling moves to the agnostic helper any future
adapter (Codex, …) can call.

## File changes

| File | Action | Part |
|------|--------|------|
| `brain/core/templates/HOME.template.md` | Create — the scaffold body (Decision 2) | 1 |
| `brain/scripts/lib/home-scaffold.mjs` | Create — `ensureHome` + CLI guard | 1 |
| `brain/scripts/check-brain-nav.mjs` | Modify — add `/templates/` walk exclusion | 1 |
| `bootstrap.sh` (`brain/scripts/bootstrap.sh`) | Modify — invoke scaffold near brain-config ensure (~L20) | 1 |
| `brain/scripts/lib/home-scaffold.test.mjs` | Create — create / no-overwrite / return shape | 1 |
| `brain/scripts/check-brain-nav.test.mjs` | Modify — add case: `/templates/*.md` never orphans/dead-links | 1 |
| `brain/scripts/lib/home-index.mjs` | Create — `insertAdrLink` (pure) + CLI | 2 |
| `brain/scripts/lib/home-index.test.mjs` | Create — empty-insert / append / fail-safe / idempotent | 2 |
| `.claude/commands/project-bootstrap-adrs.md` | Modify — Phase 4 calls the helper | 2 |
| `test/fresh-install/in-container.sh` | Modify (optional, Docker-gated) — assert HOME.md + `brain:nav` exit 0 | 1 |
| `brain/core/managed-paths.mjs` | **No change** — globs already cover new paths | — |

## Testing strategy (strict TDD — `npm test` = `node --test`)

| File (model after) | Cases |
|--------------------|-------|
| `home-scaffold.test.mjs` (← `lib/brain-config.test.mjs`) | absent → `{created:true}`, file has exact heading + `core/methodology/` links, **no** `project/**` md link; present arbitrary content → `{created:false}` + byte-identical; second call → `{created:false}` |
| Nav-integrity fixture (← `check-brain-nav.test.mjs` spawn pattern) | `cpSync` real `check-brain-nav.mjs` + real `brain/core/` into a temp root, run `ensureHome(root)`, spawn the script, assert **exit 0** (template + real core is nav-clean, `/templates/` excluded) |
| `check-brain-nav.test.mjs` (extend) | a `brain/core/templates/x.md` with `core/…` links does not add an orphan or dead link |
| `home-index.test.mjs` (← pure-fn tests, e.g. `lib/branch-type.test.mjs`) | empty-headed section → inserted after heading, `inserted:true`; existing ADR lines → appended after last; no anchor → `inserted:false` + `linesToAdd`, text unchanged; re-insert present slug → `inserted:false`, `reason:'already-present'`, unchanged |
| `test/fresh-install/in-container.sh` (optional) | after `env:init`: `brain/HOME.md` exists **and** `npm run brain:nav` exits 0 |

## Migration / rollout

No data migration. **Feature-branch-chain**, only the tracker merges to `main`
(auto-adrs precedent). **Part 1** (scaffold + nav exclusion + wiring) is
self-contained and closes the "no HOME.md" gap on its own. **Part 2** (index helper
+ adapter rewire) depends on Part 1 (needs the scaffolded empty-section HOME to make
the empty-insert branch meaningful). **Known limitation (accepted, out of scope):**
a scaffolded consumer HOME.md is never re-synced by `brain:upgrade`; future core-doc
churn can silently orphan/dead-link it — candidate follow-up.

**Review Workload Forecast:** ~450 lines total (Part 1 ~230, Part 2 ~220).
`400-line budget risk: High` for a single PR, `Low` per slice → chained PRs
recommended, matching the natural Part 1 / Part 2 boundary.

## Open questions

- [ ] None blocking. Template project-name/i18n substitution deferred by design; empty-section insert whitespace (blank line before first link) pinned in Decision 4 and covered by the empty-insert test.
