# Apply progress — issue #973 R6-erratum drafts

**Mode**: Standard (no strict-TDD test runner applies to Tier-3 doctrine drafts; the proof step
below is the equivalent verification for this artifact type).

## Completed tasks

All 13 tasks in `tasks.md` are done. The five drafts are written and proved promotable. This SDD
change's own commits never run `npm run brain:promote` — but the maintainer has, twice, on this
branch (see "Promotion history" below and `proposal.md`'s section of the same name). This revision
of this document applies the corrections found by a pre-promotion adversarial simulation of round 3
against `origin/main` (see "Promotion history" item 4 and "Round 3 simulated result" below) to the
drafts and to this folder's own claims, for the pending third round.

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
and `spec.md` for what "0 as a live claim" means precisely — `rg` may still match an erratum's
quotation of the old sentence after promotion; no match is a live claim (see `spec.md`'s
acceptance-criterion scenario).

## Promotion history

The maintainer has run `npm run brain:promote` for these five drafts twice on this branch, in two
rounds that did not stand — record here because `proposal.md`'s "Promotion history" section only
summarizes; this is the full account with reasons:

1. **First promotion** (`bc44d8f1` ADR-0002 … `e6bfa06c` ADR-0034). The five drafts used the
   marker literal `**[Corrected by Amendment N (#973) — …]**`. This document, at that revision,
   asserted that literal followed `consolidation-protocol.md` §1c act 2. It did not: §1c act 2's
   literal is `Amended by`, as used by the in-line markers in `adr-0026*.md` and `adr-0006*.md`,
   not `Corrected by`. The cold review of PR #974 on that head (`e6bfa06c`) found this.
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

4. **Pre-promotion adversarial simulation of round 3** (before the maintainer's revert and final
   promotion). Before round 3's drafts were promoted, an adversarial reviewer simulated the full
   promotion against `origin/main` and verdicted NOT PROMOTE-READY: mechanics were fine, wording
   was not. It found: the "What this changes" text asserted a present-tense "says" for a sentence
   promotion would immediately make past tense; an unwarranted `consolidation-protocol.md` §1c
   act 2 citation on the annotation claim itself; the `amend-replace` wording did not yet match
   §1c act 2's shape precisely; `home-summary` needed a more precise statement of what the
   erratum corrects; the appended section heading (and the suggested commit subjects derived from
   it) described the erratum's target rather than what was actually wrong; "this touches no other
   line" over-claimed, since promotion also rewrites the Status line; ADR-0017's preamble still
   said "in the body" without naming Amendments 1-2; the "Notes for the promoter" claimed
   verification "on this branch" when the true reference state is `origin/main`; and this folder's
   own documentation (`proposal.md`, `spec.md`, `tasks.md`, `README.md`, and this document) carried
   several further inaccuracies: "in the body for four of the five ADRs" when all five bodies carry
   annotations; "every precedent … uses `Amended by`" when `adr-0019` and `adr-0002` themselves use
   `SUPERSEDED BY AMENDMENT`; a claim that the maintainer's promotion commits are outside the PR's
   diff (they are in the PR's diff, just not written by this SDD change); rg-hit-count claims tied
   to line-wrap details that do not generalize; and a stale claim that the drift test regenerates
   `brain/HOME.md` (it only checks `AGENTS.md`; `brain/HOME.md` is patched directly). All of the
   above were fixed in the five drafts and this folder's documentation before the maintainer's
   revert and the final promotion.

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
   `docs(brain): ADR-0002 Amendment 4 — erratum: the body Amendment 3 called untouched was annotated in place (#973)`

2. ADR-0011 Amendment 2
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0011-amendment-2.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0011 Amendment 2 — erratum: the body Amendment 1 called untouched was annotated in place (#973)`

3. ADR-0014 Amendment 2
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0014-amendment-2.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0014 Amendment 2 — erratum: the body Amendment 1 called untouched was annotated in place (#973)`

4. ADR-0017 Amendment 4
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0017-amendment-4.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0017 Amendment 4 — erratum: Amendment 3 called the body and Amendments 1-2 untouched; they were annotated in place (#973)`

5. ADR-0034 Amendment 2
   ```
   npm run brain:promote -- openspec/changes/issue-973-adr-r6-erratum/brain-drafts/adr-0034-amendment-2.draft.md
   ```
   Suggested commit subject:
   `docs(brain): ADR-0034 Amendment 2 — erratum: the body Amendment 1 called untouched was annotated in place (#973)`

Every promotion stages both `brain/HOME.md` and `AGENTS.md` (§1d act 3 always runs); commit after
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

Item 1 was found by the cold review of PR #974 on its first head, `e6bfa06c`. Items 4-10 were found
by an adversarial pre-push review of its second head (`21325498`). Items 2-3 were found during
drafting, before either review — item 3 was fixed in `c2a0378e`, before the first promotion. All
are corrected as of this revision:

1. **The marker word was wrong** (round 1 → round 2). The first drafts used `**[Corrected by
   Amendment N …]**` and this section claimed that followed §1c act 2. It did not: §1c act 2's
   literal is `Amended by`, as used by the in-line markers in `adr-0026*.md` and `adr-0006*.md`.
   The round-2 drafts used the literal.
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
   promotion. It returns hits inside each erratum's own quotation of the superseded sentence — `rg`
   may still match that quotation regardless of how it wraps. Both documents now state the true
   expectation: no hit is a *live* (uncorrected) claim.
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

## Round 3 simulated result

Re-run against `origin/main` after the pre-promotion adversarial simulation above (item 4 of
"Promotion history"), reusing the reviewer's `sim-r3.mjs` and its `r3sim/` export (both reset to a
pristine `origin/main` copy of the five target ADRs, `brain/HOME.md` and `AGENTS.md` first, since a
prior run of the script had already mutated that export against the pre-correction drafts).
`planAmendment` was invoked for all five drafts, in issue #973's table order, against `origin/main`.

| Draft | Act 1 (Status) | Act 2 (edit) | Act 3 (append) | Act 4 (HOME) | `f` | `r` | `k` |
|---|---|---|---|---|---|---|---|
| `adr-0002-amendment-4.draft.md` | pending | pending | pending | pending | 1 | 0 | 0 |
| `adr-0011-amendment-2.draft.md` | pending | pending | pending | pending | 1 | 0 | 0 |
| `adr-0014-amendment-2.draft.md` | pending | pending | pending | pending | 1 | 0 | 0 |
| `adr-0017-amendment-4.draft.md` | pending | pending | pending | pending | 1 | 0 | 0 |
| `adr-0034-amendment-2.draft.md` | pending | pending | pending | pending | 1 | 0 | 0 |

Every act on every draft is pending with `f = 1, r = 0, k = 0` — nothing is already applied,
nothing conflicts, nothing is blocked.

### ADR-0002 (Amendment 4)

In-place paragraph:

> Every superseded line in the body above and in Amendment 2 is annotated in place under ruling R6
> on #961 as amended (option A, 2026-09-14): the historical name stays visible next to its
> `brain:memory:` rename, and this table is the whole mapping. **[Amended by Amendment 4 (#973) —
> rewritten: the previous sentence said the body was not rewritten, although Amendment 3's own
> promotion had annotated it in place.]** No line of this ADR runs a script with a literal
> `npm run`, so the decision reads the same.

Appended section:

> ## Amendment 4 — erratum: the body Amendment 3 called untouched was annotated in place (issue #973)
>
> **Signed**: 15/09/2026 — Cristian Rinaldi
>
> ### What this changes
>
> Amendment 3's signed section (above) said, before this amendment rewrote it: "The body above is
> not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal `npm run`, so
> the decision reads the same and this table is the whole mapping." That sentence was drafted under
> ruling R6 as first ratified — an appended amendment, body untouched. The maintainer amended R6 to
> option A on 2026-09-14 (issue #961 comment, confirmed on PR #966), and Amendment 3's own promotion
> (PR #972) applied that ruling: every line of the body and of Amendment 2 superseded by the rename
> table was annotated in place. The sentence describing that act was never updated to match. This
> amendment rewrites it to state what the act did.
>
> ### What this does NOT change
>
> The rename table and the in-place annotations Amendment 3 made were already correct under R6 as
> amended — this rewrites no other line of the body or of an earlier amendment.

`brain/HOME.md` line:

> - [ADR-0002](project/decisions/adr-0002-memoria-git-based-dos-capas.md) — Git-based team memory in
>   two layers (**Amendment 1, 08/09/2026** — the manifest note is withdrawn — records are the truth
>   (ADR-0017), the manifest was the chunk transport's index and that transport is retired;
>   manifest, symlink and merge driver are the engram adapter's private artifacts, governed by
>   memory-backend-contract.md rule 3, #863; **Amendment 2, 09/09/2026** — the canonical flow's
>   `memory:share`/`pre-push` bullets and the "verbs keep their names until #862" note now point at
>   the lane (ADR-0034); the two-layer decision itself is unchanged; **Amendment 3, 15/09/2026** —
>   the canonical flow's scripts are now `brain:memory:pull`, `brain:memory:index` and
>   `brain:memory:share`; the bare names stay as repo-only aliases and the two-layer decision is
>   unchanged, #961; **Amendment 4, 15/09/2026** — erratum — Amendment 3 said the body was not
>   rewritten, but its own promotion had annotated the body and Amendment 2 in place under ruling R6
>   on #961 as amended (option A); that sentence is rewritten, #973)

Commit subject: `docs(brain): ADR-0002 Amendment 4 — erratum: the body Amendment 3 called
untouched was annotated in place (#973)`.

### ADR-0011 (Amendment 2)

In-place paragraph:

> Every superseded line in the body above is annotated in place under ruling R6 on #961 as amended
> (option A, 2026-09-14): the historical name stays visible next to its `brain:memory:` rename, and
> this table is the whole mapping. **[Amended by Amendment 2 (#973) — rewritten: the previous
> sentence said the body was not rewritten, although Amendment 1's own promotion had annotated it in
> place.]** No line of this ADR runs a script with a literal `npm run`, so the decision reads the
> same.

Appended section:

> ## Amendment 2 — erratum: the body Amendment 1 called untouched was annotated in place (issue #973)
>
> **Signed**: 15/09/2026 — Cristian Rinaldi
>
> ### What this changes
>
> Amendment 1's signed section (above) said, before this amendment rewrote it: "The body above is
> not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal `npm run`, so
> the decision reads the same and this table is the whole mapping." That sentence was drafted under
> ruling R6 as first ratified — an appended amendment, body untouched. The maintainer amended R6 to
> option A on 2026-09-14 (issue #961 comment, confirmed on PR #966), and Amendment 1's own promotion
> (PR #972) applied that ruling: the one line of the body superseded by the rename table was
> annotated in place. The sentence describing that act was never updated to match. This amendment
> rewrites it to state what the act did.
>
> ### What this does NOT change
>
> The rename table and the one in-place annotation Amendment 1 made were already correct under R6 as
> amended — this rewrites no other line of the body or of an earlier amendment.

`brain/HOME.md` line:

> - [ADR-0011](project/decisions/adr-0011-feature-scoped-working-memory.md) — Feature-scoped working
>   memory: branch-local resume.md (**Amendment 1, 15/09/2026** — the export this ADR cites is now
>   `brain:memory:share`; the bare name stays as a repo-only alias and the decision is unchanged,
>   #961; **Amendment 2, 15/09/2026** — erratum — Amendment 1 said the body was not rewritten, but
>   its own promotion had annotated it in place under ruling R6 on #961 as amended (option A); that
>   sentence is rewritten, #973)

Commit subject: `docs(brain): ADR-0011 Amendment 2 — erratum: the body Amendment 1 called
untouched was annotated in place (#973)`.

### ADR-0014 (Amendment 2)

In-place paragraph:

> Every superseded line in the body above is annotated in place under ruling R6 on #961 as amended
> (option A, 2026-09-14): the historical name stays visible next to its `brain:memory:` rename, and
> this table is the whole mapping. **[Amended by Amendment 2 (#973) — rewritten: the previous
> sentence said the body was not rewritten, although Amendment 1's own promotion had annotated it in
> place.]** No line of this ADR runs a script with a literal `npm run`, so the decision reads the
> same.

Appended section:

> ## Amendment 2 — erratum: the body Amendment 1 called untouched was annotated in place (issue #973)
>
> **Signed**: 15/09/2026 — Cristian Rinaldi
>
> ### What this changes
>
> Amendment 1's signed section (above) said, before this amendment rewrote it: "The body above is
> not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal `npm run`, so
> the decision reads the same and this table is the whole mapping." That sentence was drafted under
> ruling R6 as first ratified — an appended amendment, body untouched. The maintainer amended R6 to
> option A on 2026-09-14 (issue #961 comment, confirmed on PR #966), and Amendment 1's own promotion
> (PR #972) applied that ruling: the one line of the body superseded by the rename table was
> annotated in place. The sentence describing that act was never updated to match. This amendment
> rewrites it to state what the act did.
>
> ### What this does NOT change
>
> The rename table and the one in-place annotation Amendment 1 made were already correct under R6 as
> amended — this rewrites no other line of the body or of an earlier amendment.

`brain/HOME.md` line:

> - [ADR-0014](project/decisions/adr-0014-workflow-governance.md) — Workflow governance: enforce
>   load-bearing invariants server-side (**Amendment 1, 15/09/2026** — the memory-dump proxy's
>   script is now `brain:memory:share`; the bare name stays as a repo-only alias and the invariants
>   are unchanged, #961; **Amendment 2, 15/09/2026** — erratum — Amendment 1 said the body was not
>   rewritten, but its own promotion had annotated it in place under ruling R6 on #961 as amended
>   (option A); that sentence is rewritten, #973)

Commit subject: `docs(brain): ADR-0014 Amendment 2 — erratum: the body Amendment 1 called
untouched was annotated in place (#973)`.

### ADR-0017 (Amendment 4)

In-place paragraph:

> Every superseded line in the body and in Amendments 1-2 above is annotated in place under ruling
> R6 on #961 as amended (option A, 2026-09-14): the historical name stays visible next to its
> `brain:memory:` rename, and this table is the whole mapping. **[Amended by Amendment 4 (#973) —
> rewritten: the previous sentence said the body and Amendments 1-2 were not rewritten, although
> Amendment 3's own promotion had annotated them in place.]** No line of this ADR runs a script with
> a literal `npm run`, so the decision reads the same.

Appended section:

> ## Amendment 4 — erratum: Amendment 3 called the body and Amendments 1-2 untouched; they were
> annotated in place (issue #973)
>
> **Signed**: 15/09/2026 — Cristian Rinaldi
>
> ### What this changes
>
> Amendment 3's signed section (above) said, before this amendment rewrote it: "The body and
> Amendments 1-2 above are not rewritten (ruling R6 on #961): no line of this ADR runs a script with
> a literal `npm run`, so the decision reads the same and this table is the whole mapping." That
> sentence was drafted under ruling R6 as first ratified — an appended amendment, body untouched.
> The maintainer amended R6 to option A on 2026-09-14 (issue #961 comment, confirmed on PR #966),
> and Amendment 3's own promotion (PR #972) applied that ruling: every line of the body and of
> Amendments 1-2 superseded by the rename table was annotated in place. The sentence describing that
> act was never updated to match. This amendment rewrites it to state what the act did.
>
> ### What this does NOT change
>
> The rename table and the in-place annotations Amendment 3 made were already correct under R6 as
> amended — this rewrites no other line of the body or of an earlier amendment.

`brain/HOME.md` line:

> - [ADR-0017](project/decisions/adr-0017-memory-format-owned-by-brain.md) — The Durable Memory
>   Record Format Is Owned By Brain, Not By Engram (**Amendment 1, 15/08/2026** — duplicate lines
>   are not necessarily byte-identical — brain's own round-trip widens the unhashed `source`, so a
>   divergent pair is reported and resolved first-wins, never refused; and the churn rule governs
>   the diff, not the write, with the cross-file caveat named, #635; **Amendment 2, 16/08/2026** —
>   the durable log holds ONE RECORD PER FILE (`records/<yyyy-mm>-<id>.jsonl`) — `merge=union` was a
>   local git mechanism the forge that performs the merge does not apply, so the log was
>   conflict-free only where the driver ran; two different records are now two different paths and
>   there is nothing to union, #677; **Amendment 3, 15/09/2026** — the scripts this ADR cites are
>   now `brain:memory:*` (`save`, `share`, `reindex`, `resolve-index`, `split-records`); the bare
>   names stay as repo-only aliases and the format decision is unchanged, #961; **Amendment 4,
>   15/09/2026** — erratum — Amendment 3 said the body and Amendments 1-2 were not rewritten, but
>   its own promotion had annotated them in place under ruling R6 on #961 as amended (option A);
>   that sentence is rewritten, #973)

Commit subject: `docs(brain): ADR-0017 Amendment 4 — erratum: Amendment 3 called the body and
Amendments 1-2 untouched; they were annotated in place (#973)`.

### ADR-0034 (Amendment 2)

In-place paragraph:

> Every superseded line in the body above is annotated in place under ruling R6 on #961 as amended
> (option A, 2026-09-14): the historical name stays visible next to its `brain:memory:` rename, and
> this table is the whole mapping. **[Amended by Amendment 2 (#973) — rewritten: the previous
> sentence said the body was not rewritten, although Amendment 1's own promotion had annotated it in
> place.]** No line of this ADR runs a script with a literal `npm run`, so the decision reads the
> same.

Appended section:

> ## Amendment 2 — erratum: the body Amendment 1 called untouched was annotated in place (issue #973)
>
> **Signed**: 15/09/2026 — Cristian Rinaldi
>
> ### What this changes
>
> Amendment 1's signed section (above) said, before this amendment rewrote it: "The body above is
> not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal `npm run`, so
> the decision reads the same and this table is the whole mapping." That sentence was drafted under
> ruling R6 as first ratified — an appended amendment, body untouched. The maintainer amended R6 to
> option A on 2026-09-14 (issue #961 comment, confirmed on PR #966), and Amendment 1's own promotion
> (PR #972) applied that ruling: every line of the body superseded by the rename table was annotated
> in place. The sentence describing that act was never updated to match. This amendment rewrites it
> to state what the act did.
>
> ### What this does NOT change
>
> The rename table and the in-place annotations Amendment 1 made were already correct under R6 as
> amended — this rewrites no other line of the body or of an earlier amendment.

`brain/HOME.md` line:

> - [ADR-0034](project/decisions/adr-0034-memory-travels-on-its-own-lane.md) — Memory travels on its
>   own lane: records reach `main` on their own pull request, never the feature's (**Amendment 1,
>   15/09/2026** — `brain:memory:ship` is now the real script name, and the scripts the ADR cites as
>   `memory:save`/`memory:share`/`memory:audit` are `brain:memory:*`; the bare names stay as
>   repo-only aliases and the lane decision is unchanged, #961; **Amendment 2, 15/09/2026** —
>   erratum — Amendment 1 said the body was not rewritten, but its own promotion had annotated it in
>   place under ruling R6 on #961 as amended (option A); that sentence is rewritten, #973)

Commit subject: `docs(brain): ADR-0034 Amendment 2 — erratum: the body Amendment 1 called
untouched was annotated in place (#973)`.

### Drift and acceptance check, post-simulation

`AGENTS.md`, recompiled from the mutated `r3sim` export's 5 `SOURCE_DOCS` (which includes
`brain/HOME.md`), is byte-equal to the committed copy the simulation wrote — the drift test would
pass. `rg -n "not rewritten \(ruling R6" brain/project/decisions/` against the simulated
post-promotion state returns exactly **one** hit — inside ADR-0017's own "What this changes"
quotation (line 491 of that file in the simulation) — not a live claim; the other four ADRs'
quotations wrap differently after this round's C1 wording change and do not match that exact
pattern at all. This is the concrete reason README.md, spec.md, this document, and the PR body no
longer state a wrap-dependent hit count: the previous round's claim ("four of five match, ADR-0017
misses") is now the *opposite* of what the corrected drafts produce, which is exactly why a
wrap-independent statement ("`rg` may still match a quotation; no match is a live claim") is the
only one that stays true across wording revisions.

## Remaining tasks

None of the 13 tasks in `tasks.md` are incomplete. The one action left for this issue is the
maintainer's: revert `49d35565`…`21325498`, then promote the five drafts as corrected by this
revision — see "Promotion history" above and `tasks.md`'s "Explicitly out of scope" section, which
this agent never performs.

## Status

13/13 tasks complete. The five drafts, `brain-drafts/README.md`, `proposal.md`, `spec.md`, and
`tasks.md` are corrected for the pending third promotion round, including the wording fixes found
by the pre-promotion adversarial simulation of round 3 (C1-C4, E1, E2, E4, and the openspec/PR-body
corrections — see "Promotion history" item 4). The simulation re-run against `origin/main` shows
every act pending (`f = 1, r = 0, k = 0`) for all five drafts — see "Round 3 simulated result".
Ready for verify / maintainer revert-and-repromote.
