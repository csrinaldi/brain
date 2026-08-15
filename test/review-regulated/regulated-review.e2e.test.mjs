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
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildFixture } from './fixture.mjs';
import { parseVerdict } from '../../brain/scripts/review/lib/parse-verdict.mjs';
import { postVerdict } from '../../brain/scripts/review/poster.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB_BIN = join(HERE, 'gh-stub');

/**
 * Builds a fixture and registers its removal (review finding F3). Each one vendors
 * brain/core + brain/scripts and adds a clone and a bare origin — ~8 MB measured —
 * and since this file now runs on every `npm test`, the un-cleaned version leaked
 * ~57 MB per suite pass. Measured on this working tree before the fix: 47 orphaned
 * trees, 383 MB.
 */
function withFixture(t, opts) {
  const fx = buildFixture(opts);
  t.after(() => rmSync(fx.base, { recursive: true, force: true }));
  return fx;
}

/** Spawns the fixture's own vendored brain:review against its PR. */
function runReview(fx, { token = 'tok-e2e', validToken = null, injectCredentials = false, extraArgs = [] } = {}) {
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
        // #604: the stub's `/user` now honours the credential, so it needs to
        // know which one is real. `validToken` defaults to the token under
        // test — the healthy case — and a test that wants a
        // credential-injecting environment sets them apart.
        GH_STUB_VALID_TOKEN: validToken ?? token ?? 'tok-e2e',
        ...(injectCredentials ? { GH_STUB_INJECT_CREDENTIALS: '1' } : {}),
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

test('e2e: a regulated consumer posts a brain-review/2 verdict, parseable by the real parser (REQ-409-1/2)', (t) => {
  const fx = withFixture(t, { tier: 'regulated' });
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
  // #443: the finding source is the budget breach again, not the stand-in red gate.
  // The unit tests prove the resolution; this proves the tiered budget survives the
  // whole production chain — real CLI, real config load, real diff — to the body
  // that gets posted.
  const budget = verdict.findings.find(f => f.id === 'budget');
  assert.ok(budget, `the 250-line diff must trip regulated's 200 budget end to end — got: ${JSON.stringify(verdict.findings)}`);
  assert.match(budget.evidence, /250 > 200/, 'the posted evidence must carry the comparison the reviewer actually applied');
  assert.match(budget.evidence, /regulated/, 'and the tier that produced that budget');
});

test('e2e: the SAME 250-line diff is silent at lite — and the silence is MEASURED, not vacuous (REQ-443-1)', (t) => {
  // The negative half of #443 at the e2e level. Before the fix this same fixture at
  // lite was judged against a hardcoded 400: a 500-line PR would have been flagged
  // on the tier brain itself declares.
  //
  // Review finding (cold review of PR #471): the first version of this test asserted
  // ONLY the absence of the budget finding, so it passed having observed nothing —
  // `evidence-reader-empty-on-failure` in the assertion layer, in the test whose
  // sibling forty lines below explicitly rejects "a different test over a different
  // fixture instance covers it" as an argument. Reproduced: mutating
  // `gatherTrancheInputs` to `if (true || !baseSha || !headSha)` (budget NEVER
  // computed) left this case GREEN while two others went red.
  //
  // So the silence now has to be positive evidence. An uncomputable budget fails
  // closed to REVISE + a condition (tranche.mjs's §10 rule), which is a state this
  // assertion pair can see; and the companion case below proves this fixture's diff
  // is measured against lite's budget at all.
  const fx = withFixture(t, { tier: 'lite' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const verdict = parseVerdict({ body: postedBodies(fx)[0].body });
  assert.ok(Array.isArray(verdict.findings), 'findings must be present — an absent list would make the check below vacuous');
  assert.equal(verdict.findings.find(f => f.id === 'budget'), undefined,
    'a budget finding at lite/250 is the #443 false positive — governance allows 1000 here');
  assert.equal(verdict.verdict, 'APPROVE',
    'the budget was COMPUTED and cleared — an uncomputable budget fails closed to REVISE, which is how this case tells "silent" from "never measured"');
  assert.deepEqual(verdict.conditions ?? [], [],
    'and carries no uncomputable-evidence condition');
});

test('e2e: at lite, 1001 lines DOES trip the budget — the positive control for the case above (REQ-443-1)', (t) => {
  // Without this, "silent at lite" is unfalsifiable from inside its own fixture: a
  // fixture whose diff silently shrank to 1 line would still pass. This case is what
  // makes lite's budget observably 1000 across the real process boundary, and it is
  // the e2e twin of the unit-level `trancheAtTier('lite', 1001)`.
  const fx = withFixture(t, { tier: 'lite', diffLines: 1001 });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const verdict = parseVerdict({ body: postedBodies(fx)[0].body });
  const budget = verdict.findings.find(f => f.id === 'budget');
  assert.ok(budget, `1001 lines must breach lite's 1000 budget — got: ${JSON.stringify(verdict.findings)}`);
  assert.match(budget.evidence, /> 1000 \(tier: lite\)/, 'and must name lite\'s budget, not another tier\'s');
});

test('e2e: /2 findings carry the causal-admission annotations (REQ-409-3)', (t) => {
  const fx = withFixture(t, { tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const verdict = parseVerdict({ body: postedBodies(fx)[0].body });
  // Guard first (review finding F2): a zero-length findings array iterates zero
  // times and this test — whose whole job is proving /2 is not /1 in name only —
  // would go GREEN over nothing. REQ-409-1's length check is a different test over
  // a different fixture instance, so it cannot cover this one. That matters
  // concretely: when #443 lands and the fixture swaps its finding source back to
  // the diff-budget breach, a breach that produces no finding turns REQ-409-1 red
  // and would have left this one green.
  assert.ok(verdict.findings.length >= 1,
    'no findings to annotate — without this guard the loop below would pass over nothing');
  for (const f of verdict.findings) {
    assert.ok(f.evidence_class, `finding lacks evidence_class — /2 in name only: ${JSON.stringify(f)}`);
    assert.ok(f.causal_disposition, `finding lacks causal_disposition: ${JSON.stringify(f)}`);
  }
});

// ── REQ-409-4: the tier really selects the protocol, both directions ─────────

test('e2e: the same fixture at lite posts /1 — the harness detects the tier, and regulated must NOT degrade to it (REQ-409-4)', (t) => {
  const fx = withFixture(t, { tier: 'lite' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const body = postedBodies(fx)[0].body;
  assert.match(body, /brain-review\/1/);
  assert.doesNotMatch(body, /brain-review\/2/);
});

// ── REQ-409-5: the identity gates EXECUTE — through them, never around ───────

test('e2e: the identity endpoint is actually hit, token-scoped (REQ-409-5a — #413 executes)', (t) => {
  const fx = withFixture(t, { tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const userCalls = stubCalls(fx).filter(c => c.argv.join(' ') === 'api /user');
  assert.ok(userCalls.length >= 1, 'whoami never ran — the #413 verification was bypassed, which this e2e must never do');
  assert.ok(userCalls.every(c => c.gh_token === 'present'),
    'whoami must be scoped to the reviewer token (GH_TOKEN present in the stub call)');
});

test('e2e: a token whose real login differs from the handle refuses at boot — nothing posted (REQ-409-5b)', (t) => {
  const fx = withFixture(t, { tier: 'regulated', handle: 'the-bot' });
  // The stub's /user returns the configured handle; override the canned response
  // to impersonate a different account holding the token.
  const userJson = join(fx.stubDir, 'user.json');
  writeFileSync(userJson, JSON.stringify({ login: 'someone-else' }) + '\n');
  const r = runReview(fx);
  assert.notEqual(r.status, 0, 'a mismatched identity must refuse');
  assert.match(r.stderr, /the-bot|someone-else/, 'the refusal must name the identities');
  assert.equal(postedBodies(fx).length, 0, 'nothing may be posted under an unverified identity');
});

// ── REQ-604-1: the negative control, end to end ──────────────────────────────

test('e2e: an environment that resolves an INVALID token refuses at boot — nothing posted (REQ-604-1)', (t) => {
  // Reproduces the environment measured in #604: behind a credential-injecting
  // proxy, `api /user` answers for the CALLER, so an invented token, an empty
  // one and no token at all resolve to the same authenticated login. The
  // reviewer's identity evidence is then the environment's, not the token's.
  //
  // The handle is set to the login the environment injects — the dangerous
  // direction of the two in #604's table. Before the negative control this
  // combination VERIFIED and PROCEEDED, satisfying the check with a credential
  // that was never used; #413's mismatch never fires because the two agree.
  const fx = withFixture(t, { tier: 'regulated', handle: 'ambient-operator' });
  writeFileSync(join(fx.stubDir, 'user.json'), JSON.stringify({ login: 'ambient-operator' }) + '\n');

  const r = runReview(fx, { token: 'unread', injectCredentials: true });

  assert.notEqual(r.status, 0, 'a verification the environment can satisfy without the token must refuse');
  assert.match(r.stderr, /INVALID token/i, 'the refusal must name the control, not a mismatch');
  assert.match(r.stderr, /ambient-operator/, 'and the ambient identity it resolved to');
  assert.doesNotMatch(r.stderr, /reviewer\.handle claims/,
    'must NOT surface as a #413 mismatch — that shape sent the maintainer through three token rotations');
  assert.equal(postedBodies(fx).length, 0, 'nothing may be posted on identity evidence the token did not establish');
});

test('e2e: the healthy environment still proceeds — the control is not a blanket refusal (REQ-604-2)', (t) => {
  // The other direction, and the one that would make this control worthless if
  // it failed: where credentials ARE honoured, the run is unaffected.
  const fx = withFixture(t, { tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(postedBodies(fx).length, 1, 'the verdict still posts in an environment that honours the token');
});

test('e2e: the control probes with a token that is NOT the reviewer credential (REQ-604-3)', (t) => {
  // The probe must never be satisfiable by the real token, or it proves nothing.
  const fx = withFixture(t, { tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const userCalls = stubCalls(fx).filter(c => c.argv.join(' ') === 'api /user');
  assert.ok(userCalls.length >= 2,
    'the identity endpoint must be hit twice: once with the deliberately invalid token, once with the real one');
});

test('e2e: a missing token refuses at boot — nothing posted (REQ-409-5c)', (t) => {
  const fx = withFixture(t, { tier: 'regulated' });
  const r = runReview(fx, { token: null });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /BRAIN_REVIEWER_TOKEN/);
  assert.equal(postedBodies(fx).length, 0);
});

// ── REQ-409-6: /2 plumbing honesty — the boundary, redrawn by #408 ───────────
//
// #408 HAS LANDED, and this pin was left with the instruction "flip means #408
// landed, move these, do not delete them". It did not flip, and that is correct
// rather than lucky: this case's finding is `gate:phase-order`, and `phase-order`
// reads THIS PR's artefacts, so no base comparison can speak to it. What the pin
// asserted has become a statement about SCOPE — findings outside the
// base-reproducible set still never reach `follow_ups` — and it is worth keeping
// under that reading, because that boundary is exactly what a future producer
// would widen.
//
// The two e2e cases at the bottom of this file are where the flip actually happens.
//
// The REFUTER half below is unchanged and is now the ONLY half tracking something
// unlanded: no evaluator emits `evidence_class: 'inferential'`, and #408
// deliberately did not build one. A base re-run answers a question about CAUSALITY
// by observing; `inferential` is a claim about how a finding was ESTABLISHED —
// reasoned rather than observed — and every evaluator brain has is deterministic by
// construction. Inventing a reasoner so a fork can fire is the error
// `causal-admission.mjs` already refuses one level down.

test('e2e: a finding OUTSIDE the base-reproducible set never reaches follow_ups, and the refuter stays silent (REQ-409-6, boundary redrawn by #408)', (t) => {
  // `redJob` here is not incidental (review finding, cold review of PR #471): when
  // #443 restored the diff-budget breach as the default finding source, `redJob`'s
  // default went to null and NO case passed it — so the gate-shaped finding path,
  // which every e2e case used to carry, stopped crossing the process boundary
  // entirely and the parameter the README advertises for #405/#408 became
  // untested. Proven: deleting the honoring of `redJob` from fixture.mjs left the
  // whole file green. This case carries it, so both finding shapes stay exercised
  // — and it is the right host, since a second finding of a DIFFERENT id is exactly
  // the population these #408 pins have to survive.
  const fx = withFixture(t, { tier: 'regulated', redJob: 'phase-order' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const body = postedBodies(fx)[0].body;
  const verdict = parseVerdict({ body });
  // Review finding F1: the previous form was `verdict.follow_ups ?? []` deepEqual
  // `[]`, which made ABSENT and EMPTY the same assertion — and absent is what
  // happens today at two independent sites: renderVerdict omits the key when the
  // list is empty (verdict.mjs), and parseVerdict only assigns the field when the
  // key was found (parse-verdict.mjs). So it compared [] to [] having observed
  // NOTHING. That is `evidence-reader-empty-on-failure` in the assertion layer,
  // and this exact field in this exact pair of functions already shipped a
  // render/parse asymmetry once (#381, c881a04) — the pin advertised as the #408
  // tripwire was blind to the one regression class it has a history of.
  //
  // Pin the true state instead, in BOTH layers, so a flip is detectable either way.
  assert.ok(!('follow_ups' in verdict),
    'phase-order reads THIS PR\'s artefacts, so no base comparison can speak to it and nothing ' +
    'may be deferred. If present: either the base-reproducible set widened (base-comparison.mjs ' +
    'BASE_REPRODUCIBLE_GATES) or the render/parse contract changed — check WHICH before moving this.');
  assert.doesNotMatch(body, /^follow_ups:/m,
    'and the posted body carries no follow_ups block — the wire-level half of the same pin');
  // No evaluator emits evidence_class: inferential (#408): the refuter must not have run.
  assert.ok(verdict.findings.every(f => f.evidence_class !== 'inferential'),
    'an inferential finding appeared — the refuter fork is live. #408 deliberately did NOT build ' +
    'an inferential producer (see the header), so this is the pin for whoever does.');
  // And the gate-shaped source is genuinely live end to end (see the fixture note
  // above) — without this, `redJob` could be silently broken and nothing would say so.
  assert.ok(verdict.findings.find(f => f.id === 'gate:phase-order'),
    `redJob's red required gate must reach the posted body — got: ${JSON.stringify(verdict.findings.map(f => f.id))}`);
});

// ── REQ-405-8: the inline anchor reaches the wire, and its absence is honest ──

/**
 * Points the REAL provider adapter at this fixture's `gh` stub for the duration
 * of one test. The cases below drive `postVerdict` in-process instead of
 * spawning the CLI, and the reason is a fact about today's tree, not a
 * convenience: **no evaluator emits `file`/`line`**. REQ-405-2 makes the anchor
 * optional precisely so evaluators can adopt it one at a time, so a CLI-level
 * case could only ever observe the empty population — which is the case above
 * this one, and it is asserted there.
 *
 * Everything below `postVerdict` is still production and still crosses a real
 * process boundary: `poster.mjs` → `vcs/cli.mjs`'s `getVcs` → `github.mjs` →
 * `spawnSync('gh')` → the payload captured on disk.
 *
 * What these cases do NOT prove: the `renderedBody` below is hand-written, not a
 * `renderVerdict` output, so it carries no findings. They pin the ANCHOR's path to
 * the wire and the refusal path; that finding text survives into the summary block
 * is REQ-405-3's round trip over the real renderer and parser.
 */
function withStubbedGh(t, fx, { rejectInline = false } = {}) {
  const prevPath = process.env.PATH;
  const prevDir = process.env.GH_STUB_DIR;
  const prevReject = process.env.GH_STUB_REJECT_INLINE;
  process.env.PATH = `${STUB_BIN}${delimiter}${prevPath}`;
  process.env.GH_STUB_DIR = fx.stubDir;
  if (rejectInline) process.env.GH_STUB_REJECT_INLINE = '1';
  t.after(() => {
    process.env.PATH = prevPath;
    if (prevDir === undefined) delete process.env.GH_STUB_DIR; else process.env.GH_STUB_DIR = prevDir;
    if (prevReject === undefined) delete process.env.GH_STUB_REJECT_INLINE; else process.env.GH_STUB_REJECT_INLINE = prevReject;
  });
}

function rejectedBodies(fx) {
  const p = join(fx.stubDir, 'posted', 'rejected.jsonl');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8').trim().split('\n').map(l => JSON.parse(l));
}

test('e2e: today NO evaluator anchors, so the real CLI posts NO comments key — and this is the tripwire for the first one that does (REQ-405-2/8)', (t) => {
  // The additive guarantee, measured at the real process boundary rather than
  // reasoned about: widening the port must leave every shipping evaluator's
  // payload byte-for-byte what it was. When an evaluator starts emitting
  // `file`/`line` this case goes red — MOVE it to that change, do not delete it;
  // a red here means inline comments became reachable from the CLI, which is
  // the event #405 exists to make possible.
  const fx = withFixture(t, { tier: 'regulated' });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const posted = postedBodies(fx);
  assert.equal(posted.length, 1);
  const verdict = parseVerdict({ body: posted[0].body });
  assert.ok(verdict.findings.length >= 1,
    'findings must exist — otherwise "no comments" would be true for the boring reason and this case would observe nothing');
  assert.ok(verdict.findings.every(f => f.file === undefined && f.line === undefined),
    `an evaluator has started anchoring: ${JSON.stringify(verdict.findings)}`);
  assert.equal('comments' in posted[0], false,
    `no anchor means no inline request at all — got: ${JSON.stringify(Object.keys(posted[0]))}`);
  assert.equal(posted[0].event, 'COMMENT', 'ADR-0020 lock 2: the event stays COMMENT, unreachable by any parameter');
});

test('e2e: an anchored finding rides the SAME payload as the verdict body, to the real gh binary (REQ-405-1/5/8)', async (t) => {
  const fx = withFixture(t, { tier: 'regulated' });
  withStubbedGh(t, fx);
  const body = '```yaml\nprotocol: brain-review/2\nverdict: REVISE\n```';
  const out = await postVerdict({
    headSha: fx.headSha,
    project: 'fixture/consumer',
    number: fx.prNumber,
    provider: 'github',
    mode: 'tranche',
    renderedBody: body,
    reviewerHandle: 'stub-reviewer',
    priorVerdicts: [],
    findings: [
      { id: 'anchored', evidence: 'line 3 is the offender', file: 'big.txt', line: 3 },
      { id: 'unanchored', evidence: 'a whole-PR concern' },
    ],
  });
  assert.equal(out.posted, true, `the verdict must post — got ${JSON.stringify(out)}`);

  const posted = postedBodies(fx);
  assert.equal(posted.length, 1, 'exactly ONE payload carries the verdict body — the anti-loop lock counts parseable verdicts');
  assert.equal(posted[0].body, body);
  assert.equal(posted[0].comments.length, 1, 'only the anchored finding becomes a comment');
  assert.equal(posted[0].comments[0].path, 'big.txt');
  assert.equal(posted[0].comments[0].line, 3);
  assert.match(posted[0].comments[0].body, /line 3 is the offender/,
    'the developer reads the EVIDENCE on the line — an id alone would send them back to the summary');
  assert.equal('inlineDropped' in out, false, 'nothing was dropped, so no count is claimed');
});

test('e2e: gh REFUSES the anchored payload — the verdict still posts, whole, and the loss is COUNTED (REQ-405-4/8)', async (t) => {
  // The load-bearing case, against the real binary boundary: GitHub 422s an
  // anchor outside the diff, and the summary must survive that. Without the
  // count, "no inline comments appeared" and "every anchor was refused" are the
  // same observation — `evidence-reader-empty-on-failure` relocated into the poster.
  const fx = withFixture(t, { tier: 'regulated' });
  withStubbedGh(t, fx, { rejectInline: true });
  const body = '```yaml\nprotocol: brain-review/2\nverdict: REVISE\n```';
  const out = await postVerdict({
    headSha: fx.headSha,
    project: 'fixture/consumer',
    number: fx.prNumber,
    provider: 'github',
    mode: 'tranche',
    renderedBody: body,
    reviewerHandle: 'stub-reviewer',
    priorVerdicts: [],
    findings: [{ id: 'anchored', evidence: 'unreachable line', file: 'big.txt', line: 99999 }],
  });
  assert.equal(out.posted, true, `a refused anchor must never cost the verdict — got ${JSON.stringify(out)}`);
  assert.equal(out.inlineDropped, 1, 'and the count must reach the caller');

  assert.equal(rejectedBodies(fx).length, 1, 'the anchored attempt really was refused by the binary');
  const posted = postedBodies(fx);
  assert.equal(posted.length, 1, 'and exactly one payload landed');
  assert.equal('comments' in posted[0], false, 'the retry drops the anchors, nothing else');
  assert.equal(posted[0].body, body,
    'the verdict body is re-sent BYTE-IDENTICAL on the retry — the fallback drops the anchors ' +
    'and nothing else. (It cannot assert findings survive: this body is hand-written and has ' +
    'none. REQ-405-3\'s round trip is what covers that.)');
});

// ── #408: the follow_ups producer, end to end ───────────────────────────────
//
// #408's exit criterion refuses a unit test that hand-feeds `causal_disposition`:
// "A review over a PR carrying a defect that exists unchanged on the base branch
// routes that finding to follow_ups[] instead of blocking on it — proven end-to-end."
// So both cases below spawn the real CLI against a real git history and read the
// POSTED body back with the real parser. Nothing about causality is injected: the
// only difference between them is whether the BASELINE COMMIT is broken.

test('e2e #408: a gate failure that exists at BASE routes to follow_ups[] and stops blocking', (t) => {
  // `breakBase` puts a broken wikilink in the baseline commit's brain/HOME.md. The PR
  // neither introduces nor fixes it, so `brain:nav` — and therefore `local-checks` —
  // is red at base and red here for the SAME inherited reason.
  const fx = withFixture(t, { tier: 'regulated', redJob: 'local-checks', diffLines: 10, breakBase: true });
  const r = runReview(fx);
  assert.equal(r.status, 0, `brain:review must exit 0 — stderr:\n${r.stderr}`);

  const verdict = parseVerdict({ body: postedBodies(fx)[0].body });
  assert.equal(verdict.protocol, 'brain-review/2');

  const followUp = (verdict.follow_ups ?? []).find(f => f.id === 'gate:local-checks');
  assert.ok(followUp,
    `the inherited gate failure must land in follow_ups[] — verdict was ${JSON.stringify(verdict, null, 2)}`);
  assert.equal(followUp.causal_disposition, 'pre-existing');
  assert.match(followUp.evidence, /local-checks is ALSO red at base/,
    'the routing must be justified by an observation the reader can check, not by a bare label');

  assert.ok(!(verdict.findings ?? []).some(f => f.id === 'gate:local-checks'),
    'and it must be OUT of the blocking set — routed, not copied');
  assert.equal(verdict.verdict, 'APPROVE',
    'with its only blocker deferred, the REVISE-to-APPROVE softening applies (protocol §Findings)');
});

test('e2e #408: the SAME gate failure with a healthy base keeps blocking', (t) => {
  // The inverse, and it is what makes the case above mean anything: without it, a
  // classifier hardcoded to answer "pre-existing" would pass. Identical fixture,
  // identical red gate — only the baseline is healthy.
  const fx = withFixture(t, { tier: 'regulated', redJob: 'local-checks', diffLines: 10, breakBase: false });
  const r = runReview(fx);
  assert.equal(r.status, 0, `brain:review must exit 0 — stderr:\n${r.stderr}`);

  const verdict = parseVerdict({ body: postedBodies(fx)[0].body });
  const blocking = (verdict.findings ?? []).find(f => f.id === 'gate:local-checks');
  assert.ok(blocking, 'a gate this change broke must stay in findings[]');
  assert.equal(blocking.causal_disposition, 'introduced');
  assert.ok(!(verdict.follow_ups ?? []).some(f => f.id === 'gate:local-checks'));
  assert.equal(verdict.verdict, 'REVISE');

  // POSITIVE EVIDENCE THAT THE PROBE RAN, and cold review F7 is why it is here:
  // `introduced` is also what you get when the probe never runs, or returns null. An
  // unreproducible or failed probe emits a condition, so an EMPTY conditions list is
  // the only observation that separates "ran and found base green" from "never
  // measured". Exactly the fix REQ-443-1 established for the silent-budget case, three
  // hundred lines up in this same file.
  assert.deepEqual(verdict.conditions ?? [], [],
    'no uncomputable condition ⇒ the base probe ran to completion and found the base healthy');
});

// ── #442: /2 dogfooded at lite, through the config override ─────────────────
//
// The D5 middle path. `/2` is `regulated`'s default and brain cannot declare
// `regulated` — `actor-check` there is unsatisfiable at n=1 (#329) — so the protocol
// had to become separable from the tier for `/2` to be dogfooded rather than only
// tested. These cases drive the REAL config file through the REAL CLI, because the
// override is a production seam and `deps.tier` deliberately is not.

test('e2e #442: lite + reviewer.protocol=/2 posts a /2 verdict, with every gate still on lite', (t) => {
  const fx = withFixture(t, { tier: 'lite', protocol: 'brain-review/2', diffLines: 1001 });
  const r = runReview(fx);
  assert.equal(r.status, 0, `brain:review must exit 0 — stderr:\n${r.stderr}`);

  const body = postedBodies(fx)[0].body;
  const verdict = parseVerdict({ body });
  assert.equal(verdict.protocol, 'brain-review/2',
    'the override must reach the POSTED body — resolving it in memory and posting /1 is the whole defect this ticket prevents');
  // And the tier did NOT move: lite's budget is 1000, so 1001 lines is what tripped
  // the finding. At regulated (200) the same diff would trip too, which would make
  // this assertion unable to tell the two apart.
  const budget = verdict.findings.find(f => f.id === 'budget');
  assert.ok(budget, `lite's 1000-line budget must be what judged this diff — got ${JSON.stringify(verdict.findings.map(f => f.id))}`);
  assert.match(budget.evidence, /> 1000/, 'the budget quoted must be lite\'s, not regulated\'s — the override moves the protocol, never a gate');
  // /2's vocabulary is present, which is what "dogfooded" buys over "tested".
  assert.ok(verdict.findings.every(f => f.causal_disposition),
    'every finding must carry a causal_disposition — that is the annotation /1 does not have');
});

test('e2e #442: with NO override, lite still posts /1 — byte-identical to pre-#442', (t) => {
  // The no-op migration guarantee, at the only layer that matters: the wire. Without
  // this, the override could have silently become the default for everyone.
  const fx = withFixture(t, { tier: 'lite', diffLines: 1001 });
  const r = runReview(fx);
  assert.equal(r.status, 0, r.stderr);
  const body = postedBodies(fx)[0].body;

  // TWO LAYERS, because `parseVerdict` assigns `result.protocol` only for /2 — a /1
  // result has no such key at all. Asserting `verdict.protocol === 'brain-review/1'`
  // would fail against correct output, and asserting it is falsy would pass against a
  // parser that stopped reading the field. So: the WIRE carries /1 explicitly, and the
  // parser's /1 shape is pinned as ABSENT rather than as some value. Same discipline
  // REQ-409-6 above arrived at for `follow_ups`, one field over.
  assert.match(body, /^protocol: brain-review\/1$/m,
    'the posted body must declare /1 — the override was absent, so the tier default stands');
  const verdict = parseVerdict({ body });
  assert.ok(!('protocol' in verdict),
    'and the parser\'s /1 shape omits the key entirely (parse-verdict.mjs sets it only for /2)');
  assert.ok(verdict.findings.every(f => !f.causal_disposition),
    'a /1 verdict carries no causal annotation — the keys must be absent, not empty');
});

test('e2e #442: an UNKNOWN protocol refuses at boot and posts nothing', (t) => {
  // Falling back to the tier default would hand the operator a /1 verdict while they
  // believed they had /2 — silently dropping causal admission. The #382/#413 shape:
  // refuse, name the value, write nothing.
  const fx = withFixture(t, { tier: 'lite', protocol: 'brain-review/3' });
  const r = runReview(fx);
  assert.notEqual(r.status, 0, 'an unknown protocol must refuse the run');
  assert.match(r.stderr, /refusing to run/);
  assert.match(r.stderr, /brain-review\/3/, 'the refusal must name the value it rejected');
  assert.equal(postedBodies(fx).length, 0, 'nothing may be posted on a refused boot');
});
