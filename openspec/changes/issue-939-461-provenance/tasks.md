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

## #461 — investigated, not implementable here

- [x] 2.1 Read the issue and the existing code
      (`provenance.mjs#renderProvenance`'s own "KNOWN-AMBIGUOUS... issue
      #461" header) to confirm whether a code fix exists.
- [x] 2.2 Conclusion: no code fix is possible without an architecture
      decision the issue itself defers (new §4 marker = doctrine change, or
      a validation rule already ruled OUT on PR #460). Documented in
      `proposal.md`; epic task 4.2 left UNCHECKED with that note.
