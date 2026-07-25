# Auto-ADR Onboarding Specification

## Purpose

Detects the absence of consumer-authored ADRs in `brain/project/decisions/` at init time and provides a governed bootstrap path: a notice directs the user to an agent command that drafts 3 descriptive+stub ADRs (Tier 1, autonomous) and writes accepted drafts to `brain/` only after explicit human confirmation (Tier 2). No `brain/` write is ever autonomous. Governance backbone: `brain/core/methodology/agent-authorities.md`.

## Requirement Index

| Req | Slice | Name | Testable |
|-----|-------|------|----------|
| REQ-S1-1 | 1 | Decision-Dir Gap Seam | Unit (`node --test`, injectable) |
| REQ-S1-2 | 1 | i18n Notice Keys | Unit (`node --test`) |
| REQ-S1-3 | 1 | Fresh-install Notice Assertion | Integration (`in-container.sh`) |
| REQ-S2-1 | 2 | Command File Exists | File assertion |
| REQ-S2-2 | 2 | Draft Destination (Tier 1) | Agent E2E |
| REQ-S2-3 | 2 | Collision-safe ADR Numbering | Agent E2E |
| REQ-S2-4 | 2 | Descriptive+stub Draft Content | Agent E2E |
| REQ-S2-5 | 2 | Draft Language | Agent E2E |
| REQ-S3-1 | 3 | Per-ADR Review Flow | Agent E2E |
| REQ-S3-2 | 3 | Tier 2 Write Gate | Agent E2E |
| REQ-S3-3 | 3 | HOME.md Patch Safety | Agent E2E + `brain:nav` |
| REQ-S3-4 | 3 | Accept-all Gate | Agent E2E |
| REQ-S4-1 | 4 | Augment Mode | Agent E2E |
| REQ-S4-2 | 4 | Full-coverage Clean Exit | Agent E2E |
| REQ-E-1 | epic | Brain Write Gate Invariant | Code review + audit |

---

### Requirement REQ-S1-1: Decision-Dir Gap Seam

`gentle-ai.mjs` `init()` MUST expose a `_checkDecisionsDir` injectable seam. The seam MUST return a gap-detected signal when `brain/project/decisions/` is absent OR contains no `.md` files. It MUST be a no-op (silent) when at least one `.md` file is present.

#### Scenario: Gap fires on absent directory

- GIVEN `brain/project/decisions/` does not exist
- WHEN `init()` runs with the injected seam
- THEN the seam returns a gap-detected signal

#### Scenario: Gap fires on directory with no .md files

- GIVEN `brain/project/decisions/` exists but contains no `.md` files
- WHEN `init()` runs with the injected seam
- THEN the seam returns a gap-detected signal

#### Scenario: Silent when populated

- GIVEN `brain/project/decisions/` contains at least one `.md` file (brain self-hosting: 12 ADRs)
- WHEN `init()` runs
- THEN no gap signal is emitted

---

### Requirement REQ-S1-2: i18n Notice Keys

The gap notice (`bootstrap.sdd.noProjectAdrs`) and its hint (`bootstrap.sdd.noProjectAdrsHint`) MUST be defined in `scripts/i18n/en.mjs` and rendered through `t()`. Neither string MUST be hardcoded in `gentle-ai.mjs`.

#### Scenario: Keys exist in catalog

- GIVEN `en.mjs` is loaded
- WHEN `t('bootstrap.sdd.noProjectAdrs')` and `t('bootstrap.sdd.noProjectAdrsHint')` are called
- THEN each returns a non-empty string (no missing-key fallback)

#### Scenario: Hint references the command

- GIVEN the gap is detected
- WHEN `init()` emits the notice
- THEN the rendered hint string contains `/project:bootstrap-adrs`

---

### Requirement REQ-S1-3: Fresh-install Notice Assertion

`test/fresh-install/in-container.sh` MUST assert that `npm run env:init` output contains the gap notice when `brain/project/decisions/` is absent.

#### Scenario: Notice appears in fresh-install output

- GIVEN a container with no `brain/project/decisions/`
- WHEN `npm run env:init` runs
- THEN stdout or stderr contains the notice text produced by `t('bootstrap.sdd.noProjectAdrs')`

---

### Requirement REQ-S2-1: Command File Exists

`.claude/commands/project-bootstrap-adrs.md` MUST exist and be invocable as `/project:bootstrap-adrs` by a Claude Code agent. The file MUST NOT be declared as a `delegate_only` skill.

#### Scenario: File present in repo

- GIVEN the repo is checked out at any commit that includes Slice 2
- WHEN `.claude/commands/project-bootstrap-adrs.md` is read
- THEN the file exists and is non-empty

---

### Requirement REQ-S2-2: Draft Destination (Tier 1)

The command MUST write all ADR drafts exclusively to `openspec/changes/auto-adrs/brain-drafts/`. No file under `brain/` MUST be created or modified during Slice 2 execution.

#### Scenario: Three drafts in brain-drafts, nothing in brain/

- GIVEN the command completes its draft phase
- WHEN the file tree is inspected
- THEN exactly 3 `.md` draft files exist under `openspec/changes/auto-adrs/brain-drafts/`
- AND no new or modified files exist under `brain/`

---

### Requirement REQ-S2-3: Collision-safe ADR Numbering

The command MUST scan all `adr-NNNN-*.md` files in `brain/project/decisions/`, identify the highest existing NNNN, and begin draft filenames at NNNN+1 in ascending order. No draft MUST share a NNNN with any existing file.

#### Scenario: Numbering starts after existing ADRs

- GIVEN `brain/project/decisions/` contains `adr-0001-stack.md`
- WHEN the command drafts the 3 starter ADRs
- THEN draft filenames are `adr-0002-*.md`, `adr-0003-*.md`, `adr-0004-*.md`

#### Scenario: No collision with any existing NNNN

- GIVEN `brain/project/decisions/` has files with NNNN values up to 0005
- WHEN drafts are generated
- THEN no draft file uses NNNN 0005 or lower

---

### Requirement REQ-S2-4: Descriptive+stub Draft Content

Each draft ADR MUST populate the `Decision` section with detected facts from the consumer repo (framework, test runner, build tool). The `Context` and `Consequences` sections MUST contain only `<TODO>` stubs. The agent MUST NOT invent rationale, alternatives, or tradeoffs not present in the codebase.

#### Scenario: Detected facts appear in Decision section

- GIVEN the consumer repo uses TypeScript + Node + npm
- WHEN the Stack ADR draft is generated
- THEN the `Decision` section references the detected technology (e.g., "TypeScript", "Node")
- AND `Context` and `Consequences` both contain `<TODO>`

#### Scenario: No invented rationale

- GIVEN the command runs on any consumer repo
- WHEN any draft ADR is read
- THEN no section contains a "chosen over" or "because" claim not traceable to a repo file

---

### Requirement REQ-S2-5: Draft Language

Draft ADR prose MUST use the language specified in `brain.config.json` under `docs.language`. When that key is absent or unset, the draft language MUST default to `en`.

#### Scenario: Language follows config

- GIVEN `brain.config.json` contains `"docs": { "language": "es" }`
- WHEN drafts are generated
- THEN ADR prose is in Spanish

#### Scenario: Default language when key absent

- GIVEN `brain.config.json` does not contain `docs.language`
- WHEN drafts are generated
- THEN ADR prose is in English

---

### Requirement REQ-S3-1: Per-ADR Review Flow

The command MUST present each draft with a short summary (2-3 sentences) and offer the user exactly four choices: `accept`, `edit [feedback]`, `reject`, `accept-all`. A `reject` choice MUST result in no write to `brain/` for that ADR.

#### Scenario: Reject leaves brain/ untouched

- GIVEN the user selects `reject` for the Stack ADR
- WHEN the review session ends
- THEN no `brain/project/decisions/adr-NNNN-stack.md` file is created

#### Scenario: Edit triggers re-draft before re-presentation

- GIVEN the user selects `edit "change testing framework reference to Vitest"`
- WHEN the agent re-drafts the Testing ADR
- THEN the updated draft is re-presented before the user makes a final choice

---

### Requirement REQ-S3-2: Tier 2 Write Gate

The command MUST obtain explicit per-action human confirmation before writing any file to `brain/project/decisions/` or modifying `brain/HOME.md`. These writes MUST NOT occur autonomously before that confirmation is received.

#### Scenario: File written only after confirmation

- GIVEN the user selects `accept` for an ADR
- WHEN the agent requests Tier 2 confirmation and the user confirms
- THEN the file is written to `brain/project/decisions/adr-NNNN-<slug>.md`

#### Scenario: No write before confirmation

- GIVEN the user selects `accept` for an ADR
- WHEN the agent has not yet received explicit confirmation
- THEN no file exists at `brain/project/decisions/adr-NNNN-<slug>.md`

---

### Requirement REQ-S3-3: HOME.md Patch Safety

After accepted ADRs are written, the command MUST patch `brain/HOME.md` by appending links in the exact existing link format (`- [ADR-NNNN](project/decisions/adr-NNNN-slug.md) — description`). The patch MUST be gated by Tier 2 confirmation. On a malformed-patch condition (unrecognized HOME.md structure), the patch MUST fail safe: `HOME.md` is left unmodified and the agent reports the failure to the user.

#### Scenario: Links added in correct format and nav passes

- GIVEN one ADR is accepted and written
- WHEN `brain/HOME.md` is patched after Tier 2 confirmation
- THEN a link matching `- [ADR-NNNN](project/decisions/adr-NNNN-slug.md) — description` is appended
- AND `npm run brain:nav` reports no orphans

#### Scenario: Malformed patch leaves HOME.md unchanged

- GIVEN `brain/HOME.md` contains an unrecognized structure
- WHEN the patch step runs
- THEN `brain/HOME.md` is unchanged
- AND the agent reports the failure to the user without aborting the session

---

### Requirement REQ-S3-4: Accept-all Gate

The `accept-all` option MUST only be acted upon after the user has explicitly stated they reviewed the drafts. The agent MUST NOT proceed with accept-all on that option alone without that prior explicit statement.

#### Scenario: accept-all blocked without review confirmation

- GIVEN the user has not yet stated they reviewed the drafts
- WHEN the user types `accept-all`
- THEN the agent declines and asks the user to confirm they reviewed before proceeding

#### Scenario: accept-all proceeds after explicit review

- GIVEN the user has stated "I reviewed all drafts" (or equivalent)
- WHEN the user selects `accept-all`
- THEN all non-rejected drafts are written to `brain/` after a single batch Tier 2 confirmation

---

### Requirement REQ-S4-1: Augment Mode

When `/project:bootstrap-adrs` runs against a non-empty `brain/project/decisions/`, the command MUST compare the starter topic set (Stack, Testing, Build) against existing ADR content and offer to draft only uncovered topics.

#### Scenario: Already-covered topics are skipped

- GIVEN `brain/project/decisions/adr-0001-stack.md` exists and covers the Stack topic
- WHEN the command runs
- THEN the Stack draft is NOT generated
- AND only uncovered topics (e.g., Testing, Build) are drafted

---

### Requirement REQ-S4-2: Full-coverage Clean Exit

When all three starter topics (Stack, Testing, Build) are already covered by existing ADRs, the command MUST exit cleanly with a message indicating no gaps were found, without generating any drafts.

#### Scenario: No drafts generated on full coverage

- GIVEN `brain/project/decisions/` contains ADRs covering Stack, Testing, and Build
- WHEN `/project:bootstrap-adrs` runs
- THEN no drafts are written to `openspec/changes/auto-adrs/brain-drafts/`
- AND the user receives a "no gaps found" (or equivalent) message

---

### Requirement REQ-E-1: Brain Write Gate Invariant (Epic)

No code path introduced by this feature MUST write to `brain/` without an explicit Tier 2 human confirmation per action. This is non-negotiable per `brain/core/methodology/agent-authorities.md` Tier 2/3 rules and applies across all slices.

#### Scenario: Every brain/ write is preceded by a Tier 2 confirmation

- GIVEN any execution path of the auto-ADR feature
- WHEN a write to `brain/project/decisions/` or `brain/HOME.md` is about to occur
- THEN an explicit Tier 2 human confirmation has been received immediately before that specific write

---

## Gaps and Assumptions

| # | Gap / Assumption |
|---|-----------------|
| G1 | **Hard to test — Slices 2-4 (REQ-S2-2 through REQ-S4-2)**: agent command behavior is conversational and cannot be covered by `node --test` unit tests. Verification strategy: (a) file-system assertions after command runs (3 drafts under `brain-drafts/`, nothing under `brain/` for Slice 2); (b) `npm run brain:nav` for HOME.md correctness (REQ-S3-3); (c) manual E2E walkthrough in a fresh consumer repo documented as a numbered checklist in the Slice PR description. Each acceptance criterion in the proposal maps 1:1 to a checklist item. |
| G2 | **Topic coverage detection in Slice 4 (REQ-S4-1)**: the exact matching algorithm (filename slug, title keyword, or a config-driven topic list) is deferred to design. The spec requires coverage detection to work; the algorithm is an implementation decision. |
| G3 | **Batch Tier 2 for accept-all**: whether `accept-all` triggers one prompt for all accepted ADRs + HOME.md or one prompt per file is deferred to design. REQ-S3-4 requires a single batch confirmation; REQ-S3-2 requires per-action gates — design must reconcile. |
| G4 | **Non-Node stack degradation**: the proposal notes that pure Ruby/PHP/C++ repos degrade gracefully to fewer, broader ADRs. The degradation behavior (which topics are dropped/broadened, how detection fallback works) is deferred to design. REQ-S2-4 covers the general case. |
| G5 | **ADR-0013 creation**: the proposal notes this change may warrant a new ADR-0013 "Auto-ADR onboarding". Whether that ADR is in scope for this change or subsequent is a design-phase decision. Not specced here. |
