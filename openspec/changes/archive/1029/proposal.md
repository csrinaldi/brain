# Proposal — a prose `Parent:` declares the reference it names, not every issue on the line

## Why

The `base-branch` gate shipped by #967 refused the Brain UI tracker PR (#1028) with
`the issue's parent declaration is parent-ambiguous (878, 881, 970, 882, 967)`.
Issue #998's body opens with one ordinary sentence that names its parent and then
says what the ticket is: `Parent: #878 (Brain UI) — the surface, after slice 3.
Slice 3 (#881, merged as #970) proved the data path… PR 7 is #882's content; PR 8
lands after #967.` The reader matched the line to its end and counted every `#N`
on it, so five references read as five competing declarations. Writing the parent
and then a sentence about the work is how these bodies are written, so the rule
turns normal prose into a blocked PR, and the fix is not to rewrite the prose.

## What changes

The key's VALUE ends where the prose begins. A prose `Parent:` declares the
reference right after it, plus any further reference joined to it as a list; a
reference reached through a bracket, a dash or a word is prose about the work.

## What does not change

`Parent: #878, #879` is still two values for one key and is still refused as
`parent-ambiguous` rather than resolved by writing order — the guess the
requirement exists to refuse. Two `Parent:` lines that disagree are still
ambiguous. `Parent: #878 — see #878` still reads 878.

## Scope

One module (`brain/scripts/status/epic-graph.mjs`) and its tests. No doctrine
under `brain/core/**` changes; no gate wiring changes.
