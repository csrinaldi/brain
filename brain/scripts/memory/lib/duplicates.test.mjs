// duplicates.test.mjs — issue #574. The accounting helpers and the operator
// report. Pure functions: no filesystem, no store.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  emptyDuplicates,
  summarizeDuplicates,
  normalizeDuplicates,
  formatDuplicateReport,
} from './duplicates.mjs';

test('emptyDuplicates: the zero accounting', () => {
  assert.deepEqual(emptyDuplicates(), { ids: 0, lines: 0, groups: [] });
});

test('summarizeDuplicates: an id seen once is not a duplicate', () => {
  const summary = summarizeDuplicates(new Map([['rec-a', ['2026-07.jsonl:1']]]));
  assert.deepEqual(summary, { ids: 0, lines: 0, groups: [] });
});

test('summarizeDuplicates: `lines` counts EXCESS lines, not occurrences', () => {
  const summary = summarizeDuplicates(new Map([
    ['rec-b', ['f:1', 'f:2', 'f:3']],   // 3 lines, 1 record → 2 excess
    ['rec-a', ['f:4', 'f:5']],          // 2 lines, 1 record → 1 excess
    ['rec-c', ['f:6']],
  ]));
  assert.equal(summary.ids, 2);
  assert.equal(summary.lines, 3);
  assert.deepEqual(summary.groups.map((g) => g.id), ['rec-a', 'rec-b'], 'groups are sorted by id');
});

test('summarizeDuplicates: reproduces the measurement that opened #574', () => {
  // The real shape of `main` at the time of writing: 2177 physical lines, 2038
  // unique ids. The 49 repeated ids carry these occurrence counts —
  // 15 ids appear twice, 16 three times, 2 four times, 8 five times, 1 six
  // times, 7 eight times — which is exactly the 139-line excess the ticket
  // measured. Pinned as a histogram so the arithmetic connecting "49 ids" to
  // "139 lines" is checkable rather than asserted.
  const histogram = { 2: 15, 3: 16, 4: 2, 5: 8, 6: 1, 8: 7 };
  const occurrences = new Map();
  let n = 0;
  for (const [times, ids] of Object.entries(histogram)) {
    for (let i = 0; i < ids; i++) {
      occurrences.set(`rec-${String(n++).padStart(16, '0')}`, Array.from({ length: Number(times) }, (_, k) => `f:${k}`));
    }
  }
  // …plus the 1989 ids that appear exactly once and are therefore not duplicates.
  for (let i = 0; i < 1989; i++) occurrences.set(`rec-solo-${i}`, ['f:1']);

  const summary = summarizeDuplicates(occurrences);

  assert.equal(occurrences.size, 2038, 'unique ids');
  assert.equal(summary.ids, 49, 'repeated ids');
  assert.equal(summary.lines, 139, 'excess physical lines — the amount the index is shorter than the store');
});

test('normalizeDuplicates: a seam that returns no accounting reports zero, never crashes', () => {
  assert.deepEqual(normalizeDuplicates(undefined), { ids: 0, lines: 0, groups: [] });
  assert.deepEqual(normalizeDuplicates(null), { ids: 0, lines: 0, groups: [] });
  assert.deepEqual(normalizeDuplicates({}), { ids: 0, lines: 0, groups: [] });
});

test('normalizeDuplicates: derives the counts from groups when only groups are given', () => {
  const normalized = normalizeDuplicates({ groups: [{ id: 'rec-a', occurrences: ['f:1', 'f:2', 'f:3'] }] });
  assert.equal(normalized.ids, 1);
  assert.equal(normalized.lines, 2);
});

test('formatDuplicateReport: a clean store prints NOTHING', () => {
  assert.deepEqual(formatDuplicateReport(emptyDuplicates()), []);
  assert.deepEqual(formatDuplicateReport(undefined), []);
});

test('formatDuplicateReport: leads with the counts, then the locations', () => {
  const report = formatDuplicateReport(
    summarizeDuplicates(new Map([['rec-a', ['2026-07.jsonl:1', '2026-07.jsonl:9']]])),
    { indexCount: 2038 },
  );
  assert.match(report[0], /1 duplicate record id/);
  assert.match(report[0], /1 excess physical line/);
  assert.match(report[0], /2039 physical line\(s\) → 2038 indexed/);
  assert.ok(report.some((l) => l.includes('rec-a ×2 — 2026-07.jsonl:1, 2026-07.jsonl:9')));
});

test('formatDuplicateReport: says WHY it deduplicated rather than refused', () => {
  const report = formatDuplicateReport(summarizeDuplicates(new Map([['rec-a', ['f:1', 'f:2']]])));
  const body = report.join('\n');
  assert.match(body, /merge=union/, 'names the mechanism that produced the duplicate');
  assert.match(body, /ADR-0017/, 'cites the decision it is consistent with');
  assert.match(body, /wc -l/, 'names the number that is now wrong, so the operator can check it');
});

test('formatDuplicateReport: caps the evidence so the summary is never buried', () => {
  const occurrences = new Map();
  for (let i = 0; i < 49; i++) occurrences.set(`rec-${String(i).padStart(4, '0')}`, ['f:1', 'f:2']);
  const report = formatDuplicateReport(summarizeDuplicates(occurrences));

  assert.equal(report.filter((l) => /^ {2}rec-/.test(l)).length, 10, 'at most 10 ids are listed');
  assert.ok(report.at(-1).includes('+39 more duplicated id(s)'), 'and the remainder is counted, not dropped');
});

test('formatDuplicateReport: caps the per-id locations too, counting the rest', () => {
  const occurrences = new Map([['rec-a', Array.from({ length: 8 }, (_, i) => `f:${i + 1}`)]]);
  const report = formatDuplicateReport(summarizeDuplicates(occurrences));
  const line = report.find((l) => l.includes('rec-a'));
  assert.match(line, /rec-a ×8/);
  assert.match(line, /\+2 more/);
});
