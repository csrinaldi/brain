# Tasks: #576 — single PR, closes #576 and #754

Strict TDD. Estimated countable: ~640 (archetypes ~120, verifier instance
~90, re-seat ~20, projection ~200, challenger rewire ~60, promoted ADR +
HOME.md ~150; tests and openspec exempt) vs `lite` 1000.

- [x] 1.1 RED+GREEN: `archetypes.mjs` — four definitions, labels checked,
      port-field duplication refused; instances re-seated (`archetype` named,
      served surface unchanged for existing consumers).
- [x] 1.2 RED+GREEN: `verifier-review.mjs` — §2 locks by symbol, no protocol
      literals; `firstPartyInstance(name)` door.
- [x] 1.3 RED+GREEN: `project-role.mjs` — same-bytes-twice, `brain-` namespace,
      `compileAgentsMd(docs, {roles})` additive with backward byte-identity
      proven; both drift guards.
- [x] 1.4 Lock survival: the projected reviewer's verdict cannot approve —
      §2's tests exercised against the projection.
- [x] 1.5 RED+GREEN: challenger rewire — binding deleted, AXIS half
      byte-untouched (pinned), `firstPartyInstance('challenger')`; the
      "WHEN #312 LANDS" text gone from the tree.
- [x] 1.6 ADR-0023 draft written from what exists; includes T3's emission
      note and T4's inert-keys note.
- [x] 1.7 Full suite, `repo:check`, `nav`; work-unit commits; memory record
      `--issue 576`.
- [ ] 1.8 THE MAINTAINER: `brain:promote` the ADR on this branch; `decision`
      label on the PR.

## Review Workload Forecast

Single PR, ~640 countable vs 1000 — **no chain needed**. Decision needed
before apply: **No**. The one ceremony inside the PR is 1.8 (the ADR
promotion — the maintainer's typed word and commit).
