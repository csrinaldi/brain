// synthesizer.test.mjs — Unit tests for Intelligent Context Synthesizer (REQ-CTX-1, REQ-CTX-2, REQ-CTX-3).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  synthesizeContext,
  matchMemories,
  deriveTerms,
  recordTitle,
  FAILSAFE_MODES,
} from './synthesizer.mjs';

// A store fixture, injected — never this repository's real `.memory/`. The
// memory half is the half that regressed by being unmeasured, so its tests
// must not depend on what happens to be committed today.
const RECORDS = [
  { id: 'rec-aaaa000000000001', ts: '2026-08-01T10:00:00Z', type: 'decision', project: 'brain', issue: 519,
    content: '**Memory writer went silent for six days**\n\nbody' },
  { id: 'rec-aaaa000000000002', ts: '2026-08-09T10:00:00Z', type: 'session_summary', project: 'brain', issue: 519,
    content: '**Closed the silence, not the gate**\n\nbody' },
  { id: 'rec-aaaa000000000003', ts: '2026-07-02T10:00:00Z', type: 'pattern', project: 'brain',
    content: '**Governance tiers resolve the diff budget**\n\nbody' },
  { id: 'rec-aaaa000000000004', ts: '2026-06-02T10:00:00Z', type: 'discovery', project: 'brain',
    content: 'no bold title here, just a first line about provider parity' },
  { id: 'rec-aaaa000000000005', ts: '2026-08-20T10:00:00Z', type: 'bugfix', project: 'brain',
    content: '**Unrelated: tooltip alignment**\n\nthe body mentions governance, which must NOT match' },
];

const stubReader = (records) => () => ({ records, duplicates: { ids: 0, lines: 0, divergent: 0, groups: [] } });

// ── deriveTerms ─────────────────────────────────────────────────────────────

test('deriveTerms: splits change-dir names on every non-alphanumeric boundary', () => {
  assert.deepEqual(
    deriveTerms(['issue-519-memory-writer-silent']).sort(),
    ['memory', 'silent', 'writer'],
  );
});

test('deriveTerms: drops the tokens that appear in every path in the repo', () => {
  const terms = deriveTerms(['brain/scripts/governance/run-check.test.mjs']);
  assert.ok(terms.includes('governance'), 'the discriminating token survives');
  for (const noise of ['brain', 'scripts', 'test']) {
    assert.ok(!terms.includes(noise), `'${noise}' carries no signal and must be dropped`);
  }
});

test('deriveTerms: never throws on non-string input', () => {
  assert.deepEqual(deriveTerms([null, undefined, 42, 'memory-format']), ['memory', 'format']);
  assert.deepEqual(deriveTerms(), []);
});

// ── recordTitle ─────────────────────────────────────────────────────────────

test('recordTitle: reads the folded **title** buildRecord writes', () => {
  assert.equal(recordTitle(RECORDS[0]), 'Memory writer went silent for six days');
});

test('recordTitle: falls back to the first non-empty line when no title was folded', () => {
  assert.equal(recordTitle(RECORDS[3]), 'no bold title here, just a first line about provider parity');
});

test('recordTitle: empty rather than throwing on a record with no content', () => {
  assert.equal(recordTitle({}), '');
  assert.equal(recordTitle(null), '');
});

// ── matchMemories ───────────────────────────────────────────────────────────

test('matchMemories: an issue match is exact and is reported as such', () => {
  const hits = matchMemories({ records: RECORDS, issue: 519, terms: [] });
  assert.deepEqual(hits.map((h) => h.id), ['rec-aaaa000000000002', 'rec-aaaa000000000001']);
  assert.ok(hits.every((h) => h.reason === 'issue'));
  assert.equal(hits[0].issue, 519, 'newest first within the rule');
});

test('matchMemories: terms match the TITLE, never the body', () => {
  const hits = matchMemories({ records: RECORDS, issue: null, terms: ['governance'] });
  assert.deepEqual(hits.map((h) => h.id), ['rec-aaaa000000000003']);
  assert.equal(hits[0].reason, 'term');
  // rec-…005 has 'governance' in its BODY. Matching bodies returns most of a
  // real store for a common word, which is how a reading list becomes noise.
});

test('matchMemories: an issue hit is never also counted as a term hit', () => {
  const hits = matchMemories({ records: RECORDS, issue: 519, terms: ['memory', 'silent'] });
  const ids = hits.filter((h) => h.id === 'rec-aaaa000000000001');
  assert.equal(ids.length, 1, 'no record appears twice');
  assert.equal(ids[0].reason, 'issue', 'the exact rule wins over the fuzzy one');
});

test('matchMemories: issue hits are never crowded out by term hits under the cap', () => {
  const hits = matchMemories({ records: RECORDS, issue: 519, terms: ['governance'], limit: 2 });
  assert.equal(hits.length, 2);
  assert.ok(hits.every((h) => h.reason === 'issue'), 'the cap trims term hits first');
});

test('matchMemories: a string issue in a pre-gate record still matches its number', () => {
  const legacy = [{ ...RECORDS[0], id: 'rec-bbbb000000000001', issue: '519' }];
  const hits = matchMemories({ records: legacy, issue: 519, terms: [] });
  assert.equal(hits.length, 1, 'records written before the write gate carry a string issue');
  assert.equal(hits[0].issue, 519, 'reported as the number it was compared as');
});

test('matchMemories: records with no id are dropped — an entry nobody can open is not an entry', () => {
  const hits = matchMemories({ records: [{ ts: '2026-08-01T10:00:00Z', issue: 519, content: 'x' }], issue: 519 });
  assert.deepEqual(hits, []);
});

test('matchMemories: no issue and no terms matches nothing (never "everything")', () => {
  assert.deepEqual(matchMemories({ records: RECORDS }), []);
  assert.deepEqual(matchMemories({}), []);
});

test('matchMemories: entries carry the record file path so the reader can open them', () => {
  const hits = matchMemories({ records: RECORDS, issue: 519, terms: [] });
  assert.equal(hits[0].file, '2026-08-rec-aaaa000000000002.jsonl');
});

// ── synthesizeContext ───────────────────────────────────────────────────────

test('synthesizeContext: always includes core methodology baseline floor', async () => {
  const result = await synthesizeContext({ touchedFiles: [], _readRecords: stubReader([]) });
  assert.ok(result.coreFloor.length > 0, 'Core floor must contain methodology docs');
  assert.ok(result.markdown.includes('agent-authorities') || result.markdown.includes('Core Methodology'), 'Markdown output must contain core baseline');
});

test('synthesizeContext: matches ADRs and memory records based on touched files', async () => {
  const result = await synthesizeContext({
    touchedFiles: ['brain/scripts/governance/workflow.mjs', 'brain/scripts/vcs/provider.mjs'],
    _readRecords: stubReader(RECORDS),
  });

  assert.ok(result.matchedDecisions.some(d => d.includes('governance') || d.includes('vcs')), 'Matches governance and VCS ADRs');
  // The half this test has always named and never asserted: before #267's fix,
  // `matchedMemories` was declared, counted and returned — and never pushed to.
  assert.ok(result.matchedMemories.length > 0, 'and matches memory records, which is what the title claims');
  assert.ok(result.markdown.includes('Working Memory'), 'the reading list reaches the markdown');
});

test('synthesizeContext: empty file matches trigger CORE_FLOOR failsafe mode', async () => {
  const result = await synthesizeContext({
    touchedFiles: ['some/unknown/untracked-thing.xyz'],
    _readRecords: stubReader(RECORDS),
  });
  assert.equal(result.failsafeActivated, true);
  assert.equal(result.failsafeMode, FAILSAFE_MODES.CORE_FLOOR);
  assert.ok(result.markdown.includes('Core Baseline Floor'), 'Output mentions failsafe baseline floor activation');
});

test('synthesizeContext: the failsafe now counts memories too, not only decisions', async () => {
  // A term that matches no ADR filename but does match a record title. Before
  // the fix this was `failsafeActivated: true` — "zero targeted matches" while
  // the store held a direct hit nobody had asked it for.
  const result = await synthesizeContext({
    touchedFiles: ['some/path/tooltip-alignment.mjs'],
    _readRecords: stubReader(RECORDS),
  });
  assert.equal(result.matchedDecisions.length, 0, 'no ADR carries this term');
  assert.equal(result.matchedMemories.length, 1, 'but a record does');
  assert.equal(result.failsafeActivated, false, 'so the floor is not a fallback here');
});

test('synthesizeContext: an unreadable store is reported, never rendered as an empty history', async () => {
  const result = await synthesizeContext({
    touchedFiles: ['brain/scripts/memory/cli.mjs'],
    _readRecords: () => { throw new Error('store on fire'); },
  });
  assert.equal(result.recordsScanned, 0);
  assert.deepEqual(result.matchedMemories, []);
  assert.ok(
    result.markdown.includes('unread store'),
    'an empty list over an unread store must not read like an empty history',
  );
});

test('synthesizeContext: never names a backend — the reading list is backend-agnostic', async () => {
  const result = await synthesizeContext({
    touchedFiles: ['issue-519-memory-writer-silent'],
    issue: 519,
    _readRecords: stubReader(RECORDS),
  });
  assert.doesNotMatch(result.markdown, /engram|MEMORY_BACKEND|postgres/i);
  assert.equal(result.matchedMemories.length, 2, 'and it still resolves the issue-scoped records');
});
