# DRAFT — `sdd-layout.md` guard-scope correction (issue #456 slice A, Phase 7)

**Status: DRAFT, NOT APPLIED.** Target file `brain/core/methodology/sdd-layout.md`
is Tier 3 — this apply run is prohibited from writing to `brain/core/**`
directly. Recorded here for human promotion. Not acted on in this slice
(design §8, "Recorded, not resolved").

## What is wrong, measured (design §1/§8)

The "Single source of truth" section claims the drift-guard test
"fails if a second, independent definition of the required-artifact set
appears anywhere else in `brain/scripts/**`." That was false by NOTATION: the
guard's original `ARTIFACT_NAMES` scan (A1, `sdd-layout.test.mjs`) matches
`.md`-suffixed names only, so a rival declaration written in BARE lifecycle
names (`['proposal', 'spec', 'design', 'tasks']`, no `.md`) was invisible to
it. Two such bare-name declarations coexisted undetected before slice A
(`stage-engine.mjs`'s `SDD_LIFECYCLE_STAGES`, `phase-order-check.mjs`'s
`STANDARD_ARTEFACTS`) until slice A collapsed both onto `LIFECYCLE_STAGES`
and added a second scan (`scanForRivalStageArray`, Phase 5) that covers the
bare-name notation too.

## Proposed edit

In `brain/core/methodology/sdd-layout.md`, "Single source of truth" section,
replace:

```
`brain/scripts/lib/sdd-layout.mjs` is the ONE module exporting `REQUIRED_ARTIFACTS`,
`OPERATIONAL_ARTIFACTS`, `CHANGES_ROOT`, `LEGACY_GRANDFATHERED`, and the layout
path/parse helpers (`changeDir`, `artifactPaths`, `archivePath`, `parseChangeId`,
`isGrandfathered`, `hasSpec`, `missingRequiredArtifacts`). A drift-guard test
(`sdd-layout.test.mjs`) fails if a second, independent definition of the
required-artifact set appears anywhere else in `brain/scripts/**`. Consumers import
from this module rather than re-deriving the layout inline.
```

with:

```
`brain/scripts/lib/sdd-layout.mjs` is the ONE module exporting `REQUIRED_ARTIFACTS`,
`LIFECYCLE_STAGES`, `OPERATIONAL_ARTIFACTS`, `CHANGES_ROOT`, `LEGACY_GRANDFATHERED`,
`resolveStageSet`, and the layout path/parse helpers (`changeDir`, `artifactPaths`,
`archivePath`, `parseChangeId`, `isGrandfathered`, `hasSpec`,
`missingRequiredArtifacts`). Two drift-guard scans in `sdd-layout.test.mjs` fail if
a second, independent definition of the set appears anywhere else in
`brain/scripts/**` — one scan matches `.md`-suffixed artifact-name arrays, the
other matches bare lifecycle-name arrays (issue #456), closing the notation gap
that let two bare-name declarations coexist undetected before both. Consumers
import from this module rather than re-deriving the layout inline.
```

No other changes to this doc. This is a doc-accuracy correction describing the
guard's actual (post-slice-A) coverage; it does not change any code behaviour.
