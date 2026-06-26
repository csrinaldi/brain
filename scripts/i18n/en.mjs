// scripts/i18n/en.mjs — Canonical English catalog.
//
// Every key used by any brain script must live here. Other locale catalogs
// (e.g. es.mjs) are partial; any key they omit falls back to this file
// per-key. Templates use named {placeholder} slots for dynamic values.
//
// Keys are dotted, grouped by script: <script>.<section>.<name>
// e.g. 'day.auth.ok', 'tracker.yourTickets', 'common.none'
//
// Grows as scripts are migrated in PR2 and PR3.
export default {
  'day.auth.ok': 'Authenticated as @{user} ({provider}).',
  'tracker.yourTickets': 'Your tickets',
  'common.none': '(none)',
};
