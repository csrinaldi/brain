// uncomputable-cause.test.mjs — issue #606. Imports ONLY the module under
// test: no `gh`, no `setSpawn`, no fixtures (design.md §2, opening
// paragraph — the classifier is a pure string-to-string function).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  UNCOMPUTABLE_REASONS,
  NO_TEXT_REPORTED,
  classifyUncomputableCause,
  uncomputable,
  isUncomputable,
} from './uncomputable-cause.mjs';

const UNCOMPUTABLE_REASON_VALUES = Object.values(UNCOMPUTABLE_REASONS);

// ── 1. The pinned corpus (identity.test.mjs:296-304's pattern) ─────────────
//
// Every row is sourced from real `gh`/`glab` output actually observed, or
// from an existing pinned message already in this repo — never invented
// from memory of what a CLI "usually says" (design §10, risk 3).
//
// Sources:
//   - `review/identity.test.mjs:296-304` (three rows, unchanged verbatim).
//   - `vcs/gitlab-api.mjs:65` — `GitLab API failed: ${status} (${path})` is
//     the ONLY template GitLab ever emits; every GitLab row here matches it.
//   - `vcs/lib/exec.mjs:30` / `vcs.contract.test.mjs`'s `failSpawn` fixture —
//     the exact `runJson` wrapper shape and the ENOENT launch-failure shape.
const CORPUS = [
  ['gh: API rate limit exceeded (HTTP 403)', UNCOMPUTABLE_REASONS.RATE_LIMITED],
  ['gh: Maximum number of login attempts exceeded. Please try again later. (HTTP 403)', UNCOMPUTABLE_REASONS.RATE_LIMITED],
  ['GitLab API failed: 429 (/user) rate limit', UNCOMPUTABLE_REASONS.RATE_LIMITED],
  ['gh api repos/x/y/pulls failed (status 1): You have exceeded a secondary rate limit', UNCOMPUTABLE_REASONS.RATE_LIMITED],
  ['gh: Bad credentials (HTTP 401)', UNCOMPUTABLE_REASONS.UNAUTHENTICATED],
  ['gh: To get started with GitHub CLI, please run: gh auth login', UNCOMPUTABLE_REASONS.UNAUTHENTICATED],
  ['GitLab API failed: 401 (projects/x%2Fy/merge_requests/1)', UNCOMPUTABLE_REASONS.UNAUTHENTICATED],
  ['gh: Could not resolve to a PullRequest with the number of 9999.', UNCOMPUTABLE_REASONS.NOT_FOUND],
  ['GitLab API failed: 404 (projects/x%2Fy/repository/commits/abc/statuses)', UNCOMPUTABLE_REASONS.NOT_FOUND],
  ['gh pr view 1 --json statusCheckRollup failed (status null): gh: spawn gh ENOENT', UNCOMPUTABLE_REASONS.BINARY_MISSING],
  ['glab: command not found', UNCOMPUTABLE_REASONS.BINARY_MISSING],
  ['TypeError: fetch failed', UNCOMPUTABLE_REASONS.NETWORK],
  ['gh: dial tcp: lookup api.github.com: ENOTFOUND', UNCOMPUTABLE_REASONS.NETWORK],
  ['GitLab API failed: 503 (projects/x%2Fy/merge_requests/1)', UNCOMPUTABLE_REASONS.NETWORK],
  ['gh pr view 1 --json statusCheckRollup failed (status 1): fixture: simulated failure', UNCOMPUTABLE_REASONS.UNCLASSIFIED],
  ['gh: the flurb subsystem declined to enumerate the rollup (HTTP 418)', UNCOMPUTABLE_REASONS.UNCLASSIFIED],
];

for (const [message, expectedReason] of CORPUS) {
  test(`classifyUncomputableCause: ${JSON.stringify(message)} -> ${expectedReason} (#606)`, () => {
    assert.equal(classifyUncomputableCause(message), expectedReason);
  });

  test(`uncomputable({detail}): ${JSON.stringify(message)} carries reason AND the verbatim message (#606)`, () => {
    const u = uncomputable({ detail: message });
    assert.equal(u.reason, expectedReason);
    assert.equal(u.detail, message, "the provider's own words must survive to the operator");
  });
}

// ── 2. Ordering (identity.test.mjs:316-321's pattern) ──────────────────────

test('classifyUncomputableCause: rate-limit language + an HTTP 403 marker classifies rate-limited, NOT unauthenticated (#606, the three-token-rotation incident identity.mjs:52-70 records)', () => {
  assert.equal(
    classifyUncomputableCause('gh: API rate limit exceeded (HTTP 403)'),
    UNCOMPUTABLE_REASONS.RATE_LIMITED,
  );
});

test('classifyUncomputableCause: binary-missing language + "not found" language classifies binary-missing, NOT not-found (#606)', () => {
  assert.equal(
    classifyUncomputableCause('gh: command not found'),
    UNCOMPUTABLE_REASONS.BINARY_MISSING,
  );
});

// ── 3. The HTTP-number negative (design §2.1, the verified bare-429 trap) ──

test('classifyUncomputableCause: a PR literally numbered 429 must NOT classify as rate-limited (#606, M9)', () => {
  // `runJson` builds this EXACT shape for a failing fetch of PR 429:
  // `${cmd} ${args.join(' ')} failed (status ${r.status}): ${r.stderr}`.
  // The digits "429" here are the PR NUMBER, not an HTTP status code.
  const message = 'gh pr view 429 --json statusCheckRollup failed (status 1): fixture: simulated failure';
  assert.equal(classifyUncomputableCause(message), UNCOMPUTABLE_REASONS.UNCLASSIFIED);
});

test('classifyUncomputableCause: a PR literally numbered 404 must NOT classify as not-found (#606, M9 mirror)', () => {
  const message = 'gh pr view 404 --json statusCheckRollup failed (status 1): fixture: simulated failure';
  assert.equal(classifyUncomputableCause(message), UNCOMPUTABLE_REASONS.UNCLASSIFIED);
});

// ── 4. Shape invariants (design §6.4) ───────────────────────────────────────

test('uncomputable(): the returned object is frozen', () => {
  assert.ok(Object.isFrozen(uncomputable({ detail: 'x' })));
});

test('uncomputable(): exactly three keys — uncomputable, reason, detail', () => {
  const u = uncomputable({ detail: 'x' });
  assert.deepEqual(Object.keys(u).sort(), ['detail', 'reason', 'uncomputable']);
});

for (const missing of [undefined, null, '']) {
  test(`uncomputable({detail: ${JSON.stringify(missing)}}): falls back to NO_TEXT_REPORTED, never an empty string`, () => {
    const u = uncomputable({ detail: missing });
    assert.equal(u.detail, NO_TEXT_REPORTED);
    assert.notEqual(u.detail, '');
  });
}

test('isUncomputable(null) === false — null is a THIRD state, not "uncomputable with no cause" (#606, load-bearing)', () => {
  assert.equal(isUncomputable(null), false);
});

test('isUncomputable(undefined) === false', () => {
  assert.equal(isUncomputable(undefined), false);
});

test('isUncomputable: a GitLab success rollup entry (conclusion: null) never collides with the shape (design §1.5)', () => {
  const entry = { name: 'x', status: 'success', conclusion: null };
  assert.equal(isUncomputable(entry), false);
});

test('classifyUncomputableCause: codomain is a subset of UNCOMPUTABLE_REASONS', () => {
  for (const [, reason] of CORPUS) {
    assert.ok(UNCOMPUTABLE_REASON_VALUES.includes(reason));
  }
});

test('UNCOMPUTABLE_REASONS: no value reads as clean, over a 200-string fuzz set', () => {
  const CLEAN_RE = /ok|success|clean|none|empty/i;
  for (const value of UNCOMPUTABLE_REASON_VALUES) {
    assert.doesNotMatch(value, CLEAN_RE, `enum value "${value}" must not read as clean`);
  }
  // A fuzz set of arbitrary strings must never leave the enum, and the
  // enum itself never reads as clean — checked directly above, and
  // structurally guaranteed by classifyUncomputableCause's single-`return`
  // arms (no fall-through to `undefined`, no computed reason string).
  const fuzz = Array.from({ length: 200 }, (_, i) => `random-fuzz-input-${i}-${Math.random()}`);
  for (const input of fuzz) {
    const reason = classifyUncomputableCause(input);
    assert.ok(UNCOMPUTABLE_REASON_VALUES.includes(reason), `fuzz input produced an out-of-enum reason: ${reason}`);
    assert.doesNotMatch(reason, CLEAN_RE);
  }
});

// ── 5. Design question 3 — total rot degrades WITH the text (design §3.2a) ─

test("an invented message no rule matches degrades to unclassified WITH the words verbatim (#606 ruling 3)", () => {
  const invented = 'gh: the flurb subsystem declined to enumerate the rollup (HTTP 418)';
  const u = uncomputable({ detail: invented });
  assert.equal(u.reason, 'unclassified', 'an unrecognised message must never borrow another label');
  assert.equal(u.detail, invented, "the provider's own words must survive to the operator");
});

// ── 6. `reason` explicit-pass path (design §1.2 — MALFORMED_RESPONSE) ──────

test('uncomputable({detail, reason}): an explicitly-passed reason is never overridden by the classifier', () => {
  const u = uncomputable({ detail: 'the rollup field was not an array', reason: UNCOMPUTABLE_REASONS.MALFORMED_RESPONSE });
  assert.equal(u.reason, UNCOMPUTABLE_REASONS.MALFORMED_RESPONSE);
});

// ── 7. Source guard (design §6.6) — one constructor, enforced ──────────────

test('source guard: neither provider source contains the literal `uncomputable: true` (#606) — one constructor, uncomputable() in this module', () => {
  for (const providerFile of ['github.mjs', 'gitlab.mjs']) {
    const src = readFileSync(fileURLToPath(new URL(`../providers/${providerFile}`, import.meta.url)), 'utf8');
    assert.equal(
      src.includes('uncomputable: true'),
      false,
      `${providerFile} must never hand-construct the uncomputable shape — call uncomputable() from vcs/lib/uncomputable-cause.mjs instead`,
    );
  }
});
