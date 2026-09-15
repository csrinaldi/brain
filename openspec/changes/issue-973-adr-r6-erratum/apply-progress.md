# Apply progress — issue #973 R6-erratum drafts

**Mode**: Standard (no strict-TDD test runner applies to Tier-3 doctrine drafts; the proof step
below is the equivalent verification for this artifact type).

## Completed tasks

All 13 tasks in `tasks.md` are done. The five drafts are written, proved promotable, and this
change never ran `npm run brain:promote`.

## Per-ADR simulation table

Produced by a throwaway script (`prove-drafts.mjs`, never committed) that imports
`parseAmendmentDraft`, `assessEdit`, `applyEdits` from the real
`brain/scripts/lib/amendment-draft.mjs`, run against each draft and its target ADR on this branch.

| Draft | Target | Parse | Edits | `assessEdit` state | `free` | Apply | Residual `not rewritten (ruling R6` | Other lines touched |
|---|---|---|---|---|---|---|---|---|
| `adr-0002-amendment-4.draft.md` | `adr-0002-memoria-git-based-dos-capas.md` | ok | 1 | pending | 1 | ok | 0 | none |
| `adr-0011-amendment-2.draft.md` | `adr-0011-feature-scoped-working-memory.md` | ok | 1 | pending | 1 | ok | 0 | none |
| `adr-0014-amendment-2.draft.md` | `adr-0014-workflow-governance.md` | ok | 1 | pending | 1 | ok | 0 | none |
| `adr-0017-amendment-4.draft.md` | `adr-0017-memory-format-owned-by-brain.md` | ok | 1 | pending | 1 | ok | 0 | none |
| `adr-0034-amendment-2.draft.md` | `adr-0034-memory-travels-on-its-own-lane.md` | ok | 1 | pending | 1 | ok | 0 | none |

For each draft the applied diff (`diff -u` against the target) touches only the two source lines
that carried the false sentence, replaced by the corrected sentence — verified by hand for all
five (no change outside that hunk).

Acceptance-criterion `rg` (issue #973), run against this branch **before** any promotion:

```
rg -n "not rewritten \(ruling R6" brain/project/decisions/
```

Returns exactly 5 hits, one per target ADR (lines 121, 68, 152, 471, 267) — the count the five
drafts are designed to bring to 0 once promoted.

## Promotion order and commands

No cross-ADR dependency exists between the five drafts (each touches a different target file), so
any order is safe. Listed in issue #973's own table order:

1. ADR-0002 Amendment 4
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0002-amendment-4.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0002 Amendment 4 — erratum: Amendment 3's body was annotated in place, not left untouched (#973)`

2. ADR-0011 Amendment 2
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0011-amendment-2.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0011 Amendment 2 — erratum: Amendment 1's body was annotated in place, not left untouched (#973)`

3. ADR-0014 Amendment 2
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0014-amendment-2.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0014 Amendment 2 — erratum: Amendment 1's body was annotated in place, not left untouched (#973)`

4. ADR-0017 Amendment 4
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0017-amendment-4.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0017 Amendment 4 — erratum: Amendment 3's body was annotated in place, not left untouched (#973)`

5. ADR-0034 Amendment 2
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0034-amendment-2.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0034 Amendment 2 — erratum: Amendment 1's body was annotated in place, not left untouched (#973)`

Every promotion stages `AGENTS.md` and/or `brain/HOME.md` (§1d act 3 always runs); commit after
each one, per the same discipline `managed-script-brain-prefix/brain-drafts/README.md` documents
for its own promotion order.

## Deviations from the precedent shape

None. Field names, fence tags, and the "Notes for the promoter" section follow
`openspec/changes/managed-script-brain-prefix/brain-drafts/adr-*.draft.md` exactly. The only
addition is the `**[Corrected by Amendment N (#973) — …]**` marker inside the replaced sentence,
which follows `consolidation-protocol.md` §1c act 2's own annotation format
(`**[Amended by Amendment N (#issue) — <what changed>]**`).

## Issues found

None.

## Remaining tasks

None in this change's scope. Promotion itself (running `npm run brain:promote` five times,
interactively, as the maintainer) is explicitly out of scope — see `tasks.md`'s "Explicitly out of
scope" section and the hard constraints in the launch prompt.

## Status

13/13 tasks complete. Ready for verify / maintainer promotion.
