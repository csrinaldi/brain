# Spec — issue-1029-parent-value-region

## R1029-1: a prose `Parent:` key declares a VALUE, and the value ends where the prose begins

The reader of a prose `Parent:` line MUST take as the key's value the issue
reference immediately after the key, together with any further reference joined
to it as a list (a comma, a slash, the word `and`, or bare whitespace). A
reference reached through anything else — a bracket, a dash, a word — is prose
about the work and MUST NOT be counted as a declaration. Ambiguity keeps its
meaning: two or more DISTINCT references inside that value, or two `Parent:`
lines naming different issues, are `parent-ambiguous` and resolve to no parent,
said through `declarationDivergences`, never resolved by writing order.

- **WHEN** a body's line reads `Parent: #878 (Brain UI) — the surface, after slice 3. Slice 3 (#881, merged as #970) proved the data path. PR 7 is #882's content; PR 8 lands after #967.`
- **THEN** the declared parent is 878 and no divergence is reported.

- **WHEN** a body's line reads `Parent: #878, #879`
- **THEN** no parent is declared and `declarationDivergences` carries `{key: 'parent', value: '878, 879', reason: 'parent-ambiguous'}`.

- **WHEN** a body's line reads `Parent: #878 #879`
- **THEN** the two references joined by bare whitespace are two values for one key, and the same `parent-ambiguous` divergence is reported.

- **WHEN** a body's line reads `Parent: #878 — see #878 for the epic body.`
- **THEN** the declared parent is 878: the second reference is prose, outside the value.

- **WHEN** a body's line reads `Parent: #878, and #879`
- **THEN** the two references are two values for one key and the same `parent-ambiguous` divergence is reported: a comma followed by `and` is a list join, not prose.

- **WHEN** a body's line reads `Parent: #878` followed by a long run of spaces and then a word
- **THEN** the declared parent is 878 and the scan is linear in the length of that run: each hop into a further reference MUST consume a separator of its own, never two optional whitespace runs around an optional token.
