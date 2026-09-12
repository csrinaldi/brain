# Tasks — issue-939-461-provenance

## #939 — widen the default agent-marker list

- [x] 1.1 RED: add tests to `capture-provenance.test.mjs` for a session
      exporting only `CODEX_THREAD_ID`, only `CLAUDECODE`, none of the
      defaults (evidence lists checked names), `CODEX_THREAD_ID` set-but-
      empty, and `brain.agentEnv` still overriding the widened defaults.
- [x] 1.2 GREEN: add `AGENT_ENV_DEFAULTS` (commented per-runtime, per-
      verification) to `capture-provenance.mjs`; `resolveActorKind()`
      defaults to it instead of `[AGENT_ENV_DEFAULT]`.
- [x] 1.3 REFACTOR: doc comments; kept `AGENT_ENV_DEFAULT` (singular)
      exported for backward compat with existing tests/callers.
- [x] 1.4 Mutation proof: revert 1.2 alone, confirm the widening tests (and
      only those / the whole module, since the revert removes an import)
      go red; restore, confirm green.
- [x] 1.5 Draft the doctrine's accepted-cost paragraph under
      `brain-drafts/memory-format-actorkind.md` (not applied to
      `brain/core/**` — maintainer promotes).
- [x] 1.6 Tick epic task 4.10 in `issue-864-memory-2-0/tasks.md`, noting the
      doctrine draft is pending promotion.

## #461 — write-time W4 rule (apply attempt 2, fresh-review finding F1)

- [x] 2.1 Read the issue and the existing code
      (`provenance.mjs#renderProvenance`'s own "KNOWN-AMBIGUOUS... issue
      #461" header) to confirm whether a code fix exists.
- [x] 2.2 (superseded — see 2.3-2.6) A first apply attempt concluded no code
      fix was possible; a fresh review corrected that: the issue itself
      names a write-time-only option (`validateWritableRecord`, added in
      #460) explicitly out of that ruling's scope.
- [x] 2.3 RED: add `format.test.mjs` tests for `validateWritableRecord`'s new
      W4 (rejects absent `issue`, rejects a disagreeing `issue`, admits an
      agreeing `issue`, does not fire absent an `issue #N` citation) plus a
      READ-gate test proving `validateRecord`/`parseRecordLine` still admit
      the shape unchanged.
- [x] 2.4 GREEN: add W4 to `validateWritableRecord` (`format.mjs`) — refuses
      a `source` citing `issue #N` when the record's own `issue` is absent
      or a different number.
- [x] 2.5 Mutation proof: revert the `format.mjs` W4 addition alone
      (`git stash`), confirm the 2 new "rejects" tests go RED; restore,
      confirm all 57 GREEN.
- [x] 2.6 Measured blast radius over this repo's `.memory/records/`,
      2026-09-12: 0/2374 records carry the disagreeing shape (2 records cite
      an issue in `source`, both already agree with their declared `issue`).
      Fixed one pre-existing test fixture (`store.test.mjs`'s "DIVERGENT
      bytes" test) that incidentally used the now-refused shape, by
      declaring the `issue` it already implied.
- [x] 2.7 Ticked epic task 4.2 in `issue-864-memory-2-0/tasks.md`; corrected
      `proposal.md`/`spec.md` to state what W4 delivers (write-time closure)
      versus what genuinely remains (pre-existing records carrying the
      shape, blocked on the same architecture decision as before).
