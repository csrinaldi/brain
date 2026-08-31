# sdd-layout.md — the guard's claim was wider than the guard (issue #456)

> Drafted during #456 slice A. `sdd-layout.md` said its drift guard catches a
> second definition of the set "anywhere else in `brain/scripts/**`". Measured,
> it caught one notation and missed the other — and two rival declarations had
> been living in the blind spot. Slice A closes the blind spot; this corrects
> the sentence that hid it.

```brain-amendment/1
target: brain/core/methodology/sdd-layout.md
issue: 456
```

```amend-find
`brain/scripts/lib/sdd-layout.mjs` is the ONE module exporting `REQUIRED_ARTIFACTS`,
`OPERATIONAL_ARTIFACTS`, `CHANGES_ROOT`, `LEGACY_GRANDFATHERED`, and the layout
path/parse helpers (`changeDir`, `artifactPaths`, `archivePath`, `parseChangeId`,
`isGrandfathered`, `hasSpec`, `missingRequiredArtifacts`). A drift-guard test
(`sdd-layout.test.mjs`) fails if a second, independent definition of the
required-artifact set appears anywhere else in `brain/scripts/**`. Consumers import
from this module rather than re-deriving the layout inline.
```

```amend-replace
`brain/scripts/lib/sdd-layout.mjs` is the ONE module exporting `REQUIRED_ARTIFACTS`,
`LIFECYCLE_STAGES`, `OPERATIONAL_ARTIFACTS`, `CHANGES_ROOT`, `LEGACY_GRANDFATHERED`,
`resolveStageSet`, and the layout path/parse helpers (`changeDir`, `artifactPaths`,
`archivePath`, `parseChangeId`, `isGrandfathered`, `hasSpec`,
`missingRequiredArtifacts`). Consumers import from this module rather than
re-deriving the layout inline.

Two drift-guard scans in `sdd-layout.test.mjs` hold that single-source claim,
and it takes two because the set has two notations. One scans for the
FILENAME form (`'proposal.md', 'spec.md', …`); the other for the BARE-NAME form
(`'proposal', 'spec', …`). Either alone leaves a hole: for as long as only the
filename scan existed, `stage-engine.mjs` and `phase-order-check.mjs` each
carried an independent bare-name declaration of the same four, invisible to a
guard whose doctrine already claimed to forbid them (#456).

The bare-name scan carries exactly one allowlist entry, and its written reason
is load-bearing: `governance-tiers.mjs`'s `TIER_PARAMS` names the same four as
the GATE set for the `standard` tier. That is REQ-L4-2′ — the tier scopes what
the GATE demands, never what the SCAFFOLD produces — so it is a different set
that happens to share members, not a rival declaration of this one.
```

---

## What was wrong, and why it mattered

The sentence claimed the guard fails "if a second, independent definition of the
required-artifact set appears anywhere else in `brain/scripts/**`". The guard
scanned `ARTIFACT_NAMES = ['proposal.md', 'spec.md', 'design.md', 'tasks.md']`
— **with the `.md` suffix**. Two declarations of the same four in bare-name form
sat in the tree the whole time:

- `brain/scripts/lib/stage-engine.mjs` — `SDD_LIFECYCLE_STAGES`
- `brain/scripts/vcs/phase-order-check.mjs` — `STANDARD_ARTEFACTS`

Stage and artefact are 1:1 by ADR-0019, so these were not a different concept in
different clothes. They were the same set, in a notation the guard could not see.

This is the failure mode the repo keeps finding and naming: a rule whose reader
is narrower than the rule. The doctrine was not wrong about what it wanted — it
was wrong that something was enforcing it.

## Notes for the promoter

The `amend-find` block is the whole "Single source of truth" body paragraph and
must match byte-for-byte, including the two internal line breaks. It is quoted
in full rather than partially because a partial anchor inside a paragraph is
exactly the kind of citation that rots (`reviewer-protocol.md` §2, #580).

No `amendment:` key: the target is not an ADR, so it carries no Status line to
number, and the contract refuses the key for non-ADR targets.
