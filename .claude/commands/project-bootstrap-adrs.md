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

### 0.4 — Coverage assessment (augment mode)

If no ADR files were found in Step 0.3 (decisions directory absent or empty), set `topicsToDraft = ['Stack', 'Testing', 'Build']` and skip ahead to Step 0.6 — there is nothing to match against, so no coverage assessment is needed.

If at least one ADR file was found, compute topic coverage by keyword-matching each ADR's filename slug and H1 title against the topic keyword sets below.

**For each existing ADR file found in Step 0.3:**

1. Extract the **slug**: the portion of the filename between the four-digit NNNN block and `.md`. Example: `adr-0009-documentation-language-policy.md` → slug = `documentation-language-policy`. Replace hyphens with spaces.
2. Read the **H1 title**: the first line of the file that begins with `# `. Strip the leading `# `.
3. Build the **combined text**: join slug words + H1 title text, all lowercased. Example: `documentation language policy  adr-0009 — documentation language policy`.
4. For each of the three topics, check whether any keyword from that topic's set appears as a **substring** of the combined text.

**Topic keyword sets (substring match, case-insensitive):**

| Topic | Keywords |
|-------|---------|
| **Stack** | `stack`, `framework`, `frontend`, `backend`, `language`, `react`, `vue`, `angular`, `nest`, `express`, `next`, `svelte` |
| **Testing** | `test`, `testing`, `coverage`, `tdd`, `jest`, `vitest`, `mocha`, `playwright`, `cypress` |
| **Build** | `build`, `bundl`, `package`, `manager`, `vite`, `webpack`, `rollup`, `esbuild`, `tsup`, `pnpm`, `yarn`, `npm`, `bun` |

> Note: `bundl` is a stem — it matches "bundle", "bundler", "bundling" and any word that contains it.

**Coverage result per topic:**
- **COVERED**: at least one existing ADR's combined text contains at least one keyword from that topic's set. Record which filename(s) produced the match.
- **NOT COVERED**: no existing ADR matched any keyword for that topic.

Store internally:
- `stackCovered: true | false` (+ matching filename list if true)
- `testingCovered: true | false` (+ matching filename list if true)
- `buildCovered: true | false` (+ matching filename list if true)

### 0.5 — Confirm coverage and set draft scope

Initialise `topicsToDraft` with every topic that is NOT COVERED.

**If all three topics are NOT COVERED** (none of the existing ADRs matched any keyword): set `topicsToDraft = ['Stack', 'Testing', 'Build']` and skip to Step 0.6 — every topic will be drafted, nothing to skip, no assessment to present.

**If at least one topic is COVERED**, present the coverage assessment and wait for the user's choice before proceeding:

```
Coverage assessment — starter ADR topics:

  Stack:   <COVERED — matched: <filename(s)> | NOT COVERED>
  Testing: <COVERED — matched: <filename(s)> | NOT COVERED>
  Build:   <COVERED — matched: <filename(s)> | NOT COVERED>

Topics that will be drafted:   <comma-separated list of NOT COVERED topics, or "none">
Topics already covered (skip): <comma-separated list of COVERED topics, or "none">

How to proceed:
  confirm            — draft uncovered topics only (skip covered ones)
  include <topic>    — re-add a covered topic to the draft run (e.g., "include stack")
  include all        — re-add all covered topics and draft all 3
  cancel             — exit without drafting anything
```

**Handle each response:**

- `confirm`: accept the assessment as shown. `topicsToDraft` stays as the NOT COVERED topics.
- `include <topic>` (e.g., `include stack`): add the named topic to `topicsToDraft`. Re-display the updated "Topics that will be drafted / Topics already covered" lines and prompt again (only `confirm` or `cancel` accepted at this point).
- `include all`: set `topicsToDraft = ['Stack', 'Testing', 'Build']`. Re-display the updated lines and prompt for `confirm` or `cancel`.
- `cancel`: respond with:
  ```
  Cancelled. /project:bootstrap-adrs exited without writing any files.
  ```
  Exit — do not run Phases 1–4.

**Full-coverage clean exit**: if, after the user types `confirm`, `topicsToDraft` is empty (every topic was COVERED and the user did not override any), respond with:

```
All starter ADR topics are already covered. No drafts needed.
/project:bootstrap-adrs complete.
```

Exit — do not run Phases 1–4.

### 0.6 — Report

Tell the user:

```
Phase 0 — Preflight complete.
  Project slug:       <projectSlug>
  Draft language:     <lang>
  Existing ADRs:      <count of ADR files found in decisions/, or "none">
  Next ADR number:    <NNNN>
  Draft destination:  openspec/changes/auto-adrs/brain-drafts/
  Topics to draft:    <topicsToDraft comma-separated, e.g. "Stack, Testing, Build" or "Testing, Build">
```

---

## Phase 1 — Detect (Tier 1)

**Goal:** collect signals for three ADR topics — **Stack**, **Testing**, and **Build** — from the consumer repo.

**Scope**: process only the topics in `topicsToDraft` (resolved in Phase 0). For any topic not in `topicsToDraft`, skip all detection work — do not call mem_search for it, do not scan any files, do not produce a signal record, and do not report on it.

You will produce a signal record for each topic in `topicsToDraft`: either DETECTED (with concrete facts) or NO-SIGNAL.

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

After completing Steps 1a and 1b, produce an internal signal record for each topic in `topicsToDraft` only (topics not in `topicsToDraft` are omitted from this summary):

```
Stack:   DETECTED — <summary of facts> | NO-SIGNAL | (skipped — already covered)
Testing: DETECTED — <summary of facts> | NO-SIGNAL | (skipped — already covered)
Build:   DETECTED — <summary of facts> | NO-SIGNAL | (skipped — already covered)
```

Report only the in-scope topic rows to the user before proceeding to Phase 2.

---

## Phase 2 — Draft (Tier 1, autonomous)

**Goal:** write one ADR draft file per DETECTED topic (that is also in `topicsToDraft`) into `openspec/changes/auto-adrs/brain-drafts/`. Numbers are assigned sequentially among the topics in `topicsToDraft` only. Topics not in `topicsToDraft` (confirmed as already covered in Phase 0) are skipped entirely — no file written, no NNNN slot consumed. Within `topicsToDraft`, a topic with NO-SIGNAL is skipped but its NNNN slot IS still consumed to preserve relative ordering among the in-scope topics.

Process topics in this fixed order: **Stack → Testing → Build**.

### For each topic

**If NOT IN `topicsToDraft`** (topic was confirmed as already covered in Phase 0):
- Skip this topic entirely — no scan was run, no draft to write.
- Do NOT consume a NNNN slot.
- (No need to report — the coverage assessment in Phase 0 already informed the user.)

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

## Phase 3 — Interactive Review

**Goal:** review each draft with the user and collect a decision — `accept`, `edit [feedback]`, `reject`, or `accept-all`. This phase writes **nothing to `brain/`** — that happens in Phase 4 after explicit Tier 2 confirmation.

### Setup

Before presenting any draft, track two pieces of state:

- `reviewedConfirmed` — starts `false`; set to `true` only when the user **explicitly asserts** they have reviewed the drafts (e.g., "I reviewed all drafts", "I've reviewed them", "already reviewed", or equivalent phrasing).
- `decisions` — a map from each draft filename to `accept` or `reject`. Starts empty.

### Accept-all gate

`accept-all` is always listed as a choice so the user knows it exists. However, if the user types `accept-all` and `reviewedConfirmed` is `false`, **decline** and respond:

> "Please confirm you have reviewed the drafts before using `accept-all`. Once you have, say something like \"I reviewed all drafts\" — then type `accept-all` to accept all remaining drafts in one step."

Do **not** proceed with accept-all until the user makes that explicit assertion and `reviewedConfirmed` becomes `true`.

If the user's input is not one of the four commands but contains a review assertion (e.g., "I reviewed all drafts", "I reviewed them", "already reviewed", "I've read them all"), set `reviewedConfirmed = true` and confirm:

> "`accept-all` is now unlocked. Type `accept-all` to accept all remaining drafts at once, or continue reviewing draft by draft."

Then prompt for their choice on the current draft.

### For each draft (Stack → Testing → Build, skip NO-SIGNAL topics)

For each topic where a draft was written in Phase 2:

**Step 1 — Read the draft**

Read `<repoRoot>/openspec/changes/auto-adrs/brain-drafts/<filename>`.

**Step 2 — Present the summary**

Show a 2–3 sentence summary of the draft, then the four choices:

```
--- Review: <filename> ---
<2–3 sentence summary drawn from the ## Decision section and the ADR title.
 State what technology was detected and recorded, and that Context/Consequences
 are TODO stubs awaiting human authorship.>

Choices:
  accept            — mark this ADR for Tier 2 write to brain/
  edit [feedback]   — revise this draft in brain-drafts/ and re-present before you decide
  reject            — discard this ADR (no write to brain/, no HOME.md entry)
  accept-all        — accept all remaining drafts at once (requires "I reviewed" confirmation first)
```

**Step 3 — Handle the response**

#### `accept`

- Record `decisions[filename] = 'accept'`.
- Respond: `Accepted: <filename>.`
- Proceed to the next draft.

#### `edit [feedback]`

- Extract the feedback text (everything after the keyword `edit `).
- Revise the draft **in-place** at `<repoRoot>/openspec/changes/auto-adrs/brain-drafts/<filename>`:
  - Incorporate the feedback into the `## Decision` section only.
  - Do **not** add invented rationale, alternatives, or tradeoffs to `## Context` or `## Consequences`.
- Confirm: `Draft revised: <filename> — <one-sentence description of the change made>.`
- **Re-present** the draft (return to Step 1 for the same draft). Repeat until the user chooses `accept` or `reject`.

#### `reject`

- Record `decisions[filename] = 'reject'`.
- Respond: `Rejected: <filename> — no write to brain/ for this ADR.`
- Proceed to the next draft.

#### `accept-all`

- Check the gate: if `reviewedConfirmed` is `false`, decline (see **Accept-all gate** above).
- If `reviewedConfirmed` is `true`:
  - Record `decisions[current_filename] = 'accept'`.
  - Record `decisions[each remaining unreviewed filename] = 'accept'`.
  - Skip individual review for all remaining drafts.
  - Proceed directly to Phase 4 **Path B (batched)**.

### Phase 3 summary

After all drafts are reviewed (or `accept-all` reached):

```
--- Phase 3 Review complete ---
Accepted: <list of accepted filenames, or "none">
Rejected: <list of rejected filenames, or "none">
```

If **no** drafts were accepted, skip Phase 4 entirely and report:

```
No drafts accepted — nothing will be written to brain/.
/project:bootstrap-adrs complete.
```

---

## Phase 4 — Tier 2 Writes + HOME.md Patch

**Goal:** write accepted ADR files to `brain/project/decisions/` and patch `brain/HOME.md`. Per `brain/core/methodology/agent-authorities.md` (Tier 2), every write to `brain/` requires **explicit human confirmation** before it occurs. Nothing in this phase is autonomous.

There are two paths — **Path A** (per-ADR, from individual `accept` choices) and **Path B** (batched, from `accept-all` after the "I reviewed" gate).

---

### Path A — Per-ADR (individual `accept` choices)

Process each accepted ADR **in order** (Stack → Testing → Build).

**For each accepted ADR**, request Tier 2 confirmation — present this prompt and wait:

```
--- Tier 2 confirmation required — brain/ write ---
  File:    brain/project/decisions/<adr-NNNN-slug.md>
  Content: <one-sentence summary of the ## Decision section>

Type "confirm" to write this file, or "skip" to leave it out.
```

- If `confirm`: write the draft content to `<repoRoot>/brain/project/decisions/<filename>`. Report: `Written: brain/project/decisions/<filename>`.
- If `skip`: do **not** write the file. Report: `Skipped: <filename> — not written to brain/.`

After all accepted ADRs are processed, run the **HOME.md patch** step with a separate Tier 2 prompt (see below).

---

### Path B — Batched (`accept-all` after "I reviewed" gate)

Issue **one single** batched Tier 2 confirmation covering all accepted ADR files and the HOME.md patch together:

```
--- Tier 2 batch confirmation required — brain/ writes ---
The following changes will be made:

ADR files to write:
<list each: brain/project/decisions/<adr-NNNN-slug.md> — <one-sentence Decision summary>>

HOME.md patch:
  brain/HOME.md — append one link per accepted ADR to '### Architecture decisions'

Type "confirm" to apply all changes, or "cancel" to abort everything.
```

- If `confirm`: write each accepted ADR file to `<repoRoot>/brain/project/decisions/<filename>`, then run the **HOME.md patch** (see below). Report each file as written.
- If `cancel`: write nothing. Report: `Batch write cancelled — no changes made to brain/.` End the command.

---

### HOME.md patch

This step runs after all accepted ADR files are written (whether via Path A or Path B).

**Path A only** — request a separate Tier 2 confirmation for the HOME.md modification before patching:

```
--- Tier 2 confirmation required — brain/HOME.md patch ---
  File:   brain/HOME.md
  Change: append <N> ADR link(s) to the '### Architecture decisions' list.

  Lines to be appended:
  <list each: - [ADR-NNNN](project/decisions/<adr-NNNN-slug.md>) — <short description>>

Type "confirm" to patch HOME.md, or "skip" to leave HOME.md unchanged
(you will need to add the links manually).
```

If the user types `skip`, leave HOME.md unchanged and proceed to **Post-write verification**.

In **Path B**, no separate prompt is needed — the batch confirmation already covers the HOME.md patch.

#### Locate the insertion point (fail-safe)

1. Read `<repoRoot>/brain/HOME.md`.
2. Search for the heading `### Architecture decisions` (exact, case-sensitive match).
   - **If not found**: ABORT the patch. Leave `brain/HOME.md` unchanged. Report:
     ```
     HOME.md patch ABORTED — could not locate the heading '### Architecture decisions'.
     HOME.md was NOT modified. Add these lines manually after that heading:
     <list each: - [ADR-NNNN](project/decisions/<adr-NNNN-slug.md>) — <short description>>
     ```
     Continue to **Post-write verification** without modifying HOME.md.
3. Within the `### Architecture decisions` section (between that heading and the next `---` separator or `##` heading), find the **last** line that matches the pattern `- [ADR-NNNN](project/decisions/...)` where NNNN is exactly four digits.
   - **If no such line is found within that section**: ABORT the patch. Leave `brain/HOME.md` unchanged. Report:
     ```
     HOME.md patch ABORTED — found '### Architecture decisions' but could not locate
     any existing ADR link line (expected pattern: - [ADR-NNNN](project/decisions/...)).
     HOME.md was NOT modified. Add these lines manually after the last existing ADR link:
     <list each: - [ADR-NNNN](project/decisions/<adr-NNNN-slug.md>) — <short description>>
     ```
     Continue to **Post-write verification** without modifying HOME.md.

#### Append the links

If the insertion point was found successfully:

For each accepted and written ADR (in order), insert a new line immediately after the last existing ADR link line, using this exact format:

```
- [ADR-<NNNN>](project/decisions/<adr-NNNN-slug>.md) — <short description>
```

Where:
- `<NNNN>` is the zero-padded four-digit number from the filename.
- `project/decisions/<adr-NNNN-slug>.md` is the path **relative to `brain/`** — no `brain/` prefix.
- `<short description>` is derived from the ADR title line `# ADR-NNNN — <Topic>: <detail>`: take the text after the first ` — ` separator (e.g., for title `# ADR-0014 — Stack: TypeScript + React`, the description is `Stack: TypeScript + React`).

After writing `brain/HOME.md`, confirm:

```
HOME.md patched: appended <N> ADR link(s) after the last entry in '### Architecture decisions'.
```

---

### Post-write verification

After all writes (ADR files + HOME.md) are complete, report:

```
/project:bootstrap-adrs complete.

Written to brain/:
<list each brain/project/decisions/<filename>, or "none">

brain/HOME.md: <patched | unchanged — see above>

Recommended: run 'npm run brain:nav' to verify no orphaned ADRs and no broken links.
```
