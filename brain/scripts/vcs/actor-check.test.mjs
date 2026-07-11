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
import { spawnSync } from 'node:child_process';
import { setSpawn } from './lib/exec.mjs';

import {
  evaluateActor,
  extractIssueNumber,
  filterLabeledEvents,
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

// FIX1 fail-open guard (unpaginated gh api list fetch truncates to page 1) now
// lives with the code it guards: EXTRACTED into github.mjs#labelEvents (issue
// #239 A3, the m3 close) — see providers.test.mjs's
// "github.labelEvents source includes --paginate" source-scan.

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

test('gatherActorCheckInputs: resolves issue number, fetches labeled events + issue (labels + author), reads allowlist', async () => {
  const deps = makeFakeDeps({
    labeledEvents: [{ actor: { login: 'bob' } }],
    issueLabels: ['status:approved'],
    issueAuthor: 'carol',
    botAllowlist: ['release-bot'],
  });
  const inputs = await gatherActorCheckInputs({
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

test('gatherActorCheckInputs: adminOverride true only when an override:* label is BOTH present and allow-listed', async () => {
  const deps = makeFakeDeps({
    labeledEvents: [{ actor: { login: 'alice' } }],
    issueLabels: ['status:approved', 'override:incident-response'],
    botAllowlist: ['override:incident-response'],
  });
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    deps,
  });
  assert.equal(inputs.adminOverride, true);
});

test('gatherActorCheckInputs: an override:* label present but NOT allow-listed does not grant adminOverride (no blanket bypass)', async () => {
  const deps = makeFakeDeps({
    labeledEvents: [{ actor: { login: 'alice' } }],
    issueLabels: ['status:approved', 'override:unlisted'],
    botAllowlist: [],
  });
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    deps,
  });
  assert.equal(inputs.adminOverride, false);
});

test('gatherActorCheckInputs: no resolvable issue number → empty labeledEvents + null issueAuthor (feeds the warn+pass branch)', async () => {
  const deps = makeFakeDeps({ labeledEvents: [{ actor: { login: 'bob' } }] });
  const inputs = await gatherActorCheckInputs({
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

test('FIX2: gatherActorCheckInputs surfaces issueAuthor from the same fetchIssue call used for labels (no second API round-trip)', async () => {
  let fetchIssueCallCount = 0;
  const deps = {
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => {
      fetchIssueCallCount += 1;
      return { labels: ['status:approved'], author: 'bob' };
    },
    readBotAllowlist: () => [],
  };
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    deps,
  });
  assert.equal(inputs.issueAuthor, 'bob');
  assert.equal(fetchIssueCallCount, 1, 'issue must be fetched exactly once — labels and author come from the same call');
});

test('FIX2 end-to-end: Bob files the issue, Alice opens the PR, Bob self-labels his own issue status:approved → fail', async () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'bob' }),
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self/i);
});

// ── runActorCheck / main — never throws, gh failure degrades to warn + pass ────
//
// runActorCheck/gatherActorCheckInputs/main are async as of A3 (they await the
// labelEvents CONTRACT verb dispatched via getVcs — a Promise-returning call);
// tests here await them directly instead of asserting a synchronous throw.

test('runActorCheck: gh api failure inside the wrapper → warn + pass, never throws', async () => {
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
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'warn');
});

test('runActorCheck: missing PR_AUTHOR/repo context → warn + pass, never throws', async () => {
  const result = await runActorCheck({ author: undefined, repo: undefined });
  assert.equal(result.level, 'warn');
});

test('runActorCheck: happy path end-to-end through the wrapper — human approval passes', async () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'alice' }),
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'pass');
});

// ── main() / CLI — exit code mapping ────────────────────────────────────────────

async function captureLogs(fn) {
  const lines = [];
  const orig = console.log;
  console.log = msg => lines.push(msg);
  try {
    await fn();
  } finally {
    console.log = orig;
  }
  return lines;
}

test('main: fail verdict → exit code 1', async () => {
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
  const lines = await captureLogs(async () => {
    exitCode = await main(deps);
  });
  assert.equal(exitCode, 1);
  assert.equal(lines[0], 'actor-check: fail');
});

test('main: warn verdict → exit code 0', async () => {
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
  const lines = await captureLogs(async () => {
    exitCode = await main(deps);
  });
  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'actor-check: warn');
});

test('main: pass verdict → exit code 0', async () => {
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
  const lines = await captureLogs(async () => {
    exitCode = await main(deps);
  });
  assert.equal(exitCode, 0);
  assert.equal(lines[0], 'actor-check: pass');
});

// ── ci-context seam wiring (ADR-0016) ─────────────────────────────────────────
//
// `author`, `prBody`, `baseBranch`, `repo` now source from an injected
// `deps.ctx` (built by ci-context.mjs's loadContext()) instead of
// process.env.PR_AUTHOR/PR_BODY/BASE_BRANCH/GITHUB_REPOSITORY. `deps.author`
// etc. still take precedence (existing tests above never pass `ctx` and are
// unaffected). Per CP-A0 ruling 1, `author` now means the PR AUTHOR sourced
// from the API payload (ctx.author) — never PR_AUTHOR env.

test('ci-context seam: ctx.author/ctx.repo/ctx.targetBranch feed the wrapper when deps.author/repo/baseBranch are absent', async () => {
  const deps = {
    ctx: { author: 'alice', repo: 'org/repo', targetBranch: 'main', body: 'Closes #144' },
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'alice' }),
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'pass');
});

test('ci-context seam: no ctx.author and no deps.author → warn (never falls back to process.env.PR_AUTHOR)', async () => {
  const result = await runActorCheck({ ctx: { author: null, repo: null } });
  assert.equal(result.level, 'warn');
});

test('ci-context seam: DETECTION consumer — ctx.body null (API failure) falls back to env.PR_BODY via resolveDetectionBody', async () => {
  const deps = {
    ctx: { author: 'alice', repo: 'org/repo', targetBranch: 'main', body: null },
    env: { PR_BODY: 'Closes #144' },
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'carol' }),
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  // extractIssueNumber only resolves an issue (and thus a non-empty labeledEvents
  // path) when prBody carries "Closes #N" — proving the PR_BODY fallback was used.
  assert.equal(result.level, 'pass');
});

test('CP-A0 ruling 1: actor-check.mjs source never reads process.env.PR_AUTHOR (author sourced from ctx.author / API payload only)', () => {
  const srcPath = fileURLToPath(new URL('./actor-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(src.includes('process.env.PR_AUTHOR'), false, 'source must not reference process.env.PR_AUTHOR');
});

test('neutrality source-scan (REQ-NEUTRALITY-2): actor-check.mjs source contains no .claude or SKILL.md literal', () => {
  const srcPath = fileURLToPath(new URL('./actor-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(src.includes('.claude'), false, 'source must not reference .claude');
  assert.equal(src.includes('SKILL.md'), false, 'source must not reference SKILL.md');
});

// ── REQ-A2-3 (issue #231 A2 phase 1): the approved label is config-driven ──────
//
// governance.approvedLabel (config-migrations.mjs, 0.7.0) + resolveApprovedLabel()
// (governance/approved-label.mjs) replace the hardcoded 'status:approved' literal.
// No comparison anywhere in this file may hardcode the label — it must always
// read the resolved value.

test('REQ-A2-3: actor-check.mjs source contains no literal status:approved (reads the resolved governance.approvedLabel value)', () => {
  const srcPath = fileURLToPath(new URL('./actor-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(src.includes('status:approved'), false,
    'source must not hardcode the approved-label literal — use resolveApprovedLabel()');
});

// filterLabeledEvents (issue #239 A3, D1): became a SHARED post-filter over
// the normalized labelEvents() shape (`action`/`label` flat fields), applied
// AFTER either provider's verb normalizes — no longer the raw gh
// `{event, label:{name}}` shape.
test('filterLabeledEvents: matches only "add" events labeled with the resolved approvedLabel, not a hardcoded value', () => {
  const events = [
    { actor: { login: 'alice' }, action: 'add', label: 'status:approved', at: 'T1' },
    { actor: { login: 'bob' }, action: 'add', label: 'status::approved', at: 'T2' },
    { actor: { login: 'carol' }, action: 'remove', label: 'status:approved', at: 'T3' },
  ];
  assert.deepEqual(filterLabeledEvents(events, 'status::approved'), [events[1]]);
  assert.deepEqual(filterLabeledEvents(events, 'status:approved'), [events[0]]);
  assert.deepEqual(filterLabeledEvents(events, 'ready:approved'), []);
});

test('filterLabeledEvents: null (uncomputable labelEvents) → [] (feeds evaluateActor\'s warn branch, REQ-L5-2)', () => {
  assert.deepEqual(filterLabeledEvents(null, 'status:approved'), []);
});

test('gatherActorCheckInputs: an injected fetchLabeledEvents still wins over default resolution (provider/readConfig accepted but unused)', async () => {
  const deps = {
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: [], author: null }),
    readBotAllowlist: () => [],
    readConfig: () => ({ governance: { approvedLabel: 'ready:approved' } }),
  };
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    provider: 'gitlab',
    deps,
  });
  assert.deepEqual(inputs.labeledEvents, [{ actor: { login: 'bob' } }]);
});

// ── A3 labelEvents dispatch (issue #239 A3, D1/R3 — the m3 close) ─────────────
//
// Pre-A3, defaultFetchLabeledEvents was GitHub-only (`gh api` unconditionally)
// — on a GitLab runner (no `gh` binary) the call threw and the check
// permanently degraded to `warn`. A3 dispatches labelEvents via
// getVcs({ provider: ctx.provider }) (the run-check.mjs#defaultFetchIssue
// finding-#14 pattern) so GitLab EVALUATES (self-approval → fail), not just
// degrades. The pure evaluateActor is untouched — only the wrapper's
// provider-resolved fetch changes.

test('A3: GitLab self-approval — labelEvents dispatches to the gitlab provider via getVcs({provider}), evaluateActor returns fail (REQ-L5-1), not a permanent warn', async () => {
  let receivedProvider;
  const fakeVcs = {
    labelEvents: async ({ project, number }) => {
      assert.equal(project, 'g/r');
      assert.equal(number, 144);
      return [{ actor: { login: 'alice' }, action: 'add', label: 'status::approved', at: '2024-01-01T00:00:00Z' }];
    },
  };
  const result = await runActorCheck({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'g/r',
    provider: 'gitlab',
    getVcs: async (opts) => { receivedProvider = opts.provider; return fakeVcs; },
    fetchIssue: () => ({ labels: ['status::approved'], author: 'alice' }),
    readBotAllowlist: () => [],
    readConfig: () => ({}),
  });
  assert.equal(receivedProvider, 'gitlab', 'getVcs must be called with the runtime ctx.provider (finding #14)');
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self/i);
});

test('A3: labelEvents returns null (uncomputable) → warn, never fail-closed (REQ-L5-2)', async () => {
  const fakeVcs = { labelEvents: async () => null };
  const result = await runActorCheck({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'g/r',
    provider: 'gitlab',
    getVcs: async () => fakeVcs,
    fetchIssue: () => ({ labels: [], author: null }),
    readBotAllowlist: () => [],
    readConfig: () => ({}),
  });
  assert.equal(result.level, 'warn');
});

test('A3: labelEvents returns an empty add-filtered list (only "remove" events) → warn, never fail-closed (REQ-L5-2)', async () => {
  const fakeVcs = {
    labelEvents: async () => ([
      { actor: { login: 'alice' }, action: 'remove', label: 'status::approved', at: '2024-01-01T00:00:00Z' },
    ]),
  };
  const result = await runActorCheck({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'g/r',
    provider: 'gitlab',
    getVcs: async () => fakeVcs,
    fetchIssue: () => ({ labels: [], author: null }),
    readBotAllowlist: () => [],
    readConfig: () => ({}),
  });
  assert.equal(result.level, 'warn');
});

// ── A3 TASK 1 (fresh-context review finding): defaultFetchIssue was STILL
// gh-CLI-hardcoded — gatherActorCheckInputs needs TWO fetches (labelEvents +
// fetchIssue) before evaluateActor runs; only labelEvents was migrated in the
// first pass. On GitLab CI (no `gh` binary) defaultFetchIssue's raw
// execFileSync('gh', ...) threw ENOENT, masking R3 behind a permanent `warn`
// — the exact same defect class as finding #14 (issue-link) and the
// pre-fix labelEvents wrapper, now closed a third time.
//
// Per lesson #10/#12 (injected deps prove the logic, not that the default is
// sane): this test does NOT inject deps.fetchIssue or deps.fetchLabeledEvents
// — it mocks ONE layer lower, at getVcs (the transport/dispatch layer), so
// the REAL defaultFetchIssue/defaultFetchLabeledEvents wrapper functions run
// end-to-end. A setSpawn spy proves no CLI process is ever spawned on the
// GitLab default path.

test('A3 TASK1: GitLab self-approval via the REAL default path (no injected fetchIssue/fetchLabeledEvents) — defaultFetchIssue dispatches getVcs({provider}).issueView(...), no gh/glab spawn, evaluateActor reaches fail (R3 genuinely met)', async () => {
  const calls = { issueView: null, labelEvents: null };
  const fakeVcs = {
    issueView: async (params) => {
      calls.issueView = params;
      return { number: 144, title: 'x', labels: ['status::approved'], body: 'y', author: 'alice' };
    },
    labelEvents: async (params) => {
      calls.labelEvents = params;
      return [{ actor: { login: 'alice' }, action: 'add', label: 'status::approved', at: '2024-01-01T00:00:00Z' }];
    },
  };
  let receivedProvider;
  let spawnCalled = false;
  setSpawn(() => {
    spawnCalled = true;
    return { status: 0, stdout: '{}', stderr: '' };
  });
  try {
    const result = await runActorCheck({
      author: 'alice',
      prBody: 'Closes #144',
      baseBranch: 'main',
      repo: 'g/r',
      provider: 'gitlab',
      getVcs: async (opts) => { receivedProvider = opts.provider; return fakeVcs; },
      readBotAllowlist: () => [],
      readConfig: () => ({}),
      // deliberately NOT fetchIssue/fetchLabeledEvents — exercising the REAL
      // default wrappers, not a deps-level bypass.
    });

    assert.equal(spawnCalled, false, 'the GitLab default path must never spawn a CLI process (gh/glab)');
    assert.equal(receivedProvider, 'gitlab', 'getVcs must be called with the runtime ctx.provider (finding #14)');
    assert.ok(calls.issueView, 'defaultFetchIssue must dispatch through vcs.issueView, not execFileSync(\'gh\', ...)');
    assert.equal(calls.issueView.project, 'g/r');
    assert.equal(calls.issueView.number, 144);
    assert.ok(calls.labelEvents, 'defaultFetchLabeledEvents must also have dispatched');
    assert.equal(result.level, 'fail', 'R3: GitLab self-approval must EVALUATE to fail via the real default path, not degrade to a permanent warn');
    assert.match(result.reason, /self/i);
  } finally {
    setSpawn(spawnSync);
  }
});

test('A3 TASK1 source-scan: defaultFetchIssue no longer contains execFileSync(\'gh\', ...) — structurally proves the default path cannot spawn gh regardless of provider', () => {
  const srcPath = fileURLToPath(new URL('./actor-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  const fnStart = src.indexOf('function defaultFetchIssue');
  assert.notEqual(fnStart, -1, 'defaultFetchIssue not found in source');
  const fnEnd = src.indexOf('\nfunction ', fnStart + 1);
  const fnBody = src.slice(fnStart, fnEnd === -1 ? undefined : fnEnd);
  assert.equal(fnBody.includes('execFileSync'), false, 'defaultFetchIssue must dispatch via getVcs(...).issueView(...), never a raw execFileSync(\'gh\', ...) call');
  assert.match(fnBody, /getVcs|issueView/, 'sanity: dispatch through the vcs adapter is present');
});
