// history-model.test.mjs — buildHistoryModel merges merge/release/adr-amended
// events newest-first (#882 R882-5). No review-verdict event is ever
// produced: no field anywhere in this data carries a review round's
// timestamp (archive/881/design.md D14), so a verdict cannot be placed on
// a real timeline — History links to the Reviews mode instead.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildHistoryModel } from './history-model.mjs';
import { prUrl } from './forge-url.mjs';

const SOURCE = readFileSync(fileURLToPath(new URL('./history-model.mjs', import.meta.url)), 'utf8');

const commit = (over = {}) => ({ sha: 'aaa1111bbb', date: '2026-09-10 10:00:00 +0000', subject: 'feat(ui): x', citedRef: null, ...over });
const tag = (over = {}) => ({ name: 'v1.4.0', date: '2026-09-01T00:00:00+00:00', ...over });
const adr = (over = {}) => ({ ok: true, path: 'brain/project/decisions/adr-0001-a.md', title: 'A', amendments: [], ...over });

test('#882 R882-5: history.ok === false passes its reason straight through', () => {
  const model = buildHistoryModel({ history: { ok: false, reason: 'git log could not be read: boom' }, adrs: { ok: true, value: [] } });
  assert.deepEqual(model, { ok: false, reason: 'git log could not be read: boom' });
});

test('#882 R882-5: a commit citing a number becomes a merge event sourced to the forge URL (through lib/forge-url.mjs\'s prUrl, not a hand-built template), [forge: #N] — never claiming "PR"', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [commit({ citedRef: 123, subject: 'feat(ui): the History view (#123)' })], tags: [] } },
    adrs: { ok: true, value: [] },
    project: 'o/r',
  });
  assert.equal(model.ok, true);
  const [event] = model.value.events;
  assert.equal(event.kind, 'merge');
  assert.equal(event.source, prUrl('o/r', 123), 'the URL is forge-url.mjs\'s own prUrl output, not a second hand-built copy');
  assert.equal(event.sourceStamp.label, '[forge: #123]');
  assert.equal(event.sourceStamp.href, 'https://github.com/o/r/pull/123');
  assert.equal(event.sourceStamp.kind, 'forge');
  assert.ok(!JSON.stringify(event).includes('PR'), 'the event never claims "PR" anywhere in its own text');
  assert.ok(!('prNumber' in event), 'no prNumber field — the field is citedRef');
});

test('#882 R882-5: a commit with no citation is still an event, sourced to git — never dropped, never guessed', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [commit({ citedRef: null, sha: 'deadbeef00' })], tags: [] } },
    adrs: { ok: true, value: [] },
    project: 'o/r',
  });
  const [event] = model.value.events;
  assert.equal(event.sourceStamp.label, '[git: deadbee]');
  assert.equal(event.sourceStamp.kind, 'git');
  assert.equal(event.sourceStamp.href, null, 'a git sha never carries an href');
});

test('#882 R882-5: a commit citing a number with no project known falls back to its git source — never a fabricated URL', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [commit({ citedRef: 123, sha: 'cafe000001' })], tags: [] } },
    adrs: { ok: true, value: [] },
    project: null,
  });
  const [event] = model.value.events;
  assert.equal(event.sourceStamp.label, '[git: cafe000]');
  assert.equal(event.sourceStamp.kind, 'git');
});

test('#882 R882-5: a tag becomes a release event', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [], tags: [tag({ name: 'v2.0.0' })] } },
    adrs: { ok: true, value: [] },
  });
  const [event] = model.value.events;
  assert.equal(event.kind, 'release');
  assert.equal(event.title, 'v2.0.0');
});

test('#882 R882-5: an ADR amendment carrying a date becomes an adr-amended event, sourced to the ADR\'s own path', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [], tags: [] } },
    adrs: { ok: true, value: [adr({ amendments: [{ n: 1, date: '2026-08-15', summary: 'x', issue: null }] })] },
  });
  const [event] = model.value.events;
  assert.equal(event.kind, 'adr-amended');
  assert.equal(event.title, 'A amended');
  assert.equal(event.source, 'brain/project/decisions/adr-0001-a.md');
  assert.equal(event.sourceStamp.label, '[repo: brain/project/decisions/adr-0001-a.md]');
  assert.equal(event.sourceStamp.kind, 'repo');
});

test('#882 R882-5: an ADR amendment with no date produces no event — never a fabricated timeline position', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [], tags: [] } },
    adrs: { ok: true, value: [adr({ amendments: [{ n: 1, date: null, summary: 'x', issue: null }] })] },
  });
  assert.deepEqual(model.value.events, []);
});

test('#882 R882-5: all three kinds merge into one list, newest first', () => {
  const model = buildHistoryModel({
    history: {
      ok: true,
      value: {
        commits: [commit({ date: '2026-09-05 00:00:00 +0000', subject: 'mid' })],
        tags: [tag({ date: '2026-09-10T00:00:00+00:00', name: 'newest' }), tag({ date: '2026-08-01T00:00:00+00:00', name: 'oldest' })],
      },
    },
    adrs: { ok: true, value: [adr({ amendments: [{ n: 1, date: '2026-09-08T00:00:00Z', summary: 'x', issue: null }] })] },
  });
  assert.deepEqual(model.value.events.map((e) => e.title), ['newest', 'A amended', 'mid', 'oldest']);
});

test('#882 R882-5: no review-verdict event is ever produced — a plain scan for kind === \'review\' finds none', () => {
  const model = buildHistoryModel({
    history: {
      ok: true,
      value: {
        commits: [commit({ citedRef: 1 }), commit({ citedRef: null })],
        tags: [tag()],
      },
    },
    adrs: { ok: true, value: [adr({ amendments: [{ n: 1, date: '2026-08-15', summary: 'x', issue: null }] })] },
    project: 'o/r',
  });
  assert.ok(model.value.events.every((e) => e.kind !== 'review'), 'no event kind is ever "review"');
  assert.deepEqual(new Set(model.value.events.map((e) => e.kind)), new Set(['merge', 'release', 'adr-amended']));
});

test('#882 R882-5: an unreadable adrs section degrades independently — merge/release events still render, adr-amended events are simply absent', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [commit({ citedRef: null })], tags: [tag()] } },
    adrs: { ok: false, reason: 'brain/project/decisions could not be listed' },
  });
  assert.equal(model.ok, true, 'one degraded section never blanks the whole view');
  assert.equal(model.value.events.length, 2);
  assert.ok(model.value.events.every((e) => e.kind !== 'adr-amended'));
});

test('#882 R882-5: an unreadable ADR row (adr.ok === false) inside a readable adrs section is skipped, never thrown on', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [], tags: [] } },
    adrs: { ok: true, value: [{ ok: false, path: 'brain/project/decisions/adr-0002-b.md', reason: 'no title line' }] },
  });
  assert.deepEqual(model.value.events, []);
});

// ── #1043 cold review correction 1: a total, stable order even when a date
// cannot be parsed — never sorted first, never dropped ──────────────────────

test('#1043 correction 1: an event whose date cannot be parsed sorts LAST and says so — never silently sorted first, never dropped', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [], tags: [] } },
    adrs: { ok: true, value: [adr({ amendments: [{ n: 1, date: 'x', summary: 'x', issue: null }] })] },
  });
  assert.equal(model.ok, true);
  assert.equal(model.value.events.length, 1, 'a truthy-but-unparseable date is never dropped');
  const [event] = model.value.events;
  assert.equal(typeof event.dateUnparseable, 'string', 'the event carries its own stated reason, not just a silent position');
  assert.match(event.dateUnparseable, /x/, 'the reason names the actual unparseable value');
});

test('#1043 correction 1: mixed valid and unparseable dates sort deterministically — valid ones newest-first, unparseable ones kept at the end', () => {
  const model = buildHistoryModel({
    history: {
      ok: true,
      value: {
        commits: [
          commit({ date: '2026-09-05T00:00:00Z', subject: 'mid', sha: 'mid0000000' }),
        ],
        tags: [
          tag({ date: '2026-09-10T00:00:00+00:00', name: 'newest' }),
          tag({ date: '2026-08-01T00:00:00+00:00', name: 'oldest' }),
        ],
      },
    },
    adrs: { ok: true, value: [adr({ amendments: [{ n: 1, date: '2027-01-01T00:00:00Z', summary: 'x', issue: null }, { n: 2, date: 'x', summary: 'y', issue: null }] })] },
  });
  assert.equal(model.ok, true);
  const titles = model.value.events.map((e) => e.title);
  // 'A amended' fires twice (two amendments): the 2027 one sorts as the real
  // newest event; the 'x'-dated one is unparseable and must land last.
  assert.deepEqual(titles.slice(0, 4), ['A amended', 'newest', 'mid', 'oldest']);
  assert.equal(titles.at(-1), 'A amended');
  assert.equal(model.value.events.at(-1).dateUnparseable, 'date "x" could not be parsed — kept at the end of the timeline');

  // run twice to prove determinism, not a lucky single ordering
  const model2 = buildHistoryModel({
    history: {
      ok: true,
      value: {
        commits: [commit({ date: '2026-09-05T00:00:00Z', subject: 'mid', sha: 'mid0000000' })],
        tags: [tag({ date: '2026-09-10T00:00:00+00:00', name: 'newest' }), tag({ date: '2026-08-01T00:00:00+00:00', name: 'oldest' })],
      },
    },
    adrs: { ok: true, value: [adr({ amendments: [{ n: 1, date: '2027-01-01T00:00:00Z', summary: 'x', issue: null }, { n: 2, date: 'x', summary: 'y', issue: null }] })] },
  });
  assert.deepEqual(model2.value.events.map((e) => e.title), titles);
});

test('#1043 correction 1: an event with a real, parseable date never carries a dateUnparseable reason', () => {
  const model = buildHistoryModel({
    history: { ok: true, value: { commits: [commit()], tags: [] } },
    adrs: { ok: true, value: [] },
  });
  const [event] = model.value.events;
  assert.equal(event.dateUnparseable, null);
});

// ── fresh-context review of PR 4, warning: one URL definition, not two ──────

test('#882 fresh-context review of PR 4, warning: history-model.mjs never hand-builds a github.com URL — lib/forge-url.mjs is the one place that literal lives', () => {
  assert.ok(!SOURCE.includes('https://github.com/'), 'no literal https://github.com/ inside history-model.mjs — prUrl (lib/forge-url.mjs) is the only builder');
  assert.match(SOURCE, /import\s*\{[^}]*prUrl[^}]*\}\s*from\s*['"]\.\/forge-url\.mjs['"]/, 'history-model.mjs must import prUrl from lib/forge-url.mjs');
});
