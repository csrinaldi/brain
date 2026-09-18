# Apply progress — issue-1029-parent-value-region

Branch `fix/issue-1029-…` off `main` (c8b3cd95). One unit, strict TDD.

## The defect, measured

`base-branch` refused the Brain UI tracker PR #1028 with "the issue's parent declaration is parent-ambiguous (878, 881, 970, 882, 967)". `PARENT_PROSE_LINE` matched a prose `Parent:` line to END OF LINE and `parentFromProse` counted every `#N` on it, so #998's opening sentence — "Parent: #878 (Brain UI) — the surface, after slice 3. Slice 3 (#881, merged as #970) proved the data path… PR 7 is #882's content; PR 8 lands after #967." — read as five competing declarations. Naming the parent and then saying anything else about the work is how these bodies are written.

## The rule now

A prose `Parent:` key declares the reference right after it, plus any further reference joined to it as a LIST (`,`, `/`, `and`, or bare whitespace); a reference reached through anything else — a bracket, a dash, a word — is prose about the work. `PARENT_PROSE_VALUE` captures that value region and `ISSUE_REF` counts inside the capture, never the line. What the old rule existed to refuse is untouched: `Parent: #878, #879` is still two values for one key (`parent-ambiguous`), never resolved by writing order, and two `Parent:` lines that disagree still are too.

RED: two new tests in `epic-map.test.mjs` (#998's real body shape → parent 878 with no divergence; `Parent: #878 #879` → still ambiguous) — 113/114 with the first red. GREEN: 115/115, and the targeted governance suites 279/279. Mutation: the value region restored to `.*$` (the old end-of-line rule) → the #998-shaped test red, reverted. Measured after the fix against the real body fetched from the forge: `{parent: 878, parentSource: 'prose', divergence: null}`.

Full suite 5701/5701; `npm run brain:repo:check` green.
