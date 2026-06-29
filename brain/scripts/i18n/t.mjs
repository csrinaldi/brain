// brain/scripts/i18n/t.mjs — i18n resolver for brain CLI scripts.
//
// Usage:
//   import { t } from './i18n/t.mjs';
//   console.log(await t('common.none'));
//   console.log(await t('day.auth.ok', { user: 'alice', provider: 'github' }));
//
// Active locale is read from brain.config.json `docs.language` (ADR-0009),
// defaulting to 'en'. The locale catalog is lazily imported and cached.
// Per-key English fallback: any key absent from the active catalog resolves
// from en.mjs. A key absent from both catalogs returns the key string itself.
// Never throws.

import en from './en.mjs';
import { loadBrainConfig } from '../lib/brain-config.mjs';

function activeLang() {
  try { return loadBrainConfig().docs?.language || 'en'; } catch { return 'en'; }
}

let _cat = null; // cached active-locale catalog (populated on first call to t)

async function catalog() {
  if (_cat !== null) return _cat;
  const lang = activeLang();
  if (!lang || lang === 'en') return (_cat = {});
  try {
    _cat = (await import(`./${lang}.mjs`)).default;
  } catch {
    // Unknown locale or missing file — fall back to English for all keys.
    _cat = {};
  }
  return _cat;
}

/**
 * Pure translation core — exported for unit testing with arbitrary catalogs.
 *
 * @param {string} key
 * @param {Record<string, string|number>} params
 * @param {Record<string, string>} cat   - active locale catalog
 * @param {Record<string, string>} fallbackCat - English catalog
 * @returns {string}
 */
export function translate(key, params, cat, fallbackCat) {
  const tpl = cat[key] ?? fallbackCat[key] ?? key;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

/**
 * Translates a key using the active locale from brain.config.json.
 * Falls back per-key to English; returns the key string for unknown keys.
 * Never throws.
 *
 * @param {string} key
 * @param {Record<string, string|number>} [params={}]
 * @returns {Promise<string>}
 */
export async function t(key, params = {}) {
  const cat = await catalog();
  return translate(key, params, cat, en);
}
