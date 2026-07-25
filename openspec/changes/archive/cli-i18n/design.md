# Design — CLI Output Internationalization

> How the [proposal](proposal.md) is implemented. Technical decisions.

## Catalog format

`scripts/i18n/<lang>.mjs` — a default-exported flat object, `key → template`. Keys are dotted, grouped by script (e.g. `day.auth.ok`, `tracker.yourTickets`). Templates use named `{placeholder}` slots.

```js
// scripts/i18n/en.mjs (canonical — every key lives here)
export default {
  'day.auth.ok': 'Authenticated as @{user} ({provider}).',
  'tracker.yourTickets': 'Your tickets',
  'common.none': '(none)',
};
```

`es.mjs` is partial; any key it omits falls back to `en` **per key** (not whole-file). brain ships `en.mjs` (canonical) + `es.mjs` (the prior Spanish strings).

## Resolver — `scripts/i18n/t.mjs`

```js
import en from './en.mjs';
import { loadBrainConfig } from '../lib/brain-config.mjs';

function activeLang() {
  try { return loadBrainConfig().docs?.language || 'en'; } catch { return 'en'; }
}

let _cat = null;               // lazily loaded active-locale catalog
async function catalog() {
  if (_cat) return _cat;
  const lang = activeLang();
  if (!lang || lang === 'en') return (_cat = {});
  try { _cat = (await import(`./${lang}.mjs`)).default; }
  catch { _cat = {}; }          // unknown locale → English everywhere
  return _cat;
}

export async function t(key, params = {}) {
  const cat = await catalog();
  const tpl = cat[key] ?? en[key] ?? key;   // per-key fallback; key itself if unknown
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}
```

- Async (locale import is async); JS scripts already use top-level await.
- A synchronous variant is unnecessary — all callers are async-capable.
- Unknown key → returns the key string (visible, lint-able), never throws.

## Shell catalog — `scripts/i18n/sh.mjs`

JS scripts import `t`. Shell scripts can't cheaply call `node` per message, so `sh.mjs <lang>` prints the active locale (English fallback applied) as `printf`-ready shell assignments, sourced once:

```
# bootstrap.sh
eval "$(node scripts/i18n/sh.mjs)"     # defines I18N_* vars for the active locale
printf "$I18N_DAY_AUTH_OK\n" "$user"   # %s placeholders for dynamic values
```

`sh.mjs` converts dotted keys to `I18N_DOTTED_UPPER` and `{placeholder}` slots to positional `%s` (documented order per key). Shell messages stay simple (few dynamic args).

## Language source

`docs.language` from `brain.config.json` (ADR-0009), fallback `en`. No migration: the key already exists (added in the language-policy change). brain = `en`.

## Migration mechanics

- Each literal `console.log('…')` → `console.log(await t('key', { … }))`. Keys added to `en.mjs`; the Spanish original goes to `es.mjs`.
- ANSI color codes stay in the calling code (templates are plain text); or keys hold only the message and color wraps the result. Keep colors in code, templates plain.

## Chained PR plan

1. **PR1 — Infra:** `en.mjs` (seed with keys as scripts are migrated), `t.mjs`, `sh.mjs`, `es.mjs` (starts empty/partial), unit tests. No script changes.
2. **PR2 — JS scripts:** migrate `day-start`, `tracker-board`, `project-status`, `ticket-start` output to `t()`; add their keys to `en.mjs` + Spanish to `es.mjs`.
3. **PR3 — Shell scripts:** migrate `bootstrap.sh`, `install-tools.sh` via the sourced catalog.

Delivered against a history branch (feature-branch-chain), final merge → main.
