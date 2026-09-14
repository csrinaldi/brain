# Doctrine drafts for #961 — promotion guide

`brain/core/**` and `brain/project/**` are Tier 2/3: nothing here is applied by the Tier-1 PR. The
maintainer promotes these in ONE promotion PR carrying `Closes #961` (ruling R10), and only after the
Tier-1 PR has merged (R1). #954 is rebased and merged only after this promotion (R1, R2).

## Promotion order

Commit after each promotion — every one of them stages `AGENTS.md` or `brain/HOME.md`, and
`antigravity.drift.test.mjs` checks byte-equality on every commit.

1. `agent-authorities.draft.md` — a `SOURCE_DOCS` member: regenerates `AGENTS.md`.
2. `harness-contract.draft.md` — a `SOURCE_DOCS` member: regenerates `AGENTS.md` (its lines 227-231).
3. `consolidation-protocol.draft.md`
4. `memory-backend-contract.draft.md`
5. `memory-format.draft.md`
6. `feature-working-memory-contract.draft.md`
7. `anti-patterns-readme.draft.md`
8. `adr-0002-amendment-3.draft.md`, `adr-0011-amendment-1.draft.md`, `adr-0014-amendment-1.draft.md`,
   `adr-0017-amendment-3.draft.md`, `adr-0034-amendment-1.draft.md` — each writes a `brain/HOME.md`
   marker, and `HOME.md` is a `SOURCE_DOCS` member, so each regenerates `AGENTS.md`. **Blocked on the
   ruling gap below.**
9. The two hand edits (R8 checklist).

Every fenced contract opens with the FORMAT tag `brain-amendment/1` — never an amendment number (#931).

## Ruling gap — decide before step 8

`parseAmendmentDraft` refuses an ADR draft with no `amend-find`/`amend-replace` pair
(`brain/scripts/lib/amendment-draft.mjs:171-177`, §1c act 2). Ruling R6 says the ADR bodies stay
untouched. The five ADR drafts are written to R6, so `brain:promote` refuses them as they stand — loudly,
before writing anything. Choose one:

- **A.** Rule one §1c annotation per ADR. In each ADR draft, change the two `text` fences under
  "Notes for the promoter" to `amend-find` and `amend-replace`; the anchors are verified.
- **B.** Keep R6 literal: apply act 1 (Status line), act 3 (append the section between `body:` and
  `body-end:`, stamping `**Signed**`), act 4 (the `brain/HOME.md` marker, using `home-summary:`) by hand,
  then `AGENT_PLATFORM=antigravity npm run brain:env:init` to regenerate `AGENTS.md`. Off the verb path,
  you are the enforcement (`consolidation-protocol.md` §1c).

## R8 checklist — `.mjs` files `brain:promote` cannot take

- [ ] `brain/core/config-migrations.mjs:69`
  `'fail-closed memory:share secret scanner (issue #214) and its sole, committed bypass ' +`
  → `'fail-closed brain:memory:share secret scanner (issue #214) and its sole, committed bypass ' +`
  (no test or golden file pins this string — verified).
- [ ] `brain/project/check-refs-rules.mjs:81`
  `//                            memory:share and would re-export into the`
  → `//                            brain:memory:share and would re-export into the`
  (a comment; keep the column aligned with lines 79-82).

## Left as written, on purpose

- `memory-backend-contract.md:154` — inside its signed Amendment 1 (#874).
- `brain/HOME.md:53` — ADR-0002's Amendment 2 marker text records what that amendment did.
- ADR bodies — R6.
- `memory:import` — not an npm script.

## Older drafts that name these scripts

| Draft (unarchived change folder) | State | Effect after this change |
|---|---|---|
| `issue-863-backend-contract/brain-drafts/agent-authorities.draft.md` | promoted, later superseded | re-run refused (anchors 0 times) |
| `issue-863-backend-contract/brain-drafts/harness-contract.draft.md` | promoted, later superseded | re-run refused (anchors 0 times) |
| `issue-863-backend-contract/brain-drafts/memory-backend-contract.md` | promoted (new-file draft) | refused: destination exists |
| `issue-330-memory-index-merge-strategy/brain-drafts/memory-format-index-merge.md` | promoted (diff note, no contract) | not verb-promotable |
| `issue-677-records-are-files/brain-drafts/adr-0017-amendment-2.draft.md` | promoted | refused at act 1 |
| `issue-677-records-are-files/brain-drafts/memory-format.draft.md` | promoted | replacement no longer occurs: refused |
| `issue-635-doctrine-catches-up-to-code/brain-drafts/adr-0017-amendment-1.draft.md` | promoted | refused at act 1 |
| `issue-635-doctrine-catches-up-to-code/brain-drafts/memory-format-churn.draft.md` | promoted | replacement no longer occurs: refused |
| `issue-701-memory-export-scope/brain-drafts/memory-format.note.draft.md` (+ `README.md`) | **NOT promoted**, paste-by-hand | **if pasted, rename its `memory:share` to `brain:memory:share` while pasting** — no gate catches bare prose without `npm run` |
| `issue-405-inline-review-comments/brain-drafts/anti-pattern-mutation-blind-by-axis.md` | promoted (STOP banner) | its `npm run memory:index` is draft metadata, not doctrine |

Those folders are history (R5) and are not edited by this change.

## After promotion — checks

```
rg -n '(^|[^\w:-])memory:(save|index|share|pull|resolve-index|audit|ship|reindex|split-records|collect|migrate-v1)([^\w-]|$)' brain/core brain/project AGENTS.md
```

Expected remaining hits: `memory-backend-contract.md:154`, `brain/HOME.md`-derived `AGENTS.md` marker text,
the ADR bodies (R6), and nothing carrying `npm run`. Then run `npm test`: the hazard guard
(`memory-script-prefix.test.mjs`) also scans `brain/core`, `brain/project`, `brain/HOME.md` and `AGENTS.md`
for `brain:brain:`.

Standing caveat: #922's tripwire catches a bare `npm run memory:*` only because the bare aliases are real
scripts (R4). Removing the aliases would silently blind it.
