// history.test.mjs — gatherHistoryFacts's own facts, read through the same
// injected `_run` seam release-debt.mjs uses (#882 R882-5).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { gatherHistoryFacts, parseCommitLog, parseTagList } from './history.mjs';

// ── the pure parsers ─────────────────────────────────────────────────────

test('#882 R882-5: parseCommitLog reads sha|date|subject lines, citedRef parsed from a trailing (#N)', () => {
  const text = 'aaa1111|2026-09-10 10:00:00 +0000|feat(ui): the History view (#123)\n'
    + 'bbb2222|2026-09-09 09:00:00 +0000|chore: tidy\n';
  assert.deepEqual(parseCommitLog(text), [
    { sha: 'aaa1111', date: '2026-09-10 10:00:00 +0000', subject: 'feat(ui): the History view (#123)', citedRef: 123 },
    { sha: 'bbb2222', date: '2026-09-09 09:00:00 +0000', subject: 'chore: tidy', citedRef: null },
  ]);
});

test('#882 R882-5: a (#N) in the middle of the subject is never read as the PR number — only a trailing one is (the trailing anchor)', () => {
  const text = 'ccc3333|2026-09-08 08:00:00 +0000|feat: mid-subject (#42) mention, not a PR suffix\n';
  assert.equal(parseCommitLog(text)[0].citedRef, null);
});

test('#882 R882-5: parseCommitLog on empty/blank input is an empty list, never null', () => {
  assert.deepEqual(parseCommitLog(''), []);
  assert.deepEqual(parseCommitLog('\n\n'), []);
});

test('#882 fresh-context review of PR 4, blocker: a commit fact never carries a prNumber key or the word "PR" — a trailing (#N) is a citation, this repo\'s own log mixes squash suffixes and hand-written issue citations with no way to tell them apart (measured: 200 commits, 147 with a trailing (#N), 17 of those resolving to #882 itself)', () => {
  const [commit] = parseCommitLog('aaa1111|2026-09-10 10:00:00 +0000|feat(ui): the History view (#882)\n');
  assert.equal(commit.citedRef, 882);
  assert.ok(!('prNumber' in commit), 'no prNumber key — the field is citedRef');
  assert.ok(!JSON.stringify(commit).includes('PR'), 'no commit fact claims "PR" anywhere in its own text');
});

test('#882 R882-5: parseTagList reads name|date lines, newest-sorted order preserved as given', () => {
  const text = 'v1.4.0|2026-09-01T00:00:00+00:00\nv1.3.0|2026-08-01T00:00:00+00:00\n';
  assert.deepEqual(parseTagList(text), [
    { name: 'v1.4.0', date: '2026-09-01T00:00:00+00:00' },
    { name: 'v1.3.0', date: '2026-08-01T00:00:00+00:00' },
  ]);
});

// ── the edge: gatherHistoryFacts ─────────────────────────────────────────

test('#882 R882-5: gatherHistoryFacts reads git log and git tag through its injected _run seam, same as release-debt.mjs', () => {
  const calls = [];
  const facts = gatherHistoryFacts({
    root: '/nowhere',
    _run: (file, args) => {
      calls.push(args.join(' '));
      if (args[0] === 'log') return 'aaa1111|2026-09-10 10:00:00 +0000|feat(ui): the History view (#123)\n';
      return 'v1.4.0|2026-09-01T00:00:00+00:00\n';
    },
  });
  assert.equal(facts.ok, true);
  assert.deepEqual(facts.value.commits, [
    { sha: 'aaa1111', date: '2026-09-10 10:00:00 +0000', subject: 'feat(ui): the History view (#123)', citedRef: 123 },
  ]);
  assert.deepEqual(facts.value.tags, [{ name: 'v1.4.0', date: '2026-09-01T00:00:00+00:00' }]);
  assert.ok(calls[0].startsWith('log '), 'git log runs first');
  assert.ok(calls[1].startsWith('tag '), 'then git tag');
});

test('#882 R882-5: either git log or git tag throwing is this section\'s own {ok:false, reason} — never a partial list', () => {
  const logFails = gatherHistoryFacts({
    root: '/nowhere',
    _run: (file, args) => { if (args[0] === 'log') throw new Error('not a git repository'); return ''; },
  });
  assert.equal(logFails.ok, false);
  assert.match(logFails.reason, /git log/);

  const tagFails = gatherHistoryFacts({
    root: '/nowhere',
    _run: (file, args) => { if (args[0] === 'tag') throw new Error('boom'); return ''; },
  });
  assert.equal(tagFails.ok, false);
  assert.match(tagFails.reason, /git tag/);
});
