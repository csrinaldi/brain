# Apply progress — issue #973 R6-erratum drafts

**Mode**: Standard (no strict-TDD test runner applies to Tier-3 doctrine drafts; the proof step
below is the equivalent verification for this artifact type).

## Completed tasks

All 13 tasks in `tasks.md` are done. The five drafts are written and proved promotable. This SDD
change's own commits never run `npm run brain:promote` — but the maintainer has, twice, on this
branch (see "Promotion history" below and `proposal.md`'s section of the same name). This revision
of this document corrects the drafts and this folder's own claims for a pending third round.

## Per-ADR simulation table

Produced by a throwaway script (`prove-drafts-v2.mjs`, never committed) that imports
`parseAmendmentDraft`, `assessEdit`, `applyEdits` from the real
`brain/scripts/lib/amendment-draft.mjs`, run against each (corrected) draft and its target ADR **as
it stands on `origin/main`** — the exact text the maintainer's pending revert of
`49d35565`…`21325498` restores. (The ADR files on this branch's current `HEAD` are NOT that text:
they carry the second round's promotion, wrong-marker-content and all — simulating against the
working tree here would test the wrong state.)

| Draft | Target | Parse | Edits | `assessEdit` state | `free` | Apply | Marker starts `**[Amended by Amendment N (#973) — ` | Prefix/suffix outside the edit span | Residual `not rewritten (ruling R6` |
|---|---|---|---|---|---|---|---|---|---|
| `adr-0002-amendment-4.draft.md` | `adr-0002-memoria-git-based-dos-capas.md` | ok | 1 | pending | 1 | ok | yes | byte-identical | 0 |
| `adr-0011-amendment-2.draft.md` | `adr-0011-feature-scoped-working-memory.md` | ok | 1 | pending | 1 | ok | yes | byte-identical | 0 |
| `adr-0014-amendment-2.draft.md` | `adr-0014-workflow-governance.md` | ok | 1 | pending | 1 | ok | yes | byte-identical | 0 |
| `adr-0017-amendment-4.draft.md` | `adr-0017-memory-format-owned-by-brain.md` | ok | 1 | pending | 1 | ok | yes | byte-identical | 0 |
| `adr-0034-amendment-2.draft.md` | `adr-0034-memory-travels-on-its-own-lane.md` | ok | 1 | pending | 1 | ok | yes | byte-identical | 0 |

"Prefix/suffix outside the edit span" is checked by byte-slicing the target text at the `find`
anchor's exact index and comparing everything before and after that span to the applied text —
stronger than a line-based diff, which reports spurious differences once the replacement wraps
onto a different number of lines than the original two-line sentence.

Acceptance-criterion `rg` (issue #973), run against `origin/main` (the pre-promotion state):

```
rg -n "not rewritten \(ruling R6" brain/project/decisions/
```

Returns exactly 5 hits, one per target ADR (lines 121, 68, 152, 471, 267) — the count the five
drafts are designed to bring to 0 as a *live* claim once promoted. See `brain-drafts/README.md`
and `spec.md` for what "0 as a live claim" means precisely — this `rg` can still report hits inside
an erratum's own quotation of the superseded sentence after promotion (see `spec.md`'s
acceptance-criterion scenario).

## Promotion history

The maintainer has run `npm run brain:promote` for these five drafts twice on this branch, in two
rounds that did not stand — record here because `proposal.md`'s "Promotion history" section only
summarizes; this is the full account with reasons:

1. **First promotion** (`bc44d8f1` ADR-0002 … `e6bfa06c` ADR-0034). The five drafts used the
   marker literal `**[Corrected by Amendment N (#973) — …]**`. This document, at that revision,
   asserted that literal followed `consolidation-protocol.md` §1c act 2. It did not: §1c act 2 and
   every precedent in `brain/project/decisions/` (e.g. `adr-0026*.md`) use `Amended by`, not
   `Corrected by`. The cold review of PR #974 on that head (`e6bfa06c`) found this.
2. **Revert** `6a28b90e` — "undo the five #973 erratum promotions to re-promote with §1c's Amended
   marker" — undid all five, restoring the ADRs to their pre-promotion (`origin/main`) text, so the
   amendment numbers did not change on re-promotion.
3. **Re-promotion** (`49d35565` ADR-0002 … `21325498` ADR-0034). The five drafts now used
   `**[Amended by Amendment N (#973) — this sentence was drafted under R6's original wording,
   before the 2026-09-14 amendment.]**` — the correct word, but the text after the em dash names a
   *reason* the sentence was wrong, not *what changed*, which is what
   `consolidation-protocol.md` §1c act 2 and the `adr-0026*.md` precedents actually show. An
   adversarial pre-push review of PR #974 at that head found this, plus: ADR-0002's and
   ADR-0017's signed text and `home-summary` said only "the body" was annotated by PR #972, when
   ADR-0002 also carries one `(renamed …; see Amendment 3)` note inside its own Amendment 2 (line
   83 on `origin/main`) and ADR-0017 carries four inside Amendments 1-2 (one in Amendment 1 at
   line 330; three in Amendment 2 at lines 391, 421, 450, all on `origin/main`); the promised
   `rg 'not rewritten \(ruling R6' brain/project/decisions/`
   result after promotion (claimed 0 hits; the errata's own quotations can still match); this
   folder's claim that the change never ran `brain:promote` (it had, twice by then); the record
   name and tense in this document's "Issues found" item 2 (below); and the mislabeling of the
   #961 amendments' inline `(renamed …; see Amendment N)` notes as `amend-find`/`amend-replace`
   annotations in `brain-drafts/README.md` and `proposal.md`.

This apply batch (this revision) corrects all of the above in the five UNPROMOTED drafts under
`brain-drafts/` and in this folder's documentation. It does not touch `brain/project/decisions/`,
`brain/HOME.md`, or `AGENTS.md` — those still carry round 2's promotion as of this revision. The
maintainer's next step is a third round: revert `49d35565`…`21325498`, then promote the drafts as
corrected here.

## Promotion order and commands

No cross-ADR dependency exists between the five drafts (each touches a different target file), so
any order is safe. Listed in issue #973's own table order. These are the commands for the pending
third round, after the maintainer reverts `49d35565`…`21325498`:

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
`openspec/changes/managed-script-brain-prefix/brain-drafts/adr-*.draft.md` exactly. The
`**[Amended by Amendment N (#973) — …]**` marker inside the replaced sentence is the literal
`consolidation-protocol.md` §1c act 2 prescribes (`**[Amended by Amendment N (#issue) — <what
changed>]**`); as of this revision, the text after the em dash states what changed (the previous
sentence's false claim), matching the `adr-0026*.md` precedents' shape, not a reason for the
change.

## Issues found

Found by the cold review of PR #974 on its first head, `e6bfa06c`, and by an adversarial pre-push
review of its second head (`21325498`); both are corrected as of this revision:

1. **The marker word was wrong** (round 1 → round 2). The first drafts used `**[Corrected by
   Amendment N …]**` and this section claimed that followed §1c act 2. It did not: §1c act 2 and
   every precedent in `brain/project/decisions/` use `Amended by`. The round-2 drafts used the
   literal.
2. **The record-first record was corrupt, and was replaced.** `memory:save` was called with one
   positional, and it wrote a record with no title whose content ended in the literal string
   `undefined` (`rec-40608e884821068a`). It was never merged, so it was removed from this branch
   and saved again with both positionals, as `rec-4d89a331921f4b76` (commit `a19642b3`,
   `chore(memory): record the #973 R6 erratum decision (#973)`). The silent write is evidence on
   #928.
3. **Stated annotation counts were wrong** (ADR-0017 said nine, not eleven). The counts were
   removed before the first promotion, in `c2a0378e`.
4. **The marker's text stated a reason, not what changed** (round 2 → round 3, this revision). The
   round-2 marker read "this sentence was drafted under R6's original wording, before the
   2026-09-14 amendment" — true, but not what §1c act 2 asks the marker to say. Every draft's
   marker now reads "rewritten: the previous sentence said the body [and Amendments 1-2, for
   ADR-0017] was/were not rewritten, although the same act had annotated it/them in place."
5. **ADR-0002's and ADR-0017's own precision** (round 2 → round 3). ADR-0002's draft said PR #972
   annotated only "the body"; on `origin/main` it also annotated one line inside ADR-0002's own
   Amendment 2 (line 83). ADR-0017's draft already said "the body and Amendments 1-2" — verified
   correct against `origin/main` (annotations at lines 330 inside Amendment 1, and 391/421/450
   inside Amendment 2, plus several in the body). ADR-0002's signed text, `home-summary`, and
   `amend-replace` text now name Amendment 2 as well.
6. **The `rg` hit-count promises were false** (round 2 → round 3). `brain-drafts/README.md` and
   `spec.md` promised 0 hits for `rg 'not rewritten \(ruling R6' brain/project/decisions/` after
   promotion. It returns hits inside each erratum's own quotation of the superseded sentence — on
   one line for four of the five ADRs, so `rg` matches; ADR-0017's quotation wraps its line break
   between "not rewritten" and "(ruling R6 on #961)", so `rg` misses that one. Both documents now
   state the true expectation: no hit is a *live* (uncorrected) claim.
7. **This folder's own claim that promotion was out of scope, unqualified** (round 2 → round 3).
   `apply-progress.md`, `proposal.md`, and `tasks.md` said or implied the change never ran
   `brain:promote` and promotion was simply "out of scope." True only for this SDD change's own
   commits — the maintainer had already run `brain:promote` twice on this branch by round 2. All
   three documents now record the real promotion history.
8. **The #961 annotations were mislabeled** (round 2 → round 3). `brain-drafts/README.md:33` (at
   that revision) and `proposal.md:59` (at that revision) called the #961 in-place annotations
   `amend-find`/`amend-replace` annotations. In the ADRs they are inline
   `(renamed \`brain:memory:X\`; see Amendment N)` notes — `amend-find`/`amend-replace` is the
   promotion mechanism, not what it leaves behind. Both documents now say so.
9. **The `npm run` uniqueness claim went stale after promotion** (round 2 → round 3).
   `brain-drafts/README.md:29-31` (at that revision) said `npm run` occurs only inside the
   rewritten sentence. True before promotion; after promotion, the erratum's own "What this
   changes" text quotes that sentence (including the literal `npm run`) verbatim, so the target
   ADR then carries the literal twice. The document now says so.
10. **`tasks.md` cited the pre-#966 script name.** Task 13 cited `npm run memory:save`; the script
    has been `brain:memory:save` since PR #966 (`dc4b56e1`, #963/#961). `memory:save` still works
    as a repo alias, but the task now names the current script.

## Remaining tasks

None of the 13 tasks in `tasks.md` are incomplete. The one action left for this issue is the
maintainer's: revert `49d35565`…`21325498`, then promote the five drafts as corrected by this
revision — see "Promotion history" above and `tasks.md`'s "Explicitly out of scope" section, which
this agent never performs.

## Status

13/13 tasks complete. The five drafts, `brain-drafts/README.md`, `proposal.md`, `spec.md`, and
`tasks.md` are corrected for the pending third promotion round. Ready for verify / maintainer
revert-and-repromote.
