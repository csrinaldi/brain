---
status: draft
issue: 1147
---

# Spec — adoption docs for the current release (issue #1147)

## Delta requirements

- **R1.** `docs/adoption.md` MUST distinguish the new-repository path from the
  existing-repository path, and every command, script name, flag, config key and
  file path it names MUST exist in the published package (`npm pack`), not only in
  this repository's source tree (ADR-0036).
- **R2.** `docs/adoption.md` MUST state the `lite` tier as the explicit default for
  new consumers (ADR-0026 Amendment 8) and `claude` as the default agent platform,
  with `antigravity` named as the second supported platform (ADR-0024 Amendment 2).
- **R3.** `docs/adoption.md` MUST document the memory backend choice
  (`plainfiles`/`engram`) and the VCS provider choice (`github`/`gitlab`) that
  `env:init` resolves.
- **R4.** `docs/adoption.md` MUST require gitignoring `.env` before any credential
  is written to it, as an explicit step before `brain:env:init` runs (#1112 F1/F2).
- **R5.** `docs/adoption.md` MUST NOT assert a supported path for a new repository's
  first commit under the installed hooks unless one has shipped; today it states
  plainly that none exists yet and links #1112 item 4, rather than inventing one.
- **R6.** `docs/adoption.md` MUST document the archive sweep's automation identity
  (`BRAIN_SWEEP_APP_ID` / `BRAIN_SWEEP_APP_PRIVATE_KEY`, #1106) and that its
  provisioning is a manual step today, linking the open provisioning issue (#1107).
- **R7.** `docs/adoption.md` MUST document `brain:protect`, `brain:upgrade`, and
  what to do when a bootstrap step fails.
- **R8.** `docs/KNOWN-LIMITATIONS.md` MUST NOT frame brain as a "1.0 pilot" release,
  and MUST list the open consumer-path defects found by #1081 (#1112, #1113,
  #1115–#1119, plus any other verified-open defect that affects a consumer), each
  with its issue link and a practical workaround where one exists.
- **R9.** `docs/definition-of-done.md` MUST exist, stating epic #1121's five
  properties and phase exits in plain words and ADR-0036's rule, without
  duplicating #1121's own task checklists (link, don't copy).

## Scenarios

- **GIVEN** a reader with only `docs/adoption.md` open, **WHEN** they follow the
  "Quick path — new repository" section top to bottom on a fresh, empty repo,
  **THEN** every command they run exists in the published `@logikas/brain` tarball.
- **GIVEN** a reader who reaches "The first commit" section, **WHEN** they look for
  a supported way to make the adoption commit, **THEN** the doc tells them
  truthfully that none exists yet, rather than presenting an invented workflow as
  supported.
- **GIVEN** a reader of `docs/KNOWN-LIMITATIONS.md`, **WHEN** they scan it,
  **THEN** they find no "1.0 pilot" framing and see #1112, #1113, #1115–#1119 each
  listed with its issue link and workaround (or "none yet" stated explicitly).
