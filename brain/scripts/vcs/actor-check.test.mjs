// actor-check.test.mjs — Unit tests for evaluateActor (REQ-L5-1, REQ-L5-2, design §5)
// and the gh I/O wrapper + CLI. Run with: npm test (node --test).
//
// Wrapper tests use plain-data fakes injected via `deps` — no test spawns a real
// `gh` process (CI-fragility discipline, same as run-check.test.mjs and
// phase-order-check.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  evaluateActor,
  extractIssueNumber,
  gatherActorCheckInputs,
  runActorCheck,
  main,
} from './actor-check.mjs';

// ── Pure evaluator — evaluateActor (design §5 step 5) ─────────────────────────

test('self-approval: actor === author, not allow-listed, no admin override → fail', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' } }],
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self/i);
});

test('botAllowlist: actor in botAllowlist → pass, even though actor !== author', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'release-bot' } }],
    botAllowlist: ['release-bot'],
  });
  assert.equal(result.level, 'pass');
});

test('botAllowlist: actor in botAllowlist → pass, even when actor === author', () => {
  // A bot account could coincide with the author field in edge cases (e.g.
  // automated PRs) — allow-listing is authoritative over the self-match check.
  const result = evaluateActor({
    author: 'release-bot',
    labeledEvents: [{ actor: { login: 'release-bot' } }],
    botAllowlist: ['release-bot'],
  });
  assert.equal(result.level, 'pass');
});

test('adminOverride: allow-listed override:* label present → pass, logged', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' } }],
    adminOverride: true,
  });
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /override/i);
});

test('no labeled event found for status:approved → warn + pass (never fail on missing evidence)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [],
  });
  assert.equal(result.level, 'warn');
  assert.match(result.reason, /no.*labeled.*event/i);
});

test('re-labeling: most recent labeled event\'s actor wins (remove -> re-add)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [
      { actor: { login: 'alice' } }, // original self-applied label, later removed
      { actor: { login: 'bob' } }, // re-added by a human reviewer — this one counts
    ],
  });
  assert.equal(result.level, 'pass');
});

test('re-labeling: most recent labeled event is the self-applied one → fail', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [
      { actor: { login: 'bob' } }, // an earlier, valid human approval
      { actor: { login: 'alice' } }, // re-applied by the author afterwards — this one counts
    ],
  });
  assert.equal(result.level, 'fail');
});

test('human-applied approval, actor differs from author → pass', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'bob' } }],
  });
  assert.equal(result.level, 'pass');
});

// ── FIX2: actor must be compared against the PR author OR the issue author ────
//
// REQ-L5-1 (spec.md:398-400) requires failing when the approval actor equals
// "the PR author or the issue author" — two distinct entities. The Bob/Alice
// gap: Bob files issue #N, Alice opens the PR, Bob self-labels his own issue
// status:approved → actor "bob" !== prAuthor "alice", so a check that only
// compares against the PR author wrongly PASSes.

test('FIX2: actor === issueAuthor (distinct from PR author), not bot/override → fail (Bob/Alice self-approval via issue author)', () => {
  const result = evaluateActor({
    author: 'alice', // PR author
    issueAuthor: 'bob', // issue author
    labeledEvents: [{ actor: { login: 'bob' } }],
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self/i);
});

test('FIX2: actor === issueAuthor but issueAuthor is allow-listed → pass', () => {
  const result = evaluateActor({
    author: 'alice',
    issueAuthor: 'release-bot',
    labeledEvents: [{ actor: { login: 'release-bot' } }],
    botAllowlist: ['release-bot'],
  });
  assert.equal(result.level, 'pass');
});

test('FIX2 regression: actor === PR author still fails, even with a distinct third-party issueAuthor present', () => {
  const result = evaluateActor({
    author: 'alice',
    issueAuthor: 'carol',
    labeledEvents: [{ actor: { login: 'alice' } }],
  });
  assert.equal(result.level, 'fail');
});

test('FIX2: actor differs from both PR author and issue author → pass', () => {
  const result = evaluateActor({
    author: 'alice',
    issueAuthor: 'bob',
    labeledEvents: [{ actor: { login: 'carol' } }],
  });
  assert.equal(result.level, 'pass');
});

// ── FIX1 fail-open guard: unpaginated gh api list fetch truncates to page 1 ────
//
// `gh api` does NOT auto-paginate. GitHub's Events API is oldest-first, so on an
// issue with more than ~30 events the most recent `status:approved` labeled
// event (including a late self-applied one) lands on page 2+ and is silently
// dropped — self-approval would then wrongly PASS. Guard via source-scan
// (mirrors the neutrality source-scan style in phase-order-check.test.mjs).

test('FIX1 fail-open guard: defaultFetchLabeledEvents source includes --paginate on the gh api events call', () => {
  const srcPath = fileURLToPath(new URL('./actor-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  const fnStart = src.indexOf('function defaultFetchLabeledEvents');
  assert.notEqual(fnStart, -1, 'defaultFetchLabeledEvents not found in source');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
  assert.match(fnBody, /issues\/\$\{issueNumber\}\/events/, 'sanity: events endpoint present');
  assert.match(
    fnBody,
    /--paginate/,
    'events fetch must use --paginate — otherwise a truncated page 1 can hide the newest labeled event (fail-open)'
  );
});

// ── extractIssueNumber (reuses the issue-link extraction rules, governance.yml) ─

test('extractIssueNumber: base=main requires a closing keyword (Closes/Fixes/Resolves #N)', () => {
  assert.equal(extractIssueNumber('Closes #144', 'main'), 144);
  assert.equal(extractIssueNumber('fixes #7 and more', 'main'), 7);
  assert.equal(extractIssueNumber('Resolved #99', 'main'), 99);
});

test('extractIssueNumber: base=main with only "Part of #N" → null (not a closing keyword)', () => {
  assert.equal(extractIssueNumber('Part of #144', 'main'), null);
});

test('extractIssueNumber: base!=main (slice PR) accepts "Part of #N"', () => {
  assert.equal(extractIssueNumber('Part of #144', 'feat/tracker'), 144);
});

test('extractIssueNumber: base!=main also accepts a closing keyword', () => {
  assert.equal(extractIssueNumber('Closes #144', 'feat/tracker'), 144);
});

test('extractIssueNumber: no match anywhere → null', () => {
  assert.equal(extractIssueNumber('no issue reference here', 'main'), null);
  assert.equal(extractIssueNumber('', 'feat/tracker'), null);
});

// ── gh I/O wrapper — gatherActorCheckInputs (DI fakes, no real gh) ──────────────

function makeFakeDeps({ labeledEvents = [], issueLabels = [], issueAuthor = null, botAllowlist = [] } = {}) {
  return {
    fetchLabeledEvents: () => labeledEvents,
    fetchIssue: () => ({ labels: issueLabels, author: issueAuthor }),
    readBotAllowlist: () => botAllowlist,
  };
}

test('gatherActorCheckInputs: resolves issue number, fetches labeled events + issue (labels + author), reads allowlist', () => {
  const deps = makeFakeDeps({
    labeledEvents: [{ actor: { login: 'bob' } }],
    issueLabels: ['status:approved'],
    issueAuthor: 'carol',
    botAllowlist: ['release-bot'],
  });
  const inputs = gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    deps,
  });
  assert.equal(inputs.author, 'alice');
  assert.equal(inputs.issueAuthor, 'carol');
  assert.deepEqual(inputs.labeledEvents, [{ actor: { login: 'bob' } }]);
  assert.deepEqual(inputs.botAllowlist, ['release-bot']);
  assert.equal(inputs.adminOverride, false);
});

test('gatherActorCheckInputs: adminOverride true only when an override:* label is BOTH present and allow-listed', () => {
  const deps = makeFakeDeps({
    labeledEvents: [{ actor: { login: 'alice' } }],
    issueLabels: ['status:approved', 'override:incident-response'],
    botAllowlist: ['override:incident-response'],
  });
  const inputs = gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    deps,
  });
  assert.equal(inputs.adminOverride, true);
});

test('gatherActorCheckInputs: an override:* label present but NOT allow-listed does not grant adminOverride (no blanket bypass)', () => {
  const deps = makeFakeDeps({
    labeledEvents: [{ actor: { login: 'alice' } }],
    issueLabels: ['status:approved', 'override:unlisted'],
    botAllowlist: [],
  });
  const inputs = gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    deps,
  });
  assert.equal(inputs.adminOverride, false);
});

test('gatherActorCheckInputs: no resolvable issue number → empty labeledEvents + null issueAuthor (feeds the warn+pass branch)', () => {
  const deps = makeFakeDeps({ labeledEvents: [{ actor: { login: 'bob' } }] });
  const inputs = gatherActorCheckInputs({
    author: 'alice',
    prBody: 'no issue reference',
    baseBranch: 'main',
    repo: 'org/repo',
    deps,
  });
  assert.deepEqual(inputs.labeledEvents, []);
  assert.equal(inputs.issueAuthor, null);
});

// ── FIX2 wiring: gatherActorCheckInputs must surface issueAuthor ───────────────
//
// The wrapper already fetches the issue object to read its labels; the issue
// author (`issue.user.login`) must be surfaced from that SAME call, not a
// second gh round-trip.

test('FIX2: gatherActorCheckInputs surfaces issueAuthor from the same fetchIssue call used for labels (no second API round-trip)', () => {
  let fetchIssueCallCount = 0;
  const deps = {
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => {
      fetchIssueCallCount += 1;
      return { labels: ['status:approved'], author: 'bob' };
    },
    readBotAllowlist: () => [],
  };
  const inputs = gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    deps,
  });
  assert.equal(inputs.issueAuthor, 'bob');
  assert.equal(fetchIssueCallCount, 1, 'issue must be fetched exactly once — labels and author come from the same call');
});

test('FIX2 end-to-end: Bob files the issue, Alice opens the PR, Bob self-labels his own issue status:approved → fail', () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'bob' }),
    readBotAllowlist: () => [],
  };
  const result = runActorCheck(deps);
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self/i);
});

// ── runActorCheck / main — never throws, gh failure degrades to warn + pass ────

test('runActorCheck: gh api failure inside the wrapper → warn + pass, never throws', () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    fetchLabeledEvents: () => {
      throw new Error('gh api failed: rate limited');
    },
    fetchIssue: () => ({ labels: ['status:approved'], author: 'bob' }),
    readBotAllowlist: () => [],
  };
  assert.doesNotThrow(() => {
    const result = runActorCheck(deps);
    assert.equal(result.level, 'warn');
  });
});

test('runActorCheck: missing PR_AUTHOR/repo context → warn + pass, never throws', () => {
  const result = runActorCheck({ author: undefined, repo: undefined });
  assert.equal(result.level, 'warn');
});

test('runActorCheck: happy path end-to-end through the wrapper — human approval passes', () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'alice' }),
    readBotAllowlist: () => [],
  };
  const result = runActorCheck(deps);
  assert.equal(result.level, 'pass');
});

// ── main() / CLI — exit code mapping ────────────────────────────────────────────

function captureLogs(fn) {
  const lines = [];
  const orig = console.log;
  console.log = msg => lines.push(msg);
  try {
    fn();
  } finally {
    console.log = orig;
  }
  return lines;
}

test('main: fail verdict → exit code 1', () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    fetchLabeledEvents: () => [{ actor: { login: 'alice' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'alice' }),
    readBotAllowlist: () => [],
  };
  let exitCode;
  const lines = captureLogs(() => {
    exitCode = main(deps);
  });
  assert.equal(exitCode, 1);
  assert.equal(lines[0], 'actor-check: fail');
});

test('main: warn verdict → exit code 0', () => {
  const deps = {
    author: 'alice',
    prBody: 'no issue reference',
    baseBranch: 'main',
    repo: 'org/repo',
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: [], author: null }),
    readBotAllowlist: () => [],
  };
  let exitCode;
  const lines = captureLogs(() => {
    exitCode = main(deps);
  });
  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'actor-check: warn');
});

test('main: pass verdict → exit code 0', () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'alice' }),
    readBotAllowlist: () => [],
  };
  let exitCode;
  const lines = captureLogs(() => {
    exitCode = main(deps);
  });
  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'actor-check: pass');
});
