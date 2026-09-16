// spec-cards.test.mjs — R881-8 Spec tab, D11. `spec.md`'s
// `### R<issue>-<n>: <title>` / `#### Scenario: <name>` /
// `- **WHEN** … **THEN** …` grammar, parsed deterministically into
// requirement/scenario cards, each carrying `{path, line}`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseSpecCards } from './spec-cards.mjs';

const PATH = 'openspec/changes/issue-881-ui-server-canvas/spec.md';

test('#881: a fixture spec.md parses into requirement cards with their scenarios and line numbers', () => {
  const text = [
    '### R881-6: every open issue is a node, coloured by its computed state',
    '',
    '#### Scenario: no node is filtered away',
    '- **WHEN** the graph has 90 open issues, some undeclared, some unreadable',
    '- **THEN** the canvas renders 90 nodes, one per issue, none omitted',
    '',
    '#### Scenario: blocked overrides state colour',
    '- **WHEN** a node has an open blockedBy',
    '- **THEN** the node renders with the blocked mark',
  ].join('\n');
  const { ok, value: cards } = parseSpecCards({ text, path: PATH });
  assert.equal(ok, true);
  assert.equal(cards.length, 1);
  const [card] = cards;
  assert.equal(card.id, 'R881-6');
  assert.equal(card.title, 'every open issue is a node, coloured by its computed state');
  assert.equal(card.line, 1);
  assert.deepEqual(card.source, { path: PATH, line: 1 });
  assert.equal(card.scenarios.length, 2);
  assert.equal(card.scenarios[0].name, 'no node is filtered away');
  assert.equal(card.scenarios[0].when, 'the graph has 90 open issues, some undeclared, some unreadable');
  assert.equal(card.scenarios[0].then, 'the canvas renders 90 nodes, one per issue, none omitted');
  assert.equal(card.scenarios[0].complete, true);
  assert.deepEqual(card.scenarios[0].source, { path: PATH, line: 3 });
});

test('#881: an empty spec.md parses to zero cards — a fact, not a failure', () => {
  const { ok, value: cards } = parseSpecCards({ text: '', path: PATH });
  assert.equal(ok, true);
  assert.deepEqual(cards, []);
});

test('#881: a heading with no scenarios yet still yields a card, with an empty scenarios array', () => {
  const text = '### R881-9: degradation is stated, never silent';
  const { ok, value: cards } = parseSpecCards({ text, path: PATH });
  assert.equal(ok, true);
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0].scenarios, []);
});

test('#881: a scenario with WHEN but no THEN is kept, marked incomplete, never dropped or thrown', () => {
  const text = [
    '### R881-1: something',
    '#### Scenario: half-written',
    '- **WHEN** a thing happens',
  ].join('\n');
  assert.doesNotThrow(() => parseSpecCards({ text, path: PATH }));
  const { value: cards } = parseSpecCards({ text, path: PATH });
  assert.equal(cards[0].scenarios.length, 1);
  assert.equal(cards[0].scenarios[0].when, 'a thing happens');
  assert.equal(cards[0].scenarios[0].then, null);
  assert.equal(cards[0].scenarios[0].complete, false);
});

test('#881: CRLF line endings parse the same as LF', () => {
  const lf = ['### R1-1: a', '#### Scenario: s', '- **WHEN** w', '- **THEN** t'].join('\n');
  const crlf = lf.replaceAll('\n', '\r\n');
  const { value: fromLf } = parseSpecCards({ text: lf, path: PATH });
  const { value: fromCrlf } = parseSpecCards({ text: crlf, path: PATH });
  assert.deepEqual(fromLf, fromCrlf);
});

test('#881: no text given is a said failure, never an empty array read as "no requirements"', () => {
  const result = parseSpecCards({ text: null, path: PATH });
  assert.equal(result.ok, false);
  assert.equal(typeof result.reason, 'string');
  assert.ok(result.reason.length > 0);
});
