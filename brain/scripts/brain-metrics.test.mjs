// brain-metrics.test.mjs — brain-metrics.mjs CLI (issue #324, M9).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, mkdirSync, writeFileSync, rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  parseArgs, renderMarkdown, renderJson, detectionConclusion, extractIssueNumber,
} from './brain-metrics.mjs';

const METRICS_SCRIPT = new URL('./brain-metrics.mjs', import.meta.url).pathname;
const REPO_ROOT = dirname(dirname(fileURLToPath(new URL('.', import.meta.url))));

// ── Fixture helpers (mirrors brain-audit.test.mjs's conventions) ────────────

function makeRepo(dir) {
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'test@test.com');
  git('config', 'user.name', 'Test');
  return git;
}

function commit(git, dir, files, message) {
  for (const [path, content] of Object.entries(files)) {
    const abs = join(dir, path);
    mkdirSync(abs.replace(/\/[^/]+$/, ''), { recursive: true });
    writeFileSync(abs, content);
  }
  git('add', '-A');
  git('commit', '-m', message);
}

function headShaOf(git) {
  const sha = git('rev-parse', 'HEAD').stdout.trim();
  assert.match(sha, /^[0-9a-f]{40}$/, `not a 40-hex sha: ${JSON.stringify(sha)}`);
  return sha;
}

function mergeAddingPayload(git, dir, files, label, mergeMsg) {
  git('checkout', '-b', `feat-${label}`, 'main');
  commit(git, dir, files, `${label}: add payload`);
  git('checkout', 'main');
  const m = git('merge', '--no-ff', `feat-${label}`, '-m', mergeMsg);
  assert.equal(m.status, 0, `merge ${label} failed: ${m.stderr}`);
  return headShaOf(git);
}

function makeSessionSummaryRecord() {
  return JSON.stringify({
    id: 'rec-1', ts: '2026-07-12T12:00:00Z', actor: '@test', actorKind: 'human',
    type: 'session_summary', project: 'brain', content: 'Test session summary',
  }) + '\n';
}

// ── parseArgs (Phase 4.1) ────────────────────────────────────────────────────

test('parseArgs: bare invocation defaults to no range, no json, month period', () => {
  assert.deepEqual(parseArgs([]), { range: undefined, json: false, period: 'month' });
});

test('parseArgs: positional git-range, --json, --period=week all combine', () => {
  assert.deepEqual(
    parseArgs(['origin/main..HEAD', '--json', '--period=week']),
    { range: 'origin/main..HEAD', json: true, period: 'week' },
  );
});

test('parseArgs: rejects an unrecognized flag', () => {
  assert.throws(() => parseArgs(['--bogus']), /unrecognized flag/i);
});

test('parseArgs: rejects a second positional argument', () => {
  assert.throws(() => parseArgs(['a..b', 'c..d']), /extra argument/i);
});

test('parseArgs: rejects an invalid --period value', () => {
  assert.throws(() => parseArgs(['--period=quarter']), /period.*month.*week/i);
});

// ── detectionConclusion / extractIssueNumber ─────────────────────────────────

test('detectionConclusion: maps success/failure (real-shaped UPPERCASE GraphQL enums), never fabricates pass/fail for anything else', () => {
  // GitHub's real `gh pr view --json statusCheckRollup` returns `conclusion`
  // as an UPPERCASE GraphQL enum (SUCCESS/FAILURE/NEUTRAL/...), never
  // lowercase — this fixture must match the real provider shape, or the test
  // can pass while the real integration silently reports 0/0 (the bug this
  // fixture regression-guards against).
  const rollup = [
    { name: 'phase-order', status: 'COMPLETED', conclusion: 'SUCCESS' },
    { name: 'actor-check', status: 'COMPLETED', conclusion: 'FAILURE' },
    { name: 'brain-writes-reviewed', status: 'COMPLETED', conclusion: 'NEUTRAL' },
  ];
  assert.equal(detectionConclusion(rollup, 'phase-order'), 'pass');
  assert.equal(detectionConclusion(rollup, 'actor-check'), 'fail');
  assert.equal(detectionConclusion(rollup, 'brain-writes-reviewed'), null);
  assert.equal(detectionConclusion(rollup, 'not-present'), null);
  assert.equal(detectionConclusion(null, 'phase-order'), null);
});

test('detectionConclusion: also accepts lowercase conclusions (defensive — some providers/fixtures may already be lowercase)', () => {
  const rollup = [
    { name: 'phase-order', status: 'completed', conclusion: 'success' },
    { name: 'actor-check', status: 'completed', conclusion: 'failure' },
  ];
  assert.equal(detectionConclusion(rollup, 'phase-order'), 'pass');
  assert.equal(detectionConclusion(rollup, 'actor-check'), 'fail');
});

test('extractIssueNumber: reads a closing reference or a chain reference', () => {
  assert.equal(extractIssueNumber('fix: thing\n\nCloses #42'), 42);
  assert.equal(extractIssueNumber('feat: thing\n\nPart of #7'), 7);
  assert.equal(extractIssueNumber('no reference here'), null);
  assert.equal(extractIssueNumber(null), null);
});

// ── Renderers (Phase 4.2/4.3, H2) ────────────────────────────────────────────

function sampleRow(period) {
  return {
    period,
    changesMerged: 3,
    uncomputable: 0,
    medianLeadTimeDays: 2.5,
    gates: {
      'diff-size': { raw: 1, enforced: 0 },
      'issue-link': { raw: 0, enforced: 0 },
      'decision-gate': { raw: 1, enforced: 1 },
    },
    bypass: { sizeException: 1, skipMemoryGate: 0 },
    detection: {
      'phase-order': { pass: 3, fail: 0 },
      'actor-check': { pass: 2, fail: 1 },
      'brain-writes-reviewed': { pass: 0, fail: 0 },
    },
  };
}

test('renderMarkdown: "No data for this period." when rows is empty (E1)', () => {
  const md = renderMarkdown({
    rows: [], memGate: { pass: true }, memCoverage: { available: true, total: 0, tagged: 0, coveragePct: 0 }, range: 'HEAD', period: 'month',
  });
  assert.match(md, /No data for this period\./);
});

test('renderMarkdown: renders period rows, repo-level memory-gate, and coverage caveat', () => {
  const md = renderMarkdown({
    rows: [sampleRow('2026-07')],
    memGate: { pass: false },
    memCoverage: {
      available: true, total: 10, tagged: 2, coveragePct: 20,
    },
    range: 'origin/main..HEAD',
    period: 'month',
  });
  assert.match(md, /2026-07/);
  assert.match(md, /memory-gate \(memoryPresence\) at HEAD: FAIL/);
  assert.match(md, /2\/10 tagged/);
  assert.match(md, /adoption pending/);
  assert.match(md, /issue-approval proxy|ISSUE-APPROVAL proxy/i);
});

test('renderMarkdown: memory records "Unavailable" caveat when coverage is unavailable (E2)', () => {
  const md = renderMarkdown({
    rows: [sampleRow('2026-07')],
    memGate: { pass: true },
    memCoverage: {
      available: false, total: 0, tagged: 0, coveragePct: 0,
    },
    range: 'HEAD',
    period: 'month',
  });
  assert.match(md, /Unavailable/);
});

test('renderJson (H2): a flat, parseable array of period objects, superset of the markdown data', () => {
  const out = renderJson({
    rows: [sampleRow('2026-07'), sampleRow('2026-08')],
    memGate: { pass: true },
    memCoverage: {
      available: true, total: 4, tagged: 1, coveragePct: 25,
    },
  });
  const parsed = JSON.parse(out);
  assert.ok(Array.isArray(parsed), 'must be a flat array, not a wrapping object');
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].period, '2026-07');
  assert.equal(parsed[0].gates['diff-size'].raw, 1);
  assert.equal(parsed[0].memoryGatePassAtHead, true);
  assert.equal(parsed[0].memoryRecordsCoverage.total, 4);
});

// ── Package script wiring (Phase 4.4) ────────────────────────────────────────

test('package.json declares the brain:metrics script pointing at brain-metrics.mjs', async () => {
  const { readFileSync } = await import('node:fs');
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['brain:metrics'], 'node ./brain/scripts/brain-metrics.mjs');
});

// ── E1/E3 edge cases + integration smoke (Phase 7/8) ─────────────────────────

test('E1 — an empty range prints "No data" and exits 0', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'metrics-e1-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');
  const head = headShaOf(git);

  const r = spawnSync('node', [METRICS_SCRIPT, `${head}..${head}`], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `expected exit 0\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /No data for this period\./);
});

test('E1 — an empty range with --json prints an empty array and exits 0', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'metrics-e1-json-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');
  const head = headShaOf(git);

  const r = spawnSync('node', [METRICS_SCRIPT, `${head}..${head}`, '--json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `expected exit 0\n${r.stdout}\n${r.stderr}`);
  assert.deepEqual(JSON.parse(r.stdout), []);
});

test('E3 — an invalid git range prints an actionable error and exits non-zero', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'metrics-e3-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, { 'README.md': 'init' }, 'chore: initial (#0)');

  const r = spawnSync('node', [METRICS_SCRIPT, 'not-a-real-ref..HEAD'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(r.status, 0, `expected non-zero exit\n${r.stdout}\n${r.stderr}`);
  assert.match(r.stdout, /invalid git range/i);
  assert.match(r.stdout, /brain:audit|valid range/i);
});

test('integration smoke — a small real history produces sane markdown counts (Phase 8)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'metrics-smoke-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, {
    'README.md': 'init',
    '.memory/records/2026-07.jsonl': makeSessionSummaryRecord(),
  }, 'chore: initial (#0)');
  const base = headShaOf(git);

  // A clean pass.
  mergeAddingPayload(git, dir, { 'src/a.mjs': 'export const a = 1;\n' }, 'A', 'A: small clean Closes #1');
  // An oversized diff WITH size:exception is unreachable without a real VCS
  // adapter (labels come from prView), so this fixture exercises the
  // no-VCS-configured path: prLabels stays null, sizeSkipped is false, and
  // the oversized merge is a genuine raw+enforced diff-size failure.
  const bigFile = Array.from({ length: 500 }, (_, i) => `line ${i}`).join('\n') + '\n';
  mergeAddingPayload(git, dir, { 'src/big.mjs': bigFile }, 'B', 'B: oversized Closes #2');

  const r = spawnSync('node', [METRICS_SCRIPT, `${base}..HEAD`, '--json'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `expected exit 0\n${r.stdout}\n${r.stderr}`);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.length, 1, 'both merges land in the same month bucket');
  assert.equal(parsed[0].changesMerged, 2);
  assert.equal(parsed[0].gates['diff-size'].raw, 1);
  assert.equal(parsed[0].gates['diff-size'].enforced, 1, 'no VCS configured — no size:exception label reachable, so raw === enforced');
  assert.equal(parsed[0].uncomputable, 0);
});

test('--period=week buckets the same history into ISO week keys', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'metrics-week-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = makeRepo(dir);
  commit(git, dir, {
    'README.md': 'init',
    '.memory/records/2026-07.jsonl': makeSessionSummaryRecord(),
  }, 'chore: initial (#0)');
  const base = headShaOf(git);
  mergeAddingPayload(git, dir, { 'src/a.mjs': 'export const a = 1;\n' }, 'A', 'A: small clean Closes #1');

  const r = spawnSync('node', [METRICS_SCRIPT, `${base}..HEAD`, '--json', '--period=week'], { cwd: dir, encoding: 'utf8' });
  assert.equal(r.status, 0, `expected exit 0\n${r.stdout}\n${r.stderr}`);
  const parsed = JSON.parse(r.stdout);
  assert.equal(parsed.length, 1);
  assert.match(parsed[0].period, /^\d{4}-W\d{2}$/);
});
