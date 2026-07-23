### [issue-install-home-scaffold] install-home-scaffold — 2026-07-13

# HOME.md Install Scaffold Specification

## Purpose

Every consumer that adopts brain gets a `brain/HOME.md` navigation entry point
created automatically at `brain:env:init`, from an agnostic, `managed`,
nav-clean template — closing the gap where `bootstrap.sh` advertises
"Read brain/HOME.md" but nothing ever creates it.

## Requirement Index

| Req | Name | Testable |
|-----|------|----------|
| REQ-1 | Create-if-absent scaffold | Unit (`node --test`) |
| REQ-2 | No-overwrite on existing HOME.md | Unit (`node --test`) |
| REQ-3 | Template is nav-clean on fresh install | Fixture (`check-brain-nav.mjs`, exit 0) |
| REQ-4 | Template structure and scope constraints | Unit / file assertion |
| REQ-5 | `env:init` wiring is idempotent | Integration (`bootstrap.sh`) |
| REQ-6 | HOME.md stays outside managed-paths arrays | Unit (`node --test`) |

---

### Requirement REQ-1: Create-if-Absent Scaffold

`ensureHome(root)` MUST create `brain/HOME.md` from the template when the file
is absent, and MUST return `{ created: true }` in that case.

#### Scenario: Absent HOME.md is scaffolded

- GIVEN a consumer repo with no `brain/HOME.md`
- WHEN `ensureHome(root)` runs
- THEN `brain/HOME.md` exists on disk with the template's structure
- AND the call returns `{ created: true }`

---

### Requirement REQ-2: No-Overwrite on Existing HOME.md

When `brain/HOME.md` already exists, `ensureHome(root)` MUST leave its content
byte-for-byte unchanged and MUST return `{ created: false }`. This holds
regardless of the existing file's content (curated links, arbitrary edits).

#### Scenario: Existing HOME.md is untouched

- GIVEN `brain/HOME.md` exists with consumer-curated content
- WHEN `ensureHome(root)` runs
- THEN the file's content is byte-for-byte identical to before the call
- AND the call returns `{ created: false }`

---

### Requirement REQ-3: Template Is Nav-Clean on Fresh Install

The scaffolded `brain/HOME.md`, combined with a real `brain/core/` copy on a
fresh consumer, MUST pass `check-brain-nav.mjs` with exit code 0: zero dead
links, and every `brain/**/*.md` file a fresh consumer has MUST be
transitively reachable from `brain/HOME.md`.

#### Scenario: Fresh scaffold passes brain:nav

- GIVEN a fresh consumer with only `brain/core/**` and `brain/scripts/**` (no `brain/project/**`)
- WHEN `ensureHome(root)` scaffolds `brain/HOME.md` and `npm run brain:nav` runs
- THEN `check-brain-nav.mjs` exits 0
- AND no orphaned or dead-linked `.md` file is reported

---

### Requirement REQ-4: Template Structure and Scope Constraints

The template MUST contain the exact heading `### Architecture decisions` with
zero ADR links under it. The template MUST NOT link any `brain/project/**`
path. All template prose MUST be in English regardless of `docs.language`
(ADR-0009).

#### Scenario: Empty Architecture decisions heading present

- GIVEN the template content
- WHEN it is inspected
- THEN it contains the exact heading `### Architecture decisions`
- AND no `- [ADR-...]` link line follows it

#### Scenario: No project/** links in a template with no project directory

- GIVEN a fresh consumer that has never had `brain/project/` created
- WHEN the scaffolded `brain/HOME.md` is inspected
- THEN no link target matches `project/**`

---

### Requirement REQ-5: `env:init` Wiring Is Idempotent

`brain:env:init` (`bootstrap.sh`) MUST invoke the scaffold on every run.
Re-running `env:init` on a repo that already has `brain/HOME.md` MUST NOT
overwrite it.

#### Scenario: First env:init creates HOME.md

- GIVEN a fresh consumer repo before its first `brain:env:init`
- WHEN `brain:env:init` runs
- THEN `brain/HOME.md` exists afterward

#### Scenario: Second env:init does not overwrite HOME.md

- GIVEN `brain/HOME.md` already exists with consumer edits after a prior `env:init`
- WHEN `brain:env:init` runs again
- THEN `brain/HOME.md` content is unchanged from before the second run

---

### Requirement REQ-6: HOME.md Stays Outside managed-paths Arrays

`brain/HOME.md` MUST NOT appear in either the `managed` array or the `local`
array of `brain/core/managed-paths.mjs`. This preserves consumer ownership:
`managed` would clobber curated links on every `brain:upgrade`, and `local`
only protects files that already exist at scaffold time.

#### Scenario: HOME.md absent from both arrays

- GIVEN `brain/core/managed-paths.mjs` is imported
- WHEN the `managed` and `local` exports are inspected
- THEN neither array contains an entry matching `brain/HOME.md` (or `HOME.md`)

---

## Gaps and Assumptions

| # | Gap / Assumption |
|---|-------------------|
| G1 | **Drift re-sync is out of scope.** Once scaffolded, `brain/HOME.md` is never touched by `brain:upgrade`. Future core-doc additions/removals could orphan or dead-link an already-scaffolded HOME.md with no automatic re-sync. Accepted as a known limitation, not solved by this spec. |
| G2 | **Docker-gated fresh-install assertion** (`test/fresh-install/in-container.sh` checking `brain/HOME.md` exists and `npm run brain:nav` exits 0 post-install) is optional per the proposal; REQ-3's fixture test is the required, non-Docker-gated coverage. |
