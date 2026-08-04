// regulated-review.e2e.test.mjs — issue #409: the `/2` reviewer path, end to end.
//
// Each case SPAWNS the real `brain:review` CLI from a vendored consumer fixture
// (fixture.mjs) with only the `gh` binary faked on PATH (gh-stub/gh). The posted
// artifact is what the stub captured in `posted/reviews.jsonl`, parsed with the REAL
// parseVerdict — see design D1: no in-process seam is used, so the identity gates,
// cold-boot, the evaluators, causal admission and the poster all run production code
// across a real process boundary.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFixture } from './fixture.mjs';
import { parseVerdict } from '../../brain/scripts/review/lib/parse-verdict.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB_BIN = join(HERE, 'gh-stub');

/** Spawns the fixture's own vendored brain:review against its PR. */
function runReview(fx, { token = 'tok-e2e', extraArgs = [] } = {}) {
  const r = spawnSync(
    process.execPath,
    [join(fx.repoDir, 'brain', 'scripts', 'review', 'cli.mjs'), '--pr', String(fx.prNumber), ...extraArgs],
    {
      cwd: fx.repoDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${STUB_BIN}${delimiter}${process.env.PATH}`,
        GH_STUB_DIR: fx.stubDir,
        ...(token === null ? { BRAIN_REVIEWER_TOKEN: '' } : { BRAIN_REVIEWER_TOKEN: token }),
      },
    },
  );
  return r;
}

function postedBodies(fx) {
  const p = join(fx.stubDir, 'posted', 'reviews.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

function stubCalls(fx) {
  const p = join(fx.stubDir, 'calls.log');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

// ── REQ-409-1/2/3: a regulated run posts a parseable, causally-annotated /2 ──

test('e2e: a regulated consumer posts a brain-review/2 verdict, parseable by the real parser (REQ-409-1/2)', () => {
  const fx = buildFixture({ tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, `brain:review must exit 0 — stderr:\n${r.stderr}\nstdout:\n${r.stdout}`);

  const posted = postedBodies(fx);
  assert.equal(posted.length, 1, 'exactly one review must be posted');
  const body = posted[0].body;
  assert.match(body, /brain-review\/2/, 'the posted protocol must be /2 — /1 here is the silent degradation observed live on PR #412');

  const verdict = parseVerdict({ body });
  assert.ok(verdict, 'the posted body must parse with the REAL parseVerdict (the #381 class stays impossible)');
  assert.equal(verdict.protocol, 'brain-review/2');
  assert.ok(Array.isArray(verdict.findings) && verdict.findings.length >= 1,
    'the fixture diff breaches regulated\'s 200-line budget — at least one finding must survive to the posted body (design D4)');
});

test('e2e: /2 findings carry the causal-admission annotations (REQ-409-3)', () => {
  const fx = buildFixture({ tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const verdict = parseVerdict({ body: postedBodies(fx)[0].body });
  for (const f of verdict.findings) {
    assert.ok(f.evidence_class, `finding lacks evidence_class — /2 in name only: ${JSON.stringify(f)}`);
    assert.ok(f.causal_disposition, `finding lacks causal_disposition: ${JSON.stringify(f)}`);
  }
});

// ── REQ-409-4: the tier really selects the protocol, both directions ─────────

test('e2e: the same fixture at lite posts /1 — the harness detects the tier, and regulated must NOT degrade to it (REQ-409-4)', () => {
  const fx = buildFixture({ tier: 'lite' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const body = postedBodies(fx)[0].body;
  assert.match(body, /brain-review\/1/);
  assert.doesNotMatch(body, /brain-review\/2/);
});

// ── REQ-409-5: the identity gates EXECUTE — through them, never around ───────

test('e2e: the identity endpoint is actually hit, token-scoped (REQ-409-5a — #413 executes)', () => {
  const fx = buildFixture({ tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const userCalls = stubCalls(fx).filter(c => c.argv.join(' ') === 'api /user');
  assert.ok(userCalls.length >= 1, 'whoami never ran — the #413 verification was bypassed, which this e2e must never do');
  assert.ok(userCalls.every(c => c.gh_token === 'present'),
    'whoami must be scoped to the reviewer token (GH_TOKEN present in the stub call)');
});

test('e2e: a token whose real login differs from the handle refuses at boot — nothing posted (REQ-409-5b)', () => {
  const fx = buildFixture({ tier: 'regulated', handle: 'the-bot' });
  // The stub's /user returns the configured handle; override the canned response
  // to impersonate a different account holding the token.
  const userJson = join(fx.stubDir, 'user.json');
  writeFileSync(userJson, JSON.stringify({ login: 'someone-else' }) + '\n');
  const r = runReview(fx);
  assert.notEqual(r.status, 0, 'a mismatched identity must refuse');
  assert.match(r.stderr, /the-bot|someone-else/, 'the refusal must name the identities');
  assert.equal(postedBodies(fx).length, 0, 'nothing may be posted under an unverified identity');
});

test('e2e: a missing token refuses at boot — nothing posted (REQ-409-5c)', () => {
  const fx = buildFixture({ tier: 'regulated' });
  const r = runReview(fx, { token: null });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /BRAIN_REVIEWER_TOKEN/);
  assert.equal(postedBodies(fx).length, 0);
});

// ── REQ-409-6: /2 plumbing honesty — the #408 boundary ───────────────────────

test('e2e: follow_ups is present and EMPTY, the refuter silent — flip means #408 landed, move these, do not delete them (REQ-409-6)', () => {
  const fx = buildFixture({ tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const verdict = parseVerdict({ body: postedBodies(fx)[0].body });
  // No evaluator emits pre-existing/base-only (#408): follow_ups must parse and be [].
  assert.deepEqual(verdict.follow_ups ?? [], [],
    'follow_ups populated?! that is #408 landing — move this assertion to its harness, do not delete it');
  // No evaluator emits evidence_class: inferential (#408): the refuter must not have run.
  assert.ok(verdict.findings.every(f => f.evidence_class !== 'inferential'),
    'an inferential finding appeared — the refuter fork is live; #408 has landed and this pin must move with it');
});
