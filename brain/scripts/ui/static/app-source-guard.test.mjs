// app-source-guard.test.mjs — the D9 boundary applied to the file the
// BROWSER loads (#881 PR 4 / B2, tasks T2a). `ui/lib/**` already has its own
// guard (`lib/source-guard.test.mjs`); this one covers `static/app.js` and
// `static/index.html`, which no `node:test` can execute — there is no DOM
// runner in this repo (design D9), so the rules that would otherwise break
// the page silently are asserted by a scan instead of trusted.
//
// The rules, all from the maintainer's 2026-09-14 ruling (no dependency, no
// CDN, no vendored library, no build step) and R881-10:
//
//   1. `app.js` imports ONLY `./lib/*.mjs` — the same pure modules node tests
//      import. No `node:` builtin (the browser has none), no URL import, no
//      bare package specifier (there is no bundler to resolve one).
//   2. `index.html` loads no external resource and carries no inline handler.
//   3. `app.js` talks to `/api/*` and nothing else — no third-party endpoint,
//      no `file://`, no worktree path.
//   4. No `eval` / `new Function` anywhere in the page.
//
// Test-only; the production files it scans are T1b/T2b/T3b's work.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const STATIC_DIR = dirname(fileURLToPath(import.meta.url));
const LIB_DIR = join(STATIC_DIR, '..', 'lib');
const APP_JS = join(STATIC_DIR, 'app.js');
const INDEX_HTML = join(STATIC_DIR, 'index.html');

function read(path) {
  assert.ok(existsSync(path), `${path} must exist — the page is a real file, not a promise`);
  return readFileSync(path, 'utf8');
}

/** Every `from '<spec>'` / `import('<spec>')` specifier, line by line. */
function importSpecifiers(text) {
  const specs = [];
  for (const line of text.split('\n')) {
    if (!/^\s*import\b/.test(line) && !/\bimport\(/.test(line)) continue;
    const m = /from\s+['"]([^'"]+)['"]/.exec(line) ?? /import\(\s*['"]([^'"]+)['"]/.exec(line);
    if (m) specs.push(m[1]);
  }
  return specs;
}

test('#881 T2a: app.js exists and imports only ./lib/*.mjs — never a node: builtin, a URL, or a bare package', () => {
  const text = read(APP_JS);
  const specs = importSpecifiers(text);
  assert.ok(specs.length > 0, 'app.js must consume the pure lib modules, not re-implement them in the browser file');
  for (const spec of specs) {
    assert.match(spec, /^\.\/lib\/[a-z][a-z0-9-]*\.mjs$/, `app.js imports "${spec}" — only ./lib/<module>.mjs is allowed (D9)`);
    assert.ok(!spec.endsWith('.test.mjs'), `app.js imports "${spec}" — a test file is not part of the page`);
  }
});

test('#881 T2a: every module app.js imports really exists under ui/lib/ — a typo would 404 in the browser and pass every node test', () => {
  const available = new Set(readdirSync(LIB_DIR).filter((n) => n.endsWith('.mjs') && !n.endsWith('.test.mjs')));
  for (const spec of importSpecifiers(read(APP_JS))) {
    const name = spec.replace('./lib/', '');
    assert.ok(available.has(name), `app.js imports ./lib/${name}, which does not exist (have: ${[...available].sort().join(', ')})`);
  }
});

test('#881 T2a: app.js fetches /api/* and nothing else, and never evaluates a string', () => {
  const text = read(APP_JS);
  for (const m of text.matchAll(/fetch\(\s*([`'"])([^`'"]*)\1/g)) {
    assert.match(m[2], /^\/api\//, `app.js fetches "${m[2]}" — the page reads this server's own API only`);
  }
  for (const m of text.matchAll(/new EventSource\(\s*([`'"])([^`'"]*)\1/g)) {
    assert.match(m[2], /^\/api\//, `app.js streams from "${m[2]}" — the page reads this server's own API only`);
  }
  assert.ok(/fetch\(/.test(text), 'app.js must actually read the API — a page that fetches nothing cannot be the SPA');
  for (const [re, label] of [[/\beval\s*\(/, 'eval()'], [/new\s+Function\s*\(/, 'new Function()']]) {
    assert.ok(!re.test(text), `app.js matched ${label} — forbidden in the page (no remote code, no third-party endpoint)`);
  }
  // The ONE absolute URL the page may contain is the SVG namespace constant,
  // which `createElementNS` requires literally: it is an identifier the
  // browser compares by string, never a resource anything fetches.
  const absolute = [...text.matchAll(/https?:\/\/\S*/g)].map((m) => m[0].replace(/['";,)]+$/, ''));
  assert.deepEqual([...new Set(absolute)], ['http://www.w3.org/2000/svg'], 'the page must reach no host but this server');
});

test('#881 T2a: index.html loads no external resource, no inline handler, and no build artefact', () => {
  const html = read(INDEX_HTML);
  assert.ok(!/<script[^>]+src="https?:/.test(html), 'index.html must not load a script from the network (no CDN — maintainer ruling)');
  assert.ok(!/<link[^>]+href="https?:/.test(html), 'index.html must not load a stylesheet or font from the network');
  assert.ok(!/\son[a-z]+=/i.test(html), 'index.html must not carry an inline event handler — app.js wires every listener');
  assert.match(html, /<script type="module" src="\/app\.js"><\/script>/, 'the page loads app.js directly as an ES module: no bundler, no build step');
});
