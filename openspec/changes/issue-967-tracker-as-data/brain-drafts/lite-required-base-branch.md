# Draft — `base-branch` is required at every tier, and when a tracker PR opens (issue #967)

> **Tier 2 draft. Not yet promoted.** `workflow-governance.md` is a promoted
> Tier-2 file (`brain/core/methodology/`), so this is an in-place addition, not
> a new file. The maintainer promotes it once PR C of #967 (the `base-branch`
> gate) has landed:
>
> ```
> npm run brain:promote -- openspec/changes/issue-967-tracker-as-data/brain-drafts/lite-required-base-branch.md
> ```
>
> Co-promote the `brain/HOME.md` entry if the promotion tool does not already
> carry it (`consolidation-protocol.md` §1d).

## Why this draft exists

`base-branch` (design.md D9, ruling 1 — maintainer, 2026-09-16) is the one
governance gate this repository declares **required at every tier, `lite`
included** — a deliberate exception to "`lite` only detects" (see this file's
own Invariant 2 note for the general rule). `GATE_MATRIX['base-branch']`
(`brain/scripts/vcs/governance-tiers.mjs`) already encodes this in code;
this draft is the doctrine sentence that explains WHY, so a reader of
`workflow-governance.md` does not find an unexplained exception to the tier
model the rest of this file describes.

Two sentences, targeting the same file, carried in one draft (R967-8: "two
files, not three" — the tracker-PR-timing sentence rides inside this one
because it targets the same doctrine file rather than opening a third draft).

## Proposed addition — new section, after "Four Invariants and Their Gates"

> ### `base-branch` — required at every tier, including `lite`
>
> `base-branch` is required at every tier, `lite` included: it is the one gate
> whose detection mode would only have warned about the failure it exists to
> prevent — a slice PR reaching `main` with the wrong base while its epic is
> still integrating (the incident this gate closes). Position never tiers
> down for this gate (`brain/scripts/vcs/governance-tiers.mjs` GATE_MATRIX
> `'base-branch'` row); only the evidence form (`declared-tracker`) is uniform
> across `lite`/`standard`/`regulated` — there is no lighter-tier variant.
>
> A tracker PR (the chain's own integration branch, `feature/…` → the default
> branch) is opened when it has a diff — GitHub and GitLab both refuse an
> empty PR/MR. Until then, `stranded.mjs` reports the tracker as a branch
> ahead of the default with no open PR covering it; that report, not a gate,
> is how an in-flight-but-not-yet-opened tracker is surfaced.

## Notes for the promoter

- This is an ADDITION, not an amendment to an existing signed section —
  `workflow-governance.md` carries no prior `base-branch` row to supersede.
- The exact section heading level and placement (a new row in the Invariants
  table vs. a standalone subsection, as proposed above) is the promoter's
  call — the table's `#` column and "Character" framing were designed around
  the original four L3 invariants; `base-branch` does not map cleanly onto
  the "Skip label" column (it has none, like invariant 1) and a standalone
  subsection avoids stretching that table's shape for one row.
- No test in this change asserts this doctrine sentence's content (R967-8
  scenario "no oracle for an unsigned sentence") — only that no path under
  `brain/core/**` changed in this PR's diff.
