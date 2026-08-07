// poster.test.mjs — Unit tests for REQ-H1-9: THE security boundary (protocol
// §1-§2, §10; design.md §6). No test spawns a real gh/glab process — the VCS
// is always an injected spy/proxy. Every scenario in the return contract this
// slice must prove lives here: no-approve-path, anti-stale, anti-loop.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { postVerdict, deriveInlineComments } from './poster.mjs';
import { guardedLabelAdd } from './deny-set.mjs';
import { VERBS } from '../vcs/cli.mjs';

const HEAD = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const MOVED = 'facefacefacefacefacefacefacefacefaceface';

function allowlistSpy({ headRefOid = HEAD } = {}) {
  const calls = [];
  return {
    calls,
    vcs: new Proxy(
      {},
      {
        get(_target, verb) {
          // Guard against the classic Proxy-as-thenable pitfall: `await proxy`
          // probes `proxy.then` to decide whether to chain it as a thenable.
          // Returning a function for `then` would make every `await vcs`
          // (and every `await getVcsFn(...)` that resolves to this proxy)
          // recurse into the trap forever. `then` is not a VCS verb.
          if (verb === 'then') return undefined;
          return (...args) => {
            calls.push(verb);
            if (verb === 'prView') return Promise.resolve({ headRefOid });
            if (verb === 'prReviewComment') return Promise.resolve({ url: 'https://example.test/1' });
            if (verb === 'issueComment') return Promise.resolve({ url: 'https://example.test/2' });
            if (verb === 'labelAdd') return Promise.resolve({ ok: true });
            throw new Error(`poster invoked an unexpected verb outside the COMMENT-only surface: "${String(verb)}"`);
          };
        },
      },
    ),
  };
}

// ── R1: no APPROVE path exists — structural ─────────────────────────────────

test('the port itself defines no approve-like verb (R1, ADR-0020) — belt-and-braces on VERBS', () => {
  assert.ok(!VERBS.some(v => /approve/i.test(v)), `VERBS must never contain an approve verb, found: ${VERBS.join(', ')}`);
});

test('postVerdict (tranche mode): posts via prReviewComment ONLY — no verb outside {prView, prReviewComment} is ever invoked', async () => {
  const { vcs, calls } = allowlistSpy();
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: '```yaml\nprotocol: brain-review/1\n```',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, true);
  assert.deepEqual(calls.sort(), ['prReviewComment', 'prView'].sort());
});

test('postVerdict (ruling mode): posts via issueComment ONLY, never prReviewComment', async () => {
  const { vcs, calls } = allowlistSpy();
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 7,
    provider: 'github',
    mode: 'ruling',
    renderedBody: '```yaml\nprotocol: brain-review/1\n```',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, true);
  assert.ok(calls.includes('issueComment'));
  assert.ok(!calls.includes('prReviewComment'));
});

// ── Anti-stale (§10): head moved mid-run ⇒ post nothing, reviewed:stale ─────

test('anti-stale: head moved mid-run → posts NOTHING, applies reviewed:stale, prReviewComment/issueComment never called', async () => {
  const { vcs, calls } = allowlistSpy({ headRefOid: MOVED });
  const result = await postVerdict({
    headSha: HEAD, // the run's own anchor — stale relative to the re-fetched MOVED head
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, false);
  assert.equal(result.skipped, 'anti-stale');
  assert.ok(!calls.includes('prReviewComment'));
  assert.ok(!calls.includes('issueComment'));
  assert.ok(calls.includes('labelAdd'));
});

test('anti-stale: labelAdd is called with exactly ["reviewed:stale"], no other label', async () => {
  const seenLabels = [];
  const vcs = {
    prView: async () => ({ headRefOid: MOVED }),
    labelAdd: async ({ labels }) => { seenLabels.push(...labels); return { ok: true }; },
    prReviewComment: async () => { throw new Error('must not be called'); },
    issueComment: async () => { throw new Error('must not be called'); },
  };
  await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    deps: { getVcs: async () => vcs },
  });
  assert.deepEqual(seenLabels, ['reviewed:stale']);
});

// ── Anti-loop (§10): last block is this reviewer's AND head_sha unchanged ──

test('anti-loop: last thread verdict is this reviewer\'s and head_sha matches the current head → skip, ZERO vcs calls (no re-fetch either)', async () => {
  const { vcs, calls } = allowlistSpy();
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [
      { head_sha: 'someoldsha', verdict: 'REVISE', author: 'brain-reviewer' },
      { head_sha: HEAD, verdict: 'REVISE', author: 'brain-reviewer' },
    ],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, false);
  assert.equal(result.skipped, 'anti-loop');
  assert.deepEqual(calls, []); // no prView re-fetch, no comment, no label — nothing
});

test('anti-loop: last thread verdict is a DIFFERENT reviewer with the same head_sha → NOT skipped, posts normally', async () => {
  const { vcs, calls } = allowlistSpy();
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [{ head_sha: HEAD, verdict: 'REVISE', author: 'a-human' }],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, true);
  assert.ok(calls.includes('prReviewComment'));
});

test('anti-loop: last thread verdict is THIS reviewer but head_sha differs (new push) → NOT skipped, posts normally', async () => {
  const { vcs, calls } = allowlistSpy();
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [{ head_sha: 'someoldsha', verdict: 'REVISE', author: 'brain-reviewer' }],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, true);
  assert.ok(calls.includes('prReviewComment'));
});

test('no priorVerdicts (first run on the thread) → anti-loop never fires, posts normally', async () => {
  const { vcs, calls } = allowlistSpy();
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, true);
  assert.ok(calls.includes('prReviewComment'));
});

// ── reResolveHead seam override ──────────────────────────────────────────────

test('reResolveHead injected seam overrides the default prView re-fetch', async () => {
  let prViewCalled = false;
  const vcs = {
    prView: async () => { prViewCalled = true; return { headRefOid: HEAD }; },
    prReviewComment: async () => ({ url: 'x' }),
  };
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    deps: { getVcs: async () => vcs, reResolveHead: async () => HEAD },
  });
  assert.equal(result.posted, true);
  assert.equal(prViewCalled, false, 'the injected reResolveHead seam must be used instead of the default prView call');
});

// ── deny-set fold (standing condition 1, issue #266 comment 5004345710) ────
// "The constant is the seed, not the fence" — poster.mjs's anti-stale
// reviewed:stale labelAdd now routes through the SAME hardcoded chokepoint
// (deny-set.mjs's guardedLabelAdd) every other reviewer label add passes
// through, instead of calling vcs.labelAdd bare.

test('poster.mjs source routes its labelAdd call through guardedLabelAdd, not a bare vcs.labelAdd', () => {
  const src = readFileSync(fileURLToPath(new URL('./poster.mjs', import.meta.url)), 'utf8');
  assert.match(src, /guardedLabelAdd/, 'poster.mjs must import and call guardedLabelAdd from deny-set.mjs');
  assert.doesNotMatch(
    src,
    /\bvcs\.labelAdd\(/,
    'poster.mjs must never call vcs.labelAdd directly — it must fold through guardedLabelAdd',
  );
});

test('poster fold guard: the exact chokepoint poster.mjs now shares (guardedLabelAdd) refuses a denied label BEFORE the provider — proves the fold is real, not cosmetic', async () => {
  const calls = [];
  const vcs = {
    labelAdd: async (...args) => {
      calls.push(args);
      throw new Error('labelAdd must NEVER be invoked for a denied label');
    },
  };
  await assert.rejects(
    () => guardedLabelAdd(vcs, { project: 'csrinaldi/brain', number: 42, labels: ['status:approved'] }),
    /refused label/,
  );
  assert.deepEqual(calls, [], 'a hypothetical denied label pushed through the poster\'s gate must never reach vcs.labelAdd');
});

// ── escalation inbox (H1-5b, candidate 4993202904, decided IN by plan
// 5011584432): a POSTED verdict carrying escalate: 'human' applies
// needs-decision, through the SAME guardedLabelAdd chokepoint. ──────────────

test('escalate:"human" on a successfully posted verdict applies needs-decision via guardedLabelAdd (after the comment posts)', async () => {
  const { vcs, calls } = allowlistSpy();
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'ruling',
    renderedBody: '```yaml\nprotocol: brain-review/1\nverdict: STOP\nescalate: human\n```',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    escalate: 'human',
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, true);
  assert.ok(calls.includes('issueComment'));
  assert.ok(calls.includes('labelAdd'), 'needs-decision must be applied on the escalation path');
});

test('escalate:"human" applies EXACTLY ["needs-decision"] via labelAdd, no other label', async () => {
  const seenLabels = [];
  const vcs = {
    prView: async () => ({ headRefOid: HEAD }),
    prReviewComment: async () => ({ url: 'x' }),
    labelAdd: async ({ labels }) => { seenLabels.push(...labels); return { ok: true }; },
  };
  await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    escalate: 'human',
    deps: { getVcs: async () => vcs },
  });
  assert.deepEqual(seenLabels, ['needs-decision']);
});

test('escalate not "human" (null, the default) never calls labelAdd — no escalation label on a normal posted verdict', async () => {
  const { vcs, calls } = allowlistSpy();
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, true);
  assert.ok(!calls.includes('labelAdd'), 'no escalate param passed -> defaults to null -> no needs-decision');
});

test('escalate:"human" on an anti-stale (skipped) run never applies needs-decision — only reviewed:stale, and the post never happened', async () => {
  const seenLabels = [];
  const vcs = {
    prView: async () => ({ headRefOid: MOVED }),
    labelAdd: async ({ labels }) => { seenLabels.push(...labels); return { ok: true }; },
    prReviewComment: async () => { throw new Error('must not be called'); },
    issueComment: async () => { throw new Error('must not be called'); },
  };
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    escalate: 'human',
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, false);
  assert.equal(result.skipped, 'anti-stale');
  assert.deepEqual(seenLabels, ['reviewed:stale'], 'anti-stale wins — the verdict never actually landed at this head, so escalation never fires');
});

test('anti-stale path still applies reviewed:stale (allowed, tightening) end-to-end after the deny-set fold', async () => {
  const seenLabels = [];
  const vcs = {
    prView: async () => ({ headRefOid: MOVED }),
    labelAdd: async ({ labels }) => { seenLabels.push(...labels); return { ok: true }; },
    prReviewComment: async () => { throw new Error('must not be called'); },
    issueComment: async () => { throw new Error('must not be called'); },
  };
  const result = await postVerdict({
    headSha: HEAD,
    project: 'csrinaldi/brain',
    number: 42,
    provider: 'github',
    mode: 'tranche',
    renderedBody: 'irrelevant',
    reviewerHandle: 'brain-reviewer',
    priorVerdicts: [],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(result.posted, false);
  assert.equal(result.skipped, 'anti-stale');
  assert.deepEqual(seenLabels, ['reviewed:stale'], 'reviewed:stale matches reviewed:* — allowed through the deny-set unchanged');
});

// The shared `allowlistSpy` records verb NAMES only. These cases need the
// ARGUMENTS — asserting that the anchor reached the verb is the whole point, and
// a name-only spy cannot tell a call with comments from one without.
function recordingSpy({ headRefOid = HEAD, reviewResult = { url: 'https://example.test/1' } } = {}) {
  const calls = [];
  return {
    calls,
    vcs: {
      prView: async (args) => { calls.push({ verb: 'prView', args }); return { headRefOid }; },
      prReviewComment: async (args) => { calls.push({ verb: 'prReviewComment', args }); return reviewResult; },
      issueComment: async (args) => { calls.push({ verb: 'issueComment', args }); return { url: 'https://example.test/2' }; },
      labelAdd: async (args) => { calls.push({ verb: 'labelAdd', args }); return { ok: true }; },
    },
  };
}

// ── #405 T9: the anchors reach the provider through the poster ─────────────

test('#405 deriveInlineComments: only ANCHORED findings become comments (REQ-405-2)', () => {
  const out = deriveInlineComments([
    { id: 'a', evidence: 'e1', file: 'x.mjs', line: 4 },
    { id: 'b', evidence: 'e2' },                          // no anchor at all
    { id: 'c', evidence: 'e3', file: 'y.mjs' },           // file without line
    { id: 'd', evidence: 'e4', line: 9 },                 // line without file
    // `line: null` was the unpinned SPELLING (round-7 cold review): dropping the
    // `=== null` half of the guard left the suite green, and under it this finding
    // posts at `Number(null)` — line 0 — while `renderVerdict`, which guards both,
    // omits `line:` from the block. That is text on the diff the posted verdict
    // does not support, which is the one thing the anchor rule exists to prevent.
    { id: 'e', evidence: 'e5', file: 'z.mjs', line: null },
    // The spellings rounds 7-10 each found unpinned one at a time. `file: ''` is
    // handled by `!f?.file` and was pinned by nothing — the mutation
    // `f?.file === undefined` survived. The three unusable LINES were worse than
    // unpinned: they were SENT, as `line: null` and `line: 0`, and diff lines are
    // 1-based — anchors already known not to attach, which is the exact cost the
    // guard's own JSDoc says it exists to avoid.
    { id: 'f', evidence: 'e6', file: '', line: 3 },        // empty path
    { id: 'g', evidence: 'e7', file: 'z.mjs', line: 'abc' },// Number() -> NaN
    { id: 'h', evidence: 'e8', file: 'z.mjs', line: '' },   // Number() -> 0
    { id: 'i', evidence: 'e9', file: 'z.mjs', line: 0 },    // no line 0 in a diff
    { id: 'j', evidence: 'e10', file: 'z.mjs', line: 2.5 }, // not an integer
    // …and the one shape that MUST survive all of that: the round-tripped string,
    // which is what `parseVerdict` actually returns.
    { id: 'k', evidence: 'e11', file: 'w.mjs', line: '7' },
  ]);
  assert.deepEqual(out.map(c => c.path), ['x.mjs', 'w.mjs'],
    'a half anchor is not an anchor — GitHub 422s a comment with no line, so a partial one ' +
    'would spend the fallback on a finding we already knew could not attach');
  assert.equal(out[0].line, 4);
  assert.strictEqual(out[1].line, 7, 'the round-tripped string form survives and arrives as a number');
  assert.match(out[0].body, /e1/, 'the comment carries the finding evidence — that is what the developer reads');
});

test('#405 deriveInlineComments: no anchored finding yields an EMPTY array, and the caller decides what that means (REQ-405-2)', () => {
  // The title used to read "yields NO array, not an empty one", which is the
  // opposite of both this assertion and the function's JSDoc (round-3 cold
  // review, E1). It also claimed to be what stops the poster sending
  // `comments: []`; that is pinned by `#405 T9: with nothing anchored the payload
  // carries NO comments key`, which reds under the always-send mutation. This one
  // does not, and should not: `deriveInlineComments` is pure and returns a list.
  // Deciding that an empty list means "no inline requested" is the POSTER's job,
  // and keeping those two responsibilities apart is why this function has no
  // knowledge of the wire at all.
  assert.deepEqual(deriveInlineComments([{ id: 'a', evidence: 'e' }]), []);
});

test('#405: deriveInlineComments tolerates a non-array findings value (REQ-405-2)', () => {
  // `findings ?? []` and the providers' `Array.isArray(comments)` are defensive
  // guards on lines this change added, and mutation showed nothing pinned them
  // (round-11 cold review, E2). No in-tree caller produces these shapes and no
  // artefact promises null-safety — so they are PINNED rather than removed: an
  // unpinned guard is an invitation to delete it during a refactor and discover
  // the caller that needed it in production.
  assert.deepEqual(deriveInlineComments(undefined), []);
  assert.deepEqual(deriveInlineComments(null), []);
  assert.deepEqual(deriveInlineComments([null, undefined, 0, 'nonsense']), [],
    'entries that are not objects yield no comment, rather than throwing mid-list');
});

test('#405 T9: anchored findings reach prReviewComment as comments[] (REQ-405-1)', async () => {
  const spy = recordingSpy();
  await postVerdict({
    headSha: HEAD, project: 'csrinaldi/brain', number: 42, provider: 'github', mode: 'tranche',
    renderedBody: '```yaml\nprotocol: brain-review/2\n```',
    reviewerHandle: 'brain-reviewer', priorVerdicts: [],
    findings: [{ id: 'f1', evidence: 'boom', file: 'brain/a.mjs', line: 12 }],
    deps: { getVcs: async () => spy.vcs },
  });
  const post = spy.calls.find(c => c.verb === 'prReviewComment');
  assert.ok(post, 'the verdict must still post');
  assert.ok(Array.isArray(post.args.comments) && post.args.comments.length === 1,
    `the anchor must reach the verb: ${JSON.stringify(post.args)}`);
  assert.equal(post.args.comments[0].path, 'brain/a.mjs');
});

test('#405 T9: a ruling posts on the ISSUE and carries NO comments (REQ-405-1)', async () => {
  // issueComment has no inline surface. Passing comments there would be a
  // silently-ignored argument at best; asserted so the wiring cannot drift into it.
  const spy = recordingSpy();
  await postVerdict({
    headSha: HEAD, project: 'csrinaldi/brain', number: 7, provider: 'github', mode: 'ruling',
    renderedBody: '```yaml\nprotocol: brain-review/2\n```',
    reviewerHandle: 'brain-reviewer', priorVerdicts: [],
    findings: [{ id: 'f1', evidence: 'boom', file: 'a.mjs', line: 1 }],
    deps: { getVcs: async () => spy.vcs },
  });
  const post = spy.calls.find(c => c.verb === 'issueComment');
  assert.ok(post, 'a ruling posts on the issue thread');
  assert.equal(post.args.comments, undefined, 'no inline surface on an issue comment');
});

test('#405 T9: a dropped anchor is REPORTED, and the verdict is still posted (REQ-405-4)', async () => {
  // The poster must surface the count its caller logs. Without it the run says
  // nothing, and "no inline comments appeared" becomes indistinguishable from
  // "the anchors would not attach" one layer up from the verb that knew.
  const vcs = {
    prView: async () => ({ headRefOid: HEAD }),
    prReviewComment: async () => ({ url: 'https://example.test/#r1', inlineDropped: 1 }),
  };
  const out = await postVerdict({
    headSha: HEAD, project: 'csrinaldi/brain', number: 42, provider: 'github', mode: 'tranche',
    renderedBody: '```yaml\nprotocol: brain-review/2\n```',
    reviewerHandle: 'brain-reviewer', priorVerdicts: [],
    findings: [{ id: 'f1', evidence: 'boom', file: 'a.mjs', line: 99999 }],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(out.posted, true, 'the verdict posted — an inline failure must never cost it');
  assert.equal(out.inlineDropped, 1, 'and the count reached the caller');
});

test('#405 T9: with nothing anchored the payload carries NO comments key (REQ-405-1)', async () => {
  // `comments: []` is not the same request as no `comments` at all: the verbs
  // read the key's PRESENCE to decide whether to attempt an inline review, and
  // GitHub's retry-without-inline fallback keys off the same distinction. An
  // empty array would ask both providers to do inline work for zero anchors.
  const spy = recordingSpy();
  await postVerdict({
    headSha: HEAD, project: 'csrinaldi/brain', number: 42, provider: 'github', mode: 'tranche',
    renderedBody: '```yaml\nprotocol: brain-review/2\n```',
    reviewerHandle: 'brain-reviewer', priorVerdicts: [],
    findings: [{ id: 'f1', evidence: 'boom' }],   // real finding, no anchor
    deps: { getVcs: async () => spy.vcs },
  });
  const post = spy.calls.find(c => c.verb === 'prReviewComment');
  assert.ok(post, 'the verdict must still post');
  assert.equal('comments' in post.args, false,
    `no anchor means no inline request at all: ${JSON.stringify(post.args)}`);
});

test('#405 T9: nothing dropped means NO inlineDropped key, never 0 (REQ-405-4)', async () => {
  // Same rule the verbs follow, one layer up. A literal 0 is a positive claim
  // ("we tried to anchor and lost none") on runs that anchored nothing at all,
  // and it would read as a computed measurement in a caller's log.
  const vcs = {
    prView: async () => ({ headRefOid: HEAD }),
    prReviewComment: async () => ({ url: 'https://example.test/#r1' }),
  };
  const out = await postVerdict({
    headSha: HEAD, project: 'csrinaldi/brain', number: 42, provider: 'github', mode: 'tranche',
    renderedBody: '```yaml\nprotocol: brain-review/2\n```',
    reviewerHandle: 'brain-reviewer', priorVerdicts: [],
    findings: [{ id: 'f1', evidence: 'boom', file: 'a.mjs', line: 3 }],
    deps: { getVcs: async () => vcs },
  });
  assert.equal(out.posted, true);
  assert.equal('inlineDropped' in out, false, `absent, not 0: ${JSON.stringify(out)}`);
});

test('#405: an inline post does NOT weaken the anti-loop lock (REQ-405-5)', async () => {
  // Asserted in spec REQ-405-5 and design D7-4 and implemented in no test until
  // the round-2 cold review counted them (C-4). The behaviour was already safe —
  // the lock returns before any verb is chosen — but an artefact claiming
  // coverage that does not exist is the same defect class as a red-proof ledger
  // with a fabricated row.
  const spy = recordingSpy();
  const args = {
    headSha: HEAD, project: 'csrinaldi/brain', number: 42, provider: 'github', mode: 'tranche',
    renderedBody: '```yaml\nprotocol: brain-review/2\n```',
    reviewerHandle: 'brain-reviewer',
    findings: [{ id: 'f1', evidence: 'boom', file: 'a.mjs', line: 3 }],
    deps: { getVcs: async () => spy.vcs },
  };
  const first = await postVerdict({ ...args, priorVerdicts: [] });
  assert.equal(first.posted, true);
  assert.ok(spy.calls.some(c => c.verb === 'prReviewComment' && c.args.comments?.length === 1),
    'the first run really did post inline — otherwise the second half proves nothing');

  const second = await postVerdict({
    ...args,
    priorVerdicts: [{ head_sha: HEAD, verdict: 'REVISE', author: 'brain-reviewer' }],
  });
  assert.deepEqual(second, { posted: false, skipped: 'anti-loop' },
    'a second run at the same head must still skip — inline annotations carry no brain-review block, ' +
    'so the lock, which counts parseable verdicts rather than posts, sees exactly what it saw before #405');
  assert.equal(spy.calls.filter(c => c.verb === 'prReviewComment').length, 1,
    'and nothing was posted the second time');
});

test('#405 deriveInlineComments: the line is COERCED to a number (REQ-405-2)', async () => {
  // `parseVerdict` returns entry scalars as TEXT — `verdict.test.mjs` pins
  // `parsed.findings[0].line === '42'`. GitHub's reviews API rejects a string
  // line, so a verdict that made the round trip would lose every anchor and
  // report them as un-anchorable diff lines: our defect, blamed on the diff.
  // The coercion was there and pinned by nothing (round-2 cold review, E-1).
  const [c] = deriveInlineComments([{ id: 'f', evidence: 'e', file: 'a.mjs', line: '42' }]);
  assert.strictEqual(c.line, 42, 'the string form must not reach the provider');
  assert.equal(typeof c.line, 'number');
});

test('#405 deriveInlineComments: the comment names the finding it came from (REQ-405-2)', async () => {
  // Only the evidence half of the body was pinned (round-2 cold review, E-2).
  // The id is what lets a developer match an inline note to the row in the
  // summary block — without it the two artifacts are read as unrelated.
  const [c] = deriveInlineComments([{ id: 'budget', evidence: 'the comparison', file: 'a.mjs', line: 1 }]);
  assert.match(c.body, /budget/, 'the comment must name the finding id');
  assert.match(c.body, /the comparison/, 'and carry its evidence');
});
