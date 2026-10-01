# Spec (#1205)

- REQ-1: The prompt text (en, es) names `engram|plainfiles` and shows no bracketed default.
  - Scenario: catalogs pinned by `i18n/coverage.test.mjs`.
- REQ-2: An empty answer re-prompts; it never writes `memory.backend` and never selects a backend.
  - Scenario: stdin `\n`, `plainfiles` yields `plainfiles`.
- REQ-3: A closed stdin (`read` fails) leaves the backend empty and runs the existing `bootstrap.memory.undeclared` warning and `MISSING_OPTIONAL` entry; nothing is written or indexed.
- REQ-4: `bootstrap.sh` contains no `MEMORY_BACKEND:-engram` default.
- REQ-5: `docs/adoption.md` no longer says Enter accepts `engram`.
