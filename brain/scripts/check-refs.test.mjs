// check-refs.test.mjs — Unit tests for the no-verify-bypass prohibition rule.
//
// REQ-S5-6: --no-verify and `git commit -n` must be flagged by repo:check.
// The test spawns check-refs.mjs against a temporary directory containing
// a fixture file that violates the rule, then asserts exit code 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CHECK_REFS_SCRIPT = new URL('./check-refs.mjs', import.meta.url).pathname;
const REPO_ROOT = new URL('../..', import.meta.url).pathname;

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeMinimalRepo(dir) {
  // check-refs.mjs calls `git ls-files` — we need a real git repo.
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '--initial-branch=main');
  git('config', 'user.email', 'test@test.com');
  git('config', 'user.name', 'Test');
  return git;
}

function addTrackedFile(git, dir, relPath, content) {
  const abs = join(dir, relPath);
  mkdirSync(abs.replace(/\/[^/]+$/, ''), { recursive: true });
  writeFileSync(abs, content);
  git('add', relPath);
  git('commit', '-m', `add ${relPath}`);
}

function copyRulesFile(dir) {
  // Copy the project's check-refs-rules.mjs into the temp repo so the check engine
  // loads the real rules (including no-verify-bypass after it is added).
  const src = join(REPO_ROOT, 'brain/project/check-refs-rules.mjs');
  const destDir = join(dir, 'brain/project');
  mkdirSync(destDir, { recursive: true });
  cpSync(src, join(destDir, 'check-refs-rules.mjs'));
}

function runCheckRefs(dir) {
  return spawnSync('node', [CHECK_REFS_SCRIPT], { cwd: dir, encoding: 'utf8' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('repo:check (no-verify-bypass): flags --no-verify in a .mjs file', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-no-verify-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);

  // Add a .mjs file that contains --no-verify (a prohibited reference)
  addTrackedFile(git, dir, 'brain/scripts/bad-script.mjs',
    '// bad script\nconst r = run(\'git\', [\'push\', \'--no-verify\']);\n');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 1,
    `expected exit 1 (violation), got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.ok(r.stderr.includes('no-verify-bypass'),
    `expected "no-verify-bypass" rule id in stderr:\n${r.stderr}`);
});

test('repo:check (no-verify-bypass): flags git commit -n in a .mjs file', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-commit-n-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);

  // Add a .mjs file that contains `git commit -n` (a prohibited reference)
  addTrackedFile(git, dir, 'brain/scripts/bad-commit.mjs',
    '// bad commit bypass\nexecSync(\'git commit -n -m "skip hooks"\');\n');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 1,
    `expected exit 1 (violation), got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.ok(r.stderr.includes('no-verify-bypass'),
    `expected "no-verify-bypass" rule id in stderr:\n${r.stderr}`);
});

test('repo:check (no-verify-bypass): clean .mjs file passes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-clean-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);

  // Clean file — no prohibited references
  addTrackedFile(git, dir, 'brain/scripts/clean-script.mjs',
    '// clean script\nexport function ok() { return true; }\n');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 0,
    `expected exit 0 (clean), got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
});

// ── S-1 (#595 pin 1a): 4-artifact enforcement via sdd-layout.mjs's
// missingRequiredArtifacts, wired in B1 (issue #253). Behavior-preserving over
// the frozen corpus (proven by the golden fixture, sdd-layout-golden.test.mjs)
// + B0-contract enforcement going forward — never "pure wiring". ────────────

function makeChangeDir(dir, name, files) {
  const changeDir = join(dir, 'openspec', 'changes', name);
  mkdirSync(changeDir, { recursive: true });
  for (const [fname, content] of Object.entries(files)) {
    writeFileSync(join(changeDir, fname), content);
  }
}

test('repo:check S-1: a new dir missing spec.md and design.md is flagged, naming BOTH missing artifacts and pointing to sdd-layout.md (never-cryptic, #595 pin 1b)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-s1-missing-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);
  makeChangeDir(dir, 'issue-1-new', { 'proposal.md': '', 'tasks.md': '' });
  git('add', '-A');
  git('commit', '-m', 'seed');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.ok(r.stderr.includes('openspec-incomplete'), `expected 'openspec-incomplete' in:\n${r.stderr}`);
  assert.ok(r.stderr.includes('spec.md'), `expected 'spec.md' named in:\n${r.stderr}`);
  assert.ok(r.stderr.includes('design.md'), `expected 'design.md' named in:\n${r.stderr}`);
  assert.ok(r.stderr.includes('sdd-layout.md'), `expected a pointer to sdd-layout.md in:\n${r.stderr}`);
});

test('repo:check S-1: a grandfathered dir (vcs-adapter) with no spec/design artifacts at all is never flagged (sealed-set short-circuit)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-s1-grandfathered-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);
  makeChangeDir(dir, 'vcs-adapter', { 'proposal.md': '', 'tasks.md': '' });
  git('add', '-A');
  git('commit', '-m', 'seed');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 0, `expected exit 0 (grandfathered, exempt), got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
});

test('repo:check S-1 (Phase 6.2 synthetic — REQ-B1-2 "latent-stricter for future new dirs"): a dir missing exactly ONE of the 4 (spec.md) is caught — the OLD 2-of-4 loop would have missed this since proposal.md+tasks.md are both present', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-s1-one-missing-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);
  makeChangeDir(dir, 'issue-2-partial', { 'proposal.md': '', 'design.md': '', 'tasks.md': '' });
  git('add', '-A');
  git('commit', '-m', 'seed');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.ok(r.stderr.includes('spec.md'), `expected 'spec.md' named as missing in:\n${r.stderr}`);
});

test('repo:check S-1 (Phase 6.1 synthetic): a new dir with a NESTED specs/<capability>/spec.md (no flat spec.md) passes — flat-OR-nested tolerance holds through the wired site', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-s1-nested-spec-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);
  makeChangeDir(dir, 'issue-4-nested', { 'proposal.md': '', 'design.md': '', 'tasks.md': '' });
  mkdirSync(join(dir, 'openspec', 'changes', 'issue-4-nested', 'specs', 'some-capability'), { recursive: true });
  writeFileSync(join(dir, 'openspec', 'changes', 'issue-4-nested', 'specs', 'some-capability', 'spec.md'), '');
  git('add', '-A');
  git('commit', '-m', 'seed');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 0, `expected exit 0 (nested spec satisfies the contract), got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
});

test('repo:check S-1 (Phase 6.1 synthetic): a dir with no artifacts at all lists all 4 as missing', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-s1-empty-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);
  makeChangeDir(dir, 'issue-3-empty', {});
  git('add', '-A');
  git('commit', '-m', 'seed');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 1, `expected exit 1, got ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  for (const artifact of ['proposal.md', 'spec.md', 'design.md', 'tasks.md']) {
    assert.ok(r.stderr.includes(artifact), `expected '${artifact}' named as missing in:\n${r.stderr}`);
  }
});

// ── #555: the tier-resolved S-1 set ─────────────────────────────────────────
//
// Added after a cold review found the whole tiering path untested (C2): every
// existing fixture is built by `makeMinimalRepo` with NO brain.config.json, so
// all of them exercised only the absent-config → `standard` fallback. The
// config-PRESENT paths — including a swallowed refusal that turned a typo'd
// `regulated` into a green `standard` — had no coverage at all.

function writeTierConfig(git, dir, tier) {
  addTrackedFile(git, dir, 'brain.config.json', JSON.stringify({ governance: { tier } }, null, 2));
}

test('#555: at a declared `lite`, a change carrying only spec.md is accepted (config-present path)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-s1-lite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);
  writeTierConfig(git, dir, 'lite');
  makeChangeDir(dir, 'issue-1-lite', { 'spec.md': '' });
  git('add', '-A');
  git('commit', '-m', 'seed');

  const r = runCheckRefs(dir);
  assert.equal(r.status, 0,
    `lite requires spec.md only (ADR-0026); expected exit 0, got ${r.status}\n${r.stderr}`);
});

test('#555: a TYPO in governance.tier REFUSES — it never silently degrades to standard', (t) => {
  // The blocker this test exists for: a bare `catch` around `resolveTier` turned
  // `regulatedd` into `standard`, green and silent — LOOSER than the operator
  // declared, in a gate `NEVER_TIERED` lists as required at every tier.
  // `review/cli.mjs` already refuses on this same throw; this gate now agrees.
  const dir = mkdtempSync(join(tmpdir(), 'refs-s1-typo-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);
  writeTierConfig(git, dir, 'regulatedd');
  makeChangeDir(dir, 'issue-1-typo', { 'spec.md': '' });
  git('add', '-A');
  git('commit', '-m', 'seed');

  const r = runCheckRefs(dir);
  assert.notEqual(r.status, 0,
    `an unrecognized tier must fail closed (REQ-TIER-1), got exit ${r.status}\n${r.stdout}\n${r.stderr}`);
  const out = `${r.stdout}${r.stderr}`;
  assert.match(out, /regulatedd/,
    `the refusal must name the offending value so it is actionable, got:\n${out}`);
});

test('#555: a present-but-unparseable config REFUSES — unreadable is not "absent"', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'refs-s1-badjson-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const git = makeMinimalRepo(dir);
  copyRulesFile(dir);
  addTrackedFile(git, dir, 'brain.config.json', '{ not json');
  // The change dir carries the FULL standard set on purpose. The first version of
  // this test gave it only spec.md, so the buggy path — swallow the parse error,
  // fall back to `standard` — ALSO exited non-zero, on missing artefacts. The test
  // passed with the defect reintroduced and pinned nothing (cold review, R2-B3).
  // With every standard artefact present, the fallback exits 0 and only a real
  // refusal can fail this.
  makeChangeDir(dir, 'issue-1-bad', {
    'proposal.md': '', 'spec.md': '', 'design.md': '', 'tasks.md': '',
  });
  git('add', '-A');
  git('commit', '-m', 'seed');

  const r = runCheckRefs(dir);
  assert.notEqual(r.status, 0,
    `an unreadable tier is uncomputable, not "no config" — expected refusal, got ${r.status}`);
  assert.match(`${r.stdout}${r.stderr}`, /unreadable/i,
    'and the refusal must say WHY, or it is indistinguishable from an artefact failure');
});

// ── Dead-exemption sweep (issue #616) ────────────────────────────────────────
//
// An exemption whose file no longer matches its rule is not inert: it blinds
// that rule for that path forever, silently. #315 and #616 each had to run this
// check by hand against one rule; this is its general form, so dead entries
// cannot accumulate again.
//
// "Dead" has three shapes, and all three are caught here: the file is gone, the
// rule can never read it (its extension is outside `onlyExt`), or it is read and
// nothing in it matches.

test('every exemption is load-bearing — no rule exempts a path it would not flag', async () => {
  const { prohibitedRefs } = await import('../project/check-refs-rules.mjs');
  const { readFileSync, existsSync } = await import('node:fs');
  const { extname, join: joinPath } = await import('node:path');

  const dead = [];
  let inspected = 0;

  for (const rule of prohibitedRefs) {
    for (const relPath of rule.exempt ?? []) {
      inspected++;
      const full = joinPath(REPO_ROOT, relPath);

      if (!existsSync(full)) {
        dead.push(`${rule.id} → ${relPath} (file does not exist)`);
        continue;
      }
      if (rule.onlyExt && !rule.onlyExt.includes(extname(relPath))) {
        dead.push(`${rule.id} → ${relPath} (unreachable: "${extname(relPath)}" is outside onlyExt [${rule.onlyExt.join(', ')}])`);
        continue;
      }
      const matches = readFileSync(full, 'utf8')
        .split('\n')
        .some((line) => rule.pattern.test(line));
      if (!matches) dead.push(`${rule.id} → ${relPath} (file matches nothing — the exemption protects nothing)`);
    }
  }

  // Evidence floor: a sweep that inspected nothing would report no dead entries
  // and pass while proving nothing at all.
  assert.ok(inspected >= 5, `the sweep inspected ${inspected} exemptions — it is not reading the rules`);

  assert.deepEqual(
    dead,
    [],
    `dead exemptions found:\n  ${dead.join('\n  ')}\n` +
      'Remove the entry, or fix the rule so it can actually read that path.',
  );
});
