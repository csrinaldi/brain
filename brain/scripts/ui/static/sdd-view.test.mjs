// sdd-view.test.mjs — the SDD view's rendering, asserted by text scan
// (#998, review of PR 4): this repo has no DOM test harness (design D9), so
// the rules that would otherwise break the page silently are pinned against
// `app.js`'s own source text, the same precedent `app-source-guard.test.mjs`
// and `loadChange`'s token-guard test already use.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const STATIC_DIR = dirname(fileURLToPath(import.meta.url));
const APP_JS = join(STATIC_DIR, 'app.js');

function read(path) {
  return readFileSync(path, 'utf8');
}

/** The named function's whole body, `function <name>(` to its closing `\n}\n` at column 0. */
function functionBody(text, signaturePrefix) {
  const start = text.indexOf(signaturePrefix);
  assert.ok(start >= 0, `${signaturePrefix} must exist in app.js`);
  const end = text.indexOf('\n}\n', start);
  assert.ok(end > start, `${signaturePrefix} must close with a top-level "}"`);
  return text.slice(start, end + 3);
}

// ── review of PR 4, fix 1: skipped archive dirs are said in band ───────────

test('#998 fix1: renderSdd says the archive dirs it skipped, by name, when totals.archiveSkipped is non-empty', () => {
  const body = functionBody(read(APP_JS), 'function renderSdd(');
  assert.match(body, /totals\.archiveSkipped\.count/, 'the band is gated on the count, not always shown');
  assert.match(body, /totals\.archiveSkipped\.names/, 'the names are rendered, not just the count');
});
