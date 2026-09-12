# Verify report — issue-939-461-provenance (#948, closes #939, #461)

**Verdict: PASS**

## Evidence (HEAD 7335552d)

- #939: `AGENT_ENV_DEFAULTS = [AGENT_ENV_DEFAULT, 'CLAUDECODE', 'CODEX_THREAD_ID']` —
  `memory/lib/capture-provenance.mjs:52`, `brain.agentEnv` still overrides (`:102`).
- #461: W4 write-time-only rule — `memory/lib/format.mjs:76` (`ISSUE_CITED_IN_SOURCE_RE`),
  enforced inside `validateWritableRecord` (`:263,271`). READ path
  (`validateRecord`/`parseRecordLine`) confirmed untouched — records that already carry the
  shape in a consumer store are NOT corrected; that still needs the architecture call between a
  new §4 marker vs. overturning #460's read-path ruling (per proposal.md "partially closed").
- `brain-drafts/memory-format-actorkind.md` present, unpromoted.
- Focused tests: `memory/lib/capture-provenance.test.mjs` + `memory/lib/format.test.mjs` →
  **94/94 pass**.

## Deliberately left undone

- #461's read-path/existing-record correction — explicitly not fixed; blocked on a maintainer
  architecture decision (new §4 doctrine marker vs. re-adding #460's dropped R4 rule).
- `brain-drafts/memory-format-actorkind.md` unpromoted — awaiting maintainer `brain:promote`.

No CRITICAL / WARNING. Fresh adversarial review (F1-F6) already answered in apply-progress.
