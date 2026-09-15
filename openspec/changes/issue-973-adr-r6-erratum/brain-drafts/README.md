# Doctrine drafts for #973 — promotion guide

Five `brain-amendment/1` erratum drafts, one per ADR amendment that PR #972 promoted for #961.
Each fixes exactly one sentence: the signed section's claim that the ADR body "is not rewritten
(ruling R6 on #961)" is false — the same promotion annotated every superseded line in place,
because the maintainer had already amended R6 to option A (issue #961 comment, 2026-09-14,
confirmed on PR #966) before that promotion ran. See `../proposal.md` for the full account.

## Promotion order

No draft depends on another — each targets a different ADR file. Commit after each promotion:
every one stages both `brain/HOME.md` and `AGENTS.md`, and `npm test` runs
`antigravity.drift.test.mjs`, which checks `AGENTS.md` for byte-equality against its 5 source docs
(same discipline as `openspec/changes/managed-script-brain-prefix/brain-drafts/README.md`). The
drift test does not regenerate or check `brain/HOME.md` itself — `brain-promote.mjs` patches that
file directly.

1. `adr-0002-amendment-4.draft.md`
2. `adr-0011-amendment-2.draft.md`
3. `adr-0014-amendment-2.draft.md`
4. `adr-0017-amendment-4.draft.md`
5. `adr-0034-amendment-2.draft.md`

Exact commands and suggested commit subjects: `../apply-progress.md`.

## What each draft does

One `amend-find`/`amend-replace` pair, replacing the two-line sentence that claims the body above
was not rewritten with a sentence that states what actually happened: every superseded line is
annotated in place under R6 as amended (option A, 2026-09-14), the historical names stay visible,
and the rename table is the full mapping. The still-true clause — no line of the ADR runs a script
with a literal `npm run` — is kept. Before promotion, that literal is the only occurrence of
`npm run` in each target ADR — it is inside the sentence being rewritten. After promotion the
erratum's own "What this changes" text quotes the superseded sentence verbatim, so `npm run` then
occurs more than once in the ADR; that second occurrence is a quotation, not a live claim.

Nothing else changes. The rename tables and the inline `(renamed \`brain:memory:X\`; see
Amendment N)` notes the #961 amendments already applied — not `amend-find`/`amend-replace`
pairs; those are how the amendment itself was promoted, not what it left behind — are correct as
they stand.

## After promotion — checks

```
rg -n "not rewritten \(ruling R6" brain/project/decisions/
```

Expected: no *live* occurrence of the false claim — the false sentence in each #961 amendment
section is rewritten. `rg` may still match an erratum's own quotation of the old sentence inside
its `### What this changes` text; no match there is a live claim — read any hit and confirm it
sits inside a `### What this changes` paragraph, not a signed section's own assertion. Then
`npm test` for the full suite, and confirm `AGENTS.md` regenerates byte-equal (the drift test).

## Proof, before promotion

Each draft was proved promotable without promoting: `parseAmendmentDraft` accepts it, its one edit
assesses as `pending` with `free = 1` against the target ADR on `origin/main`, and applying the edit
leaves no remaining "not rewritten (ruling R6" in that ADR while changing no other line. See
`../apply-progress.md` for the per-ADR table.
