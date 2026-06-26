# Tasks — CLI Output Internationalization

> Implements [proposal.md](proposal.md) following [design.md](design.md). Grouped by chained PR.

## PR1 — i18n infrastructure
- [x] 1.1 `scripts/i18n/en.mjs` — canonical catalog (grows as scripts migrate).
- [x] 1.2 `scripts/i18n/t.mjs` — `t(key, params)` resolver: locale from `docs.language`, per-key English fallback, `{placeholder}` interpolation, unknown key → key string.
- [x] 1.3 `scripts/i18n/sh.mjs` — emit sourceable shell catalog (`I18N_*` vars, `%s` placeholders) for the active locale with English fallback applied.
- [x] 1.4 `scripts/i18n/es.mjs` — start (partial; filled as scripts migrate).
- [x] 1.5 Tests: resolver fallback (missing key, unknown locale), interpolation; `sh.mjs` output shape.

## PR2 — JS script output
- [x] 2.1 `day-start.mjs` output → `t()` (keys + en/es entries).
- [x] 2.2 `tracker-board.mjs` output → `t()` (preserve `retomar`'s markdown structure).
- [x] 2.3 `project-status.mjs` VCS section + headers → `t()`.
- [x] 2.4 `ticket-start.mjs` output → `t()`.
- [x] 2.5 Verify: brain (`docs.language: en`) prints English; `docs.language: es` prints the prior Spanish.

## PR3 — Shell script output
- [x] 3.1 `bootstrap.sh` → source the generated catalog; `printf` for dynamic messages.
- [x] 3.2 `install-tools.sh` → same.
- [x] 3.3 Verify both under `docs.language` en/es with English fallback.

## Closure
- [ ] No user-facing literal output strings remain in the migrated scripts (`rg` spot-check).
- [ ] `npm test` + `repo:check` + `brain:nav` green.
