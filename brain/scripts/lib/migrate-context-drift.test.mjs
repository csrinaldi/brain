// Drift guard (#1346): since #1344 an `undefined` axisContext means "build it from process.env and the cwd's
// .env". A test that calls migrateConfig / a migration's .migrate without saying which context it wants
// therefore silently reads the machine it runs on. Every such call must pass its 4th argument explicitly
// (`null` = env-blind; a real context; or `undefined` written out on purpose), and every direct `.migrate(`
// must name `axisContext` / `buildAxisContext` in its helpers — except the suites that deliberately test the
// self-build path, listed below with the reason.
//
// Why a static scan, not a hostile-env run: the migration only consults the env when a shaping migration
// (1.11.1 / 1.12.1) is pending, and most suites assert outcomes that happen not to depend on it, so a hostile
// env run proves nothing about the call sites it does not exercise. The scan fails on the call shape itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../../..');
const SELF = 'brain/scripts/lib/migrate-context-drift.test.mjs';
// Suites that exist to exercise the self-build path (env + .env, no context handed in): each wraps its
// calls in a sandboxed consumer dir with a controlled .env.
const SELF_BUILD_SUITES = new Set(['brain/scripts/lib/axis-shape-old-upgrader.test.mjs']);

const files = execFileSync('git', ['ls-files', '*.test.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 20000 })
  .split('\n').filter(Boolean);

// Returns the top-level argument texts of the call whose '(' is at `open`.
export function callArgs(src, open) {
  const args = [];
  let depth = 0, cur = '', q = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (q) { cur += c; if (c === '\\') { cur += src[++i]; } else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; cur += c; continue; }
    if ('([{'.includes(c)) { depth++; if (depth > 1) cur += c; continue; }
    if (')]}'.includes(c)) { depth--; if (depth === 0) { if (cur.trim()) args.push(cur.trim()); return args; } cur += c; continue; }
    if (c === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return args;
}

export function violations(file, src) {
  const out = [];
  const line = (i) => src.slice(0, i).split('\n').length;
  for (const m of src.matchAll(/(?<![\w.])migrateConfig\(/g)) {
    const before = src.slice(0, m.index);
    if (/function\s+$/.test(before)) continue;
    if (/^\s*(\/\/|\*)/.test(before.slice(before.lastIndexOf('\n') + 1))) continue; // prose, not a call
    if (callArgs(src, m.index + m[0].length - 1).length < 4) out.push(`${file}:${line(m.index)} migrateConfig(...) without an explicit axisContext (4th arg)`);
  }
  if (!SELF_BUILD_SUITES.has(file)) {
    for (const m of src.matchAll(/\.migrate\(/g)) {
      const args = callArgs(src, m.index + m[0].length - 1);
      if (!/axisContext|buildAxisContext/.test(args[1] ?? '')) out.push(`${file}:${line(m.index)} .migrate(...) helpers name no axisContext/buildAxisContext`);
    }
  }
  return out;
}

test('#1346: no test reaches the self-build axisContext path by accident', () => {
  const bad = files.filter((f) => f !== SELF).flatMap((f) => violations(f, readFileSync(resolve(ROOT, f), 'utf8')));
  assert.deepEqual(bad, [], `these calls read the machine's env; pass null (env-blind) or a context:\n${bad.join('\n')}`);
});

test('#1346: the scanner is a real detector (planted violations are caught, compliant calls are not)', () => {
  assert.equal(violations('x.test.mjs', "migrateConfig(c, m, '1.0.0');").length, 1);
  assert.equal(violations('x.test.mjs', "migrateConfig(c, m, '1.0.0', null);").length, 0);
  assert.equal(violations('x.test.mjs', "migrateConfig(\n  { a: [1, 2] },\n  migrations,\n  '1.6.0',\n  null,\n);").length, 0);
  assert.equal(violations('x.test.mjs', 'E.migrate(cfg, { mergeDefaults });').length, 1);
  assert.equal(violations('x.test.mjs', 'E.migrate(cfg, { mergeDefaults, axisContext: null });').length, 0);
});
