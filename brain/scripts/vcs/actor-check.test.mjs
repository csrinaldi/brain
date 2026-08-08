// actor-check.test.mjs — Unit tests for evaluateActor (REQ-L5-1, REQ-L5-2, design §5)
// and the gh I/O wrapper + CLI. Run with: npm test (node --test).
//
// Wrapper tests use plain-data fakes injected via `deps` — no test spawns a real
// `gh` process (CI-fragility discipline, same as run-check.test.mjs and
// phase-order-check.test.mjs).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { setSpawn } from './lib/exec.mjs';
import { renderDecision } from '../review/lib/decision-block.mjs';

import {
  evaluateActor,
  extractIssueNumber,
  filterLabeledEvents,
  gatherActorCheckInputs,
  runActorCheck,
  compareTimestamps,
  evaluateSignedDecision,
  LITE_SIGNED_EVIDENCE_SOURCES,
  resolveHeadSha,
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

// ── tier-scoped override:* (issue #358 Q5, REQ-TIER-6) ─────────────────────

test('gatherActorCheckInputs: regulated tier refuses an allow-listed override:* label — adminOverride false, overrideRefused true', async () => {
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
    tier: 'regulated',
    deps,
  });
  assert.equal(inputs.adminOverride, false, 'regulated must never honor override:*');
  assert.equal(inputs.overrideRefused, true, 'the refusal must be surfaced, never silent');
});

test('evaluateActor: regulated + an allow-listed override:* still fails self-approval, naming the tier refusal (REQ-TIER-6)', () => {
  const result = evaluateActor({
    author: 'alice',
    issueAuthor: 'alice',
    labeledEvents: [{ actor: { login: 'alice' } }],
    botAllowlist: [],
    adminOverride: false,
    overrideRefused: true,
    tier: 'regulated',
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self-approval/);
  assert.match(result.reason, /not honored at the "regulated" tier/);
});

test('evaluateActor: lite tier with NO override label present passes on evidence, verdict never mentions override (design §4, "lite passes on its own evidence")', () => {
  const result = evaluateActor({
    author: 'alice',
    issueAuthor: 'bob',
    labeledEvents: [{ actor: { login: 'carol' }, at: '2024-01-01T00:10:00Z' }],
    commits: [{ sha: 'abc', login: 'alice', at: '2024-01-01T00:00:00Z' }],
    botAllowlist: [],
    adminOverride: false,
    overrideRefused: false,
    tier: 'lite',
  });
  assert.equal(result.level, 'pass');
  assert.doesNotMatch(result.reason, /override/i);
});

// ── REQ-L5-1′: evidence tiering (issue #358 Q5 Phase 4) ────────────────────
//
// `lite` evaluates ONLY the distinct-act evidence (evaluateDistinctAct):
// self-approval is not checked — a solo maintainer applying their own
// approval strictly after their own push passes. `standard`/`regulated` keep
// the pre-tiering distinct-actor (self-approval) check UNCHANGED
// (REQ-TIER-10's no-op-migration guarantee — see the tests above, which
// never supply `commits` and still exercise `standard`'s behavior via the
// default tier). `regulated` additionally requires the approver to have
// authored no commit on the branch.

test('compareTimestamps: label strictly after the head commit → true', () => {
  assert.equal(compareTimestamps('2024-01-01T00:10:00Z', '2024-01-01T00:00:00Z'), true);
});

test('compareTimestamps: label at or before the head commit → false', () => {
  assert.equal(compareTimestamps('2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'), false);
  assert.equal(compareTimestamps('2023-12-31T23:00:00Z', '2024-01-01T00:00:00Z'), false);
});

test('compareTimestamps: either timestamp missing → null (uncomputable, never assumed)', () => {
  assert.equal(compareTimestamps(undefined, '2024-01-01T00:00:00Z'), null);
  assert.equal(compareTimestamps('2024-01-01T00:00:00Z', undefined), null);
  assert.equal(compareTimestamps(null, null), null);
});

test('evaluateActor: lite — solo maintainer self-applies the approved label strictly after their own head-commit push → pass on distinct-act (design §4/REQ-L5-1′, #329)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:10:00Z' }],
    commits: [{ sha: 'abc', login: 'alice', at: '2024-01-01T00:00:00Z' }],
    tier: 'lite',
  });
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /distinct-act/i);
});

// AMENDED by ADR-0026 Amendment 1 (#418): this pinned the pre-amendment rule
// with the approver's OWN commit, which no longer re-arms. The intent —
// "approval before the code is not an approval" — is unchanged and still
// enforced, but only over FOREIGN commits, so the case is restated with a
// third-party author. The approver-authored variant is now REQ-418-2 below.
test('evaluateActor: lite — approval applied BEFORE a FOREIGN commit was pushed → fail (approval before the code is not an approval)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: 'abc', login: 'mallory', at: '2024-01-01T00:10:00Z' }],
    tier: 'lite',
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /not strictly after/i);
});

// PR #503 cold-review round 1, finding 3: a caller that never threads the
// `decisions` field at all (issue #473 pre-existed this field) must get the
// BYTE-IDENTICAL reason string it got before issue #473 landed — no
// `(brain-decision/1: ...)` annotation appended. The expected string below is
// copied verbatim from the true base branch's (feat/issue-473-s1-parser-
// extraction, pre-slice-2) `evaluateActor` output for this exact fixture —
// derived by running that file's own `evaluateActor`, not guessed. `decisions`
// is absent from the input object (not `null`): that is the LEGACY state — a
// caller that fetched nothing and never intended to. `decisions === null`
// (fetch attempted, uncomputable) legitimately still annotates, unchanged.
test('evaluateActor: lite — legacy caller with NO `decisions` field at all → reason is byte-identical to pre-#473 base (no brain-decision/1 annotation)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: 'abc', login: 'mallory', at: '2024-01-01T00:10:00Z' }],
    tier: 'lite',
  });
  assert.equal(result.level, 'fail');
  assert.equal(
    result.reason,
    'the approved label was applied at 2024-01-01T00:00:00Z, not strictly after the latest foreign commit — ' +
      'authored by "mallory" and pushed at 2024-01-01T00:10:00Z — so the approval predates work the approver has ' +
      'not seen. Re-apply the approved label after reviewing that commit (REQ-L5-1′ "lite" evidence, ADR-0026 ' +
      'Amendment 1).',
  );
});

// ── ADR-0026 Amendment 1 / issue #418 — re-arm only on foreign commits ──────
//
// At `lite` the approver is ALLOWED to be the author, so comparing against
// the head commit asked "did you keep working on your own branch" — linear
// cost, near-zero value at n=1, and a structural blocker for the automated
// review loop (#409). The comparison target moves to the latest FOREIGN
// commit: authored by neither the approver nor a registered
// `governance.reviewActors` identity. The `reviewActors` exemption is only
// safe because #413 made the reviewer identity verifiable against its token.

test('evaluateActor: lite — the approver\'s OWN later pushes do not re-arm the approval (REQ-418-2, #418)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [
      { sha: 'abc', login: 'alice', at: '2024-01-01T00:10:00Z' },
      { sha: 'def', login: 'alice', at: '2024-01-01T00:20:00Z' },
    ],
    tier: 'lite',
  });
  assert.equal(result.level, 'pass', 'the approver signing their own later commits certifies nothing new');
  assert.match(result.reason, /no push re-arms/i);
});

test('evaluateActor: lite — a registered reviewActors identity\'s pushes do not re-arm (REQ-418-3, #418)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: 'abc', login: 'csrinaldibot', at: '2024-01-01T00:10:00Z' }],
    denyActors: ['csrinaldibot'], // governance.reviewActors
    tier: 'lite',
  });
  assert.equal(result.level, 'pass', 'a verified reviewer identity\'s fix-push must not demand a fresh signature');
});

test('evaluateActor: lite — a THIRD-PARTY push still re-arms; the stale-green property survives (REQ-418-1, #418)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [
      { sha: 'abc', login: 'alice', at: '2024-01-01T00:05:00Z' },
      { sha: 'def', login: 'mallory', at: '2024-01-01T00:10:00Z' },
    ],
    denyActors: ['csrinaldibot'],
    tier: 'lite',
  });
  assert.equal(result.level, 'fail', 'work the approver has not seen must still invalidate the approval');
});

// Negative control: green on BOTH the pre- and post-amendment code by design.
// It pins that the exemption never reaches an identity the platform cannot
// vouch for — the guard against an over-permissive relaxation, the same class
// as #413's case-insensitivity control.
test('evaluateActor: lite — unresolvable commit authorship counts as FOREIGN and re-arms (REQ-418-4, #418)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: 'abc', login: null, at: '2024-01-01T00:10:00Z' }], // GitLab / unattributed author
    tier: 'lite',
  });
  assert.equal(result.level, 'fail', 'relief must never extend to an identity the provider cannot resolve');
});

test('evaluateActor: lite — no foreign commit at all → any approval event satisfies the evidence (REQ-418-5, #418)', () => {
  const result = evaluateActor({
    author: 'alice',
    // Label predates every commit — under the pre-amendment rule this failed.
    labeledEvents: [{ actor: { login: 'alice' }, at: '2023-12-31T00:00:00Z' }],
    commits: [{ sha: 'abc', login: 'alice', at: '2024-01-01T00:10:00Z' }],
    tier: 'lite',
  });
  assert.equal(result.level, 'pass');
});

test('evaluateActor: lite — logins fold case; a case-different approver login is the same account (REQ-418-4, #418)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'Alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: 'abc', login: 'alice', at: '2024-01-01T00:10:00Z' }],
    tier: 'lite',
  });
  assert.equal(result.level, 'pass', 'refusing on case alone would be a false positive');
});

test('evaluateActor: lite — the refusal names the foreign author and its timestamp (REQ-418-7, #418)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: 'def', login: 'mallory', at: '2024-01-01T00:10:00Z' }],
    tier: 'lite',
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /mallory/, 'the operator must be able to tell WHICH commit to review');
  assert.match(result.reason, /2024-01-01T00:10:00Z/);
  assert.match(result.reason, /re-apply the approved label/i, 'the next action must be derivable from the message');
});

test('evaluateActor: standard — a reviewActors identity\'s push does NOT exempt anything (REQ-418-6, #418)', () => {
  // The amendment is lite-only. At standard the approver is never the author,
  // so the distinct-actor rule and its message must be untouched.
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:10:00Z' }],
    commits: [{ sha: 'abc', login: 'csrinaldibot', at: '2024-01-01T00:00:00Z' }],
    denyActors: [],
    tier: 'standard',
  });
  assert.equal(result.level, 'fail', 'standard still refuses self-approval regardless of who pushed');
  assert.match(result.reason, /self-applied/i);
});

test('evaluateActor: lite — commits uncomputable (null) → fail closed (an unreadable approval is not an approval)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:10:00Z' }],
    commits: null,
    tier: 'lite',
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /unreadable/i);
});

test('evaluateActor: lite — label event carries no timestamp → fail closed', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' } }], // no `at`
    commits: [{ sha: 'abc', login: 'alice', at: '2024-01-01T00:00:00Z' }],
    tier: 'lite',
  });
  assert.equal(result.level, 'fail');
});

test('evaluateActor: regulated — distinct actor passes self-approval, but the approver also authored a commit on the branch → fail (REQ-L5-1′)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'bob' }, at: '2024-01-01T00:10:00Z' }],
    commits: [
      { sha: 'a1', login: 'alice', at: '2023-12-31T00:00:00Z' },
      { sha: 'b2', login: 'bob', at: '2024-01-01T00:00:00Z' }, // bob (the approver) pushed a commit earlier
    ],
    tier: 'regulated',
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /authored at least one commit/i);
});

test('evaluateActor: regulated — distinct actor AND no commit authored by the approver → pass', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'bob' }, at: '2024-01-01T00:10:00Z' }],
    commits: [{ sha: 'a1', login: 'alice', at: '2023-12-31T00:00:00Z' }],
    tier: 'regulated',
  });
  assert.equal(result.level, 'pass');
});

test('evaluateActor: regulated — commit authorship uncomputable (e.g. GitLab\'s all-null logins) → warn, never a false fail', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'bob' }, at: '2024-01-01T00:10:00Z' }],
    commits: [{ sha: 'a1', login: null, at: '2023-12-31T00:00:00Z' }],
    tier: 'regulated',
  });
  assert.equal(result.level, 'warn');
});

test('evaluateActor: standard — unchanged, self-approval fails with no commits/timestamp evidence supplied at all (REQ-TIER-10 no-op-migration guarantee)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' } }], // no `at`, no `commits` — must not matter at standard
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self/i);
});

// ── gatherActorCheckInputs: commits are fetched only when the tier needs them ──

test('gatherActorCheckInputs: standard tier never calls fetchCommits (REQ-TIER-10 no-op-migration guarantee)', async () => {
  let fetchCommitsCalled = false;
  const deps = {
    ...makeFakeDeps({ labeledEvents: [{ actor: { login: 'bob' } }] }),
    fetchCommits: () => { fetchCommitsCalled = true; return []; },
  };
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    prNumber: 7,
    tier: 'standard',
    deps,
  });
  assert.equal(fetchCommitsCalled, false, 'standard must never fetch commits — it is not part of its evidence form');
  assert.equal(inputs.commits, null);
});

test('gatherActorCheckInputs: lite tier fetches commits via the injected fetchCommits when a prNumber is available', async () => {
  const fakeCommits = [{ sha: 'abc', login: 'alice', at: '2024-01-01T00:00:00Z' }];
  const deps = {
    ...makeFakeDeps({ labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:10:00Z' }] }),
    fetchCommits: prNumber => { assert.equal(prNumber, 7); return fakeCommits; },
  };
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    prNumber: 7,
    tier: 'lite',
    deps,
  });
  assert.deepEqual(inputs.commits, fakeCommits);
});

test('gatherActorCheckInputs: regulated tier fetches commits via the injected fetchCommits', async () => {
  const fakeCommits = [{ sha: 'abc', login: 'bob', at: '2024-01-01T00:00:00Z' }];
  const deps = {
    ...makeFakeDeps({ labeledEvents: [{ actor: { login: 'carol' } }] }),
    fetchCommits: () => fakeCommits,
  };
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    prNumber: 7,
    tier: 'regulated',
    deps,
  });
  assert.deepEqual(inputs.commits, fakeCommits);
});

test('gatherActorCheckInputs: lite tier with no resolvable prNumber → commits stays null (never throws)', async () => {
  const deps = makeFakeDeps({ labeledEvents: [{ actor: { login: 'alice' } }] });
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    tier: 'lite',
    deps,
  });
  assert.equal(inputs.commits, null);
});

// ── runActorCheck: lite end-to-end through the wrapper (ctx.prNumber wiring) ──

test('runActorCheck: lite end-to-end — ctx.prNumber feeds gatherActorCheckInputs, distinct-act evidence passes', async () => {
  const deps = {
    ctx: { author: 'alice', repo: 'org/repo', targetBranch: 'main', body: 'Closes #144', prNumber: 7 },
    tier: 'lite',
    fetchLabeledEvents: () => [{ actor: { login: 'alice' }, at: '2024-01-01T00:10:00Z' }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'alice' }),
    fetchCommits: () => [{ sha: 'abc', login: 'alice', at: '2024-01-01T00:00:00Z' }],
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'pass');
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
    // Pinned to 'standard' — see the "main: pass verdict" comment above
    // (issue #358 Q5 Phase 4): this test is about the distinct-actor
    // self-approval check, not tier-scoped evidence ('lite' does not
    // evaluate self-approval at all — this repo's own brain.config.json
    // declares 'lite', so an unpinned tier would silently exercise a
    // different evidence form here).
    tier: 'standard',
    fetchLabeledEvents: () => [{ actor: { login: 'bob' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'bob' }),
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /self/i);
});

// ── runActorCheck / main — never throws; a gh failure fails closed when the ──
// gate is required (issue #358 Q5 Phase 5 review finding 1) ───────────────────
//
// runActorCheck/gatherActorCheckInputs/main are async as of A3 (they await the
// labelEvents CONTRACT verb dispatched via getVcs — a Promise-returning call);
// tests here await them directly instead of asserting a synchronous throw.
//
// `actor-check` is `required` at EVERY tier (GATE_MATRIX, REQ-TIER-2's
// never-tiered core) — so an API failure now fails closed regardless of
// tier, matching evaluateDistinctAct's existing fail-closed handling of an
// unreadable `prCommits`. This CHANGES prior behavior (was: unconditional
// warn) — the asymmetry finding this fixes.

test('runActorCheck: gh api failure inside the wrapper → fail closed, never throws (actor-check is required at every tier)', async () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    tier: 'standard',
    fetchLabeledEvents: () => {
      throw new Error('gh api failed: rate limited');
    },
    fetchIssue: () => ({ labels: ['status:approved'], author: 'bob' }),
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'fail');
  assert.match(result.reason, /rate limited/);
  assert.match(result.reason, /failing closed/i);
});

test('runActorCheck: gh api failure at "lite" tier ALSO fails closed (actor-check never demotes)', async () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    tier: 'lite',
    prNumber: 7,
    fetchCommits: () => {
      throw new Error('gh api failed: rate limited');
    },
    fetchLabeledEvents: () => [],
    fetchIssue: () => ({ labels: [], author: 'bob' }),
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'fail');
});

test('runActorCheck: gh api failure resolves the tier from readConfig when deps.tier is absent, defaulting to "standard" (fail-closed-safe) on a broken config', async () => {
  const deps = {
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    readConfig: () => {
      throw new Error('ENOENT: no such file');
    },
    fetchLabeledEvents: () => {
      throw new Error('gh api failed: rate limited');
    },
    fetchIssue: () => ({ labels: ['status:approved'], author: 'bob' }),
    readBotAllowlist: () => [],
  };
  const result = await runActorCheck(deps);
  assert.equal(result.level, 'fail');
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
    // Pinned to 'standard' — see the "main: pass verdict" comment above
    // (issue #358 Q5 Phase 4).
    tier: 'standard',
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
    // Pinned to 'standard' (issue #358 Q5 Phase 4): this repo's own
    // brain.config.json declares "tier": "lite" (design.md §5), and this test
    // is about the wrapper's exit-code mapping, not tier-scoped evidence — an
    // unpinned tier would silently pick up the real repo's 'lite' evidence
    // form (distinct-act) instead of the distinct-actor check this test means
    // to exercise.
    tier: 'standard',
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
    // Pinned to 'standard' — see the "main: pass verdict" comment above
    // (issue #358 Q5 Phase 4): this test is about ctx-seam wiring, not
    // tier-scoped evidence.
    tier: 'standard',
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
    // Pinned to 'standard' — see the "main: pass verdict" comment above
    // (issue #358 Q5 Phase 4): this test is about the PR_BODY fallback, not
    // tier-scoped evidence.
    tier: 'standard',
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

// ── REQ-266-6 t1 (issue #266, rev-2 binding condition B, lock 3) ──────────────
//
// The reviewer identity registers ONLY in governance.reviewActors, never in
// governance.approvalActors (design §3 two-key split). L5 (actor-check.mjs) is
// NOT touched by H0-b — at the time this test was written it kept reading
// governance.approvalActors only. Issue #375 later gave L5 a SECOND, DENY-only
// read of governance.reviewActors (see the `#375:` tests below) — this test
// still passes (now via the deny check, which fires before the self-approval
// check this test originally exercised) since #375 only narrows what passes,
// never widens it. This test uses a test-fixture reviewer identity, not a real
// registered handle (task 7.3 is deferred — no reviewer bot handle exists yet).

test('REQ-266-6 t1 (lock-3, issue #266): reviewer identity in governance.reviewActors (NOT governance.approvalActors) does not pass L5 via the allow-listed-automation branch when self-applying status:approved', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-config-'));
  writeFileSync(join(dir, 'brain.config.json'), JSON.stringify({
    governance: {
      approvalActors: [], // the reviewer must NEVER be registered here (design §3, R2)
      reviewActors: ['brain-reviewer[bot]'], // L6-only key (test fixture identity)
    },
  }));
  const result = await runActorCheck({
    author: 'brain-reviewer[bot]',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    cwd: dir,
    fetchLabeledEvents: () => [{ actor: { login: 'brain-reviewer[bot]' } }],
    fetchIssue: () => ({ labels: ['status:approved'], author: 'brain-reviewer[bot]' }),
    // deliberately NOT injecting readBotAllowlist/readConfig — exercising the
    // REAL default reader, which sources L5's botAllowlist from
    // governance.approvalActors ONLY (never governance.reviewActors).
  });
  assert.equal(
    result.level,
    'fail',
    'the reviewer must not be admitted by the allow-listed-automation branch',
  );
  // REASON UPDATED BY ISSUE #375 — the level assertion above, which is this
  // test's load-bearing claim, is unchanged.
  //
  // Originally this asserted /self/i, because the ONLY thing that caught the
  // reviewer here was rule 5 (self-approval): the fixture makes the reviewer
  // the PR author, the issue author AND the label actor at once. That is
  // precisely why this test could not detect the gap #375 fixes — it asserted
  // the reviewer does not pass via the ALLOW-listed branch, a strictly weaker
  // claim than "it fails", and it would have passed identically with no
  // deny-set at all.
  //
  // #375 added a deny check ahead of the allow-list, so the reviewer is now
  // caught earlier and for the stronger reason. Both outcomes satisfy this
  // test's intent, so accept either rather than pinning the weaker one.
  assert.match(result.reason, /self|governance\.reviewActors/i);
});

// ── issue #375 — L5 deny-set (Option A: reviewActors read as a DENY list) ─────
//
// Why these tests exist even though #266's t1 above already touches lock 3:
// t1 sets the PR author, the issue author AND the label actor all to the same
// reviewer identity, so rule 4 (self-approval) fires and returns 'fail'. Its own
// assertion message says so — "self-approval is caught instead". t1 would pass
// identically if `reviewActors` did not exist, which is exactly why the gap
// survived undetected: it asserts the reviewer does not pass via the
// ALLOW-listed branch (rule 3), a strictly weaker claim than "it fails".
//
// These tests make the reviewer a DIFFERENT actor from both authors, so nothing
// but the deny-set can catch it.

test('#375: an actor in denyActors FAILS even when it is neither the PR author nor the issue author', () => {
  const result = evaluateActor({
    author: 'alice',
    issueAuthor: 'bob',
    labeledEvents: [{ actor: { login: 'brain-reviewer[bot]' } }],
    denyActors: ['brain-reviewer[bot]'],
  });

  // Without the deny-set this falls through to rule 5 and PASSES as
  // "human-applied approval, actor differs from both" — a property rule 5
  // asserts in prose but never verifies.
  assert.equal(result.level, 'fail', 'a denied identity must never unlock status:approved');
  assert.match(result.reason, /brain-reviewer\[bot\]/);
});

test('#375: deny beats allow — an actor in BOTH denyActors and botAllowlist FAILS (fail-closed)', () => {
  const result = evaluateActor({
    author: 'alice',
    issueAuthor: 'bob',
    labeledEvents: [{ actor: { login: 'brain-reviewer[bot]' } }],
    botAllowlist: ['brain-reviewer[bot]'],
    denyActors: ['brain-reviewer[bot]'],
  });

  // `reviewer-identity-config.test.mjs` already asserts the two lists never
  // overlap in the shipped config, so this is defense in depth. It pins the
  // resolution of a contradictory config as fail-CLOSED: a misregistration must
  // not hand the reviewer the merge keystroke.
  assert.equal(result.level, 'fail', 'a contradictory config must resolve against the approval, not for it');
});

test('#375: an actor in neither list still passes — the deny-set does not widen rule 4', () => {
  const result = evaluateActor({
    author: 'alice',
    issueAuthor: 'bob',
    labeledEvents: [{ actor: { login: 'carol' } }],
    denyActors: ['brain-reviewer[bot]'],
  });

  // Negative control. Without it, a deny rule that failed everything would
  // satisfy the two tests above and still be wrong.
  assert.equal(result.level, 'pass');
});

test('#375: gatherActorCheckInputs sources denyActors from governance.reviewActors', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brain-config-'));
  writeFileSync(join(dir, 'brain.config.json'), JSON.stringify({
    governance: {
      approvalActors: ['release-bot'],
      reviewActors: ['brain-reviewer[bot]'],
    },
  }));

  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'Closes #144',
    baseBranch: 'main',
    repo: 'org/repo',
    cwd: dir,
    deps: {
      fetchLabeledEvents: () => [{ actor: { login: 'brain-reviewer[bot]' } }],
      fetchIssue: () => ({ labels: ['status:approved'], author: 'bob' }),
    },
  });

  // The two keys must stay separate on the way in: reviewActors → denyActors
  // (L5 denial, new), approvalActors → botAllowlist (L5 allow, existing).
  assert.deepEqual(inputs.denyActors, ['brain-reviewer[bot]']);
  assert.deepEqual(inputs.botAllowlist, ['release-bot']);
});

// ── issue #473 slice 2 — brain-decision/1 as additional `lite` evidence ─────
// (design.md §C, §D, §E2). `evaluateSignedDecision` is a PEER evidence source
// in `evaluateActor`'s `lite` branch, additive-OR with `evaluateDistinctAct`
// (REQ-473-1, REQ-473-6 monotonicity: a non-admissible block only ANNOTATES
// the fallback verdict, design.md §C4 — it never blocks a pass the label
// alone would already grant, and never turns a fail into a pass).

const HEAD_SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);

/** Builds a `prReviews()`-shaped review carrying a `brain-decision/1` block,
 * defaulting to a happy-path APPROVE at HEAD_SHA. `extraBody` overrides the
 * body entirely, for parse-level fixtures `renderDecision` cannot produce
 * (missing fields). */
function decisionReview({ actor = 'alice', head_sha = HEAD_SHA, decision = 'APPROVE', author = actor, protocol, at = '2026-08-07T00:00:00Z', extraBody } = {}) {
  const body = extraBody ?? renderDecision({ protocol, decision, head_sha, actor, at });
  return { state: 'COMMENTED', author, body };
}

// ── resolveHeadSha (design §D) ───────────────────────────────────────────────

test('resolveHeadSha: returns the last commit\'s sha (PR head, ascending prCommits() list)', () => {
  assert.equal(resolveHeadSha([{ sha: 'a' }, { sha: 'b' }, { sha: HEAD_SHA }]), HEAD_SHA);
});

test('resolveHeadSha: null/empty commits → null (uncomputable, never assumed) — design §D2, distinct from evaluateDistinctAct\'s OWN null handling', () => {
  assert.equal(resolveHeadSha(null), null);
  assert.equal(resolveHeadSha([]), null);
});

// ── evaluateSignedDecision — rule 1: decisions === null (review list unreadable) ─

test('evaluateSignedDecision: decisions === null (PR review list unreadable) → refuse, note names the reason', () => {
  const result = evaluateSignedDecision({ decisions: null, headSha: HEAD_SHA });
  assert.equal(result.admitted, false);
  assert.match(result.note, /unreadable/i);
});

// ── PATH axis — rules 2/3: nothing addressed to this reader → silent (null) ──

test('evaluateSignedDecision: PATH — decisions === [] (no reviews at all) → silent (null), never a note', () => {
  assert.equal(evaluateSignedDecision({ decisions: [], headSha: HEAD_SHA }), null);
});

test('evaluateSignedDecision: PATH — a review with no fence at all (a plain "+1" comment) → silent (null)', () => {
  const result = evaluateSignedDecision({
    decisions: [{ state: 'COMMENTED', author: 'alice', body: 'looks good, +1' }],
    headSha: HEAD_SHA,
  });
  assert.equal(result, null);
});

test('evaluateSignedDecision: rule 3 — a review carrying a brain-review/1 block (wrong protocol family) is not addressed to this reader → silent', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ protocol: 'brain-review/1' })],
    headSha: HEAD_SHA,
  });
  assert.equal(result, null);
});

// ── rule 4: addressed but unsupported protocol version → refuse ─────────────

test('evaluateSignedDecision: rule 4 — brain-decision/2 (unsupported version) → refuse, names the version (addressed, unlike rule 3)', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ protocol: 'brain-decision/2' })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
  assert.match(result.note, /brain-decision\/2/);
  assert.match(result.note, /unsupported|version/i);
});

// ── rules 5-9: field-level malformation (parse-level, re-verified end-to-end) ─

test('evaluateSignedDecision: rule 5 — decision field absent → refuse', () => {
  const body = ['```yaml', 'protocol: brain-decision/1', `head_sha: ${HEAD_SHA}`, 'actor: alice', '```'].join('\n');
  const result = evaluateSignedDecision({
    decisions: [{ state: 'COMMENTED', author: 'alice', body }],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
});

test('evaluateSignedDecision: rule 6 — decision present but not exactly APPROVE → refuse', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ decision: 'REJECT' })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
});

test('evaluateSignedDecision: rule 7 — head_sha field absent → refuse', () => {
  const body = ['```yaml', 'protocol: brain-decision/1', 'decision: APPROVE', 'actor: alice', '```'].join('\n');
  const result = evaluateSignedDecision({
    decisions: [{ state: 'COMMENTED', author: 'alice', body }],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
});

test('evaluateSignedDecision: VALUE CLASS — rule 8 head_sha malformed (not 40 hex) → refuse', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ head_sha: 'not-a-valid-sha-at-all' })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
});

test('evaluateSignedDecision: VALUE CLASS — rule 9 head_sha is a 7-char PREFIX of the PR head → refuse (not 40 hex)', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ head_sha: HEAD_SHA.slice(0, 7) })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
});

// ── VALUE CLASS — rules 10/11: head_sha vs PR head (this function's OWN compare) ─

test('evaluateSignedDecision: VALUE CLASS — rule 10 head_sha mismatches the PR head (39-hex-equivalent-length, different value) → refuse, names both SHAs', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ head_sha: OTHER_SHA })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
  assert.match(result.note, new RegExp(OTHER_SHA));
  assert.match(result.note, new RegExp(HEAD_SHA));
});

test('evaluateSignedDecision: VALUE CLASS — a head_sha sharing only a 7-char PREFIX with the real head (rest differs) → refuse (full-length compare, not a prefix compare)', () => {
  const prefixColliding = HEAD_SHA.slice(0, 7) + 'b'.repeat(33); // 'aaaaaaa' + 33 'b's — same first 7 chars as HEAD_SHA, differs after
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ head_sha: prefixColliding })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false, 'a shared 7-char prefix must never be mistaken for a match — the compare is full-length');
});

test('evaluateSignedDecision: VALUE CLASS — head_sha case-folded (hex case is not identity) — a case-different but otherwise-matching head_sha ADMITS', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ head_sha: HEAD_SHA.toUpperCase() })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, true);
});

test('evaluateSignedDecision: rule 11 — PR head unresolvable (headSha null) → refuse', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview()],
    headSha: null,
  });
  assert.equal(result.admitted, false);
  assert.match(result.note, /cannot resolve the pr head/i);
});

// PR #503 cold-review round 1, finding 2: the guard at actor-check.mjs:268
// checked ONLY `headSha === null`; `undefined` or a non-string value (e.g. a
// number) reached `parsed.head_sha.toLowerCase() !== headSha.toLowerCase()`
// and THREW instead of refusing. The contract is "never throws, refuse
// instead" — these two rows drive the SAME rule-11 refusal path with the
// other non-string shapes, mirroring the null case above exactly.
test('evaluateSignedDecision: fail-closed — headSha undefined (never resolved/threaded) → refuse, never throws', () => {
  assert.doesNotThrow(() => {
    const result = evaluateSignedDecision({
      decisions: [decisionReview()],
      headSha: undefined,
    });
    assert.equal(result.admitted, false);
    assert.match(result.note, /cannot resolve the pr head/i);
  });
});

test('evaluateSignedDecision: fail-closed — headSha a non-string (number) → refuse, never throws', () => {
  assert.doesNotThrow(() => {
    const result = evaluateSignedDecision({
      decisions: [decisionReview()],
      headSha: 123,
    });
    assert.equal(result.admitted, false);
    assert.match(result.note, /cannot resolve the pr head/i);
  });
});

// ── rules 12-14: actor field vs review author ─────────────────────────────────

test('evaluateSignedDecision: rule 12 — actor field absent → refuse', () => {
  const body = ['```yaml', 'protocol: brain-decision/1', 'decision: APPROVE', `head_sha: ${HEAD_SHA}`, '```'].join('\n');
  const result = evaluateSignedDecision({
    decisions: [{ state: 'COMMENTED', author: 'alice', body }],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
});

test('evaluateSignedDecision: rule 13 — review author unresolvable (null) → refuse, an unresolvable identity is never treated as a match', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ author: null })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
  assert.match(result.note, /unresolvable/i);
});

test('evaluateSignedDecision: rule 14 — block actor differs from the posting review author → refuse, names both', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ actor: 'alice', author: 'mallory' })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
  assert.match(result.note, /alice/);
  assert.match(result.note, /mallory/);
});

test('evaluateSignedDecision: actor/author comparison case-folds (both providers case-insensitive) — a case-different match ADMITS', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ actor: 'Alice', author: 'alice' })],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, true);
});

// ── rule 15: deny-set — a review identity may never SIGN an approval either ──

test('evaluateSignedDecision: rule 15 — review author is a denyActors (governance.reviewActors) identity → refuse, regardless of head_sha/actor match', () => {
  const result = evaluateSignedDecision({
    decisions: [decisionReview({ actor: 'brain-reviewer[bot]', author: 'brain-reviewer[bot]' })],
    headSha: HEAD_SHA,
    denyActors: ['brain-reviewer[bot]'],
  });
  assert.equal(result.admitted, false);
  assert.match(result.note, /reviewActors|never sign/i);
});

// ── rule 16: multiple reviews — evaluate ALL in order, admit if ANY, else collect notes ─

test('evaluateSignedDecision: rule 16 — first review non-admissible, second admissible → ADMITS on the second (evaluate ALL, order preserved)', () => {
  const result = evaluateSignedDecision({
    decisions: [
      decisionReview({ head_sha: OTHER_SHA, author: 'mallory', actor: 'mallory' }),
      decisionReview({ head_sha: HEAD_SHA, author: 'alice', actor: 'alice' }),
    ],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, true);
});

test('evaluateSignedDecision: rule 16 — none admissible across several reviews → refuse, note collects EACH refusal, not just the first (FIELD axis)', () => {
  const result = evaluateSignedDecision({
    decisions: [
      decisionReview({ head_sha: OTHER_SHA, author: 'mallory', actor: 'mallory' }),
      decisionReview({ decision: 'REJECT', author: 'bob', actor: 'bob' }),
    ],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false);
  assert.match(result.note, new RegExp(OTHER_SHA), 'the note must name the FIRST refused block, not just "refused"');
  assert.match(result.note, /malformed|not admissible/i, 'the note must ALSO carry the SECOND review\'s refusal, not just the first (a truncating implementation would drop it)');
});

// ── rule 17: multiple fences in ONE body — only the first is ever read ───────

test('evaluateSignedDecision: rule 17 — a stale FIRST fence refuses even though a fresh SECOND (quoted) fence would be valid', () => {
  const stale = renderDecision({ decision: 'APPROVE', head_sha: OTHER_SHA, actor: 'alice', at: '2026-01-01T00:00:00Z' });
  const fresh = renderDecision({ decision: 'APPROVE', head_sha: HEAD_SHA, actor: 'alice', at: '2026-01-02T00:00:00Z' });
  const result = evaluateSignedDecision({
    decisions: [{ state: 'COMMENTED', author: 'alice', body: `${stale}\n\nQuoting an earlier reply:\n\n${fresh}` }],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, false, 'the FIRST fence governs — a fresher quoted block does not rescue it (fail-closed direction)');
});

test('evaluateSignedDecision: rule 17 — a valid FIRST fence admits even though a SECOND (ignored) fence would be invalid', () => {
  const fresh = renderDecision({ decision: 'APPROVE', head_sha: HEAD_SHA, actor: 'alice', at: '2026-01-01T00:00:00Z' });
  const brokenSecond = ['```yaml', 'protocol: brain-decision/2', '```'].join('\n');
  const result = evaluateSignedDecision({
    decisions: [{ state: 'COMMENTED', author: 'alice', body: `${fresh}\n\n${brokenSecond}` }],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, true);
});

// ── FIELD axis — rule 20: an unknown extra field never changes admissibility ──

test('evaluateSignedDecision: FIELD — an unknown extra field (e.g. a future dispositions) does not change admissibility (rule 20)', () => {
  const body = [
    '```yaml',
    'protocol: brain-decision/1',
    'decision: APPROVE',
    `head_sha: ${HEAD_SHA}`,
    'actor: alice',
    'dispositions: something-not-in-slice-1',
    '```',
  ].join('\n');
  const result = evaluateSignedDecision({
    decisions: [{ state: 'COMMENTED', author: 'alice', body }],
    headSha: HEAD_SHA,
  });
  assert.equal(result.admitted, true);
});

// ── LITE_SIGNED_EVIDENCE_SOURCES — the pluggable list (design §C2) ──────────

test('LITE_SIGNED_EVIDENCE_SOURCES: frozen, and its sole default member is evaluateSignedDecision', () => {
  assert.ok(Object.isFrozen(LITE_SIGNED_EVIDENCE_SOURCES));
  assert.equal(LITE_SIGNED_EVIDENCE_SOURCES.length, 1);
  assert.equal(LITE_SIGNED_EVIDENCE_SOURCES[0], evaluateSignedDecision);
});

// ── evaluateActor composite seam — the (b)-swap boundary (design §C2) ────────

test('evaluateActor: lite — signedEvidenceSources is an INJECTED list, not a hardcoded call (order preserved, first-admitted-wins)', () => {
  const calls = [];
  const refusing = () => { calls.push('refusing'); return { admitted: false, note: 'source A refuses' }; };
  const admitting = () => { calls.push('admitting'); return { admitted: true, reason: 'source B admits' }; };
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: HEAD_SHA, login: 'mallory', at: '2024-01-01T00:10:00Z' }],
    tier: 'lite',
    signedEvidenceSources: [refusing, admitting],
  });
  assert.deepEqual(calls, ['refusing', 'admitting'], 'sources must be tried IN ORDER');
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /source B admits/);
});

test('evaluateActor: lite — first-admitted-wins: a SECOND source is never consulted once an earlier one admits', () => {
  const calls = [];
  const admitting = () => { calls.push('first'); return { admitted: true, reason: 'first admits' }; };
  const neverCalled = () => { calls.push('second'); return { admitted: true, reason: 'must never run' }; };
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: HEAD_SHA, login: 'mallory', at: '2024-01-01T00:10:00Z' }],
    tier: 'lite',
    signedEvidenceSources: [admitting, neverCalled],
  });
  assert.deepEqual(calls, ['first']);
  assert.match(result.reason, /first admits/);
});

// ── success criterion (task 2.1) + monotonicity (REQ-473-6) ─────────────────

test('evaluateActor: lite — a brain-decision/1 APPROVE at the current head passes even though the approved-label PREDATES a later foreign commit (issue #473 REQ-473-1, success criterion)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [
      { sha: 'x', login: 'alice', at: '2024-01-01T00:00:00Z' },
      { sha: HEAD_SHA, login: 'mallory', at: '2024-01-01T00:10:00Z' }, // foreign, postdates the label
    ],
    headSha: HEAD_SHA,
    decisions: [decisionReview({ head_sha: HEAD_SHA, author: 'alice', actor: 'alice' })],
    tier: 'lite',
  });
  assert.equal(result.level, 'pass');
  assert.match(result.reason, /brain-decision\/1/i);
});

test('evaluateActor: lite — negative control: WITHOUT any decision block, the identical foreign-commit-after-label input still fails (proves the BLOCK admits it, not the commit list)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [
      { sha: 'x', login: 'alice', at: '2024-01-01T00:00:00Z' },
      { sha: HEAD_SHA, login: 'mallory', at: '2024-01-01T00:10:00Z' },
    ],
    headSha: HEAD_SHA,
    tier: 'lite',
  });
  assert.equal(result.level, 'fail');
});

test('evaluateActor: lite — a non-admissible decision block ANNOTATES an otherwise-passing verdict, never blocks it (design §C4 monotonicity)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:10:00Z' }],
    commits: [{ sha: 'abc', login: 'alice', at: '2024-01-01T00:00:00Z' }],
    decisions: [decisionReview({ head_sha: OTHER_SHA, author: 'alice', actor: 'alice' })], // stale block
    headSha: HEAD_SHA,
    tier: 'lite',
  });
  assert.equal(result.level, 'pass', 'the label alone already satisfies lite — the broken block must not turn this into a fail');
  assert.match(result.reason, new RegExp(OTHER_SHA), 'the note naming the refused block\'s head_sha must be appended to the passing reason');
});

test('evaluateActor: lite — a non-admissible decision block does NOT turn an otherwise-failing label check into a pass (fail stays fail, note appended)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:00:00Z' }],
    commits: [{ sha: HEAD_SHA, login: 'mallory', at: '2024-01-01T00:10:00Z' }],
    decisions: [decisionReview({ head_sha: OTHER_SHA, author: 'alice', actor: 'alice' })],
    headSha: HEAD_SHA,
    tier: 'lite',
  });
  assert.equal(result.level, 'fail');
  assert.match(result.reason, new RegExp(OTHER_SHA));
});

// ── design §C5 property 1 — the label stays a required precondition ─────────

test('evaluateActor: lite — no labeled event at all → warn+pass even with an ADMISSIBLE decision block present (design §C5 property 1: the block never bypasses the label precondition)', () => {
  const result = evaluateActor({
    author: 'alice',
    labeledEvents: [],
    headSha: HEAD_SHA,
    decisions: [decisionReview({ head_sha: HEAD_SHA, author: 'alice', actor: 'alice' })],
    tier: 'lite',
  });
  assert.equal(result.level, 'warn', 'a signed block alone must never bypass the "no labeled event" precondition');
});

// ── gatherActorCheckInputs: decisions/headSha threading (design §D, REQ-473-10) ─

test('gatherActorCheckInputs: standard tier never calls fetchDecisions (REQ-473-10 no-op-migration guarantee)', async () => {
  let called = false;
  const deps = { ...makeFakeDeps({ labeledEvents: [{ actor: { login: 'bob' } }] }), fetchDecisions: () => { called = true; return []; } };
  const inputs = await gatherActorCheckInputs({
    author: 'alice', prBody: 'Closes #144', baseBranch: 'main', repo: 'org/repo', prNumber: 7, tier: 'standard', deps,
  });
  assert.equal(called, false, 'standard must never fetch decisions — it is not part of its evidence form');
  assert.equal(inputs.decisions, null);
});

test('gatherActorCheckInputs: regulated tier never calls fetchDecisions', async () => {
  let called = false;
  const deps = { ...makeFakeDeps({ labeledEvents: [{ actor: { login: 'bob' } }] }), fetchDecisions: () => { called = true; return []; } };
  const inputs = await gatherActorCheckInputs({
    author: 'alice', prBody: 'Closes #144', baseBranch: 'main', repo: 'org/repo', prNumber: 7, tier: 'regulated', deps,
  });
  assert.equal(called, false);
  assert.equal(inputs.decisions, null);
});

test('gatherActorCheckInputs: lite tier fetches decisions via the injected fetchDecisions when a prNumber is available; headSha resolves from the ALREADY-fetched commits (no second prView, design §D4)', async () => {
  const fakeDecisions = [decisionReview({ head_sha: HEAD_SHA })];
  const deps = {
    ...makeFakeDeps({ labeledEvents: [{ actor: { login: 'alice' }, at: '2024-01-01T00:10:00Z' }] }),
    fetchDecisions: prNumber => { assert.equal(prNumber, 7); return fakeDecisions; },
    fetchCommits: () => [{ sha: HEAD_SHA, login: 'alice', at: '2024-01-01T00:00:00Z' }],
  };
  const inputs = await gatherActorCheckInputs({
    author: 'alice', prBody: 'Closes #144', baseBranch: 'main', repo: 'org/repo', prNumber: 7, tier: 'lite', deps,
  });
  assert.deepEqual(inputs.decisions, fakeDecisions);
  assert.equal(inputs.headSha, HEAD_SHA);
});

test('gatherActorCheckInputs: lite tier with no resolvable prNumber → decisions/headSha stay null (never throws)', async () => {
  const deps = makeFakeDeps({ labeledEvents: [{ actor: { login: 'alice' } }] });
  const inputs = await gatherActorCheckInputs({
    author: 'alice', prBody: 'Closes #144', baseBranch: 'main', repo: 'org/repo', tier: 'lite', deps,
  });
  assert.equal(inputs.decisions, null);
  assert.equal(inputs.headSha, null);
});

// ── SITE axis — gatherActorCheckInputs has TWO return statements; both must thread ─

test('gatherActorCheckInputs: SITE — the early return (no resolvable issue number) still carries decisions/headSha, not only the normal-path return (actor-check.mjs:670)', async () => {
  const fakeDecisions = [decisionReview({ head_sha: HEAD_SHA })];
  const deps = {
    fetchDecisions: () => fakeDecisions,
    fetchCommits: () => [{ sha: HEAD_SHA, login: 'alice', at: '2024-01-01T00:00:00Z' }],
  };
  const inputs = await gatherActorCheckInputs({
    author: 'alice',
    prBody: 'no issue reference here',
    baseBranch: 'main',
    repo: 'org/repo',
    prNumber: 7,
    tier: 'lite',
    deps,
  });
  assert.equal(inputs.labeledEvents.length, 0, 'sanity: this exercises the early-return branch (no issue number resolved)');
  assert.deepEqual(inputs.decisions, fakeDecisions, 'the early return must also thread decisions');
  assert.equal(inputs.headSha, HEAD_SHA, 'the early return must also thread headSha');
});

test('SITE — actor-check.mjs never CALLS .prView(; headSha is derived from the already-fetched commits list (design §D4, no second source of truth for "the head")', () => {
  const srcPath = fileURLToPath(new URL('./actor-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(/\.prView\(/.test(src), false, 'headSha must come from resolveHeadSha(commits), never a second prView() call — a doc comment MAY name it, code must not call it');
});

// ── REQ-473-6 monotonicity — the pre-existing evaluateDistinctAct matrix is untouched ─
//
// No new assertions here by design: the entire pre-existing test block above
// this section (lines 1-1227) is re-run byte-for-byte unmodified by this same
// `npm test` invocation — that IS the monotonicity proof (task 2.10). Adding a
// parallel "re-run" block here would test node:test's own re-execution, not
// this change.
