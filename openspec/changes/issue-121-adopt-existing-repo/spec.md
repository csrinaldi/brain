# adopt-inventory Specification

## Purpose

Read-only inventory and classification for the `brain:adopt` S1 command (`brain/scripts/adopt.mjs`).
New capability; no prior spec to reference.

---

## Requirements

### Requirement: Logical-Name Classification

The command MUST resolve each scanned file to a **logical name** before testing membership in
`managed[]` from `brain/core/managed-paths.mjs`. For flat-brain repos the command MUST map
`brain/<tail>` → `brain/core/<tail>` before matching. Direct path comparison MUST NOT substitute for
logical-name comparison. Files whose logical name matches `managed[]` MUST be classified `generic`;
all others MUST be classified `project`.

#### Scenario: Flat-brain file matched by logical name (catastro #145 fixture)

- GIVEN a flat-brain repo containing `brain/methodology/intro.md`
- WHEN `brain:adopt` scans that repo
- THEN the file resolves to logical name `brain/core/methodology/intro.md`, matches `managed[]`, and
  is classified `generic`

#### Scenario: File absent from manifest

- GIVEN a file `docs/onboarding/guide.md` with no match in `managed[]`
- WHEN `brain:adopt` scans that repo
- THEN classification is `project`, divergenceKind `absent-upstream`, proposedAction `keep-as-project`

---

### Requirement: Language-Aware Divergence Classification

For each `generic` file that differs from upstream the command MUST classify divergenceKind as
`identical`, `translation`, or `drift`. A file is classified `translation` only when ALL four
conditions hold: (1) matched in `managed[]`; (2) differs from upstream; (3) consumer primary language
is ES and upstream is EN; (4) content structure (heading count, section order, reference patterns)
closely mirrors upstream. Any ambiguity MUST resolve to `drift` + `flag-review`. Silent
reclassification as `translation` is PROHIBITED.

#### Scenario: ES translation with matching structure

- GIVEN a `generic` file in Spanish whose section structure mirrors the EN upstream
- WHEN `brain:adopt` classifies divergence
- THEN divergenceKind `translation`, languageFlag `true`, proposedAction `adopt-upstream`, and the
  file is listed in the "replaced translations" section of the Markdown report

#### Scenario: Structural mismatch — classified as drift

- GIVEN a `generic` file differing from upstream with consumer-added sections not present upstream
- WHEN `brain:adopt` classifies divergence
- THEN divergenceKind `drift`, proposedAction `flag-review`, languageFlag `false`

---

### Requirement: No-Brain Repo Inventory

When no `brain/` directory is detected the command MUST set targetShape `no-brain`, classify all
scanned files as `project`, and MUST NOT propose `adopt-upstream` for any file.

#### Scenario: No-brain repo produces all-project plan

- GIVEN a repo with no `brain/` directory
- WHEN `brain:adopt` runs
- THEN all scanned files are classified `project`, targetShape is `no-brain`, no file has
  proposedAction `adopt-upstream`

---

### Requirement: JSON Plan Schema

The command MUST emit `{outDir}/plan.json` conforming to the following schema. This schema is
canonical and aligned with the design document; the design's `resolveLogicalName` /
`classifyDivergence` contracts populate these fields.

**Envelope (top-level, all fields REQUIRED):**

| Field | Type | Allowed values |
|---|---|---|
| `schemaVersion` | string | `"1"` |
| `tool` | string | `"brain:adopt"` |
| `generatedAt` | string | ISO 8601 timestamp |
| `target` | object | `{ shape: "flat-brain" \| "no-brain", root: string }` |
| `manifestSource` | string | `node_modules/brain` \| `self-host` |
| `summary` | object | `{ total, generic, project, identical, translation, drift, flagForReview, upstreamMissing }` |
| `files` | array | per-file records (see below) |

**Per-file record (all fields REQUIRED):**

| Field | Type | Allowed values |
|---|---|---|
| `sourcePath` | string | path relative to repo root |
| `logicalName` | string | resolved name used for manifest matching |
| `classification` | string | `generic` \| `project` |
| `matchedGlob` | string \| null | manifest glob matched (`null` when `project`) |
| `divergenceKind` | string | `identical` \| `translation` \| `drift` \| `upstream-missing` \| `absent-upstream` |
| `languageSignal` | object \| null | `{ es: number, en: number, verdict: "es" \| "en" \| "mixed" }`; `null` when not a generic byte-diff |
| `languageFlag` | boolean | derived: `true` iff `divergenceKind == "translation"` (file is a replaced translation) |
| `proposedAction` | string | `adopt-upstream` \| `keep-as-project` \| `place-under-project` \| `flag-review` |
| `reason` | string | short human-readable explanation of the classification |

Value reconciliation (canonical): classification uses `project` (not `project-owned`);
`divergenceKind` uses `upstream-missing` for a generic file whose upstream byte source is absent and
`absent-upstream` for a project file with no manifest match; no-brain project placement uses
`proposedAction` `place-under-project`.

---

### Requirement: Output Location

The command MUST write `{outDir}/plan.json` and `{outDir}/report.md`. Default `outDir` MUST be
`.brain-adopt/` at the repo root. The user MAY override with `--out <dir>`. The command MUST create
the output directory if it does not exist.

---

### Requirement: Read-Only Contract

The command MUST NOT write any file outside `outDir`. It MUST NOT modify any git object, hook,
config, branch, index, or scanned repo file. The only permitted file-system writes are `plan.json`
and `report.md` inside `outDir`.

#### Scenario: Write isolation — flat-brain repo

- GIVEN any repo shape (flat-brain or no-brain)
- WHEN `brain:adopt` runs to completion
- THEN the only file-system changes are `{outDir}/plan.json` and `{outDir}/report.md`; no scanned
  files, `.git/**`, hooks, or config files are modified
