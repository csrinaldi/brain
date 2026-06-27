---
name: project-bootstrap-adrs
description: "Detect the tech stack, testing framework, and build tool of this repo and draft three starter ADRs (Stack, Testing, Build) into openspec/changes/auto-adrs/brain-drafts/ for human review. Tier 1 only — no writes to brain/ in this phase."
---

You are executing the `/project:bootstrap-adrs` command. Work through the phases below in order. This is a **Tier 1 autonomous** operation for Phases 0–2: you write only to `openspec/changes/auto-adrs/brain-drafts/` — never to `brain/` — until the Slice 3 interactive review phases are reached.

---

## Phase 0 — Preflight

**Goal:** resolve project context and compute the next available ADR number.

### 0.1 Resolve `repoRoot`

`repoRoot` is the absolute path of the repository root — the directory that contains both `.git/` and `brain.config.json`. Determine it from your current working directory or the known repository path.

### 0.2 Read `brain.config.json`

Read `<repoRoot>/brain.config.json`. Extract:

- `docs.language` → store as `lang`. Default to `"en"` if the key is absent or the file cannot be read.
- `project.slug` → store as `projectSlug` (e.g. `"csrinaldi/brain"`).

### 0.3 Scan for existing ADRs

Scan `<repoRoot>/brain/project/decisions/` for files whose names match the pattern `adr-NNNN-*.md` (where NNNN is exactly four digits).

- Parse the four-digit number from each matching filename.
- Take the maximum value found; set `nextNNNN = max + 1`.
- If the directory does not exist or contains no matching files, set `nextNNNN = 1`.
- Format `nextNNNN` as a zero-padded four-digit string: e.g. `1` → `"0001"`, `13` → `"0013"`.

### 0.4 Report

Tell the user:

```
Phase 0 — Preflight complete.
  Project slug:       <projectSlug>
  Draft language:     <lang>
  Next ADR number:    <NNNN>
  Draft destination:  openspec/changes/auto-adrs/brain-drafts/
```

---

## Phase 1 — Detect (Tier 1)

**Goal:** collect signals for three ADR topics — **Stack**, **Testing**, and **Build** — from the consumer repo.

You will produce a signal record for each topic: either DETECTED (with concrete facts) or NO-SIGNAL.

### 1a — Try Engram cache first

Search for cached `sdd-init` data for this project:

1. Call `mem_search("sdd-init/<projectSlug>")` (replace `<projectSlug>` with the value from Phase 0).
2. If an observation is found, call `mem_get_observation(id)` to retrieve the full content.
3. From the cached content, extract signals for each topic:
   - **Stack**: programming language, primary framework or runtime
   - **Testing**: test runner name, config file, test script command
   - **Build**: bundler or build tool, package manager

If the Engram cache provides clear signals for all three topics, proceed to Phase 2 with those facts and skip Step 1b.

### 1b — Direct file scan (fallback)

If the Engram cache is absent or does not provide sufficient signals for a topic, scan the repo directly. Read these files if they exist (use relative paths from `repoRoot`):

| File | What to look for |
|------|-----------------|
| `package.json` | `dependencies`, `devDependencies` (framework/runner/bundler names + versions), `scripts.test`, `scripts.build` |
| `tsconfig.json` | Presence confirms TypeScript |
| `pnpm-lock.yaml` | Package manager: pnpm |
| `yarn.lock` | Package manager: yarn |
| `package-lock.json` | Package manager: npm |
| `bun.lockb` | Package manager: bun |
| `go.mod` | Go module name + Go version |
| `pyproject.toml` | Python project, build system (`[build-system]`), test runner |
| `Cargo.toml` | Rust crate name + edition |
| `Gemfile` | Ruby runtime + gems |
| `composer.json` | PHP dependencies |

**Detection mapping — what counts as a signal for each topic:**

| ADR topic | Counts as a signal when… |
|-----------|--------------------------|
| **Stack** | A framework dep is present in `package.json`: `react`, `vue`, `svelte`, `@angular/core`, `next`, `@nestjs/core`, `express`; OR `tsconfig.json` exists (TypeScript); OR `go.mod` / `Cargo.toml` / `pyproject.toml` / `Gemfile` / `composer.json` exists (non-Node language) |
| **Testing** | A test-runner dep is present: `vitest`, `jest`, `mocha`, `@playwright/test`, `cypress`, `@testing-library/*`, `node:test` used in scripts; OR a test config file exists (`vitest.config.*`, `jest.config.*`); OR `scripts.test` is set in `package.json`; OR `*.test.*` / `*.spec.*` files exist in the repo |
| **Build** | A bundler dep is present: `vite`, `webpack`, `rollup`, `esbuild`, `tsup`; OR `scripts.build` is set in `package.json`; OR a lock file is present (which also identifies the package manager) |

**Collect exact facts** for each DETECTED topic — specific package names, versions (if in `package.json`), config filenames, lock filenames. These exact facts go into the `## Decision` section of each draft. Do not paraphrase or generalize.

### 1c — Signal summary

After completing Steps 1a and 1b, produce an internal signal record:

```
Stack:   DETECTED — <summary of facts> | NO-SIGNAL
Testing: DETECTED — <summary of facts> | NO-SIGNAL
Build:   DETECTED — <summary of facts> | NO-SIGNAL
```

Report this to the user before proceeding to Phase 2.

---

## Phase 2 — Draft (Tier 1, autonomous)

**Goal:** write one ADR draft file per DETECTED topic into `openspec/changes/auto-adrs/brain-drafts/`. Numbers are assigned sequentially at draft time: Stack = `nextNNNN`, Testing = `nextNNNN+1`, Build = `nextNNNN+2`. A topic with NO-SIGNAL is skipped (its number slot is still consumed to preserve ordering).

Process topics in this order: **Stack → Testing → Build**.

### For each topic

**If NO-SIGNAL:**
- Do NOT write a file.
- Report: `No signal detected for <topic> — skipping draft.`
- Increment the NNNN counter anyway (the slot is reserved but empty).

**If DETECTED:**
1. Determine the draft filename:
   - Stack: `adr-<NNNN>-stack.md` (or `adr-<NNNN>-stack-<main-tech>.md` if the main technology is unambiguous, e.g. `stack-typescript-react`)
   - Testing: `adr-<NNNN>-testing.md`
   - Build: `adr-<NNNN>-build.md`

2. Write `<repoRoot>/openspec/changes/auto-adrs/brain-drafts/<filename>` using the template below.

3. Confirm to the user:
   ```
   Draft written: openspec/changes/auto-adrs/brain-drafts/<filename>
     Decision: <one-sentence summary of detected facts>
   ```

### Descriptive ADR template

Use this exact structure for every draft. Substitute `<lang>` prose (see language rule below):

```markdown
# ADR-<NNNN> — <Topic>: <detected main technology or framework>

**Status**: Proposed
**Date**: <today's date, ISO 8601 format: YYYY-MM-DD>

## Decision

<One or two sentences stating detected facts only. Reference exact filenames,
package names, and versions from the scan. Do NOT invent rationale, tradeoffs,
or "chosen over" comparisons — record only what is present in the repo.>

## Context

<TODO: why <technology> here? What alternatives were considered, and what
constraints or requirements drove this choice?>

## Consequences

<TODO: what does adopting <technology> commit the team to — tooling, hiring,
ecosystem lock-in, upgrade path, performance characteristics?>
```

**Concrete example** (TypeScript + React + Vitest + Vite + pnpm repo, `lang: "en"`, starting NNNN = `"0002"`):

`adr-0002-stack-typescript-react.md`:
```markdown
# ADR-0002 — Stack: TypeScript + React

**Status**: Proposed
**Date**: 2026-06-27

## Decision

Built on **React 18** with **TypeScript** (detected: `react@18.3.1` and
`typescript@5.x` in `package.json`; `.tsx` components under `src/`).

## Context

<TODO: why React + TypeScript here? What alternatives were weighed (Vue, Svelte,
plain JS), and what constraints drove the choice?>

## Consequences

<TODO: what does this commit the team to — tooling, hiring, ecosystem, upgrade path?>
```

`adr-0003-testing.md`:
```markdown
# ADR-0003 — Testing: Vitest

**Status**: Proposed
**Date**: 2026-06-27

## Decision

Uses **Vitest** as the test runner (detected: `vitest@2.x` in `devDependencies`;
`vitest.config.ts` present; `scripts.test` = `"vitest run"`).

## Context

<TODO: why Vitest? What other runners were considered (Jest, Mocha, Playwright),
and what drove this choice?>

## Consequences

<TODO: what does this commit the team to — Vite ecosystem coupling, migration
cost from Jest if applicable, browser test strategy?>
```

`adr-0004-build.md`:
```markdown
# ADR-0004 — Build & Package Manager: Vite + pnpm

**Status**: Proposed
**Date**: 2026-06-27

## Decision

Uses **Vite** as the build tool (detected: `vite@5.x` in `devDependencies`;
`vite.config.ts` present; `scripts.build` = `"vite build"`). Package manager:
**pnpm** (detected: `pnpm-lock.yaml` present).

## Context

<TODO: why Vite + pnpm? What alternatives were considered (webpack, esbuild,
npm, yarn), and what drove these choices?>

## Consequences

<TODO: what does this commit the team to — pnpm workspace conventions,
Vite plugin ecosystem, build performance characteristics, CI cache setup?>
```

### Language rule

All prose in the generated draft — including the `## Decision` sentence, the `## Context` TODO hint, and the `## Consequences` TODO hint — MUST be written in `lang` (resolved in Phase 0).

- `lang = "en"`: write in English (as in the example above).
- `lang = "es"`: write in Spanish. Example `## Context` stub for Spanish:
  `<TODO: ¿por qué <tecnología> aquí? ¿Qué alternativas se consideraron y qué restricciones llevaron a esta decisión?>`

Detected names (package names, filenames, version strings) are never translated — they appear as-is regardless of `lang`.

---

## End of Slice 2

After Phase 2 completes, report a final summary:

```
/project:bootstrap-adrs — Slice 2 complete (draft phase).

Drafts written to openspec/changes/auto-adrs/brain-drafts/:
  <list each filename written, one per line>
  (or "No drafts written — all topics had no signal." if all were skipped)

Topics with no signal (skipped): <list or "none">

These are Tier 1 drafts only.
No files were written to brain/project/decisions/ or brain/HOME.md.

Next step — Slice 3 (not yet implemented):
  The interactive review phase (accept | edit [feedback] | reject | accept-all)
  followed by Tier 2 writes to brain/project/decisions/ with explicit confirmation
  will be added to this command in the next slice.
  Run /project:bootstrap-adrs again after the Slice 3 update to complete the flow.
```

<!-- SLICE 3 EXTENSION POINT
Phase 3 (interactive review: accept | edit | reject | accept-all) and
Phase 4 (Tier 2 writes to brain/project/decisions/ + brain/HOME.md patch)
will be appended here by the Slice 3 implementation.
Do NOT modify the Phase 0–2 structure above when extending.
-->
