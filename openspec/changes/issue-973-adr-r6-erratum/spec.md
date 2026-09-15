# Spec — issue #973 R6-erratum drafts

## Delta requirement

Five ADRs under `brain/project/decisions/` currently carry a signed amendment section whose
sentence claims the ADR body "is not rewritten (ruling R6 on #961)". That claim is false: the
same act (PR #972) annotated every superseded line in place — in the body of all five ADRs, and
also inside Amendment 2 of ADR-0002 and Amendments 1-2 of ADR-0017 — because the maintainer had
already amended ruling R6 to option A on 2026-09-14. This change adds one new signed amendment per
ADR that corrects only that sentence.

## Scenarios

### Scenario: a drafted erratum amendment parses and is promotable

- **Given** one of the five `*.draft.md` files in `brain-drafts/`
- **When** `parseAmendmentDraft` reads it
- **Then** it returns `ok: true`, with exactly one `amend-find`/`amend-replace` pair and a valid
  `brain-amendment/1` contract (`target`, `amendment`, `issue`, `home-summary`, `body`,
  `body-end`)

### Scenario: the edit is pending and uniquely anchored

- **Given** a draft's single edit and its target ADR's pre-promotion text (`origin/main`, or
  equivalently this branch once the pending revert lands)
- **When** `assessEdit` runs
- **Then** the state is `pending` and `free === 1` — the false sentence occurs exactly once and
  the corrected sentence does not yet appear

### Scenario: applying the edit removes the false claim and nothing else

- **Given** a draft's edit applied to its target ADR's pre-promotion text via `applyEdits`
- **When** the result is compared against that pre-promotion text
- **Then** the only difference is the replaced sentence — `applyEdits` succeeds, and the result
  contains zero occurrences of `not rewritten (ruling R6`

### Scenario: the repo-wide acceptance check is satisfied once all five are promoted

- **Given** `rg -n "not rewritten \(ruling R6" brain/project/decisions/`
- **When** run before promotion
- **Then** it returns exactly 5 hits (one per target ADR), each a live, uncorrected claim
- **And** once all five drafts in this change are promoted by the maintainer, no remaining hit is
  a live claim — the sentence is corrected in every ADR's signed section. `rg` may still match an
  erratum's own quotation of the old sentence in its "What this changes" text — a match there is
  not evidence of an uncorrected claim

## Out of scope

- Running `npm run brain:promote` (maintainer-only action, not performed by this change).
- Any change to the rename tables, the `#961` in-place annotations, or any other line of the five
  target ADRs.
