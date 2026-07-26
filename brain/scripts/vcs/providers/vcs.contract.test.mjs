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
// github-prView-happy.json — see fixtures/record-fixtures.mjs), DERIVED
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

import * as github from './github.mjs';
import * as gitlab from './gitlab.mjs';
import { gatherBrainWritesReviewedInputs, evaluateBrainWritesReviewed } from '../brain-writes-reviewed.mjs';

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

function githubJsonCallArgs(fixture) {
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

const PROVIDERS = {
  github: {
    module: github,
    labelEvents: githubJsonCallArgs,
    prView: githubJsonCallArgs,
    prReviews: githubJsonCallArgs,
    mrCreate: githubRawCallArgs,
  },
  gitlab: {
    module: gitlab,
    labelEvents: gitlabCallArgs,
    prView: gitlabCallArgs,
    prReviews: gitlabCallArgs,
    mrCreate: gitlabCallArgs,
  },
};

for (const providerName of Object.keys(PROVIDERS)) {
  const {
    module: vcs,
    labelEvents: labelEventsArgs,
    prView: prViewArgs,
    prReviews: prReviewsArgs,
    mrCreate: mrCreateArgs,
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

  // ── prReviews (issue #317 M10 Phase 2) ──────────────────────────────────
  test(`${providerName}.prReviews (contract): happy fixture normalizes to entries of EXACTLY { state, author } — no body leak`, async () => {
    const fixtureName = `${providerName}-prReviews-happy.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.prReviews({ project: 'x/y', number: 1, ...prReviewsArgs(fixture) });

    assert.ok(Array.isArray(result), 'prReviews must return an array on a successful fetch');
    assert.ok(result.length >= 1, 'the happy fixture must exercise at least one review');
    for (const entry of result) {
      assert.deepEqual(
        Object.keys(entry).sort(),
        ['author', 'state'],
        'each prReviews entry must contain EXACTLY { author, state } — a body key (or any other future widening) must fail this lock',
      );
    }
  });

  test(`${providerName}.prReviews (contract): a fetch failure yields null, never a fabricated []`, async () => {
    const fixtureName = `${providerName}-prReviews-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const result = await vcs.prReviews({ project: 'x/y', number: 42, ...prReviewsArgs(fixture) });
    assert.equal(result, null, 'an uncomputable prReviews fetch must return null, never []');
  });

  // Zero-review success (distinct from the failure-yields-null case above):
  // a successful fetch that genuinely found no reviews normalizes to `[]`,
  // never `null` — `null` means uncomputable, `[]` means computed-and-empty
  // (design D3). Inline mocks, same discipline as prView's empty-body case.
  test(`${providerName}.prReviews (contract): a successful fetch with zero reviews normalizes to [] (never null — null means uncomputable)`, async () => {
    const emptyFixture =
      providerName === 'github'
        ? { throws: false, data: [] }
        : { throws: false, data: { approved_by: [] } };
    const result = await vcs.prReviews({ project: 'x/y', number: 1, ...prReviewsArgs(emptyFixture) });
    assert.deepEqual(result, [], 'a successfully-fetched-but-empty prReviews must normalize to [], not null');
  });

  // ── Chain assertion (issue #317 M10 Phase 2, spec Requirement 4, design D4) ──
  // Drives a `prReviews`-shaped normalizer output into the REAL
  // `gatherBrainWritesReviewedInputs` → `evaluateBrainWritesReviewed` chain —
  // no inline fakes stand in for the normalizer or for the `null → []`
  // fallback (design D4: that collapse lives in `defaultFetchReviews`,
  // brain-writes-reviewed.mjs, NOT in the evaluator). Only the TRANSPORT is
  // injected (`deps.getVcs`), via the same fixture-glue seam
  // (`githubJsonCallArgs`/`gitlabCallArgs`) already used above — the
  // normalizer (`vcs.prReviews`) and the wrapper (`defaultFetchReviews`) run
  // for real.
  function chainVcs(fixture) {
    return providerName === 'github'
      ? (() => { githubJsonCallArgs(fixture); return github; })()
      : { prReviews: (a) => gitlab.prReviews({ ...a, ...gitlabCallArgs(fixture) }) };
  }

  test(`${providerName} chain: a PR with an APPROVED review distinct from the author passes the DETECTION gate (never warn)`, async () => {
    // No PR in this repository has ever received a GitHub-native APPROVED
    // review (verified live via `gh`/GraphQL search — solo-maintainer repo;
    // see github-prReviews-happy.json's _provenance note), so the recorded
    // happy fixture cannot exercise this branch with real API bytes. This
    // inline APPROVED fixture follows the SAME inline-mock precedent already
    // used in this file for cases a real recordable fixture cannot reach
    // (headRefOid/baseRefOid/prStatusRollup above) — only the fixture DATA is
    // inline; the transport seam, normalizer, and wrapper are all real.
    const approvedFixture =
      providerName === 'github'
        ? { throws: false, data: [{ state: 'APPROVED', user: { login: 'reviewer-bot' }, body: 'lgtm' }] }
        : { throws: false, data: { approved_by: [{ user: { username: 'reviewer-bot' } }] } };

    const inputs = await gatherBrainWritesReviewedInputs({
      baseSha: 'a', headSha: 'b', prNumber: 1, repo: 'x/y', author: 'pr-author', provider: providerName,
      deps: {
        getVcs: async () => chainVcs(approvedFixture),
        diffNameOnly: () => ['brain/core/methodology/vcs-contract.md'],
        readBotAllowlist: () => [],
        readOverrideActors: () => [],
      },
    });
    const verdict = evaluateBrainWritesReviewed(inputs);

    assert.notEqual(verdict.level, 'warn', 'a reviewed PR must not warn for missing reviews');
    assert.equal(verdict.level, 'pass', 'an APPROVED review from a distinct author must pass the gate');
    assert.match(verdict.reason, /reviewer-bot/, "the gate's reasoning must reflect the real normalized entry, not a fixture-shaped fake");
  });

  test(`${providerName} chain: a prReviews fetch failure propagates through the REAL null → [] fallback to a warn, never a throw`, async () => {
    const fixtureName = `${providerName}-prReviews-failure.json`;
    const fixture = loadFixture(fixtureName);
    assertProvenance(fixture, fixtureName);

    const inputs = await gatherBrainWritesReviewedInputs({
      baseSha: 'a', headSha: 'b', prNumber: 1, repo: 'x/y', author: 'pr-author', provider: providerName,
      deps: {
        getVcs: async () => chainVcs(fixture),
        diffNameOnly: () => ['brain/core/methodology/vcs-contract.md'],
        readBotAllowlist: () => [],
        readOverrideActors: () => [],
      },
    });
    assert.deepEqual(inputs.reviews, [], 'defaultFetchReviews must collapse a null prReviews fetch to [] (design D4)');

    const verdict = evaluateBrainWritesReviewed(inputs);
    assert.equal(verdict.level, 'warn', 'missing/unfetchable reviews on a brain/-touching PR must warn, never fail or throw');
    assert.match(verdict.reason, /no PR reviews found/, 'the reason must cite missing/unsupported reviews');
  });

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
