import { test } from 'node:test';
import assert from 'node:assert/strict';

import { releaseDebt, classifyCommits } from './release-debt.mjs';

const joined = (r) => r.lines.join('\n');

// ── R860-1: a dormant migration is the strongest signal ─────────────────────

test('#860: migrations above the published version are named as unreachable', () => {
  const r = releaseDebt({
    packageVersion: '1.1.0',
    migrationVersions: ['0.10.0', '1.2.0', '1.3.0', '1.4.0'],
    commits: [], tag: 'v1.1.0',
  });
  assert.equal(r.severity, 'migration', 'the strongest of the three');
  const out = joined(r);
  assert.match(out, /1\.2\.0.*1\.3\.0.*1\.4\.0/s, 'every dormant version is named');
  assert.match(out, /unreachable|dead/i, 'and what that means for a consumer');
  assert.doesNotMatch(out, /0\.10\.0/, 'a migration at or below the package version is not debt');
});

test('#860: published up to the tail reports no migration debt', () => {
  const r = releaseDebt({
    packageVersion: '1.4.0', migrationVersions: ['1.2.0', '1.3.0', '1.4.0'],
    commits: [], tag: 'v1.4.0',
  });
  assert.notEqual(r.severity, 'migration');
});

// ── R860-2: ordinary drift, reported as drift ───────────────────────────────

test('#860: feats and fixes since the tag are owed, not urgent', () => {
  const commits = [
    'feat(348): capability honesty', 'feat(124): human signature', 'feat(336): port audit',
    'fix(603): tier exit code', 'fix(853): tag ancestry', 'fix(850): npm audit', 'fix(812): dogfood boundary',
  ];
  const r = releaseDebt({ packageVersion: '1.4.0', migrationVersions: ['1.4.0'], commits, tag: 'v1.4.0' });
  assert.equal(r.severity, 'drift');
  const out = joined(r);
  assert.match(out, /7 commit/, 'the count');
  assert.match(out, /3 feat/, 'and its shape');
  assert.match(out, /4 fix/);
  assert.match(out, /owed but not urgent/i, 'stated as what it is — a repo mid-cycle is healthy');
});

test('#860: nothing since the tag is up to date', () => {
  const r = releaseDebt({ packageVersion: '1.4.0', migrationVersions: ['1.4.0'], commits: [], tag: 'v1.4.0' });
  assert.equal(r.severity, 'none');
  assert.match(joined(r), /up to date/);
});

test('#860: internal-only work reports NOTHING — a line that fires for everything is unread', () => {
  const commits = ['chore(memory): sync', 'test(x): add a case', 'docs(y): reword', 'ci(z): bump'];
  const r = releaseDebt({ packageVersion: '1.4.0', migrationVersions: ['1.4.0'], commits, tag: 'v1.4.0' });
  assert.equal(r.severity, 'none', 'hygiene accumulates; it does not owe a release');
  assert.doesNotMatch(joined(r), /owed/i);
});

test('#860: commit classification reads the conventional prefix and nothing else', () => {
  assert.deepEqual(classifyCommits(['feat(a): x', 'fix: y', 'chore: z', 'no prefix at all']),
    { feat: 1, fix: 2, internal: 1 },
    'an unprefixed subject counts as a FIX — the safe direction: it may be consumer-visible, '
    + 'and under-reporting debt is the failure this ticket exists to end');
});

// ── R860-3: absent evidence is reported as absent ───────────────────────────

test('#860: no tag is NOT "up to date" — it is not comparable', () => {
  const r = releaseDebt({ packageVersion: '1.4.0', migrationVersions: ['1.4.0'], commits: [], tag: null });
  assert.equal(r.severity, 'uncomparable');
  assert.match(joined(r), /could not be compared|no release tag/i);
  assert.doesNotMatch(joined(r), /up to date/, 'the strongest claim from the weakest evidence');
});

test('#860: an unreadable migration list reports its half and keeps the other', () => {
  const r = releaseDebt({
    packageVersion: '1.4.0', migrationVersions: null,
    commits: ['feat(a): x'], tag: 'v1.4.0',
  });
  const out = joined(r);
  assert.match(out, /migration list could not be read/i, 'the half that failed says so, in the message the module actually prints');
  assert.match(out, /1 commit/, 'and the half that worked still reports');
});

test('#860: brain:status prints the debt through the injected facts seam', async () => {
  const { runStatus } = await import('./cli.mjs');
  const lines = [];
  await runStatus({
    log: (s) => lines.push(s),
    deps: {
      releaseFacts: {
        packageVersion: '1.1.0',
        migrationVersions: ['1.2.0', '1.3.0', '1.4.0'],
        commits: [], tag: 'v1.1.0',
      },
    },
  }).catch(() => {});
  const out = lines.join('\n');
  assert.match(out, /DEBT — 3 migration/, 'the dormant case reaches the surface');
  assert.match(out, /UNREACHABLE/, 'saying what it costs a consumer');
});
