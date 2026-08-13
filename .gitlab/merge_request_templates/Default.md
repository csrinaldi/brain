## Linked issue (required)

<!--
Every merge request must reference an approved issue — `issue-link` is a required gate
and fails closed without one.

  · Targeting the default branch: use a CLOSING reference, followed by the issue
    number — the line below is already in that form.
    Accepted closing keywords (case-insensitive): `Close`, `Closed`, `Closes`, `Fix`, `Fixed`, `Fixes`, `Resolve`, `Resolved`, `Resolves`.
  · Targeting any other branch (a chained slice): "Part of #N" is accepted too.
    It is NOT accepted on the default branch — the integration MR must close.

The referenced issue MUST carry the approved label (`status:approved`; scoped
providers use their own separator). An unapproved issue fails the gate exactly as a
missing reference does.
-->

Closes #

## Merge request type

<!--
Check exactly ONE box and add the matching `type:*` label.

This list IS the vocabulary — a `type:*` value outside it is not a label on this
repository, so checking a box for one leaves the "exactly one `type:*` label" item
unsatisfiable. Verify with your provider's label list before adding a new value here.
-->

- [ ] New feature (`type:feature`)
- [ ] Bug fix (`type:bug`)
- [ ] Documentation only (`type:docs`)
- [ ] Code refactoring (`type:refactor`)
- [ ] Maintenance / tooling (`type:chore`)
- [ ] Governance / process (`type:governance`)

## Summary

<!-- 1–3 bullet points describing what this merge request does. -->

-

## Changes

| File | Change |
|------|--------|
| `path/to/file` | what changed |

## Diff size budget

<!--
The budget is resolved from the repo's declared governance tier, NOT a flat number
(#496): 1000 changed lines at `lite`, 400 at `standard`, 200 at `regulated`.
Additions + deletions, excluding whatever `governance.ignoreList` in this repo's
brain.config.json lists (test files, fixtures and lock files are the usual
entries — the list varies per repo, so read it rather than assuming).

If this merge request exceeds the budget, add the `size:exception` label and explain why
splitting was not feasible. CI will block merges over budget without it.

`regulated` does NOT honor `size:exception` — at that tier the label is refused
and the only way through is a smaller diff. Run `npm run brain:governance-status`
if you are unsure which tier this repo declares.
-->

- [ ] Diff is under the tier's budget (or `size:exception` label added with justification — not available at `regulated`)

## Decision / ADR

<!--
What `decision-gate` actually does (ADR-0026 Amendment 4, #516; added-only since #510):
it takes the changed-file list and the added-file list. It reads no labels. It fails
in exactly two cases —

  · an ADR is ADDED under `brain/project/decisions/` and `brain/HOME.md` is not in
    the diff;
  · `brain/HOME.md` is in the diff and no ADR path is touched at all.

Everything else passes, including MODIFYING an existing ADR on its own: correcting a
line in an ADR from months ago does not force a re-index.

So if this merge request introduces an architectural or process decision:
  1. Add an `adr-NNNN-<slug>.md` under `brain/project/decisions/`
  2. Index it in `brain/HOME.md` — this is the half the gate checks
  3. Add the `decision` label

Step 3 is a HUMAN signal that a decision was made. No gate reads it, and no gate
verifies that an ADR was OWED — "is this a decision?" is judgment, deliberately left
outside the machine.
-->

- [ ] No architectural decision involved
- [ ] ADR added (`brain/project/decisions/adr-NNNN-*.md`) and indexed in `brain/HOME.md`

## What the gates check

<!--
The governance jobs that run on this merge request. Which of them BLOCK the merge depends
on the tier this repo declares and on what the platform can enforce — run
`npm run brain:governance-status` to see the resolved set.
-->

| Gate | What it verifies |
|------|------------------|
| `issue-link` | The merge request description references an issue carrying the approved label. Fails closed. |
| `diff-size` | Changed lines are within the declared tier's budget, excluding the configured ignore list. |
| `local-checks` | The repo-local checks (`npm test`, reference check, navigation check) run in CI too. |
| `memory-gate` | This repository has EVER recorded a session summary under `.memory/records/`. It is repo-scoped, not per-change. |
| `decision-gate` | An ADDED ADR is indexed in `brain/HOME.md`, and `brain/HOME.md` is not touched without an ADR. Reads no labels. |
| `phase-order` | The change's SDD artifacts progressed in order. Detection-only at the lightest tier. |
| `actor-check` | The approval evidence comes from an act distinct from the authoring one. |
| `brain-writes-reviewed` | Writes to the knowledge half were not authored by an agent identity. |

## Test plan

- [ ] `npm test` passes (all unit tests green)
- [ ] `npm run brain:repo:check` passes
- [ ] `npm run brain:nav` passes (no orphans, no broken links)
- [ ] Manually verified the changed functionality

## Contributor checklist

- [ ] Linked an approved issue on the reference line above
- [ ] Exactly one `type:*` label added, from the list above
- [ ] Diff size within the tier's budget (or `size:exception` labelled and justified)
- [ ] Conventional commit format (`type(scope): description`, no AI-attribution trailers)
- [ ] Anything worth keeping was captured with `npm run memory:share`. Note that
      `memory-gate` does not check this merge request: it asks only whether the repository
      has ever recorded a session summary, and `skip:memory-gate` is named in the
      docs but no code reads it — applying it changes nothing.

<!-- Emitted from brain/scripts/vcs/contributor-scaffold.mjs — edit the source, not
     .gitlab/merge_request_templates/Default.md. A hand-edit here is refused by contributor-scaffold.test.mjs. -->
