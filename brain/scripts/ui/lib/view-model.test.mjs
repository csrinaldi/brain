// view-model.test.mjs — the four-mode view model (#998 R998-2). Pure,
// imported by the browser and by node:test (D9): no DOM, no clock.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, MODE_IDS, PLACEHOLDERS, initialView, switchMode, nextMode, keyAction } from './view-model.mjs';

test('#998 R998-2: the four modes, in a fixed order, each with a non-empty label', () => {
  assert.deepEqual(MODE_IDS, ['map', 'sdd', 'reviews', 'governance']);
  for (const mode of MODES) {
    assert.equal(typeof mode.id, 'string');
    assert.equal(typeof mode.label, 'string');
    assert.ok(mode.label.length > 0, `mode "${mode.id}" has no label`);
  }
});

test('#998 R998-2: only map has content in this PR; the other three name the PR that brings them', () => {
  assert.equal(PLACEHOLDERS.map, null, 'map draws the canvas + drawer, not a placeholder');
  assert.match(PLACEHOLDERS.sdd, /PR 4/);
  assert.match(PLACEHOLDERS.reviews, /PR 5/);
  assert.match(PLACEHOLDERS.governance, /PR 7/);
});

test('#998 R998-2: initialView starts on map', () => {
  assert.equal(initialView(), 'map');
});

test('#998 R998-2: Tab cycles the four modes in order and wraps back to map', () => {
  let view = initialView();
  const seen = [view];
  for (let i = 0; i < 4; i += 1) {
    view = keyAction(view, 'Tab', { nodes: [], selected: null }).mode;
    seen.push(view);
  }
  assert.deepEqual(seen, ['map', 'sdd', 'reviews', 'governance', 'map']);
});

test('#998 R998-2: switchMode validates the target mode; nextMode validates the current view', () => {
  assert.equal(switchMode('map', 'reviews'), 'reviews');
  assert.throws(() => switchMode('map', 'bogus'), /unknown mode/);
  assert.throws(() => nextMode('bogus'), /unknown mode/);
});

// ── J/K traversal fixture matrix: 0 nodes, 1 node, many; selected at the
// first, at the last, at none ──────────────────────────────────────────────

test('#998 R998-2: j/k on an empty canvas selects nothing', () => {
  assert.deepEqual(keyAction('map', 'j', { nodes: [], selected: null }), { type: 'none' });
  assert.deepEqual(keyAction('map', 'k', { nodes: [], selected: null }), { type: 'none' });
});

test('#998 R998-2: j/k on a single node selects it from no selection, and wraps to itself at either end', () => {
  const nodes = [{ number: 5, x: 0, y: 0 }];
  assert.deepEqual(keyAction('map', 'j', { nodes, selected: null }), { type: 'select', issue: 5 });
  assert.deepEqual(keyAction('map', 'k', { nodes, selected: null }), { type: 'select', issue: 5 });
  assert.deepEqual(keyAction('map', 'j', { nodes, selected: 5 }), { type: 'select', issue: 5 });
  assert.deepEqual(keyAction('map', 'k', { nodes, selected: 5 }), { type: 'select', issue: 5 });
});

test('#998 R998-2: j/k traverse many nodes in reading order (top-to-bottom, left-to-right) and wrap at both ends', () => {
  const nodes = [
    { number: 3, x: 100, y: 0 },
    { number: 1, x: 0, y: 0 },
    { number: 2, x: 0, y: 50 },
  ];
  // reading order: #1 (y0,x0), #3 (y0,x100), #2 (y50,x0)
  assert.deepEqual(keyAction('map', 'j', { nodes, selected: null }), { type: 'select', issue: 1 }, 'j with no selection starts at the first');
  assert.deepEqual(keyAction('map', 'k', { nodes, selected: null }), { type: 'select', issue: 2 }, 'k with no selection starts at the last');
  assert.deepEqual(keyAction('map', 'j', { nodes, selected: 1 }), { type: 'select', issue: 3 });
  assert.deepEqual(keyAction('map', 'j', { nodes, selected: 3 }), { type: 'select', issue: 2 });
  // at the last node: j wraps to the first instead of stopping silently
  assert.deepEqual(keyAction('map', 'j', { nodes, selected: 2 }), { type: 'select', issue: 1 });
  // at the first node: k wraps to the last instead of stopping silently
  assert.deepEqual(keyAction('map', 'k', { nodes, selected: 1 }), { type: 'select', issue: 2 });
});

test('#998 R998-2: Escape closes the door only when something is selected', () => {
  assert.deepEqual(keyAction('map', 'Escape', { nodes: [], selected: null }), { type: 'none' });
  assert.deepEqual(keyAction('map', 'Escape', { nodes: [], selected: 7 }), { type: 'close' });
});

test('#998 R998-2: an unknown key is a no-op', () => {
  assert.deepEqual(keyAction('map', 'z', { nodes: [], selected: null }), { type: 'none' });
});
