// scripts/i18n/es.mjs — Partial Spanish catalog.
//
// Only keys that differ from English need to be listed here.
// Any key absent from this file falls back to en.mjs per-key — no whole-file
// replacement. Set docs.language: es in brain.config.json to activate.
//
// Grows as scripts are migrated in PR2 and PR3.
// Templates use the same named {placeholder} slots as en.mjs.
export default {
  'day.auth.ok': 'Autenticado como @{user} ({provider}).',
  'tracker.yourTickets': 'Tus tickets',
  'common.none': '(ninguno)',
};
