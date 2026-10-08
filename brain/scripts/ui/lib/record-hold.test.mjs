// record-hold.test.mjs — which opened records the page keeps holding (#1377, D160/D173).
// Two surfaces open records (the Memory ledger and the drawer's Records tab) and share
// one read cache; an id is held while ANY surface has it open and can still show it.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { staleIds, unheldIds } from './record-hold.mjs';

test('#1377 R1377-2: an open id that is no longer visible is stale; a visible one is not', () => {
  assert.deepEqual(staleIds(new Set(['a', 'b', 'c']), new Set(['b'])), ['a', 'c']);
  assert.deepEqual(staleIds(new Set(['a']), new Set(['a', 'z'])), []);
  assert.deepEqual(staleIds(new Set(), new Set(['a'])), []);
  assert.deepEqual(staleIds(new Set(['a']), new Set()), ['a'], 'nothing visible: everything open is stale');
});

test('#1377 R1377-2: a held read is released only when no surface has the id open', () => {
  const ledger = new Set(['a']);
  const drawer = new Set(['b']);
  assert.deepEqual(unheldIds(['a', 'b', 'c'], ledger, drawer), ['c'], 'a is open in the ledger, b in the drawer');
  assert.deepEqual(unheldIds(['a', 'b'], new Set(), drawer), ['a']);
  assert.deepEqual(unheldIds([], ledger, drawer), []);
});
