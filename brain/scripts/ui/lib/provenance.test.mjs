// provenance.test.mjs — A3, a PROPERTY test, not a screenshot (D11): for a
// fixture change, every object `spec-cards.mjs`, `tasks-list.mjs` and
// `resume-view.mjs` emit carries a non-empty `source.path` or
// `source.url`. No DOM, no browser — composes this run's shapers only.
//
// Scope note: `change-route.mjs` (the Reviews tab's rows, and the "no
// change dir"/branch-resolution IO) ships in a later slice (this run is
// `ui/lib/**` only, per PR 3's split) — its objects are out of scope here
// and get their own property-test coverage when it lands. `blame.mjs`
// itself emits raw per-line attribution, not a drawer-visible object; its
// data is consumed BY `tasks-list.mjs`, whose items already carry `source`
// below, so it needs no separate provenance assertion.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSpecCards } from './spec-cards.mjs';
import { parseTasksList } from './tasks-list.mjs';
import { parseBlame } from './blame.mjs';
import { shapeResumeView } from './resume-view.mjs';

const SPEC_PATH = 'openspec/changes/issue-881-ui-server-canvas/spec.md';
const TASKS_PATH = 'openspec/changes/issue-881-ui-server-canvas/tasks.md';
const BRANCH = 'feat/issue-881-slice-3-lib';

function hasSource(obj) {
  const src = obj.source;
  if (!src || typeof src !== 'object') return false;
  return (typeof src.path === 'string' && src.path.length > 0) || (typeof src.url === 'string' && src.url.length > 0);
}

function walkAndCheck(obj, assertPath) {
  assert.ok(hasSource(obj), `${assertPath}: no non-empty source.path or source.url — ${JSON.stringify(obj)}`);
}

test('#881: every spec-cards.mjs card and scenario carries a non-empty source', () => {
  const specText = [
    '### R881-6: every open issue is a node, coloured by its computed state',
    '#### Scenario: no node is filtered away',
    '- **WHEN** the graph has 90 open issues',
    '- **THEN** the canvas renders 90 nodes',
    '### R881-7: the layout is deterministic and cycle-tolerant',
    '#### Scenario: a cycle does not crash or hide nodes',
    '- **WHEN** the edge set contains a cycle',
    '- **THEN** the layout returns a coordinate for every node',
  ].join('\n');
  const { ok, value: cards } = parseSpecCards({ text: specText, path: SPEC_PATH });
  assert.equal(ok, true);
  assert.ok(cards.length > 0);
  for (const card of cards) {
    walkAndCheck(card, `card ${card.id}`);
    for (const scenario of card.scenarios) walkAndCheck(scenario, `card ${card.id} scenario "${scenario.name}"`);
  }
});

test('#881: every tasks-list.mjs item carries a non-empty source, with or without blame attribution', () => {
  const tasksText = ['## Phase 1', '- [x] ship layout.mjs', '- [ ] ship change-route.mjs'].join('\n');
  const blame = parseBlame({
    text: [
      'abc1234abc1234abc1234abc1234abc1234abc1 1 2 1',
      'author csrinaldi',
      'author-mail <c@example.com>',
      'author-time 1694700000',
      'author-tz +0000',
      'committer csrinaldi',
      'committer-mail <c@example.com>',
      'committer-time 1694700000',
      'committer-tz +0000',
      'summary ship layout.mjs',
      'filename tasks.md',
      '\t- [x] ship layout.mjs',
    ].join('\n'),
  });
  assert.equal(blame.ok, true);
  const attribution = Object.entries(blame.value).map(([line, a]) => ({ line: Number(line), actor: a.author, ts: a.authorTime }));
  const { ok, value: items } = parseTasksList({ text: tasksText, path: TASKS_PATH, attribution });
  assert.equal(ok, true);
  assert.ok(items.length > 0);
  for (const item of items) walkAndCheck(item, `task item "${item.text}"`);
});

test('#881: every resume-view.mjs field carries a non-empty source, including a field that failed to shape', () => {
  const result = shapeResumeView({ frontmatter: { current_slice: 3, blockers: [] }, branch: BRANCH }); // next_action deliberately missing
  for (const [key, field] of Object.entries(result)) walkAndCheck(field, `resume field "${key}"`);
});
