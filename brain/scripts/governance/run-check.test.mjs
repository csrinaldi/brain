// run-check.test.mjs — Unit tests for the thin run-check.mjs runner (REQ-L3-1, REQ-L3-2)
//
// CI FRAGILITY: never let these tests read real git state or the real cwd's
// .memory/ — always inject the fakes. The memory-gate is records-only as of
// C4/D4 (REQ-C4-4): the #227 transitional chunks/records union is retired, so
// the gate no longer accepts a `readChunks` dep at all. Memory-gate tests
// inject `readRecords` — never rely on a default that reads the real world
// (finding #10 — a fail-expecting test broke once real records/ existed).
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { runCheck, main } from './run-check.mjs';

async function captureLog(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { await fn(); } finally { console.log = orig; }
  return logs;
}

// ── memory-gate — records-only (C4/D4, REQ-C4-4) ────────────────────────────
//
// The #227 transitional chunks/records union is retired: the gate computes
// its observation set from `records/` ALONE. `readChunkObservations` is no
// longer imported by run-check.mjs at all. `readRecords` is injectable so
// these tests never touch the real filesystem.

test('runCheck: memory-gate — records has session_summary → pass', async () => {
  const result = await runCheck('memory-gate', {
    readRecords: () => [{ type: 'session_summary', title: 'x' }],
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: memory-gate — records have no session_summary → fail with reason', async () => {
  const result = await runCheck('memory-gate', {
    readRecords: () => [{ type: 'decision' }],
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: memory-gate — records empty → fail with reason', async () => {
  const result = await runCheck('memory-gate', {
    readRecords: () => [],
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: memory-gate — readRecords receives the injected cwd (uses injected reader, never a raw fs read)', async () => {
  let receivedCwd;
  await runCheck('memory-gate', {
    cwd: '/fake/cwd',
    readRecords: (cwd) => {
      receivedCwd = cwd;
      return [{ type: 'session_summary' }];
    },
  });
  assert.equal(receivedCwd, '/fake/cwd');
});

test('runCheck: memory-gate — only chunks has session_summary (records empty) → FAIL (chunks are no longer read, #227 union retired)', async () => {
  const result = await runCheck('memory-gate', {
    readChunks: () => [{ type: 'session_summary' }],
    readRecords: () => [],
  });
  assert.equal(result.pass, false, 'a readChunks dep, even if passed, must never be consulted — records/ alone decides the verdict');
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

// ── decision-gate ────────────────────────────────────────────────────────────

test('runCheck: decision-gate — injected diff has HOME.md but no ADR file → fail with reason', async () => {
  const result = await runCheck('decision-gate', {
    diffNameOnly: () => ['brain/HOME.md', 'src/other.mjs'],
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: decision-gate — injected diff has ADR file and HOME.md → pass', async () => {
  const result = await runCheck('decision-gate', {
    diffNameOnly: () => ['brain/project/decisions/adr-0099-foo.md', 'brain/HOME.md'],
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: decision-gate — injected diff touches neither ADR nor HOME.md → pass (non-architectural PR)', async () => {
  const result = await runCheck('decision-gate', { diffNameOnly: () => ['src/whatever.mjs'] });
  assert.deepEqual(result, { pass: true });
});

// ── decision-gate fail-closed when the diff cannot be computed ──────────────
//
// A REQUIRED gate must never silently pass just because its input could not
// be computed (missing BASE_SHA/HEAD_SHA env, or the git command throwing).
// diffNameOnly() throwing MUST fail the gate closed, not degrade to `[]`
// (which adrPresence would otherwise treat as a harmless empty diff → pass).

test('runCheck: decision-gate — diffNameOnly throws (diff uncomputable) → fail closed with reason', async () => {
  const result = await runCheck('decision-gate', {
    diffNameOnly: () => { throw new Error('BASE_SHA/HEAD_SHA not set'); },
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /cannot compute diff — failing closed/i);
});

test('runCheck: decision-gate — diffNameOnly throws → reason includes the underlying error message', async () => {
  const result = await runCheck('decision-gate', {
    diffNameOnly: () => { throw new Error('git exited with status 128'); },
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /git exited with status 128/);
});

// ── unknown check ────────────────────────────────────────────────────────────

test('runCheck: unknown check name throws', async () => {
  await assert.rejects(() => runCheck('not-a-real-check', {}), /unknown check/i);
});

// ── ci-context seam wiring (ADR-0016) — decision-gate reads ctx.baseSha/headSha ─
//
// The default diff-computation path now sources baseSha/headSha from an
// injected `deps.ctx` (built by ci-context.mjs's loadContext() at the CLI
// entrypoint) instead of reading process.env.BASE_SHA/HEAD_SHA directly.
// `deps.diffNameOnly` still overrides everything (existing tests above never
// pass `ctx` and are unaffected).

function withEnv(overrides, fn) {
  const saved = {};
  for (const k of Object.keys(overrides)) saved[k] = process.env[k];
  Object.assign(process.env, overrides);
  try {
    return fn();
  } finally {
    for (const k of Object.keys(overrides)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('runCheck: decision-gate — deps.ctx.baseSha/headSha take precedence over process.env.BASE_SHA/HEAD_SHA (ci-context seam)', async () => {
  await withEnv({ BASE_SHA: 'this-is-not-a-real-sha-xyz', HEAD_SHA: 'this-is-not-a-real-sha-abc' }, async () => {
    const result = await runCheck('decision-gate', { ctx: { baseSha: 'HEAD', headSha: 'HEAD' } });
    assert.deepEqual(result, { pass: true }, 'ctx.baseSha/headSha ("HEAD") must win over the bogus env values');
  });
});

test('runCheck: decision-gate — deps.ctx signaling null baseSha/headSha fails closed even when process.env.BASE_SHA/HEAD_SHA are set', async () => {
  await withEnv({ BASE_SHA: 'HEAD', HEAD_SHA: 'HEAD' }, async () => {
    const result = await runCheck('decision-gate', { ctx: { baseSha: null, headSha: null } });
    assert.equal(result.pass, false);
    assert.match(result.reason, /cannot compute diff — failing closed/i);
  });
});

// ── main() — exit-code + printed-reason smoke test ───────────────────────────

test('main: memory-gate passing → returns 0, prints nothing', async () => {
  let code;
  const logs = await captureLog(async () => {
    code = await main('memory-gate', { readRecords: () => [{ type: 'session_summary' }] });
  });
  assert.equal(code, 0);
  assert.deepEqual(logs, []);
});

test('main: memory-gate failing → returns 1, prints the reason', async () => {
  let code;
  const logs = await captureLog(async () => {
    code = await main('memory-gate', { readRecords: () => [] });
  });
  assert.equal(code, 1);
  assert.ok(logs.length === 1 && logs[0].length > 0);
});

test('main: decision-gate failing → returns 1, prints the reason', async () => {
  let code;
  const logs = await captureLog(async () => {
    code = await main('decision-gate', { diffNameOnly: () => ['brain/HOME.md'] });
  });
  assert.equal(code, 1);
  assert.ok(logs.length === 1 && logs[0].length > 0);
});

test('main: decision-gate passing (non-architectural PR) → returns 0, prints nothing', async () => {
  let code;
  const logs = await captureLog(async () => {
    code = await main('decision-gate', { diffNameOnly: () => ['src/foo.mjs'] });
  });
  assert.equal(code, 0);
  assert.deepEqual(logs, []);
});

test('main: decision-gate — diff uncomputable → returns 1, prints fail-closed reason', async () => {
  let code;
  const logs = await captureLog(async () => {
    code = await main('decision-gate', {
      diffNameOnly: () => { throw new Error('no BASE_SHA/HEAD_SHA'); },
    });
  });
  assert.equal(code, 1);
  assert.ok(logs.length === 1);
  assert.match(logs[0], /cannot compute diff — failing closed/i);
});

test('neutrality source-scan (REQ-NEUTRALITY-2): run-check.mjs source contains no .claude or SKILL.md literal', () => {
  const srcPath = fileURLToPath(new URL('./run-check.mjs', import.meta.url));
  const src = readFileSync(srcPath, 'utf8');
  assert.equal(src.includes('.claude'), false, 'source must not reference .claude');
  assert.equal(src.includes('SKILL.md'), false, 'source must not reference SKILL.md');
});

// ── issue-link — THE GOTCHA (issue #231 A2 phase 2, design.md Decision 2) ──
//
// GitLab has no CI_MERGE_REQUEST_DESCRIPTION var and CI_MERGE_REQUEST_LABELS
// freezes at pipeline creation (ADR-0016:45), so issue-link cannot be bash on
// GitLab. run-check.mjs's issue-link case calls the EXISTING pure evaluator
// issueLink(ctx.body) for the reference pattern, THEN verifies the referenced
// issue carries the resolved approved label via an injectable `fetchIssue`
// dep — never a real network call in tests. `readConfig` is injectable too so
// resolveApprovedLabel() never touches the real brain.config.json.

test('runCheck: issue-link — body has "Part of #231", referenced issue carries the approved label → pass (fresh ctx.labels via fetchIssue, never CI_MERGE_REQUEST_LABELS)', async () => {
  // Slice target (targetBranch !== defaultBranch) — "Part of #N" alone is
  // the accepted pattern for a chained-PR slice (task 2.1's original scope).
  const result = await runCheck('issue-link', {
    ctx: { body: 'feat: slice\n\nPart of #231', provider: 'gitlab', targetBranch: 'feature/tracker', defaultBranch: 'main' },
    fetchIssue: async (issueNumber) => {
      assert.equal(issueNumber, 231);
      return { labels: ['status::approved'] };
    },
    readConfig: () => ({}),
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: issue-link — body has "Closes #42", referenced issue carries the approved label → pass', async () => {
  // Default-branch target — a closing keyword satisfies both the generic
  // pattern check AND the (addendum) default-branch closing-keyword policy.
  const result = await runCheck('issue-link', {
    ctx: { body: 'fix: bug\n\nCloses #42', provider: 'github', targetBranch: 'main', defaultBranch: 'main' },
    fetchIssue: async () => ({ labels: ['status:approved'] }),
    readConfig: () => ({}),
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: issue-link — referenced issue does NOT carry the approved label → fail with reason', async () => {
  const result = await runCheck('issue-link', {
    ctx: { body: 'Part of #5', provider: 'gitlab', targetBranch: 'feature/tracker', defaultBranch: 'main' },
    fetchIssue: async () => ({ labels: ['status::in-review'] }),
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: issue-link — fetchIssue throws (network/API failure) → fail closed with reason', async () => {
  const result = await runCheck('issue-link', {
    ctx: { body: 'Closes #9', provider: 'gitlab', targetBranch: 'feature/tracker', defaultBranch: 'main' },
    fetchIssue: async () => { throw new Error('GitLab MR API failed: 500'); },
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /failing closed/i);
});

// ── issue-link — REQUIRED fail-closed on null body (task 2.2) ──────────────

test('runCheck: issue-link — ctx.body is null (uncomputable) → fails closed, never passes (REQUIRED gate)', async () => {
  const result = await runCheck('issue-link', {
    ctx: { body: null, provider: 'gitlab' },
    fetchIssue: async () => { throw new Error('must not be called — body is null'); },
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
});

test('main: issue-link — ctx.body is null → returns 1 (never 0) on the REQUIRED gate', async () => {
  const code = await main('issue-link', {
    ctx: { body: null, provider: 'gitlab' },
    fetchIssue: async () => { throw new Error('must not be called'); },
    readConfig: () => ({}),
  });
  assert.equal(code, 1);
});

test('runCheck: issue-link — body with no reference at all → fail, referenced-issue fetch never attempted', async () => {
  let fetchCalled = false;
  const result = await runCheck('issue-link', {
    ctx: { body: 'Some PR description without any link', provider: 'gitlab' },
    fetchIssue: async () => { fetchCalled = true; return { labels: [] }; },
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
  assert.equal(fetchCalled, false, 'fetchIssue must not be called when the body carries no reference');
});

// ── issue-link — default-branch-conditional (issue #231 A2 phase 2 ADDENDUM) ─
//
// GAP CLOSED: GitHub bash (governance.yml:45-70) is base-branch-conditional —
// base=='main' requires a CLOSING keyword ONLY (Part of #N alone is rejected);
// base!='main' (slice) accepts EITHER. The pure issueLink() evaluator is NOT
// base-branch-aware (by design — REQ-CIC-4, it stays UNCHANGED), so without
// this wrapper-level conditional, a "Part of #N"-only body would wrongly PASS
// the Node path even when targeting the default branch. This wires
// ctx.targetBranch === ctx.defaultBranch through the WRAPPER, never the pure
// evaluator.

test('runCheck: issue-link — target IS the default branch, body has ONLY "Part of #N" (no closing keyword) → FAIL (closing keyword required)', async () => {
  // fetchIssue DELIBERATELY returns the approved label (a would-otherwise-pass
  // result) so this test only goes GREEN because of the closing-keyword
  // policy itself — never because the fetch happened to fail for some other
  // reason (that would be a false-positive RED).
  const result = await runCheck('issue-link', {
    ctx: { body: 'feat: slice\n\nPart of #42', provider: 'github', targetBranch: 'main', defaultBranch: 'main' },
    fetchIssue: async () => ({ labels: ['status:approved'] }),
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('runCheck: issue-link — target IS the default branch, body has "Closes #N" → PASS (closing keyword satisfies the default-branch policy)', async () => {
  const result = await runCheck('issue-link', {
    ctx: { body: 'fix: thing\n\nCloses #42', provider: 'github', targetBranch: 'main', defaultBranch: 'main' },
    fetchIssue: async () => ({ labels: ['status:approved'] }),
    readConfig: () => ({}),
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: issue-link — target is NOT the default branch (slice), body has ONLY "Part of #N" → PASS (existing chained-PR pattern preserved)', async () => {
  const result = await runCheck('issue-link', {
    ctx: { body: 'feat: slice\n\nPart of #42', provider: 'github', targetBranch: 'feature/tracker', defaultBranch: 'main' },
    fetchIssue: async () => ({ labels: ['status:approved'] }),
    readConfig: () => ({}),
  });
  assert.deepEqual(result, { pass: true });
});

// ── issue-link — FAIL-CLOSED on null defaultBranch (never assume 'main') ────
//
// issue-link is REQUIRED. If ctx.defaultBranch is null (uncomputable — the
// workflow did not map it) the conditional above cannot be decided, so the
// gate MUST fail closed rather than silently assuming 'main' (that would
// reintroduce the rejected hardcoded-'main' option). targetBranch below is
// deliberately NOT 'main' and the body deliberately carries a would-otherwise-
// pass "Part of #N" + an approved issue, to prove the failure is NOT coming
// from anything else — it is specifically the null defaultBranch.

test('runCheck: issue-link — ctx.defaultBranch is null → fails closed, NEVER falls back to a hardcoded "main" comparison', async () => {
  // fetchIssue DELIBERATELY returns the approved label — proves the failure
  // comes from the null-defaultBranch fail-closed path itself, not from the
  // fetch/label check (which would otherwise pass, since targetBranch here is
  // deliberately NOT 'main' — a hardcoded 'main' fallback would treat this as
  // a slice PR and wrongly PASS on the "Part of #N" pattern).
  const result = await runCheck('issue-link', {
    ctx: { body: 'feat: slice\n\nPart of #42', provider: 'github', targetBranch: 'feature/tracker', defaultBranch: null },
    fetchIssue: async () => ({ labels: ['status:approved'] }),
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
});

test('main: issue-link — ctx.defaultBranch is null → returns 1 (never 0) on the REQUIRED gate', async () => {
  const code = await main('issue-link', {
    ctx: { body: 'Closes #42', provider: 'github', targetBranch: 'main', defaultBranch: null },
    fetchIssue: async () => ({ labels: ['status:approved'] }),
    readConfig: () => ({}),
  });
  assert.equal(code, 1);
});

test('runCheck: issue-link — ctx.targetBranch is null (defaultBranch known) → also fails closed (the conditional needs BOTH to be decided)', async () => {
  const result = await runCheck('issue-link', {
    ctx: { body: 'Closes #42', provider: 'github', targetBranch: null, defaultBranch: 'main' },
    fetchIssue: async () => ({ labels: ['status:approved'] }),
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
});

// ── issue-link — issue-number extraction precedence (issue #231 CP-A2a
// review, finding m2) ─────────────────────────────────────────────────────
//
// GitHub bash's SLICE branch (governance.yml:66-76) tries Part-of FIRST,
// then falls back to a closing keyword. Before m2, run-check.mjs's
// extractIssueNumber() tried CLOSING first regardless of target — a
// fail-OPEN edge for a body carrying BOTH patterns pointing at DIFFERENT
// issues: bash picks the Part-of issue, Node picked the closing issue. m2
// aligns Node to bash: on a slice target, extract Part-of first; on a
// default-branch target, only the closing ref is ever consulted (the
// default-branch policy already requires it).

test('runCheck: issue-link — slice target, body has BOTH "Closes #42" and "Part of #7" (different issues) → extracts #7 (Part-of-first, matches GitHub bash slice-branch precedence)', async () => {
  let fetchedIssueNumber = null;
  const result = await runCheck('issue-link', {
    ctx: {
      body: 'fix: thing\n\nCloses #42\n\nPart of #7',
      provider: 'github',
      targetBranch: 'feature/tracker',
      defaultBranch: 'main',
    },
    fetchIssue: async (issueNumber) => {
      fetchedIssueNumber = issueNumber;
      return { labels: ['status:approved'] };
    },
    readConfig: () => ({}),
  });
  assert.equal(fetchedIssueNumber, 7, 'slice target must extract the Part-of issue (#7) first, mirroring GitHub bash');
  assert.deepEqual(result, { pass: true });
});

// ── diff-size — size:exception from FRESH ctx.labels, never CI_MERGE_REQUEST_LABELS (task 2.3) ─

test('runCheck: diff-size — ctx.labels includes "size:exception" → skips the budget check, pass', async () => {
  const result = await runCheck('diff-size', {
    ctx: { labels: ['size:exception'], baseSha: 'BASE', headSha: 'HEAD' },
    diffNumstat: () => { throw new Error('must not be called — size:exception skips the gate'); },
    readConfig: () => ({}),
  });
  assert.equal(result.pass, true);
});

test('runCheck: diff-size — over budget, no size:exception label → fail with reason', async () => {
  const result = await runCheck('diff-size', {
    ctx: { labels: [], baseSha: 'BASE', headSha: 'HEAD' },
    diffNumstat: () => '300\t101\tsrc/big.mjs',
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /401/);
});

test('runCheck: diff-size — under budget, no size:exception label → pass', async () => {
  const result = await runCheck('diff-size', {
    ctx: { labels: [], baseSha: 'BASE', headSha: 'HEAD' },
    diffNumstat: () => '5\t0\tbrain/scripts/foo.mjs',
    readConfig: () => ({}),
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: diff-size — reads ignoreList from governance.ignoreList (config), not hardcoded', async () => {
  const result = await runCheck('diff-size', {
    ctx: { labels: [], baseSha: 'BASE', headSha: 'HEAD' },
    diffNumstat: () => '3\t0\t.memory/session.jsonl.gz\n5\t0\tbrain/scripts/foo.mjs',
    readConfig: () => ({ governance: { ignoreList: ['.memory/**'] } }),
  });
  assert.deepEqual(result, { pass: true });
});

test('runCheck: diff-size — diffNumstat throws (git uncomputable) → fail closed with reason', async () => {
  const result = await runCheck('diff-size', {
    ctx: { labels: [], baseSha: null, headSha: null },
    diffNumstat: () => { throw new Error('BASE_SHA/HEAD_SHA not set'); },
    readConfig: () => ({}),
  });
  assert.equal(result.pass, false);
  assert.match(result.reason, /cannot compute diff — failing closed/i);
});

// ── behavior parity (task 2.6, CP-A2a ruling) ───────────────────────────────
//
// Name parity alone is NOT enough. This table encodes the truth table
// implemented by the GitHub bash paths — issue-link (.github/workflows/
// governance.yml:28-81) and diff-size (:84-113) — for the fixture dimensions
// task 2.6 calls out (body with/without a ref, referenced issue approved/not,
// diff over/under budget, size:exception present/absent), and asserts the
// Node run-check.mjs cases return the SAME pass/fail verdict for the SAME
// inputs. This proves routing through Node changed the TRANSPORT, not the
// VERDICT.
//
// Scope note (UPDATED — issue #231 A2 phase 2 ADDENDUM closes the gap this
// note originally flagged): the bash issue-link job branches on BASE_BRANCH
// — base=='main' requires a closing keyword (Closes|Fixes|Resolves #N)
// ONLY; base!='main' (the slice-PR branch, :55-71) accepts EITHER "Part of
// #N" OR a closing keyword. run-check.mjs's issue-link case now ALSO
// branches — via `requiresClosingKeyword(ctx)`, fed by
// `ctx.targetBranch`/`ctx.defaultBranch` (REQ-CIC-2 delta) — so the Node
// path matches BOTH bash branches, not just the slice-PR one. Rows below
// that omit `targetBranch`/`defaultBranch` default to a SLICE target
// (targetBranch !== defaultBranch, the original task 2.6 scope); the new row
// at the bottom explicitly sets a default-branch target to prove the
// previously-undocumented gap is now closed.
//
// EXPLICIT DIVERGENCE (NOT total parity — pre-existing, out of scope here):
// the GitHub bash literally compares `BASE_BRANCH == 'main'` (a hardcoded
// string), never the repo's actual default branch. A GitHub consumer whose
// default branch is NOT 'main' (e.g. 'develop') would have the bash apply
// the WRONG policy — comparing against a literal that isn't its default —
// while the Node path (this addendum) correctly compares against
// `ctx.defaultBranch` (the real default branch, mapped from
// `github.event.repository.default_branch`). This divergence is a
// pre-existing bash limitation, not introduced by this addendum, and fixing
// the bash side is out of scope here — recorded as a follow-up, not implied
// parity.
//
// VOCABULARY DIMENSION (issue #231 CP-A2a review, finding M1): the rows
// above use "Closes"/"Part of" almost exclusively. The table now also covers
// the full 9-form closing-keyword vocabulary (close, closes, closed, fix,
// fixes, fixed, resolve, resolves, resolved) that GitHub bash's grep
// (close[sd]?|fix(e[sd])?|resolve[sd]?) has always accepted — issueLink()
// and run-check.mjs's own closing-number regex were previously NARROWER (3
// forms only), a fail-closed parity gap now closed by sharing one pattern
// (checks/issue-ref-patterns.mjs) across issueLink(), run-check.mjs, and
// actor-check.mjs.

const issueLinkParityTable = [
  {
    label: 'Closes #N present, issue approved',
    body: 'fix: thing\n\nCloses #42',
    issueLabels: ['status:approved'],
    // bash (governance.yml:59-66): num extracted via Part-of-or-closing regex
    // (finds #42) → (:76-81) gh api fetches issue #42 labels → grep -qx
    // 'status:approved' matches → PASS.
    githubBashVerdict: true,
  },
  {
    label: 'Part of #N present, issue approved',
    body: 'feat: slice\n\nPart of #42',
    issueLabels: ['status:approved'],
    // bash (:59-62): Part-of regex matches #42 → (:76-81) approved → PASS.
    githubBashVerdict: true,
  },
  {
    label: 'Closes #N present, issue NOT approved',
    body: 'fix: thing\n\nCloses #42',
    issueLabels: ['status:in-review'],
    // bash (:76-81): labels fetched but grep -qx 'status:approved' does not
    // match 'status:in-review' → ::error:: not labeled → FAIL.
    githubBashVerdict: false,
  },
  {
    label: 'Part of #N present, issue NOT approved',
    body: 'Part of #7',
    issueLabels: [],
    // bash (:76-81): issue has no labels at all → grep -qx fails → FAIL.
    githubBashVerdict: false,
  },
  {
    label: 'no issue reference at all',
    body: 'chore: tidy up, no link here',
    issueLabels: ['status:approved'], // irrelevant — bash never reaches the fetch
    // bash (:59-70): both num= extractions come up empty → ::error:: must
    // have a reference → exit 1 → FAIL (before any gh api call).
    githubBashVerdict: false,
  },
  {
    label: 'Part of #N present (no closing keyword), base == default branch — RULED ROW (A2 phase 2 addendum)',
    body: 'feat: slice\n\nPart of #42',
    issueLabels: ['status:approved'],
    targetBranch: 'main',
    defaultBranch: 'main',
    // bash (governance.yml:45-54): BASE_BRANCH=='main' branch requires a
    // CLOSING keyword ONLY — the num= extraction on :48-50 (grep for
    // close[sd]?|fix(e[sd])?|resolve[sd]?) finds nothing in a Part-of-only
    // body → num empty → ::error:: PR to main must have a Closes/Fixes/
    // Resolves reference → exit 1 → FAIL.
    // Node (run-check.mjs, THIS ADDENDUM): ctx.targetBranch===ctx.defaultBranch
    // → requiresClosingKeyword() returns true → CLOSING_NUM_RE does not match
    // a Part-of-only body → FAIL. Both paths FAIL — this is the exact input
    // that used to PASS on Node before this addendum (the gap being closed).
    githubBashVerdict: false,
  },

  // ── vocabulary dimension (issue #231 CP-A2a review, finding M1) ───────────
  //
  // Before M1, run-check.mjs's issue-link case (via issueLink() AND its own
  // CLOSING_NUM_RE) only recognized closes|fixes|resolves (3 of the 9
  // GitHub-documented closing forms) — a NARROWER vocabulary than GitHub
  // bash's own grep (close[sd]?|fix(e[sd])?|resolve[sd]?, all 9 forms). A
  // body like "Fixed #42" therefore PASSED GitHub bash but FAILED the Node
  // path — a parity divergence. M1 widens issueLink() and run-check.mjs to
  // the SAME shared broad pattern (checks/issue-ref-patterns.mjs). These
  // rows cover at least one form from each of the three keyword families
  // (close/fix/resolve) on a slice target, PLUS the exact M1 default-branch
  // case below.
  {
    label: 'Fixed #N (past-tense "fix" form), issue approved',
    body: 'Fixed #42',
    issueLabels: ['status:approved'],
    // bash (:74, broad grep matches "Fixed"): finds #42 → approved → PASS.
    githubBashVerdict: true,
  },
  {
    label: 'close #N (bare "close" form), issue approved',
    body: 'close #42',
    issueLabels: ['status:approved'],
    // bash (:74, broad grep matches "close"): finds #42 → approved → PASS.
    githubBashVerdict: true,
  },
  {
    label: 'Resolved #N (past-tense "resolve" form), issue approved',
    body: 'Resolved #42',
    issueLabels: ['status:approved'],
    // bash (:74, broad grep matches "Resolved"): finds #42 → approved → PASS.
    githubBashVerdict: true,
  },
  {
    label: 'Fixed #42 targeting the DEFAULT branch — THE M1 case (broad closing form satisfies the default-branch closing-keyword policy)',
    body: 'Fixed #42',
    issueLabels: ['status:approved'],
    targetBranch: 'main',
    defaultBranch: 'main',
    // bash (governance.yml:55-64, base=='main' branch): the broad grep
    // (close[sd]?|fix(e[sd])?|resolve[sd]?) matches "Fixed" → num=42 →
    // approved → PASS. Before M1, Node's own CLOSING_NUM_RE was narrow
    // (closes|fixes|resolves) and did NOT match "Fixed" → the default-branch
    // closing-keyword policy (requiresClosingKeyword) would wrongly FAIL this
    // — the exact fail-closed parity divergence M1 closes.
    githubBashVerdict: true,
  },
];

for (const row of issueLinkParityTable) {
  test(`behavior parity (issue-link): "${row.label}" → Node verdict matches documented GitHub-bash verdict (${row.githubBashVerdict ? 'PASS' : 'FAIL'})`, async () => {
    // provider: 'github' — the bash's own label literal is the unscoped
    // 'status:approved' (governance.yml:78); the fixture issueLabels above
    // use that same unscoped form, so the Node-side resolver must resolve to
    // the SAME form for an apples-to-apples verdict comparison. Rows that
    // don't specify targetBranch/defaultBranch default to a SLICE target
    // (the original task 2.6 scope, preserved).
    const result = await runCheck('issue-link', {
      ctx: {
        body: row.body,
        provider: 'github',
        targetBranch: row.targetBranch ?? 'feature/tracker',
        defaultBranch: row.defaultBranch ?? 'main',
      },
      fetchIssue: async () => ({ labels: row.issueLabels }),
      readConfig: () => ({}),
    });
    assert.equal(result.pass, row.githubBashVerdict,
      `Node issue-link verdict (${result.pass}) must match GitHub-bash verdict (${row.githubBashVerdict}) for: ${row.label}`);
  });
}

const diffSizeParityTable = [
  {
    label: 'under budget, no size:exception',
    numstat: '5\t0\tbrain/scripts/foo.mjs',
    labels: [],
    // bash (:100-113): LABELS has no size:exception word → git diff --numstat
    // piped to diff-size-count.mjs → changed=5 → 5>400 false → PASS (no error).
    githubBashVerdict: true,
  },
  {
    label: 'over budget, no size:exception',
    numstat: '300\t101\tsrc/big.mjs',
    labels: [],
    // bash (:100-113): no size:exception → changed=401 → 401>400 → ::error:: → FAIL.
    githubBashVerdict: false,
  },
  {
    label: 'over budget, size:exception present',
    numstat: '300\t101\tsrc/big.mjs',
    labels: ['size:exception'],
    // bash (:101-104): grep -qw 'size:exception' on LABELS matches → prints
    // "skipping" → exit 0 → PASS (the budget is never even computed).
    githubBashVerdict: true,
  },
  {
    label: 'under budget, size:exception present',
    numstat: '5\t0\tbrain/scripts/foo.mjs',
    labels: ['size:exception'],
    // bash (:101-104): size:exception present → skip → exit 0 → PASS.
    githubBashVerdict: true,
  },
];

for (const row of diffSizeParityTable) {
  test(`behavior parity (diff-size): "${row.label}" → Node verdict matches documented GitHub-bash verdict (${row.githubBashVerdict ? 'PASS' : 'FAIL'})`, async () => {
    const result = await runCheck('diff-size', {
      ctx: { labels: row.labels, baseSha: 'BASE', headSha: 'HEAD' },
      diffNumstat: () => row.numstat,
      readConfig: () => ({}),
    });
    assert.equal(result.pass, row.githubBashVerdict,
      `Node diff-size verdict (${result.pass}) must match GitHub-bash verdict (${row.githubBashVerdict}) for: ${row.label}`);
  });
}
