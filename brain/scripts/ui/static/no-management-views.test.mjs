// no-management-views.test.mjs — R881-10 S2, asserted as ABSENCE (#881 PR 4
// / B2, tasks T4).
//
// Slice 3 draws the canvas and the four-tab drawer. The roadmap, decisions
// (ADR), anti-pattern and by-actor/history views belong to #882, and every
// worktree's uncommitted content belongs to #883. "We did not build them" is
// the kind of claim that decays the moment someone adds a nav item, so the
// page's whole view surface is enumerated here: the tab ids come from the
// module that owns them, and the endpoints come from `app.js` itself.
//
// Test-only; no production code belongs to this task.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TAB_IDS } from '../lib/drawer-model.mjs';

const STATIC_DIR = dirname(fileURLToPath(import.meta.url));
const APP_JS = readFileSync(join(STATIC_DIR, 'app.js'), 'utf8');
const INDEX_HTML = readFileSync(join(STATIC_DIR, 'index.html'), 'utf8');

/** Every endpoint the page can reach, quoted literally in `app.js`. */
function endpoints(text) {
  const found = [];
  for (const m of text.matchAll(/(?:fetch|new EventSource)\(\s*([`'"])([^`'"]*)\1/g)) found.push(m[2]);
  return [...new Set(found)].sort();
}

test('#881 R881-10 S2: the page reaches exactly the endpoints this slice owns — no management view, no MCP, no pulse', () => {
  assert.deepEqual(endpoints(APP_JS), [
    '/api/change/${issue}',
    '/api/poll/${action}',
    '/api/snapshot',
    '/api/stream',
  ]);
});

test('#881 R881-10 S2: the drawer has four tabs and no fifth view hides among them', () => {
  assert.deepEqual(TAB_IDS, ['spec', 'tasks', 'workingMemory', 'reviews']);
});

test('#881 R881-10 S2: no roadmap, decisions, anti-pattern or by-actor/history view identifier exists in the page', () => {
  for (const [name, text] of [['app.js', APP_JS], ['index.html', INDEX_HTML]]) {
    for (const forbidden of [/\broadmapview\b/i, /\bdecisionsview\b/i, /\badrs?\b/i, /anti-?pattern/i, /\bby-?actor\b/i, /\bhistoryview\b/i, /\bnav\b/i]) {
      assert.ok(!forbidden.test(text), `${name} matched ${forbidden} — those views are #882's, not this slice's`);
    }
  }
});

test('#881 R881-10 S1: nothing on the page reads a worktree path — the committed tier is the only tier this slice knows', () => {
  for (const endpoint of endpoints(APP_JS)) {
    assert.ok(!/worktree|uncommitted|working-tree/i.test(endpoint), `the page reaches "${endpoint}"`);
  }
  assert.ok(!/file:\/\//.test(APP_JS), 'the page reads nothing from the filesystem directly');
});

test('#881 R881-10 S2: the shell mounts exactly four regions — status, banners, canvas, drawer', () => {
  const ids = [...INDEX_HTML.matchAll(/id="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(ids, ['banners', 'canvas', 'drawer', 'status']);
});
