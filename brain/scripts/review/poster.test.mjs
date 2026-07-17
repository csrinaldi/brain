// poster.test.mjs — Unit tests for REQ-H1-9: THE security boundary (protocol
// §1-§2, §10; design.md §6). No test spawns a real gh/glab process — the VCS
// is always an injected spy/proxy. Every scenario in the return contract this
// slice must prove lives here: no-approve-path, anti-stale, anti-loop.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { postVerdict } from './poster.mjs';
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
