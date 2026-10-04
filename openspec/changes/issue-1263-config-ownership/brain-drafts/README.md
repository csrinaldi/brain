# brain-drafts for #1263: the amendments ADR-0038 and ADR-0040 name

ADR-0038 and ADR-0040 are already promoted. Each lists, under "Amendments this requires", the
signed ADRs it changes. These drafts are those amendments. Each one is a `brain-amendment/1` draft
for `brain:promote`, which runs `planAmendment()` (`brain/scripts/lib/amendment-draft.mjs`) before
it writes anything.

An agent may not promote any of them. **The promoter's commit is the signature** (ADR-0028).

## Promotion order

Promote one draft per commit, in this order:

| # | Draft | Target | Why here |
|---|---|---|---|
| 1 | `adr-0024-amendment-5.draft.md` | ADR-0024 Amendment 5 | the axis frame (four axes, one shape, the orchestrator) that the others cite |
| 2 | `adr-0004-amendment-4.draft.md` | ADR-0004 Amendment 4 | memory on that frame |
| 3 | `adr-0008-amendment-2.draft.md` | ADR-0008 Amendment 2 | VCS on that frame; ADR-0024 Amendment 5 cites it |
| 4 | `adr-0023-amendment-2.draft.md` | ADR-0023 Amendment 2 | the provider `brain` and `sdd.roles` |
| 5 | `adr-0033-amendment-3.draft.md` | ADR-0033 Amendment 3 | cites ADR-0023 Amendment 2 |
| 6 | `adr-0020-amendment-5.draft.md` | ADR-0020 Amendment 5 | `governance.owners` and `prReviews.commitId` |
| 7 | `vcs-contract-prreviews-commitid.draft.md` | `brain/core/methodology/vcs-contract.md` (not an ADR) | the port row ADR-0020 Amendment 5 points to |
| 8 | `adr-0026-amendment-10.draft.md` | ADR-0026 Amendment 10 | the gate's tier row, which reads `governance.owners` |

**No two drafts share a target file, so no anchor can conflict across drafts.** Every ADR draft also
adds a marker to `brain/HOME.md`, each on its own index line. The order is about citations: a later
amendment cites an earlier one by number, so the earlier one is signed first.

Each amendment number is the target's current count plus one. If any target gains an amendment
before its draft is promoted, `brain:promote` refuses the stale number. Renumber that draft and its
in-place `Amendment K` brackets.

## Checked

Each draft passes `planAmendment()` against its target with every anchor occurring exactly once. All
eight applied in the order above, against shared `brain/HOME.md`, then re-planned, each read as
`cascadeComplete`.

## Not drafted here

ADR-0040 also names an amendment to ADR-0038 (the user layer, `locked`, and foundation-only
declaration) and to `brain/core/methodology/agent-authorities.md` (`brain.config.json` in Tier 2's
team-wide infrastructure list). Neither is in this set.
