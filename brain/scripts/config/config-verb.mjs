// config-verb.mjs — issue #823: the ONE config verb Compuerta 4 ruled
// (#323, 28/08/2026), first slice. PURE: config, migrations and the target
// version are RECEIVED, never read — `role-port.mjs`'s discipline — so the
// CLI beside this file and #824's discovery verb are two CALLERS of one
// validator, never two validators of one schema.
//
// THE SCHEMA IS THE MIGRATIONS'. `deriveKnownPaths` reads the same `defaults`
// objects `migrateConfig` applies, so a key becomes settable in the same
// commit that declares it, and a hand-written second schema — the
// one-rule-two-implementations defect C4 names — has nowhere to grow. Two
// kinds of knowledge fall out of a defaults tree:
//   · a LEAF ("docs.language": 'en')  → settable exactly, nothing beneath it;
//   · an EMPTY OBJECT ("sdd.map": {}) → an OPEN FAMILY: the migration declares
//     the container and the consumer names the members, so any subpath under
//     it is settable (`sdd.map.<stage>` — the ruled spelling).
// Migration entries that use `migrate()` instead of `defaults` contribute no
// paths — a rename/restructure declares no new settable surface.
//
// MIGRATION BELONGS TO THE VERB (C4, verbatim). `planConfigWrite` runs every
// pending migration BEFORE the write, through `installer.mjs`'s own
// `migrateConfig` — the exact function `brain-upgrade` runs, at a second call
// site, never a re-implementation.

import { migrateConfig } from '../lib/installer.mjs';

/**
 * Walks every migration's `defaults` tree once.
 * @param {Array<{defaults?: object}>} migrations
 * @returns {{leaves: Set<string>, families: Set<string>}}
 */
export function deriveKnownPaths(migrations) {
  const leaves = new Set();
  const families = new Set();
  const walk = (node, prefix) => {
    for (const [key, value] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        if (Object.keys(value).length === 0) families.add(path);
        else walk(value, path);
      } else {
        leaves.add(path);
      }
    }
  };
  for (const m of migrations) if (m.defaults) walk(m.defaults, '');
  return { leaves, families };
}

/** JSON first, bare string on failure — `set sdd.map.x '{"engine":"plain"}'` and `set docs.language es` both work. */
export function parseValue(raw) {
  try { return JSON.parse(raw); } catch { return String(raw); }
}

/** `get`'s resolver — undefined for a missing path, never a throw. */
export function resolvePath(config, path) {
  return path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), config);
}

/** The nearest known family/leaf for a refusal — longest shared prefix wins, then shortest name. */
function nearestKnown(path, known) {
  const all = [...known.leaves, ...known.families];
  const score = (candidate) => {
    let i = 0;
    while (i < Math.min(candidate.length, path.length) && candidate[i] === path[i]) i++;
    return i;
  };
  return all.sort((a, b) => score(b) - score(a) || a.length - b.length)[0] ?? null;
}

/**
 * The ONE write path. Refuses closed on an unknown path; migrates first;
 * writes one value. Never touches I/O.
 *
 * @param {{config: object, path: string, value: string, migrations: Array<object>, targetVersion: string}} args
 * @returns {{next: object|null, migrationsApplied: string[], refusal: string|null}}
 */
export function planConfigWrite({ config, path, value, migrations, targetVersion }) {
  const known = deriveKnownPaths(migrations);
  const inFamily = [...known.families].some((f) => path.startsWith(`${f}.`));
  if (!known.leaves.has(path) && !inFamily) {
    const near = nearestKnown(path, known);
    return {
      next: null,
      migrationsApplied: [],
      refusal: `config: unknown path '${path}' — refused, nothing written.` +
        (near ? ` Nearest declared path family: '${near}'.` : '') +
        ' A path becomes settable in the migration that declares it (the schema IS the migrations).',
    };
  }

  const { config: migrated, applied } = migrateConfig(config, migrations, targetVersion);

  const next = structuredClone(migrated);
  const keys = path.split('.');
  let node = next;
  for (const key of keys.slice(0, -1)) {
    if (node[key] == null || typeof node[key] !== 'object') node[key] = {};
    node = node[key];
  }
  node[keys[keys.length - 1]] = parseValue(value);

  return { next, migrationsApplied: applied, refusal: null };
}
