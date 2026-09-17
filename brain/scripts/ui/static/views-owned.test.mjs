// views-owned.test.mjs — R998-2's absence proof, replacing
// no-management-views.test.mjs (#998 PR 2).
//
// That file's name and its `\bnav\b` prohibition described a page with no
// nav: #881 PR 4 drew one canvas and a four-tab drawer, nothing else. #998
// PR 2 adds a real `<nav id="modes">` with four mode buttons, so a
// prohibition on the word "nav" would now fail on the page's own, intended
// markup — the claim it protected ("we did not build the management views
// of #882") still holds, but the ABSENCE it needs to enumerate has grown:
// this PR owns four modes, not one canvas. Same rule (#881's evidence-reader
// discipline: "we built exactly this, and named what we didn't"), rewritten
// for the surface this PR actually draws.
//
// Test-only; no production code belongs to this task.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TAB_IDS } from '../lib/drawer-model.mjs';
import { MODE_IDS, PLACEHOLDERS } from '../lib/view-model.mjs';

const STATIC_DIR = dirname(fileURLToPath(import.meta.url));
const APP_JS = readFileSync(join(STATIC_DIR, 'app.js'), 'utf8');
const INDEX_HTML = readFileSync(join(STATIC_DIR, 'index.html'), 'utf8');

/** Every endpoint the page can reach, quoted literally in `app.js`. */
function endpoints(text) {
  const found = [];
  for (const m of text.matchAll(/(?:fetch|new EventSource)\(\s*([`'"])([^`'"]*)\1/g)) found.push(m[2]);
  return [...new Set(found)].sort();
}

test('#998 R998-2: the page reaches exactly the endpoints this slice owns — no management view, no MCP, no pulse', () => {
  assert.deepEqual(endpoints(APP_JS), [
    '/api/change/${issue}',
    '/api/poll/${action}',
    '/api/snapshot',
    '/api/stream',
  ]);
});

test('#998 R998-2: the drawer still has four tabs and no fifth view hides among them', () => {
  assert.deepEqual(TAB_IDS, ['spec', 'tasks', 'workingMemory', 'reviews']);
});

test('#998 R998-2/R998-4: this PR owns exactly four modes; map and sdd have real content, the rest name the PR that brings them', () => {
  assert.deepEqual(MODE_IDS, ['map', 'sdd', 'reviews', 'governance']);
  for (const mode of ['map', 'sdd']) assert.equal(PLACEHOLDERS[mode], null, `mode "${mode}" has real content, not a placeholder`);
  for (const mode of ['reviews', 'governance']) {
    assert.match(PLACEHOLDERS[mode], /\bPR \d\b/, `mode "${mode}" must name the PR that brings it, not render blank`);
  }
});

test('#998 R998-2: no roadmap, decisions, anti-pattern or by-actor/history view identifier exists in the page', () => {
  for (const [name, text] of [['app.js', APP_JS], ['index.html', INDEX_HTML]]) {
    for (const forbidden of [/\broadmapview\b/i, /\bdecisionsview\b/i, /\badrs?\b/i, /anti-?pattern/i, /\bby-?actor\b/i, /\bhistoryview\b/i]) {
      assert.ok(!forbidden.test(text), `${name} matched ${forbidden} — those views are #882's, not this slice's`);
    }
  }
});

test('#998 R998-2: nav, modes and Governance are allowed labels — this PR draws them on purpose', () => {
  assert.match(INDEX_HTML, /<nav id="modes"/, 'the modes nav must exist: R998-2 adds it');
});

test('#881 R881-10 S1: nothing on the page reads a worktree path — the committed tier is the only tier this slice knows', () => {
  for (const endpoint of endpoints(APP_JS)) {
    assert.ok(!/worktree|uncommitted|working-tree/i.test(endpoint), `the page reaches "${endpoint}"`);
  }
  assert.ok(!/file:\/\//.test(APP_JS), 'the page reads nothing from the filesystem directly');
});

test('#998 R998-2: the shell mounts exactly five regions — status, modes, banners, canvas, drawer', () => {
  const ids = [...INDEX_HTML.matchAll(/id="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(ids, ['banners', 'canvas', 'drawer', 'modes', 'status']);
});
