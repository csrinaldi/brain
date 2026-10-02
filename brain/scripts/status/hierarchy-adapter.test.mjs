// hierarchy-adapter.test.mjs — #1199 R1199-5/D59: the ADR-0039 resolver contract,
// computed over today's `kind` and `parent`. Hand-built nodes where one field is
// the point, `buildGraph` where the divergence mapping must meet the real thing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { hierarchyFromGraph } from './hierarchy-adapter.mjs';
import { buildGraph } from './epic-graph.mjs';

const node = (number, over = {}) => ({ number, title: `t${number}`, state: 'open', ok: true, kind: null, parent: null, tracker: null, ...over });
const KEYS = ['children', 'divergences', 'level', 'levelSource', 'milestone', 'parent', 'state', 'tracker'];
const fence = (lines) => ['```brain-graph/1', ...lines, '```'].join('\n');

test('#1199 R1199-5: every entry has exactly the eight contract keys, in a Map keyed by number', () => {
  const { issues, divergences } = hierarchyFromGraph({ nodes: [node(2), node(1, { kind: 'epic' })], declarationDivergences: [], closed: null });
  assert.ok(issues instanceof Map);
  assert.deepEqual([...issues.keys()], [1, 2], 'ascending');
  for (const e of issues.values()) assert.deepEqual(Object.keys(e).sort(), KEYS);
  assert.deepEqual(divergences, []);
});

test('#1199 R1199-5/R9: children are computed once, closed and nested ones included, ascending', () => {
  const nodes = [node(878, { kind: 'epic' }), node(900, { parent: 878 }), node(884, { kind: 'epic', parent: 878 })];
  const closed = { nodes: [node(881, { state: 'closed', parent: 878 }), node(880, { state: 'closed', parent: 878 })], declarationDivergences: [], unresolved: [] };
  const { issues } = hierarchyFromGraph({ nodes, declarationDivergences: [], closed });
  assert.deepEqual(issues.get(878).children, [880, 881, 884, 900]);
  assert.deepEqual(issues.get(884).children, []);
  assert.equal(issues.get(880).state, 'closed');
  assert.equal(issues.get(900).state, 'open');
});

test('#1199 R1199-5: levelSource is block for a declared epic, default for a ticket, null for an unreadable node', () => {
  const nodes = [node(1, { kind: 'epic' }), node(2, { parent: 1 }), node(3, { ok: false, kind: null })];
  const { issues } = hierarchyFromGraph({ nodes, declarationDivergences: [], closed: null });
  assert.deepEqual([1, 2, 3].map((n) => [issues.get(n).level, issues.get(n).levelSource]), [['epic', 'block'], ['ticket', 'default'], [null, null]]);
});

test('#1199 R1199-5: a state the port did not know stays null, never open or closed', () => {
  const { issues } = hierarchyFromGraph({ nodes: [node(1, { state: null }), node(2, { state: 'weird' })], declarationDivergences: [], closed: null });
  assert.equal(issues.get(1).state, null);
  assert.equal(issues.get(2).state, null);
});

test('#1199 R1199-5: no closed data means no closed entry and open-only children', () => {
  const { issues } = hierarchyFromGraph({ nodes: [node(1, { kind: 'epic' }), node(2, { parent: 1 })], declarationDivergences: [], closed: null });
  assert.equal([...issues.values()].filter((e) => e.state === 'closed').length, 0);
  assert.deepEqual(issues.get(1).children, [2]);
});

test('#1199 R1199-5: an unresolved closed row has no entry, and tracker is copied while milestone is always null', () => {
  const closed = { nodes: [node(5, { state: 'closed', tracker: 'feature/x' })], declarationDivergences: [], unresolved: [{ number: 6, reason: 'the forge list carried no body' }] };
  const { issues } = hierarchyFromGraph({ nodes: [], declarationDivergences: [], closed });
  assert.equal(issues.has(6), false);
  assert.equal(issues.get(5).tracker, 'feature/x');
  assert.equal(issues.get(5).milestone, null);
});

test('#1199 R1199-5: parent-not-epic goes to the top level once and is not repeated on an entry', () => {
  const g = buildGraph([
    { number: 12, title: 'not an epic', labels: [], state: 'open', body: fence(['track: UI']) },
    { number: 20, title: 'slice', labels: [], state: 'open', body: fence(['track: UI', 'parent: 12']) },
  ]);
  const { issues, divergences } = hierarchyFromGraph({ nodes: g.nodes.map((n) => ({ ...n, ok: true })), declarationDivergences: g.declarationDivergences, closed: null });
  assert.deepEqual(divergences, [{ issues: [20, 12], field: 'parent', source: 'graph', expected: 'parent-not-epic', found: 12 }]);
  for (const e of issues.values()) assert.deepEqual(e.divergences, []);
});

test('#1199 R1199-5: a per-issue declaration divergence lands on its own entry, prose for an ambiguous parent', () => {
  const dv = [
    { number: 3, key: 'parent', value: '1, 2', reason: 'parent-ambiguous' },
    { number: 4, key: 'tracker', value: 'a..b', reason: 'tracker-grammar' },
  ];
  const { issues, divergences } = hierarchyFromGraph({ nodes: [node(3), node(4)], declarationDivergences: dv, closed: null });
  assert.deepEqual(issues.get(3).divergences, [{ source: 'prose', field: 'parent', expected: 'parent-ambiguous', found: '1, 2' }]);
  assert.deepEqual(issues.get(4).divergences, [{ source: 'block', field: 'tracker', expected: 'tracker-grammar', found: 'a..b' }]);
  assert.deepEqual(divergences, []);
});

test('#1199 R1199-5: closed divergences are carried too', () => {
  const closed = { nodes: [node(7, { state: 'closed' })], declarationDivergences: [{ number: 7, key: 'tracker', value: 'x', reason: 'tracker-without-kind-epic' }], unresolved: [] };
  const { issues } = hierarchyFromGraph({ nodes: [], declarationDivergences: [], closed });
  assert.equal(issues.get(7).divergences.length, 1);
});

test('#1199 R1199-5: the adapter reads neither track nor files nor edges, and ticket-hierarchy.mjs does not exist (R5)', () => {
  const traps = { get track() { throw new Error('track read'); }, get files() { throw new Error('files read'); }, get blockedBy() { throw new Error('blockedBy read'); } };
  const n = Object.defineProperties(node(1), Object.getOwnPropertyDescriptors(traps));
  assert.doesNotThrow(() => hierarchyFromGraph({ nodes: [n], declarationDivergences: [], closed: null }));
  assert.equal(existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'ticket-hierarchy.mjs')), false);
});
