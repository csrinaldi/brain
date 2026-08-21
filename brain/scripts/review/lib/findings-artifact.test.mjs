// findings-artifact.test.mjs — issue #682 slice 3, REQ-S3-3 / REQ-S3-4 / REQ-S3-6.
//
// The axis these tests vary is WHICH STATE THE CALLER ENDS UP IN. A reader that
// answers "nothing" for both "the file was not there" and "the engine found
// nothing" hands `cli.mjs` one answer for two facts, and the verdict then either
// declares a control it never applied or hides one it did. That is #552's fold,
// moved one layer up into the file contract.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readFindingsArtifact, ARTIFACT_TAG, CARRIED_FIELDS } from './findings-artifact.mjs';

const block = (json) => `# Cold review\n\n\`\`\`${ARTIFACT_TAG}\n${json}\n\`\`\`\n`;
const finding = (over = {}) => ({
  id: 'inferential:J1', severity: 'blocker', evidence: 'the semantics are inverted',
  cites: 'reviewer-protocol.md §6.1', file: 'a.mjs', line: 42, ...over,
});

// ── the four states, and the three that are FAILURES ─────────────────────────

test('#682 S3: a missing or empty artifact is a FAILURE, not an empty result', () => {
  for (const input of [undefined, null, '', '   \n\n  ']) {
    const r = readFindingsArtifact(input);
    assert.equal(r.ok, false, `${JSON.stringify(input)} must fail`);
    assert.match(r.reason, /missing or empty/);
  }
});

test('#682 S3: an artifact with no block of the tag is a FAILURE', () => {
  const r = readFindingsArtifact('# Cold review\n\nProse, and a fence of another kind:\n\n```js\nconst a = 1;\n```\n');
  assert.equal(r.ok, false);
  assert.match(r.reason, new RegExp(`no .*${ARTIFACT_TAG.replace('/', '\\/')} block`));
});

test('#682 S3: unparseable or wrongly-shaped JSON is a FAILURE, never an empty list', () => {
  const cases = [
    ['not JSON at all', block('{ this is not json }')],
    ['a JSON scalar', block('"a string"')],
    ['an object with no findings array', block('{"summary": "looks fine"}')],
    ['a list whose entries are not objects', block('["just a string"]')],
    ['a list carrying null', block('[null]')],
  ];
  for (const [label, text] of cases) {
    const r = readFindingsArtifact(text);
    assert.equal(r.ok, false, `${label} must fail`);
    assert.ok(r.reason, `${label} must say why`);
  }
});

test('#682 S3: two blocks of the tag REFUSE rather than pick one', () => {
  const two = block('[]') + '\n' + block(JSON.stringify([finding()]));
  const r = readFindingsArtifact(two);
  assert.equal(r.ok, false);
  assert.match(r.reason, /expected exactly 1/);
  // Picking the first would have silently dropped a blocker — the exact shape
  // this refusal exists to prevent.
});

test('#682 S3: an EMPTY findings list is a SUCCESS — the engine ran and found nothing', () => {
  for (const empty of ['[]', '{"findings": []}']) {
    const r = readFindingsArtifact(block(empty));
    assert.equal(r.ok, true, `${empty} must succeed`);
    assert.deepEqual(r.findings, []);
  }
});

test('#682 S3: "found nothing" and "could not read" are DISTINGUISHABLE by the caller', () => {
  // The pin. A reader that collapsed these would let cli.mjs render a verdict
  // declaring `inferential` applied over a file it never read.
  const ranAndFoundNothing = readFindingsArtifact(block('[]'));
  const couldNotRead = readFindingsArtifact(block('{ nope }'));

  assert.equal(ranAndFoundNothing.ok, true);
  assert.equal(couldNotRead.ok, false);
  assert.notDeepEqual(ranAndFoundNothing, couldNotRead,
    'the two states must not be the same object — one is a result, the other is a refusal');
  assert.equal(couldNotRead.findings, undefined,
    'a failure must carry no findings key at all: an empty array there is the fold itself');
});

// ── the family rule, which is a live hazard and not a style ──────────────────

test('#682 S3: a `protocol: brain-review/N` line REFUSES, and says what it would corrupt', () => {
  const posted = '```yaml\nprotocol: brain-review/2\nverdict: APPROVE\n```\n' + block('[]');
  const r = readFindingsArtifact(posted);
  assert.equal(r.ok, false);
  assert.match(r.reason, /rev and the anti-loop lock/);
  // Refused even though a well-formed block of the tag is present further down:
  // the hazard is the file carrying the posted shape at all, not which block wins.
});

// ── REQ-682-6 — the fields that cross are the fields that render ─────────────

test('#682 S3: entries are projected onto CARRIED_FIELDS at the boundary', () => {
  const smuggled = finding({ deliberation_notes: 'my private reasoning', title: 'a framing' });
  const [out] = readFindingsArtifact(block(JSON.stringify([smuggled]))).findings;

  assert.equal(out.deliberation_notes, undefined, 'a field outside the set must not cross');
  assert.equal(out.title, undefined, 'title was removed from the set by a cold review — it must stay out');
  for (const k of Object.keys(out)) {
    assert.ok(CARRIED_FIELDS.includes(k), `"${k}" crossed and is not a carried field`);
  }
  assert.equal(out.id, smuggled.id, 'and the carried fields DO cross — the projection is not a delete-all');
});

// ── why JSON, pinned as behaviour rather than left in a comment ──────────────

test('#682 S3: multi-line evidence survives the round trip', () => {
  const long = 'I ran:\n\n    npm test\n\nand it printed 4149.';
  const [out] = readFindingsArtifact(block(JSON.stringify([finding({ evidence: long })]))).findings;
  assert.equal(out.evidence, long, 'evidence in a real cold review is paragraphs — it may not be truncated');
});

test('#682 S3: the payload is read at ANY indentation — the reason it is not YAML', () => {
  // Measured on the verdict's own list reader: 2-space indent → 1 entry,
  // 0-indent and 4-space → 0 entries, silently. A finding must never be
  // reachable-or-not by a whitespace choice, least of all in a file a model wrote.
  const entries = JSON.stringify([finding()]);
  for (const indent of ['', '  ', '    ', '\t']) {
    const json = entries.split('\n').map((l) => indent + l).join('\n');
    const r = readFindingsArtifact(block(json));
    assert.equal(r.ok, true, `indent ${JSON.stringify(indent)} must parse`);
    assert.equal(r.findings.length, 1, `indent ${JSON.stringify(indent)} must yield the finding`);
  }
});

test('#682 S3: `file` and `line` cross — they are what becomes an inline comment', () => {
  const [out] = readFindingsArtifact(block(JSON.stringify([finding()]))).findings;
  assert.equal(out.file, 'a.mjs');
  assert.equal(out.line, 42);
  // deriveInlineComments requires BOTH and a positive integer line; without them
  // a reasoned finding reaches the summary block and never the changed line.
});
