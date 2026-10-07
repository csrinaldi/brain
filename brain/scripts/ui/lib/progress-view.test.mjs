// progress-view.test.mjs — #1199 R1199-3/R1199-4: one wording function for
// "how far along is this change", and every sentence it can say.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SOURCE, PROGRESS_WORDS, progressLabel } from './progress-view.mjs';

const OK = { ok: true, value: { done: 3, total: 5 } };
const fail = (code) => ({ ok: false, code, reason: `raw reason for ${code}` });

test('#1199 R1199-3: the sources are named in one place', () => {
  assert.deepEqual(SOURCE, { workingTree: 'working tree', head: 'at HEAD' });
});

test('#1199 R1199-3: the card and SDD wording is "tasks done / total · working tree"', () => {
  assert.equal(progressLabel(OK, SOURCE.workingTree, { prefix: 'tasks' }), 'tasks 3 / 5 · working tree');
});

test('#1199 R1199-4: the drawer wording is "done / total tasks done · at HEAD"', () => {
  assert.equal(progressLabel({ ok: true, value: { done: 2, total: 5 } }, SOURCE.head), '2 / 5 tasks done · at HEAD');
});

test('#1199 R1199-3: each failure code has its own sentence, with the prefix and the source', () => {
  assert.deepEqual(PROGRESS_WORDS, {
    missing: 'no tasks.md',
    unreadable: 'tasks.md could not be read',
    'no-items': 'tasks.md has no checklist items',
    truncated: 'tasks.md is truncated; no total is shown',
  });
  for (const [code, words] of Object.entries(PROGRESS_WORDS)) {
    assert.equal(progressLabel(fail(code), SOURCE.workingTree, { prefix: 'tasks' }), `tasks: ${words} · working tree`, code);
    assert.equal(progressLabel(fail(code), SOURCE.head), `${words} · at HEAD`, code);
  }
});

test('#1199 R1199-3: a failure never reads as 0/0, a percentage, or a number over a slash', () => {
  for (const code of Object.keys(PROGRESS_WORDS)) {
    const text = progressLabel(fail(code), SOURCE.workingTree, { prefix: 'tasks' });
    assert.doesNotMatch(text, /\d\s*\/|%/, code);
  }
});

test('#1199 R1199-3: an unknown code falls back to its own reason, and no progress at all says so', () => {
  assert.equal(progressLabel(fail('odd'), SOURCE.head), 'raw reason for odd · at HEAD');
  assert.match(progressLabel(null, SOURCE.workingTree, { prefix: 'tasks' }), /^tasks: no progress was read · working tree$/);
});
