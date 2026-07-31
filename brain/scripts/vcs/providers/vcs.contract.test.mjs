// vcs.contract.test.mjs — the shared, parameterized CONTRACT suite (issue #239
// A3 Phase 3, REQ-A3-5). ONE assertion set, run over BOTH providers
// (`['github', 'gitlab']`), for `labelEvents`, `prView`, `mrCreate`: parity
// means the SAME test body applies to each provider — not two divergent files
// that can silently drift apart.
//
// This is DISTINCT from `../providers.test.mjs` (provider-specific behavior,
// e.g. each provider's own URL-building/CLI-arg details) — this suite only
// asserts what the CONTRACT (vcs-contract.md) promises: normalized shapes,
// `null`-on-uncomputable, ascending ordering, never-throws.
//
// Fixtures live in `../fixtures/*.json` (REQ-A3-6) — recorded from the real
// GitHub API where reachable (github-labelEvents-happy.json,
// github-prView-happy.json, github-prReviews-happy.json — see
// fixtures/record-fixtures.mjs), DERIVED
// (hand-authored from the documented API shape) everywhere else (all
// gitlab-*.json — no live GitLab mirror reachable from this environment,
// deferred to CP-A3b/SCIT; every github-*-failure.json and
// github-mrCreate-happy.json — forced-failure/mutating-write cases that
// cannot be recorded). `_provenance.recorded`/`_provenance.derived` is always
// present and never both true (lesson #12).
//
// No live network or CLI spawn happens in this suite — every transport is the
// injected fixture reader below (github via the existing `setSpawn` seam,
// gitlab via the existing `fetchImpl` param).

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setSpawn } from '../lib/exec.mjs';
// The REAL production parser the reviewer's flow guarantees run on (issue
// #317). Imported here on purpose: the `prReviews` block below feeds this
// suite's REAL normalizer output straight into it, so "the adapter emits a
// parseable verdict" is asserted end-to-end rather than assumed.
import { parseVerdict } from '../../review/lib/parse-verdict.mjs';

import * as github from './github.mjs';
import * as gitlab from './gitlab.mjs';

afterEach(() => setSpawn(spawnSync));

const FIXTURES_DIR = fileURLToPath(new URL('../fixtures/', import.meta.url));

/** Loads and parses a fixture JSON file by name. */
function loadFixture(name) {
  return JSON.parse(readFileSync(`${FIXTURES_DIR}${name}`, 'utf8'));
}

/** Every fixture MUST declare exactly one of recorded/derived (never both, never neither). */
function assertProvenance(fixture, fixtureName) {
  const p = fixture._provenance;
  assert.ok(p, `${fixtureName}: missing _provenance`);
  const recorded = p.recorded === true;
  const derived = p.derived === true;
  assert.ok(recorded || derived, `${fixtureName}: must be marked recorded or derived — never ambiguous (lesson #12)`);
  assert.ok(!(recorded && derived), `${fixtureName}: must not be marked BOTH recorded and derived`);
  assert.ok(p.endpoint, `${fixtureName}: missing _provenance.endpoint`);
  assert.ok(p.date, `${fixtureName}: missing _provenance.date`);
}

// ── Per-provider fixture-reading transport glue ─────────────────────────────
// github verbs read via the `gh` CLI (spawn-based, no fetchImpl param);
// gitlab verbs read via the shared `gitlabApiFetch` (fetchImpl param). Both
// glue functions turn ONE fixture shape ({ data } | { throws, ... }) into
// whatever that provider's real transport seam expects — the fixture format
// itself is provider-agnostic.

function jsonSpawn(data, status = 0) {
  return () => ({ status, stdout: JSON.stringify(data), stderr: '' });
}
function rawSpawn(stdout, status = 0) {
  return () => ({ status, stdout, stderr: '' });
}
function failSpawn(message = 'fixture: simulated failure') {
  return () => ({ status: 1, stdout: '', stderr: message });
}

// Named for the seam (JSON-over-spawn), not the provider — `mrList` proves
// GitLab needs this same spawn glue too (gitlab.mrList spawns `glab` via
// `runJson` rather than fetching over `gitlabApiFetch`, so `gitlabCallArgs`'s
// `fetchImpl` injection does not apply to it).
function jsonSpawnCallArgs(fixture) {
  setSpawn(fixture.throws ? failSpawn(fixture.error) : jsonSpawn(fixture.data));
  return {};
}
function githubRawCallArgs(fixture) {
  setSpawn(fixture.throws ? failSpawn(fixture.error) : rawSpawn(fixture.stdout ?? ''));
  return {};
}
function gitlabCallArgs(fixture) {
  return {
    fetchImpl: async () =>
      fixture.throws
        ? { ok: false, status: fixture.status ?? 500 }
        : { ok: true, json: async () => fixture.data },
  };
}

// gitlab.prReviews (issue #317) is the ONLY verb that reads TWO endpoints —
// MR notes (the verdict thread) and MR approvals (the L6 approver roster) —
// so the uniform single-payload `gitlabCallArgs` above cannot serve it: one
// fixed response for both calls would feed the notes payload to the approvals
// normalizer (and vice versa), producing a green test for the wrong reason.
// This glue dispatches on the request URL, serving each endpoint its own half
// of `fixture.data`. `page`-aware: any page past the first returns `[]`, the
// short-page terminator the verb's pagination loop stops on.
function gitlabPrReviewsCallArgs(fixture) {
  return {
    fetchImpl: async (url) => {
      if (fixture.throws) return { ok: false, status: fixture.status ?? 500 };
      if (url.includes('/approvals')) return { ok: true, json: async () => fixture.data.approvals };
      const firstPage = !/[?&]page=(?!1\b)\d+/.test(url);
      return { ok: true, json: async () => (firstPage ? fixture.data.notes : []) };
    },
  };
}

// authCheck/authLogin (issues #364/#365, M10 Phase 2 ranks 5-6) call the raw
// `run()` wrapper, not `runJson()` — there is no JSON body to parse, only an
// exit status (`run()`'s `ok: r.status === 0`). Reusing `jsonSpawnCallArgs`
// would JSON-serialize the fixture's data as stdout, fabricating a JSON body
// neither verb ever parses. This glue drives `_spawn` directly off the
// fixture's own `status`/`stdout`/`stderr` fields — the exact mechanism both
// verbs' boolean return value depends on (design D1).
function rawStatusCallArgs(fixture) {
  setSpawn(() => ({ status: fixture.status, stdout: fixture.stdout ?? '', stderr: fixture.stderr ?? '' }));
  return {};
}

const PROVIDERS = {
  github: {
    module: github,
    labelEvents: jsonSpawnCallArgs,
    prView: jsonSpawnCallArgs,
    mrCreate: githubRawCallArgs,
    issueView: jsonSpawnCallArgs,
    mrList: jsonSpawnCallArgs,
    issueList: jsonSpawnCallArgs,
    authCheck: rawStatusCallArgs,
    authLogin: rawStatusCallArgs,
    prReviews: jsonSpawnCallArgs,
  },
  gitlab: {
    module: gitlab,
    labelEvents: gitlabCallArgs,
    prView: gitlabCallArgs,
    mrCreate: gitlabCallArgs,
    issueView: gitlabCallArgs,
    // gitlab.mrList spawns `glab` via runJson rather than fetching over
    // gitlabApiFetch (design D1) — it shares GitHub's spawn-transport seam,
    // so PROVIDERS.gitlab.mrList is the SAME function object as
    // PROVIDERS.github.mrList. That is the honest encoding of "both
    // providers share one transport for this verb", not a copy-paste error.
    mrList: jsonSpawnCallArgs,
    // gitlab.issueList spawns `glab` via runJson for the same reason
    // gitlab.mrList does (design D1) — same shared function object.
    issueList: jsonSpawnCallArgs,
    // gitlab.authCheck/authLogin spawn `glab` via the raw run() wrapper, the
    // same shared spawn-transport seam github's boolean verbs use — same
    // shared function object, same "one transport, both providers" honesty.
    authCheck: rawStatusCallArgs,
    authLogin: rawStatusCallArgs,
    // gitlab.prReviews reads TWO endpoints over gitlabApiFetch (issue #317),
    // so it needs the URL-dispatching glue rather than the uniform one.
    prReviews: gitlabPrReviewsCallArgs,
  },
};

for (const providerName of Object.keys(PROVIDERS)) {
  const {
    module: vcs,
    labelEvents: labelEventsArgs,
    prView: prViewArgs,
    mrCreate: mrCreateArgs,
    issueView: issueViewArgs,
    mrList: mrListArgs,
    issueList: issueListArgs,
    authCheck: authCheckArgs,
    authLogin: authLoginArgs,
    prReviews: prReviewsArgs,
  } = PROVIDERS[providerName];

  // ── labelEvents ────────────────────────────────────────────────────────
  test(`${providerName}.labelEvents (contract): happy fixture normalizes to the shared shape, ascending by at`, async () => {
    const fixtureName = `${providerName}-labelEvents-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.labelEvents({ project: 'x/y', number: 1, ...labelEventsArgs(fixture) });

    assert.ok(Array.isArray(result), 'labelEvents must return an array on a successful fetch');
    assert.ok(result.length >= 2, 'happy fixture must exercise at least 2 label events');
    for (const entry of result) {
      assert.ok('login' in entry.actor, 'each entry must normalize to { actor: { login } }');
      assert.ok(['add', 'remove'].includes(entry.action), 'action must normalize to add|remove');
      assert.ok('label' in entry, 'each entry must carry a normalized label');
      assert.ok('at' in entry, 'each entry must carry a normalized at timestamp');
      // No provider-specific field name may leak through the contract.
      assert.ok(!('iid' in entry), 'must not leak GitLab iid');
      assert.ok(!('username' in entry), 'must not leak raw username (only actor.login)');
      assert.ok(!('created_at' in entry), 'must not leak raw created_at (only at)');
    }
    const ats = result.map(e => new Date(e.at).getTime());
    const sorted = [...ats].sort((a, b) => a - b);
    assert.deepEqual(ats, sorted, 'labelEvents must be ordered chronologically ascending');
  });

  test(`${providerName}.labelEvents (contract): a fetch failure yields null, never a fabricated []`, async () => {
    const fixtureName = `${providerName}-labelEvents-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.labelEvents({ project: 'x/y', number: 1, ...labelEventsArgs(fixture) });
    assert.equal(result, null, 'an uncomputable labelEvents fetch must return null, never []');
  });

  // ── prView ─────────────────────────────────────────────────────────────
  test(`${providerName}.prView (contract): happy fixture normalizes to { number, labels, body, author }`, async () => {
    const fixtureName = `${providerName}-prView-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.prView({ project: 'x/y', number: 1, ...prViewArgs(fixture) });

    assert.equal(typeof result.number, 'number', 'number must normalize to a number');
    assert.ok(Array.isArray(result.labels), 'labels must normalize to an array of names');
    for (const label of result.labels) assert.equal(typeof label, 'string', 'each label must be a bare name string');
    assert.equal(typeof result.body, 'string', 'body must be a string on a successful fetch');
    // REQ-A3-... (task 3.7 body-parity): `null` means uncomputable, `''` means
    // successfully-empty — a SUCCESSFUL fetch must never surface `null`.
    assert.notEqual(result.body, null, 'a successful prView fetch must never surface body:null (that means uncomputable)');
    assert.notEqual(result.author, undefined, 'author key must be present (null is valid — absent-on-provider — undefined is not)');
  });

  test(`${providerName}.prView (contract): a fetch failure yields the null-shape, never throws`, async () => {
    const fixtureName = `${providerName}-prView-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.prView({ project: 'x/y', number: 42, ...prViewArgs(fixture) });
    assert.deepEqual(result, { number: 42, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null });
  });

  // headRefOid (ADR-0021 Decision 1): the recorded/derived happy fixtures
  // predate this field (queried BEFORE the widening), so they are exercised
  // inline here rather than mutating provenance-tracked fixture files.
  test(`${providerName}.prView (contract): a successful fetch normalizes headRefOid to the API head sha`, async () => {
    const withHead =
      providerName === 'github'
        ? { throws: false, data: { number: 7, labels: [], body: '', author: null, headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d' } }
        : { throws: false, data: { iid: 7, labels: [], description: '', author: null, sha: 'cafef00dcafef00dcafef00dcafef00dcafef00d' } };
    const result = await vcs.prView({ project: 'x/y', number: 7, ...prViewArgs(withHead) });
    assert.equal(result.headRefOid, 'cafef00dcafef00dcafef00dcafef00dcafef00d');
  });

  test(`${providerName}.prView (contract): headRefOid normalizes to null when uncomputable on an otherwise-successful fetch`, async () => {
    const noHead =
      providerName === 'github'
        ? { throws: false, data: { number: 7, labels: [], body: '', author: null } }
        : { throws: false, data: { iid: 7, labels: [], description: '', author: null } };
    const result = await vcs.prView({ project: 'x/y', number: 7, ...prViewArgs(noHead) });
    assert.equal(result.headRefOid, null);
  });

  // Body-parity (task 3.7, empty-vs-uncomputable canonical rule): `null` means
  // uncomputable (the fetch itself failed — asserted above); `''` means the
  // fetch SUCCEEDED and the underlying body/description field was genuinely
  // empty. Prior to A3 Phase 3, GitHub's prView already normalized to `?? ''`
  // but GitLab's normalized bare `r.description` (→ `null`/`undefined` when
  // absent) — indistinguishable from the failure case above. This test would
  // RED on the pre-fix gitlab.mjs.
  test(`${providerName}.prView (contract): a successful fetch with no body/description normalizes to '' (never null — null means uncomputable)`, async () => {
    const emptyFixture =
      providerName === 'github'
        ? { throws: false, data: { number: 7, labels: [], body: null, author: null } }
        : { throws: false, data: { iid: 7, labels: [], description: null, author: null } };
    const result = await vcs.prView({ project: 'x/y', number: 7, ...prViewArgs(emptyFixture) });
    assert.equal(result.body, '', 'a successfully-fetched-but-empty body must normalize to "", not null/undefined');
  });

  // ── issueView (issue #334, M10 Gap-A) ─────────────────────────────────
  // `({ project, number }) -> { number, title, labels, body, author }`. `labels`
  // is always a `string[]`, never null, possibly empty — the source of the
  // issue's `type:*` label consumed by `ship-pr-label-resolution` /
  // `findTypeLabel`. Unlike `prView`, a fetch failure REJECTS (design A5) —
  // `brain-start.mjs:65` already depends on that, so this is PINNED, not fixed.
  test(`${providerName}.issueView (contract): happy fixture normalizes to { number, title, labels, body, author }`, async () => {
    const fixtureName = `${providerName}-issueView-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.issueView({ project: 'x/y', number: 1, ...issueViewArgs(fixture) });

    assert.equal(typeof result.number, 'number', 'number must normalize to a number');
    assert.equal(typeof result.title, 'string', 'title must be a string');
    assert.ok(Array.isArray(result.labels), 'labels must always normalize to an array, never null/undefined');
    for (const label of result.labels) {
      assert.equal(typeof label, 'string', 'each label must be a bare name string — no leaked provider object shape');
    }
    assert.equal(typeof result.body, 'string', 'body must be a string on a successful fetch');
    assert.notEqual(result.author, undefined, 'author key must be present (null is valid — undefined is not)');
  });

  test(`${providerName}.issueView (contract): a fetch failure REJECTS — never a fabricated null/empty shape (A5)`, async () => {
    const fixtureName = `${providerName}-issueView-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    await assert.rejects(
      () => vcs.issueView({ project: 'x/y', number: 9999, ...issueViewArgs(fixture) }),
      'issueView must REJECT on a fetch failure — brain-start.mjs:65 depends on that, unlike prView\'s null-shape',
    );
  });

  test(`${providerName}.issueView (contract): a successful fetch with no labels normalizes to [], never null/undefined`, async () => {
    // The `labels` key is OMITTED from the payload DELIBERATELY. A payload
    // that already carried `labels: []` would satisfy the assertion below
    // without the provider's `?? []` guard ever running — a vacuous test that
    // would still pass if the guard were deleted. With the key absent, `[]`
    // can only come from the guard, so the invariant is genuinely pinned.
    const emptyFixture =
      providerName === 'github'
        ? { throws: false, data: { number: 7, title: 'x', body: '', user: { login: null } } }
        : { throws: false, data: { iid: 7, title: 'x', description: '', author: null } };
    const result = await vcs.issueView({ project: 'x/y', number: 7, ...issueViewArgs(emptyFixture) });
    assert.deepEqual(result.labels, [], 'an empty label set must normalize to [], not null/undefined');
  });

  // ── mrList (issue #355, M10 Phase 2 rank-3) ─────────────────────────────
  // `({ project, state }) -> [{ number, title, headBranch }]`. Unlike its
  // sibling read verbs (prView/prReviews/labelEvents/prStatusRollup), `mrList`
  // does NOT wrap its transport call — `runJson` throws on a non-zero exit or
  // malformed JSON (exec.mjs:31-32), and neither provider catches it. This is
  // PINNED here (design D3) because changing it is out of scope for this
  // change, NOT because a caller depends on the throw — the opposite of why
  // issueView's failure-REJECTS test above is pinned.
  test(`${providerName}.mrList (contract): happy fixture normalizes to exactly { number, title, headBranch } per entry`, async () => {
    const fixtureName = `${providerName}-mrList-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.mrList({ project: 'x/y', state: 'open', ...mrListArgs(fixture) });

    assert.ok(result.length >= 2, 'happy fixture must exercise at least 2 entries');
    for (const entry of result) {
      assert.deepEqual(
        Object.keys(entry).sort(),
        ['headBranch', 'number', 'title'],
        'each mrList entry must normalize to EXACTLY { number, title, headBranch } — no narrowed or widened shape',
      );
    }
    // Full-array lock: pins values AND order (neither provider sorts —
    // callers index into the list, so preserving the API's own ordering
    // matters). Expected values are hardcoded from the fixture's own known
    // content rather than re-derived from fixture.data via the same
    // number/head.ref/source_branch mapping the normalizer performs — doing
    // so would let a normalizer bug that mirrors this test's mapping pass
    // undetected.
    const expected =
      providerName === 'github'
        ? [
            { number: 342, title: 'M10: seam-contract-coverage epic tracker', headBranch: 'feature/m10-seam-contract-coverage' },
            { number: 331, title: 'fix(governance): re-order release audit gate to audit-then-tag and add audit baseline', headBranch: 'fix/issue-210-fixgovernance-releaseyml-audit-gate-cann' },
          ]
        : [
            { number: 42, title: 'Add pagination guard to labelList', headBranch: 'feat/label-pagination' },
            { number: 41, title: 'Fix issueView author normalization', headBranch: 'fix/issue-author-null' },
          ];
    assert.deepEqual(result, expected);
  });

  test(`${providerName}.mrList (contract): an empty open-list yields [], never a fabricated null/undefined`, async () => {
    const fixtureName = `${providerName}-mrList-empty.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.mrList({ project: 'x/y', state: 'open', ...mrListArgs(fixture) });
    assert.deepEqual(result, [], 'board.mjs/queue.mjs iterate the mrList result unguarded — [] is required, null/undefined would crash them');
  });

  test(`${providerName}.mrList (contract): a transport failure REJECTS — pinned as a documented divergence, not fixed here`, async () => {
    const fixtureName = `${providerName}-mrList-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    await assert.rejects(
      () => vcs.mrList({ project: 'x/y', state: 'open', ...mrListArgs(fixture) }),
      'mrList must REJECT on a transport failure — unlike prView/prReviews/labelEvents/prStatusRollup\'s never-throws convention, mrList does not wrap runJson in a try/catch (design D3); this is PINNED because changing it is out of scope here, not because a caller depends on it',
    );
  });

  // ── issueList (issue #362, M10 Phase 2 rank-4) ──────────────────────────
  // `({ project, state, assignee }) -> [{ number, title, labels }]`. Like
  // `mrList`, `issueList` does NOT wrap its transport call — `runJson` throws
  // on a non-zero exit or malformed JSON (exec.mjs:31-32), and neither
  // provider catches it. BUT the reason this throw is pinned is the OPPOSITE
  // of why mrList's is (design D3): every `issueList` call site already
  // ABSORBS the throw — `tracker-board.mjs:44-47`'s `safeList` wraps it in
  // try/catch and returns `[]`; `project-status.mjs:115-130` wraps the call
  // (and the sibling `mrList` call) in its own try/catch. So the throw is
  // CONTAINED and load-bearing here, not merely out of scope to fix.
  //
  // D1 — the `assignee` parameter is DELIBERATELY EXCLUDED from this loop.
  // Every assignee value produces the identical result shape from the
  // identical response payload; only the query string varies, and that is
  // already unit-tested at `cli.test.mjs:110-116`. Tracing what would
  // silently go green if `assignee: 'me'` were added under this loop's
  // uniform-response stub (one fixed response for every spawn call): `
  // whoami()` would receive the ISSUES ARRAY back instead of a user object,
  // so `resp.login`/`resp.username` would be `undefined`;
  // `assigneeParams('github', 'me', undefined)` falls back to a
  // plausible-looking `{ assignee: '@me' }`; `assigneeParams('gitlab', 'me',
  // undefined)` yields `{ assignee_username: undefined }`, which `toQs`
  // filters out but still leaves a truthy `extra`, producing a malformed
  // trailing `&` in the endpoint. The second `runJson` call then returns the
  // same array again and normalizes cleanly — a GREEN test for the WRONG
  // reason. Do not "improve" this coverage by adding `assignee` here.
  test(`${providerName}.issueList (contract): happy fixture normalizes to exactly { number, title, labels } per entry`, async () => {
    const fixtureName = `${providerName}-issueList-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.issueList({ project: 'x/y', state: 'open', ...issueListArgs(fixture) });

    assert.ok(result.length >= 2, 'happy fixture must exercise at least 2 surviving entries');
    for (const entry of result) {
      assert.deepEqual(
        Object.keys(entry).sort(),
        ['labels', 'number', 'title'],
        'each issueList entry must normalize to EXACTLY { number, title, labels } — no narrowed or widened shape',
      );
      for (const label of entry.labels) {
        assert.equal(
          typeof label,
          'string',
          'each label must be a bare name string — GitHub unwraps label objects via .map(l => l.name), GitLab is already a flat string array',
        );
      }
    }
    // Full-array lock: pins values AND order (neither provider sorts — the
    // API's own ordering surfaces as-is, and project-status.mjs:118 prints in
    // that order). Expected values are hardcoded from the fixture's own known
    // content rather than re-derived from fixture.data via the same
    // number/iid/labels mapping the normalizer performs — doing so would let
    // a normalizer bug that mirrors this test's mapping pass undetected.
    const expected =
      providerName === 'github'
        ? [
            { number: 362, title: 'feat(m10-phase2): issueList contract-parity coverage (rank 4)', labels: ['type:feature', 'status:needs-review'] },
            { number: 361, title: 'fix(memory): index self-healing is backend-asymmetric — engram.share() reindexes conditionally and engram.pull() never does', labels: [] },
            { number: 358, title: 'Q5 — Architecture decision: doctrine tiers (lite/standard/regulated)', labels: [] },
            { number: 340, title: 'fix(governance): issue-link local check and CI job implement the same rule differently — brain:check greenlights PRs that CI rejects', labels: ['type:bug', 'status:needs-review'] },
            { number: 336, title: 'feat(vcs): M10 Phase 1 — port-verb contract coverage audit (detection only)', labels: ['type:feature', 'status:needs-review'] },
            { number: 329, title: 'fix(governance): actor-check L5 and #124 are mutually unsatisfiable for a solo maintainer', labels: ['type:bug'] },
          ]
        : [
            { number: 42, title: 'Add pagination guard to labelList', labels: ['type:bug', 'status:needs-review'] },
            { number: 41, title: 'Fix issueView author normalization', labels: [] },
          ];
    assert.deepEqual(result, expected);
  });

  test(`${providerName}.issueList (contract): an empty open-list yields [], never a fabricated null/undefined`, async () => {
    const fixtureName = `${providerName}-issueList-empty.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.issueList({ project: 'x/y', state: 'open', ...issueListArgs(fixture) });
    assert.deepEqual(
      result,
      [],
      "tracker-board.mjs:58's myIssues.length is unguarded — null/undefined would crash it with an uncaught TypeError at ESM top level; [] is the only safe return",
    );
  });

  test(`${providerName}.issueList (contract): a transport failure REJECTS — caller-absorbed at both call sites, unlike mrList's out-of-scope pin`, async () => {
    const fixtureName = `${providerName}-issueList-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    await assert.rejects(
      () => vcs.issueList({ project: 'x/y', state: 'open', ...issueListArgs(fixture) }),
      "issueList must REJECT on a transport failure — tracker-board.mjs:44-47's safeList catches it and returns [], and project-status.mjs:115-130 wraps the call in its own try/catch; both sites already absorb the throw, so it is CONTAINED and load-bearing here, not merely pinned because fixing it is out of scope (contrast with mrList's design D3 rationale)",
    );
  });

  // ── authCheck (issue #365, M10 Phase 2 rank-6) ──────────────────────────
  // `({ host }) -> boolean` (vcs-contract.md row 24). Corrected premise
  // (design.md): the originating task brief assumed a `{ username }` object
  // shape; both providers call the raw `run()` wrapper (never `runJson()`)
  // and return `.ok` — a plain boolean. `run()` never throws (exec.mjs:20-23)
  // — a non-zero exit normalizes to `false`, it does not reject. This is the
  // OPPOSITE divergence from mrList/issueList, which are pinned as throwing.
  test(`${providerName}.authCheck (contract): an authenticated session returns exactly true`, async () => {
    const fixtureName = `${providerName}-authCheck-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.authCheck({ host: 'github.com', ...authCheckArgs(fixture) });
    assert.equal(result, true, 'authCheck must return the exact boolean true on an authenticated session, not merely a truthy value');
  });

  test(`${providerName}.authCheck (contract): an unauthenticated session returns exactly false, and never rejects`, async () => {
    const fixtureName = `${providerName}-authCheck-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    await assert.doesNotReject(
      async () => {
        const result = await vcs.authCheck({ host: 'github.com', ...authCheckArgs(fixture) });
        assert.equal(result, false, 'authCheck must return the exact boolean false on a non-zero exit, not merely a falsy value');
      },
      'authCheck must resolve on a non-zero exit — run() never throws (exec.mjs:20-23) — unlike mrList/issueList, which are pinned as rejecting',
    );
  });

  // ── authLogin (issue #364, M10 Phase 2 rank-5) ──────────────────────────
  // `({ host, token }) -> boolean` (vcs-contract.md row 25). Same corrected
  // premise as authCheck — see design.md's "Corrected premise" section.
  test(`${providerName}.authLogin (contract): a successful login returns exactly true`, async () => {
    const fixtureName = `${providerName}-authLogin-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.authLogin({ host: 'github.com', token: 'tok', ...authLoginArgs(fixture) });
    assert.equal(result, true, 'authLogin must return the exact boolean true on a successful login, not merely a truthy value');
  });

  test(`${providerName}.authLogin (contract): a failed login returns exactly false, and never rejects`, async () => {
    const fixtureName = `${providerName}-authLogin-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    await assert.doesNotReject(
      async () => {
        const result = await vcs.authLogin({ host: 'github.com', token: 'tok', ...authLoginArgs(fixture) });
        assert.equal(result, false, 'authLogin must return the exact boolean false on a non-zero exit, not merely a falsy value');
      },
      'authLogin must resolve on a non-zero exit — run() never throws (exec.mjs:20-23)',
    );
  });

  // ── prReviews (issue #317) ──────────────────────────────────────────────
  //
  // `({ project, number, ... }) -> Promise<Array<{ state, author, body }>|null>`.
  //
  // WHY THIS BLOCK EXISTS. Every one of the reviewer's flow guarantees —
  // the anti-loop lock (poster.mjs's `lastVerdict`), the `rev >= 3 -> STOP`
  // bound (verdict.mjs's `priorRevCount`), the §8 prior-verdict doctrine
  // load, and board reconciliation — is reconstructed from ONE input:
  // `cold-boot`'s `doctrine.priorVerdicts`, which is `prReviews(...)` mapped
  // through `parseVerdict`. `parseVerdict` needs a STRING `body`.
  //
  // Before #317 neither provider emitted one. GitHub's normalizer dropped
  // `body`; GitLab's read the APPROVALS endpoint, which has no bodies at all
  // and no verdict thread. So `priorVerdicts` was ALWAYS `[]` in production
  // and all four guarantees were inert — while their unit tests stayed green
  // because cold-boot.test.mjs and board.test.mjs injected a `body` no real
  // adapter ever emitted (cold-boot.mjs even carried a comment admitting it).
  //
  // The masking is what these tests exist to kill, so the central assertion
  // is deliberately NOT "the shape has a body key". It is: run the REAL
  // normalizer output through the REAL `parseVerdict` and require a verdict
  // back. That is the only assertion an adapter cannot satisfy while still
  // being broken in production — a shape-only check would go green again the
  // moment someone normalized `body` to `undefined`, and a hand-written
  // review object in the test would reintroduce exactly the injection this
  // block replaces.
  test(`${providerName}.prReviews (contract): happy fixture normalizes to exactly { state, author, body } per entry`, async () => {
    const fixtureName = `${providerName}-prReviews-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.prReviews({ project: 'x/y', number: 1, ...prReviewsArgs(fixture) });

    assert.ok(Array.isArray(result), 'prReviews must return an array on a successful fetch');
    assert.ok(result.length >= 2, 'happy fixture must exercise at least 2 entries');
    for (const entry of result) {
      assert.deepEqual(
        Object.keys(entry).sort(),
        ['author', 'body', 'state'],
        'each prReviews entry must normalize to EXACTLY { state, author, body } — a narrowed shape is the #317 defect itself',
      );
      assert.equal(
        typeof entry.body,
        'string',
        'body must ALWAYS be a string — parse-verdict.mjs:36 rejects a non-string outright, so null/undefined silently empties priorVerdicts',
      );
      assert.notEqual(entry.author, undefined, 'author key must be present (null is valid — undefined is not)');
      // No provider-specific field name may leak through the contract.
      assert.ok(!('user' in entry), 'must not leak GitHub user object (only author)');
      assert.ok(!('username' in entry), 'must not leak raw GitLab username (only author)');
      assert.ok(!('system' in entry), 'must not leak GitLab note system flag');
      assert.ok(!('created_at' in entry), 'must not leak raw created_at');
    }
  });

  // THE anti-masking test. This is the assertion #317 turns on.
  test(`${providerName}.prReviews (contract): the REAL normalizer output parses into a verdict via the REAL parseVerdict — priorVerdicts is no longer always empty`, async () => {
    const fixtureName = `${providerName}-prReviews-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.prReviews({ project: 'x/y', number: 1, ...prReviewsArgs(fixture) });

    // Exactly cold-boot.mjs's `reviews.map(r => parseVerdict(r)).filter(Boolean)`
    // — the same expression, not a re-implementation, so a divergence between
    // this suite and production cannot hide here.
    const priorVerdicts = result.map(r => parseVerdict(r)).filter(Boolean);

    assert.ok(
      priorVerdicts.length >= 1,
      'the adapter\'s own output must yield at least one parsed verdict — an empty priorVerdicts is the #317 production defect: anti-loop dead, rev-bound dead, doctrine load dead, board reconciliation dead',
    );
    const latest = priorVerdicts[priorVerdicts.length - 1];
    assert.equal(typeof latest.head_sha, 'string', 'the parsed verdict must carry head_sha — poster.mjs compares it against the current head to suppress a duplicate re-post');
    assert.ok(['APPROVE', 'REVISE', 'STOP'].includes(latest.verdict), 'the parsed verdict must carry a recognized verdict scalar — board.mjs denormalizes it to reviewed:*');
    assert.notEqual(latest.author, undefined, 'the parsed verdict must carry author — poster.mjs\'s anti-loop compares it against the reviewer handle');
  });

  test(`${providerName}.prReviews (contract): a fetch failure yields null, never a fabricated []`, async () => {
    const fixtureName = `${providerName}-prReviews-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.prReviews({ project: 'x/y', number: 1, ...prReviewsArgs(fixture) });
    assert.equal(
      result,
      null,
      'an uncomputable prReviews fetch must return null, never [] — the L6 gate distinguishes "nobody approved" from "could not fetch"',
    );
  });

  if (providerName === 'gitlab') {
    test(`${providerName}.prReviews (contract): malformed notes response (200 OK, non-array body) yields null, matching prStatusRollup discipline`, async () => {
      const fixtureName = `${providerName}-prReviews-malformed.json`;
      const fixture = loadFixture(fixtureName);
      assertProvenance(fixture, fixtureName);

      const result = await vcs.prReviews({ project: 'x/y', number: 1, ...prReviewsArgs(fixture) });
      assert.equal(
        result,
        null,
        'prReviews must return null on a malformed notes response (200 OK with non-array body), not fabricate [] — all-or-nothing invariant',
      );
    });
  }

  // ── mrCreate ───────────────────────────────────────────────────────────
  test(`${providerName}.mrCreate (contract): happy fixture returns { url }`, async () => {
    const fixtureName = `${providerName}-mrCreate-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.mrCreate({
      project: 'x/y',
      title: 'T',
      body: 'B',
      head: 'feat/x',
      base: 'main',
      ...mrCreateArgs(fixture),
    });

    assert.equal(typeof result.url, 'string', 'a successful mrCreate must return a string url');
    assert.ok(result.url.length > 0);
    assert.equal(result.error, undefined, 'a successful mrCreate must not carry an error key');
  });

  test(`${providerName}.mrCreate (contract): a create failure returns { url: null, error }, never throws`, async () => {
    const fixtureName = `${providerName}-mrCreate-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.mrCreate({
      project: 'x/y',
      title: 'T',
      body: 'B',
      head: 'feat/x',
      base: 'main',
      ...mrCreateArgs(fixture),
    });

    assert.equal(result.url, null, 'a failed mrCreate must never fabricate a url');
    assert.equal(typeof result.error, 'string', 'a failed mrCreate must carry an error string');
  });
}

// ── authCheck/authLogin argument-building divergence + token security ──────
// (issues #364/#365, M10 Phase 2 ranks 5-6). Both verbs' fixture-driven
// happy/failure tests live in the main parity loop above (they only vary
// `status`, never call args). These three tests assert on the ARGS the
// mocked `_spawn` actually receives — a real per-provider code divergence
// (D4) that no fixture-driven test can see, since fixtures only vary the
// exit status. Standalone tests (no fixture, no loop), same precedent as the
// `github.issueList` pull_request-filter test directly below.

test('authCheck (contract): host-argument-building divergence — GitHub omits --hostname when host is falsy, GitLab always includes it', async () => {
  let githubArgs;
  setSpawn((_cmd, args) => { githubArgs = args; return { status: 0, stdout: '', stderr: '' }; });
  await github.authCheck({});
  assert.ok(
    !githubArgs.includes('--hostname'),
    'github.mjs#authCheck branches on a falsy host and omits --hostname entirely (github.mjs:20-23)',
  );

  let gitlabArgs;
  setSpawn((_cmd, args) => { gitlabArgs = args; return { status: 0, stdout: '', stderr: '' }; });
  await gitlab.authCheck({});
  assert.ok(
    gitlabArgs.includes('--hostname'),
    'gitlab.mjs#authCheck never branches — it always includes --hostname, even passing the omitted host value through as undefined (gitlab.mjs:22-24)',
  );
});

test('authLogin (contract): host-default divergence — GitHub defaults to github.com when host is omitted, GitLab does not', async () => {
  let githubArgs;
  setSpawn((_cmd, args) => { githubArgs = args; return { status: 0, stdout: '', stderr: '' }; });
  await github.authLogin({ token: 'tok' });
  assert.ok(
    githubArgs.includes('github.com'),
    "github.mjs#authLogin substitutes the literal default 'github.com' when host is omitted (host || 'github.com', github.mjs:25-28)",
  );

  let gitlabArgs;
  setSpawn((_cmd, args) => { gitlabArgs = args; return { status: 0, stdout: '', stderr: '' }; });
  await gitlab.authLogin({ token: 'tok' });
  const hostnameIdx = gitlabArgs.indexOf('--hostname');
  assert.ok(hostnameIdx !== -1, 'gitlab.mjs#authLogin always passes --hostname');
  assert.equal(
    gitlabArgs[hostnameIdx + 1],
    undefined,
    'gitlab.mjs#authLogin does NOT default host — the omitted value is passed through unguarded, unlike GitHub (gitlab.mjs:26-29)',
  );
});

test('authLogin (contract): the token is delivered via stdin on both providers, never via argv', async () => {
  const CREDENTIAL_VALUE = 'sample-cred-9x7';

  let githubArgs, githubOpts;
  setSpawn((_cmd, args, opts) => { githubArgs = args; githubOpts = opts; return { status: 0, stdout: '', stderr: '' }; });
  await github.authLogin({ host: 'github.com', token: CREDENTIAL_VALUE });
  assert.equal(githubOpts.input, CREDENTIAL_VALUE, 'github.mjs#authLogin must deliver the token via opts.input (stdin)');
  assert.ok(!githubArgs.includes(CREDENTIAL_VALUE), 'the token must never appear in the argv array passed to gh — a credential-leak guard');

  let gitlabArgs, gitlabOpts;
  setSpawn((_cmd, args, opts) => { gitlabArgs = args; gitlabOpts = opts; return { status: 0, stdout: '', stderr: '' }; });
  await gitlab.authLogin({ host: 'gitlab.com', token: CREDENTIAL_VALUE });
  assert.equal(gitlabOpts.input, CREDENTIAL_VALUE, 'gitlab.mjs#authLogin must deliver the token via opts.input (stdin)');
  assert.ok(!gitlabArgs.includes(CREDENTIAL_VALUE), 'the token must never appear in the argv array passed to glab — a credential-leak guard');
});

// ── issueList pull_request filter (issue #362, M10 Phase 2 rank-4) ─────────
// GitHub-only: GitLab's `projects/:id/issues` endpoint returns only issues —
// there is nothing to filter, so an `if (providerName === 'github')` branch
// inside the parity loop above would be exactly the provider-asymmetric
// concern that loop exists to prevent (design D2). This follows the file's
// own precedent for asymmetric concerns (BASE_REF_PROVIDERS below,
// prStatusRollup, labelList). The assertion is ARITHMETIC, not a fixture
// spot-check the reader must count by hand: `prCount >= 1` fails loudly if
// the fixture is ever re-recorded from a repo with no open PRs, rather than
// silently degrading into a tautology — this is the one assertion in this
// change that guards the fixture itself, not the normalizer.
test('github.issueList (contract): the pull_request filter is proven arithmetically against the recorded happy fixture', async () => {
  const fixtureName = 'github-issueList-happy.json';
  const fixture = loadFixture(fixtureName);
  assertProvenance(fixture, fixtureName);
  setSpawn(jsonSpawn(fixture.data));

  const result = await github.issueList({ project: 'x/y', state: 'open' });

  const prCount = fixture.data.filter(r => r.pull_request).length;
  assert.ok(prCount >= 1, 'the recorded fixture must contain at least one PR entry — otherwise this test is vacuous');
  assert.equal(
    result.length,
    fixture.data.length - prCount,
    'every PR-carrying entry must be filtered out, and no non-PR entry may be dropped alongside them',
  );
  for (const entry of result) {
    const source = fixture.data.find(r => r.number === entry.number);
    assert.ok(!source.pull_request, 'no PR-carrying source entry may survive the filter');
  }
});

// ── prView baseRefOid (ADR-0022 Decision 1) ─────────────────────────────────
// GH sources it via a SECOND, supplementary `gh api repos/{owner}/{repo}/
// pulls/{n} --jq .base.sha` call — `gh pr view --json` has no baseRefOid
// field. GL reads the already-fetched MR payload's `diff_refs.base_sha`
// (mirrors headRefOid's diff_refs.head_sha; no second request). GitHub's
// mechanism needs a SECOND spawn call returning a raw (not JSON) sha string —
// this doesn't fit the single-fixture `prViewArgs` glue used by the loop
// above (which mocks one uniform response for every spawn/fetch call), so
// these are exercised per-provider, same discipline as the prStatusRollup
// block below.

const BASE_REF_PROVIDERS = {
  github: {
    module: github,
    ok: (baseSha) => {
      setSpawn((_cmd, args) =>
        args[0] === 'pr'
          ? { status: 0, stdout: JSON.stringify({ number: 7, labels: [], body: '', author: null, headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d' }), stderr: '' }
          : { status: 0, stdout: `${baseSha}\n`, stderr: '' }
      );
      return {};
    },
    supplementFails: () => {
      setSpawn((_cmd, args) =>
        args[0] === 'pr'
          ? { status: 0, stdout: JSON.stringify({ number: 7, labels: [], body: '', author: null, headRefOid: 'cafef00dcafef00dcafef00dcafef00dcafef00d' }), stderr: '' }
          : { status: 1, stdout: '', stderr: 'fixture: simulated failure' }
      );
      return {};
    },
  },
  gitlab: {
    module: gitlab,
    ok: (baseSha) => ({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ iid: 7, labels: [], description: '', author: null, diff_refs: { base_sha: baseSha } }),
      }),
    }),
    supplementFails: () => ({
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ iid: 7, labels: [], description: '', author: null }),
      }),
    }),
  },
};

for (const providerName of Object.keys(BASE_REF_PROVIDERS)) {
  const { module: vcs, ok, supplementFails } = BASE_REF_PROVIDERS[providerName];

  test(`${providerName}.prView (contract): a successful fetch normalizes baseRefOid to the API base sha`, async () => {
    const result = await vcs.prView({ project: 'x/y', number: 7, ...ok('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef') });
    assert.equal(result.baseRefOid, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef');
  });

  test(`${providerName}.prView (contract): baseRefOid normalizes to null when uncomputable on an otherwise-successful fetch`, async () => {
    const result = await vcs.prView({ project: 'x/y', number: 7, ...supplementFails() });
    assert.equal(result.baseRefOid, null);
  });
}

// ── prStatusRollup (ADR-0021 Decision 2) — READ-only status-check rollup ────
// One assertion set run over both providers: the normalized shape
// `[{ name, status, conclusion }]` is the contract both must satisfy, even
// though GitHub's checks API and GitLab's commit-statuses model differ
// underneath. Inline mocks (no fixture files) — GitLab's normalization
// requires TWO chained calls (resolve the MR head sha, then fetch that sha's
// statuses), which doesn't fit the single-fixture `{data}|{throws}` shape
// used by the loop above.

const ROLLUP_PROVIDERS = {
  github: {
    module: github,
    ok: (checks) => { setSpawn(jsonSpawn({ statusCheckRollup: checks })); return {}; },
    fail: () => { setSpawn(failSpawn('fixture: simulated failure')); return {}; },
  },
  gitlab: {
    module: gitlab,
    ok: (checks) => ({
      fetchImpl: async (url) => (
        url.includes('/merge_requests/')
          ? { ok: true, json: async () => ({ sha: 'cafef00dcafef00dcafef00dcafef00dcafef00d' }) }
          : { ok: true, json: async () => checks.map(c => ({ name: c.name, status: c.status })) }
      ),
    }),
    fail: () => ({ fetchImpl: async () => ({ ok: false, status: 500 }) }),
  },
};

for (const providerName of Object.keys(ROLLUP_PROVIDERS)) {
  const { module: vcs, ok, fail } = ROLLUP_PROVIDERS[providerName];

  test(`${providerName}.prStatusRollup (contract): normalizes to [{ name, status, conclusion }], one entry per check`, async () => {
    const checks = [
      { name: 'issue-link', status: 'completed', conclusion: 'success' },
      { name: 'diff-size', status: 'in_progress', conclusion: null },
    ];
    const result = await vcs.prStatusRollup({ project: 'x/y', number: 1, ...ok(checks) });

    assert.ok(Array.isArray(result), 'prStatusRollup must return an array on a successful fetch');
    assert.ok(result.length >= 1, 'the happy case must exercise at least one check');
    for (const entry of result) {
      assert.equal(typeof entry.name, 'string', 'each entry must carry a normalized name');
      assert.ok('status' in entry, 'each entry must carry a normalized status');
      assert.ok('conclusion' in entry, 'each entry must carry a normalized conclusion key (null is valid)');
    }
  });

  test(`${providerName}.prStatusRollup (contract): a fetch failure yields null, never a fabricated []`, async () => {
    const result = await vcs.prStatusRollup({ project: 'x/y', number: 1, ...fail() });
    assert.equal(result, null, 'an uncomputable prStatusRollup fetch must return null, never []');
  });

  test(`${providerName}.prStatusRollup (contract): is READ-only — no write-verb call is reachable from its source`, () => {
    const src = readFileSync(fileURLToPath(new URL(`./${providerName}.mjs`, import.meta.url)), 'utf8');
    const fnBody = src.slice(src.indexOf('export async function prStatusRollup'));
    const fnEnd = fnBody.indexOf('\nexport ', 1);
    const scoped = fnEnd === -1 ? fnBody : fnBody.slice(0, fnEnd);
    assert.doesNotMatch(scoped, /-X['"]?\s*['"]?POST|-X['"]?\s*['"]?PUT|-X['"]?\s*['"]?DELETE|method:\s*['"](POST|PUT|DELETE)['"]/,
      `${providerName}.prStatusRollup must contain no write HTTP method — it is READ-only (ADR-0021 Decision 2)`);
  });
}

// ── prReviewComment / issueComment / labelAdd / labelRemove (issue #266,
// REQ-266-2) — the four COMMENT-only port verbs. ONE assertion set run over
// both providers, same discipline as the loop above: parity means the same
// test body applies to each provider. Inline mocks (no fixture files) — these
// are simple write verbs and the normalized shapes are the whole contract.

const WRITE_VERB_PROVIDERS = {
  github: {
    module: github,
    ok: (data) => { setSpawn(jsonSpawn(data)); return {}; },
    fail: () => { setSpawn(failSpawn('fixture: simulated failure')); return {}; },
  },
  gitlab: {
    module: gitlab,
    ok: (data) => ({ fetchImpl: async () => ({ ok: true, json: async () => data }) }),
    fail: () => ({ fetchImpl: async () => ({ ok: false, status: 500 }) }),
  },
};

for (const providerName of Object.keys(WRITE_VERB_PROVIDERS)) {
  const { module: vcs, ok, fail } = WRITE_VERB_PROVIDERS[providerName];

  test(`${providerName}.prReviewComment (contract): posts event:'COMMENT' (hardcoded), returns { url } on success`, async () => {
    const result = await vcs.prReviewComment({
      project: 'x/y', number: 1, body: 'verdict',
      ...ok({ html_url: 'https://example.test/x/y/pull/1#review-1', id: 1 }),
    });
    assert.equal(typeof result.url, 'string', 'a successful prReviewComment must return a string url');
    assert.equal(result.error, undefined, 'a successful prReviewComment must not carry an error key');
  });

  test(`${providerName}.prReviewComment (contract): a post failure returns { url: null, error }, never throws`, async () => {
    const result = await vcs.prReviewComment({ project: 'x/y', number: 1, body: 'verdict', ...fail() });
    assert.equal(result.url, null, 'a failed prReviewComment must never fabricate a url');
    assert.equal(typeof result.error, 'string', 'a failed prReviewComment must carry an error string');
  });

  test(`${providerName}.issueComment (contract): returns { url } on success`, async () => {
    const result = await vcs.issueComment({
      project: 'x/y', number: 1, body: 'ruling',
      ...ok({ html_url: 'https://example.test/x/y/issues/1#comment-1', id: 1 }),
    });
    assert.equal(typeof result.url, 'string', 'a successful issueComment must return a string url');
    assert.equal(result.error, undefined);
  });

  test(`${providerName}.issueComment (contract): a post failure returns { url: null, error }, never throws`, async () => {
    const result = await vcs.issueComment({ project: 'x/y', number: 1, body: 'ruling', ...fail() });
    assert.equal(result.url, null, 'a failed issueComment must never fabricate a url');
    assert.equal(typeof result.error, 'string');
  });

  test(`${providerName}.labelAdd (contract): returns { ok: true } on success`, async () => {
    const result = await vcs.labelAdd({
      project: 'x/y', number: 1, labels: ['seq:1'],
      ...ok({ labels: [{ name: 'seq:1' }] }),
    });
    assert.equal(result.ok, true);
    assert.equal(result.error, undefined, 'a successful labelAdd must not carry an error key');
  });

  test(`${providerName}.labelAdd (contract): a post failure returns { ok: false, error }, never throws`, async () => {
    const result = await vcs.labelAdd({ project: 'x/y', number: 1, labels: ['seq:1'], ...fail() });
    assert.equal(result.ok, false, 'a failed labelAdd must never fabricate ok:true');
    assert.equal(typeof result.error, 'string');
  });

  test(`${providerName}.labelRemove (contract): returns { ok: true } on success`, async () => {
    const result = await vcs.labelRemove({
      project: 'x/y', number: 1, labels: ['seq:1'],
      ...ok({ labels: [] }),
    });
    assert.equal(result.ok, true);
  });

  test(`${providerName}.labelRemove (contract): a post failure returns { ok: false, error }, never throws`, async () => {
    const result = await vcs.labelRemove({ project: 'x/y', number: 1, labels: ['seq:1'], ...fail() });
    assert.equal(result.ok, false, 'a failed labelRemove must never fabricate ok:true');
    assert.equal(typeof result.error, 'string');
  });
}

// ── labelList (issue #334, vcs-label-preflight contract) — inline mocks, no
// fixture files: a simple normalized READ verb, same precedent as
// labelAdd/prStatusRollup. `({ project }) -> string[]` — MAY throw like its
// siblings (labelPreflight, not this verb, is the total/never-throws layer —
// design A1). Pagination is exercised explicitly: a repo with >30/>100 labels
// must not silently drop real labels and false-reject a valid ship.

const LABEL_LIST_PROVIDERS = {
  github: {
    module: github,
    ok: (names) => { setSpawn(jsonSpawn(names.map(name => ({ name, color: 'ededed', description: '' })))); return {}; },
    fail: () => { setSpawn(failSpawn('fixture: simulated failure')); return {}; },
  },
  gitlab: {
    module: gitlab,
    ok: (names) => ({
      fetchImpl: async () => ({ ok: true, json: async () => names.map(name => ({ name, color: '#ededed', description: '' })) }),
    }),
    fail: () => ({ fetchImpl: async () => ({ ok: false, status: 500 }) }),
  },
};

for (const providerName of Object.keys(LABEL_LIST_PROVIDERS)) {
  const { module: vcs, ok, fail } = LABEL_LIST_PROVIDERS[providerName];

  test(`${providerName}.labelList (contract): normalizes to an array of bare label name strings`, async () => {
    const result = await vcs.labelList({ project: 'x/y', ...ok(['type:bug', 'type:feature', 'status:approved']) });
    assert.ok(Array.isArray(result), 'labelList must return an array');
    assert.deepEqual([...result].sort(), ['status:approved', 'type:bug', 'type:feature']);
    for (const name of result) assert.equal(typeof name, 'string', 'each entry must be a bare label name string');
  });

  test(`${providerName}.labelList (contract): names pass through verbatim — no case-folding`, async () => {
    const result = await vcs.labelList({ project: 'x/y', ...ok(['Type:Bug']) });
    assert.deepEqual(result, ['Type:Bug']);
  });

  test(`${providerName}.labelList (contract): a fetch failure throws (this verb is a normalized READ, not the total policy layer)`, async () => {
    await assert.rejects(() => vcs.labelList({ project: 'x/y', ...fail() }));
  });
}

test('github.labelList (contract): uses `gh api --paginate` — a many-page label set must not be silently truncated', async () => {
  let capturedArgs;
  setSpawn((_cmd, args) => {
    capturedArgs = args;
    return { status: 0, stdout: JSON.stringify([{ name: 'type:bug' }]), stderr: '' };
  });
  await github.labelList({ project: 'x/y' });
  assert.ok(capturedArgs.includes('--paginate'), 'github.labelList must call `gh api --paginate` — a single unpaginated page can silently drop real labels on a >30-label repo');
});

test('gitlab.labelList (contract): paginates until a short page — a many-page label set must not be silently truncated', async () => {
  let callCount = 0;
  const fullPage = Array.from({ length: 100 }, (_, i) => ({ name: `label-${i}` }));
  const shortPage = [{ name: 'type:bug' }];
  const result = await gitlab.labelList({
    project: 'x/y',
    fetchImpl: async () => {
      callCount += 1;
      return { ok: true, json: async () => (callCount === 1 ? fullPage : shortPage) };
    },
  });
  assert.equal(callCount, 2, 'gitlab.labelList must fetch a second page when the first page is full (per_page-sized)');
  assert.ok(result.includes('type:bug'), 'labels from a later page must be included, never dropped');
});

// ── branchProtect (M10 Phase 2, issue #335 rank 2) — mutating write verb.
// `({ project, branch?, checks, requiredReviews? }) -> { enforced: boolean,
// reason?: string, remedy?: string }`. Both providers' impls call `run()`
// from the SAME shared spawn seam (github via `gh`, gitlab via `glab`), so
// ONE setSpawn-based glue serves both providers — unlike WRITE_VERB_PROVIDERS,
// no gitlab `fetchImpl` branch is needed here (design D2). `checks` is always
// supplied, even on the failure path: `github.branchProtect` does
// `checks.map()` with no default and THROWS on `undefined` — omitting it
// would fail the never-throws test for the wrong reason (an unhandled
// TypeError building the request payload, not the branchProtect contract).
// `reason`/`remedy` vocabulary legitimately differs per provider ('tier' is
// GitHub-only; 'auth'/'permission' are GitLab-only) — only type/presence is
// asserted here, never exact-string equality across providers (design D4).

const BRANCH_PROTECT_PROVIDERS = {
  github: {
    module: github,
    ok: (checks) => { setSpawn(rawSpawn('', 0)); return { checks }; },
    // Trips github.mjs's `r.stderr.includes('403') || /upgrade.*pro/i.test(r.stderr)` tier-block branch.
    fail: (checks) => { setSpawn(failSpawn('403: upgrade to GitHub Pro for private-repo branch protection')); return { checks }; },
  },
  gitlab: {
    module: gitlab,
    ok: (checks) => { setSpawn(rawSpawn('', 0)); return { checks }; },
    // Trips gitlab.mjs's `r.stderr.includes(': 403') || /forbidden/i.test(r.stderr)` permission-block branch.
    fail: (checks) => { setSpawn(failSpawn('glab: 403 Forbidden')); return { checks }; },
  },
};

for (const providerName of Object.keys(BRANCH_PROTECT_PROVIDERS)) {
  const { module: vcs, ok, fail } = BRANCH_PROTECT_PROVIDERS[providerName];

  test(`${providerName}.branchProtect (contract): a successful protect returns exactly { enforced: true }`, async () => {
    const result = await vcs.branchProtect({ project: 'x/y', ...ok(['ci']) });
    assert.deepEqual(result, { enforced: true }, 'a successful branchProtect must return exactly { enforced: true } — no enabled/rules leakage into the contract shape');
  });

  test(`${providerName}.branchProtect (contract): a protect failure returns { enforced: false, reason, remedy } — never throws`, async () => {
    const result = await vcs.branchProtect({ project: 'x/y', ...fail(['ci']) });
    assert.equal(result.enforced, false, 'a failed branchProtect must never fabricate enforced:true');
    assert.deepEqual(Object.keys(result).sort(), ['enforced', 'reason', 'remedy'].sort(), 'a failed branchProtect must return exactly these three keys — no enabled/rules/requiredReviews leakage into the contract shape');
    assert.equal(typeof result.reason, 'string', 'reason must be a string — vocabulary is provider-specific, asserted in providers.test.mjs, not here');
    assert.equal(typeof result.remedy, 'string', 'remedy must be a string — presence/type only, never compared across providers');
  });

  test(`${providerName}.branchProtect (contract): never throws, even under a mocked transport failure`, async () => {
    await assert.doesNotReject(
      () => vcs.branchProtect({ project: 'x/y', ...fail(['ci']) }),
      `${providerName}.branchProtect must resolve, not throw, on a mocked transport failure`,
    );
  });
}

// ── rerunWorkflowRun (GitHub-only, issue #328) ──────────────────────────────
// No GitLab equivalent is implemented (deliberately out of scope) — this verb
// is absent from cli.mjs's VERBS array on purpose (that array is reserved for
// verbs BOTH providers implement, enforced by verb-contract-drift-guard's
// "every function exported by BOTH REAL providers" check; since gitlab.mjs
// has no sibling export, this verb never trips it). GitHub-only, hence no
// parity loop over PROVIDERS — a single direct suite against `github.mjs`,
// same precedent as the `github.issueList` pull_request-filter test and the
// `github.labelList --paginate` test above (both GitHub-only, both outside
// the shared loop).

test('github.rerunWorkflowRun (contract): picks the newest run matching the target workflow path and POSTs a FULL rerun (never rerun-failed-jobs)', async () => {
  const fixtureName = 'github-rerunWorkflowRun-happy.json';
  const fixture = loadFixture(fixtureName);
  assertProvenance(fixture, fixtureName);

  const calls = [];
  setSpawn((_cmd, args) => {
    calls.push(args);
    if (args.includes('-X')) return { status: 0, stdout: '', stderr: '' };
    return { status: 0, stdout: JSON.stringify(fixture.data), stderr: '' };
  });

  const result = await github.rerunWorkflowRun({ project: 'x/y', ref: 'fix/issue-328-x', workflow: 'governance.yml' });

  assert.deepEqual(
    result,
    { ok: true, runId: 55500 },
    'must pick the newest governance.yml run (55500) — never the non-matching release.yml run (55501) above it, nor the older governance.yml run (55499) below it',
  );

  const rerunCall = calls.find(a => a.includes('-X'));
  assert.ok(rerunCall, 'a rerun API call must have been made');
  assert.ok(
    rerunCall.some(a => /\/actions\/runs\/55500\/rerun$/.test(a)),
    'must POST to the FULL rerun endpoint for the matched run (55500)',
  );
  assert.ok(
    !rerunCall.some(a => /rerun-failed-jobs/.test(a)),
    'must NEVER call rerun-failed-jobs — that silently skips an already-green job stuck on stale evidence, the exact stale-GREEN bug this verb exists to fix (issue #328)',
  );
});

test('github.rerunWorkflowRun (contract): no run matches the target workflow — returns { ok: false, reason }, never throws', async () => {
  const fixtureName = 'github-rerunWorkflowRun-empty.json';
  const fixture = loadFixture(fixtureName);
  assertProvenance(fixture, fixtureName);
  setSpawn(jsonSpawn(fixture.data));

  const result = await github.rerunWorkflowRun({ project: 'x/y', ref: 'fix/issue-328-x', workflow: 'governance.yml' });
  assert.equal(result.ok, false, 'no matching run must never fabricate ok:true');
  assert.equal(typeof result.reason, 'string', 'must carry a reason string');
});

test('github.rerunWorkflowRun (contract): a list-runs API failure returns { ok: false, reason }, never throws', async () => {
  setSpawn(failSpawn('fixture: simulated failure'));
  const result = await github.rerunWorkflowRun({ project: 'x/y', ref: 'fix/issue-328-x' });
  assert.equal(result.ok, false, 'a transport failure must never fabricate ok:true');
  assert.equal(typeof result.reason, 'string', 'must carry a reason string');
});

// ── REQ-266-3 (lock 2): no code path can emit an APPROVE review, on any provider ──

test('REQ-266-3 lock 2: github.prReviewComment sends event:\'COMMENT\' to the API regardless of input — no argument selects a different event', async () => {
  let sentPayload;
  setSpawn((_cmd, _args, opts) => {
    sentPayload = JSON.parse(opts.input);
    return { status: 0, stdout: JSON.stringify({ html_url: 'https://example.test/x/y/pull/1#review-1' }), stderr: '' };
  });
  await github.prReviewComment({ project: 'x/y', number: 1, body: 'anything, even an approval-sounding body' });
  assert.equal(sentPayload.event, 'COMMENT', 'the review event sent to the API must always be COMMENT, never derived from input');
});

test('REQ-266-3 lock 2: no exported verb on either provider references an approval review-event literal — source scan', () => {
  for (const modName of ['github.mjs', 'gitlab.mjs']) {
    const src = readFileSync(fileURLToPath(new URL(`./${modName}`, import.meta.url)), 'utf8');
    assert.doesNotMatch(
      src,
      /event\s*:\s*['"](?!COMMENT['"])[A-Z_]+['"]/,
      `${modName} must not contain any review "event:" literal other than 'COMMENT' — no code path may reach an approval event`,
    );
  }
});

// ── branchProtect requiredReviews no-op (M10 Phase 2, design D1/D3) —
// FUNCTION-SCOPED source-scan lock. gitlab.mjs's branchProtect accepts a
// `requiredReviews` param but never enforces it (GitLab's approval-count
// enforcement needs the Premium approval-rules API, not called here — see
// the JSDoc above the function). This scan is deliberately scoped to the
// branchProtect function body's OWN source slice, never file-wide: a
// file-wide scan for /approvals/ would false-positive on gitlab.mjs:271
// (prReviews), which legitimately calls `.../approvals` for an unrelated,
// correct reason. The lock is intentionally BIDIRECTIONAL — if a future
// change adds an approval-rules call inside branchProtect, this test FAILS
// and forces that decision into the open (design D1), rather than drifting
// silently either way.
test('branchProtect (M10 Phase 2): GitLab requiredReviews is accepted but never enforced — scoped source-scan lock', () => {
  const src = readFileSync(fileURLToPath(new URL('./gitlab.mjs', import.meta.url)), 'utf8');
  const start = src.indexOf('export async function branchProtect');
  assert.ok(start !== -1, 'gitlab.mjs must still export branchProtect');
  const end = src.indexOf('\n}\n', start);
  assert.ok(end !== -1, 'branchProtect function body must have a closing brace at column 0');
  const body = src.slice(start, end);

  // Function-scoped: no approval/approval-rules endpoint call inside branchProtect's own body.
  assert.doesNotMatch(
    body,
    /approvals|approval[_-]?rules/i,
    'gitlab.branchProtect must not call any approvals/approval-rules endpoint — requiredReviews is accepted but not enforced (pinned, not fixed, per design D1)',
  );

  // requiredReviews must be declared (the destructured parameter) but never referenced again in the body.
  const occurrences = (body.match(/requiredReviews/g) || []).length;
  assert.equal(occurrences, 1, 'requiredReviews must occur exactly once in the function body — the parameter signature — proving it is declared but never read/enforced');

  // Proves the narrow scope above is load-bearing, not incidentally passing:
  // the SAME pattern DOES match file-wide, via prReviews' legitimate
  // .../approvals call (~gitlab.mjs:271). A file-wide doesNotMatch on `src`
  // would fail here — this is the false positive the scoped scan avoids.
  assert.match(
    src,
    /approvals|approval[_-]?rules/i,
    'the full gitlab.mjs file DOES contain an approvals reference (prReviews) — proving the branchProtect-scoped scan above is a genuine narrowing, not a no-op',
  );
});

// ── prReviews provider-specific divergences (issue #317) ────────────────────
//
// The parameterized block above pins what BOTH providers must promise. These
// pin the two places they legitimately differ, plus the security boundary
// that difference creates.

test('github.prReviews (contract): a review with no comment normalizes body to \'\' (never null — null means uncomputable)', async () => {
  // GitHub returns `body: null` for a review submitted with no comment (the
  // common case for a bare APPROVED). The key is present in the payload but
  // null, so `''` can only come from the normalizer's `?? ''` guard — the
  // same empty-vs-uncomputable rule prView.body follows (A3 task 3.7).
  setSpawn(jsonSpawn([{ state: 'APPROVED', user: { login: 'bob' }, body: null }]));
  const result = await github.prReviews({ project: 'o/r', number: 144 });
  assert.deepEqual(result, [{ state: 'APPROVED', author: 'bob', body: '' }]);
});

test('github.prReviews (contract): body passes through VERBATIM — no trimming, no re-encoding of the fenced verdict block', async () => {
  // parseVerdict matches on the fence and on line-anchored `key: value`
  // scalars, so any normalization of whitespace or fences would break the
  // recovery while leaving a plausible-looking string in place.
  const body = '```yaml\nprotocol: brain-review/1\nverdict: STOP\nhead_sha: abc123\nrev: 4\n```';
  setSpawn(jsonSpawn([{ state: 'COMMENTED', user: { login: 'brain-reviewer' }, body }]));
  const [entry] = await github.prReviews({ project: 'o/r', number: 144 });
  assert.equal(entry.body, body, 'body must be byte-identical to the API payload');
  assert.deepEqual(parseVerdict(entry), { head_sha: 'abc123', rev: 4, verdict: 'STOP', author: 'brain-reviewer' });
});

// SECURITY BOUNDARY. GitLab's verdict thread lives in MR notes, but the L6
// brain-writes-reviewed gate counts ONLY `state === 'APPROVED'`. If notes
// normalized to APPROVED, anyone could clear the self-approval gate by typing
// a comment. The happy fixture's approver ('bob') is a different identity from
// every note author, so this cannot pass by coincidence.
test('gitlab.prReviews (contract): MR notes normalize to COMMENTED and NEVER to APPROVED — only the approvals endpoint may produce an approver', async () => {
  const fixture = loadFixture('gitlab-prReviews-happy.json');
  const result = await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    ...gitlabPrReviewsCallArgs(fixture),
  });

  const approvers = result.filter(r => r.state === 'APPROVED').map(r => r.author);
  assert.deepEqual(
    approvers,
    ['bob'],
    'the ONLY APPROVED entry must be the approvals endpoint\'s approver — a note author appearing here would let a plain MR comment clear the L6 self-approval gate',
  );

  const noteAuthors = new Set(result.filter(r => r.state === 'COMMENTED').map(r => r.author));
  assert.ok(noteAuthors.has('brain-reviewer'), 'the reviewer\'s verdict note must be present, as COMMENTED');
  assert.ok(noteAuthors.has('alice'), 'a plain human note must be present, as COMMENTED');
  assert.ok(!noteAuthors.has('bob'), 'sanity: the approver is not also a note author, so the assertion above is load-bearing');
});

test('gitlab.prReviews (contract): GitLab system notes are dropped — activity records are not reviewer speech', async () => {
  const fixture = loadFixture('gitlab-prReviews-happy.json');
  const result = await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    ...gitlabPrReviewsCallArgs(fixture),
  });
  assert.ok(
    fixture.data.notes.some(n => n.system === true),
    'sanity: the fixture must actually contain a system note, or this assertion is vacuous',
  );
  assert.ok(
    !result.some(r => r.author === 'gitlab-bot'),
    'the system note\'s author must not appear — system notes ("changed target branch from ...") are GitLab\'s own activity records',
  );
});

test('gitlab.prReviews (contract): requests notes oldest-first — poster.mjs/board.mjs take the LAST parsed verdict as current', async () => {
  // GitLab's notes endpoint defaults to NEWEST-first, which would invert
  // "latest verdict wins" and make the anti-loop compare against the oldest
  // verdict on the thread. The sort must be requested explicitly.
  const urls = [];
  await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    fetchImpl: async (url) => {
      urls.push(url);
      return { ok: true, json: async () => (url.includes('/approvals') ? { approved_by: [] } : []) };
    },
  });
  const notesUrl = urls.find(u => u.includes('/notes'));
  assert.ok(notesUrl, 'sanity: a notes request must have been made');
  assert.match(notesUrl, /sort=asc/, 'notes must be requested ascending — GitLab defaults to newest-first');
  assert.match(notesUrl, /order_by=created_at/, 'notes must be ordered by created_at, not the default id ordering');
});

test('gitlab.prReviews (contract): paginates the notes thread — with sort=asc an unpaginated fetch drops the LATEST verdict', async () => {
  // This is sharper than GitHub's --paginate guard: page 1 holds the OLDEST
  // notes, so truncation loses exactly the verdict the anti-loop needs.
  const perPage = 100;
  const page1 = Array.from({ length: perPage }, (_, i) => ({
    id: i,
    body: 'noise',
    author: { username: 'alice' },
    created_at: '2026-07-10T10:00:00.000Z',
    system: false,
  }));
  const page2 = [{
    id: 999,
    body: '```yaml\nprotocol: brain-review/1\nverdict: REVISE\nhead_sha: deadbeef\nrev: 2\n```',
    author: { username: 'brain-reviewer' },
    created_at: '2026-07-10T12:00:00.000Z',
    system: false,
  }];
  const result = await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    fetchImpl: async (url) => {
      if (url.includes('/approvals')) return { ok: true, json: async () => ({ approved_by: [] }) };
      const page = Number(new URL(url).searchParams.get('page'));
      return { ok: true, json: async () => (page === 1 ? page1 : page === 2 ? page2 : []) };
    },
  });

  assert.equal(result.length, perPage + 1, 'both pages of notes must be present');
  const verdicts = result.map(r => parseVerdict(r)).filter(Boolean);
  assert.equal(verdicts.length, 1, 'the page-2 verdict must survive');
  assert.equal(verdicts[0].head_sha, 'deadbeef', 'the LATEST verdict lives on page 2 — an unpaginated fetch would silently lose it');
});

test('gitlab.prReviews (contract): an approvals failure yields null even when notes succeed — a notes-only result would fail-OPEN on the L6 gate', async () => {
  // The dangerous shape: returning the notes half alone hands
  // evaluateBrainWritesReviewed an empty approver set that is
  // indistinguishable from a genuine "nobody approved".
  const result = await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    fetchImpl: async (url) =>
      url.includes('/approvals')
        ? { ok: false, status: 403 }
        : { ok: true, json: async () => [{ id: 1, body: 'hi', author: { username: 'alice' }, system: false }] },
  });
  assert.equal(result, null, 'a partial fetch must degrade to null (uncomputable), never to a half-populated array');
});

test('gitlab.prReviews (contract): a notes failure yields null even when approvals succeed — a half result would silently empty the verdict thread', async () => {
  const result = await gitlab.prReviews({
    project: 'g/r',
    number: 7,
    fetchImpl: async (url) =>
      url.includes('/approvals')
        ? { ok: true, json: async () => ({ approved_by: [{ user: { username: 'bob' } }] }) }
        : { ok: false, status: 500 },
  });
  assert.equal(result, null, 'losing the notes half must be uncomputable, not a verdict-free approvals list');
});

test('gitlab.prReviews (contract): source reads BOTH the notes and approvals endpoints — neither half may be dropped', () => {
  // Structural companion to the behavioral tests above: a regression that
  // reverts to approvals-only (the #317 defect) or drops approvals in favor
  // of notes-only (the fail-open) is caught here even if a future fixture
  // stops exercising one half.
  const src = readFileSync(fileURLToPath(new URL('./gitlab.mjs', import.meta.url)), 'utf8');
  const start = src.indexOf('export async function prReviews');
  assert.notEqual(start, -1, 'gitlab.mjs must still export prReviews');
  const end = src.indexOf('\nexport ', start + 1);
  const body = src.slice(start, end === -1 ? undefined : end);

  assert.match(body, /merge_requests\/\$\{number\}\/notes/, 'prReviews must fetch MR notes — the verdict thread lives there, and approvals alone carries no body (the #317 defect)');
  assert.match(body, /merge_requests\/\$\{number\}\/approvals/, 'prReviews must still fetch approvals — the L6 brain-writes-reviewed gate reads only APPROVED entries');
});
