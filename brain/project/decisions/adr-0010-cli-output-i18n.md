# ADR-0010 — CLI Output Internationalization (i18n)

**Status**: Accepted
**Date**: 2026-06-26

## Context

The harness scripts print user-facing output (progress, warnings, next steps). That text was hardcoded in Spanish. For a public, adoptable product this is wrong in two ways: it forces one language on every consumer, and it mixes a localizable concern into the code.

ADR-0009 settled that **code comments** are always English. It deliberately left **runtime output strings** as a separate concern — this ADR resolves it.

## Decision

User-facing CLI output is **externalized to message catalogs** keyed by language, with **English as the canonical fallback**.

- **Catalogs**: `scripts/i18n/<lang>.mjs`, each exporting a flat `key → template` map. `en.mjs` is canonical — every key MUST exist there. Other locales (e.g. `es.mjs`) are partial; missing keys fall back to English **per key**.
- **Resolver**: `scripts/i18n/t.mjs` exports `t(key, params)`, which interpolates named `{placeholder}` slots. It selects the active locale, then resolves each key against that locale with a fallback to `en`.
- **Language source**: the active locale is `brain.config.json` `docs.language` (ADR-0009), falling back to `en`. No new config key — a team's language is one choice; CLI output follows the same `docs.language` as the project docs. (`cli.language` can be added later if a project ever needs them to differ.)
- **Shell scripts** (`bootstrap.sh`, `install-tools.sh`) cannot import the resolver cheaply per message. They source a generated catalog once at start (`scripts/i18n/sh.mjs <lang>` emits `printf`-style shell variables for the active locale with English fallback already applied); messages with dynamic values use `printf "$MSG" "$arg"`.

English becomes the default everywhere (brain's own `docs.language` is `en`), so the repo's output is English while any consumer can ship a locale catalog.

## Consequences

- **Positive**: output language is configurable per project; English is guaranteed by the per-key fallback even for incomplete locales.
- **Positive**: output strings live in one place per language — translatable without touching logic; the code references stable keys.
- **Positive**: closes the deferred half of ADR-0009 — comments English, output localized.
- **Negative**: every output literal must be migrated to a key; a missing key silently falls back to English (mitigated by `en.mjs` being the canonical source of all keys, lint-able later).
- **Negative**: shell i18n is less ergonomic than JS — the sourced-catalog indirection is a deliberate trade to avoid a `node` call per message.
