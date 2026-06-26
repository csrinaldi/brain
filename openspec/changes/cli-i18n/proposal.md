# Proposal — CLI Output Internationalization

> **Status:** Draft for implementation · **Implements:** [ADR-0010](../../../brain/project/decisions/adr-0010-cli-output-i18n.md) · **Depends on:** [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md) (language policy)

## Context

The harness scripts print hardcoded Spanish output. ADR-0009 made code comments English and deferred the output-language question; the VCS adapter slices kept output as-is pending this. This change externalizes all user-facing output to language catalogs with an English fallback, driven by `brain.config.json` `docs.language`.

## What to build

1. **i18n infrastructure**: `scripts/i18n/en.mjs` (canonical catalog), `scripts/i18n/t.mjs` (resolver `t(key, params)` with per-key English fallback, locale from `docs.language`), and `scripts/i18n/sh.mjs` (emit a sourceable shell catalog for the active locale). Unit tests.
2. **Migrate JS script output** to `t(key, …)`: `day-start.mjs`, `tracker-board.mjs`, `project-status.mjs`, `ticket-start.mjs`.
3. **Migrate shell script output** to the sourced catalog: `bootstrap.sh`, `install-tools.sh`.
4. **Seed `es.mjs`** with the current Spanish strings (so existing users keep Spanish by setting `docs.language: es`), while brain's own output becomes English (`docs.language: en`).

## Out of scope

- A `cli.language` key separate from `docs.language` (add later only if needed).
- Translating output to languages beyond en/es.
- Pluralization / ICU message format (named-placeholder interpolation is enough for now).

## Acceptance criteria

- [ ] `t(key, params)` resolves the active locale and falls back to English per missing key (tested).
- [ ] `scripts/i18n/en.mjs` contains every key used; brain runs in English with `docs.language: en`.
- [ ] All JS script output goes through `t()`; no user-facing literal strings remain in those scripts.
- [ ] Shell scripts source the generated catalog; output respects `docs.language` with English fallback.
- [ ] `es.mjs` reproduces the prior Spanish output (verified: `docs.language: es` yields the old text).
- [ ] `npm test` + `repo:check` + `brain:nav` green.

## Rollback plan

The catalog + resolver are additive. Each script migration is independent and revertible; until a script is migrated it keeps its literals. A missing key falls back to English, never crashes.
