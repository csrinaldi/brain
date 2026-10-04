// codeowners-drift.test.mjs — CODEOWNERS is an OPTIONAL mirror of governance.owners (ADR-0040 ratified point 8).
// The drift is a finding, never a gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { codeownersDrift, readCodeowners } from './codeowners-drift.mjs';
import { diagnoseAxes } from './axis-config.mjs';
import en from '../i18n/en.mjs';
import es from '../i18n/es.mjs';

test('no rule MATCHING brain.config.json: nothing is reported, whatever else CODEOWNERS says', () => {
  assert.equal(codeownersDrift('# c\n/brain/core/** @team\n/docs/ @alice\n*.md @zed\n/sub/* @y\n', ['bob']), null);
  assert.equal(codeownersDrift('', ['bob']), null);
  assert.equal(codeownersDrift(null, ['bob']), null);
  assert.equal(codeownersDrift(undefined, ['bob']), null);
});

test('a rule whose owners equal governance.owners (order, case and @ are ignored) is no drift', () => {
  assert.equal(codeownersDrift('/brain.config.json @Alice @bob\n', ['bob', 'alice']), null);
  assert.equal(codeownersDrift('brain.config.json  @alice   # trailing comment\n', ['alice']), null);
});

test('a rule whose owners differ is drift, naming both sides', () => {
  const d = codeownersDrift('/brain.config.json @alice @carol\n', ['alice', 'bob']);
  assert.deepEqual(d, { codeowners: ['alice', 'carol'], owners: ['alice', 'bob'] });
});

test('a rule with owners while governance.owners is empty or absent is drift', () => {
  assert.deepEqual(codeownersDrift('/brain.config.json @alice\n', []), { codeowners: ['alice'], owners: [] });
  assert.deepEqual(codeownersDrift('/brain.config.json @alice\n', undefined), { codeowners: ['alice'], owners: [] });
});

test('the LAST matching rule wins, as in CODEOWNERS itself', () => {
  assert.equal(codeownersDrift('/brain.config.json @old\n/brain.config.json @alice\n', ['alice']), null);
});

test('only the root file counts: a nested brain.config.json rule is not the team config', () => {
  assert.equal(codeownersDrift('/sub/brain.config.json @zed\n', ['alice']), null);
});

test('diagnoseAxes surfaces codeowners-drift as a WARNING with a fix, in English and Spanish; no input, no finding', () => {
  const config = { governance: { owners: ['alice'] } };
  const find = (args) => diagnoseAxes({ config, env: {}, dotenv: {}, ...args }).filter((f) => f.code === 'codeowners-drift');
  assert.deepEqual(find({}), []);
  assert.deepEqual(find({ codeowners: '/brain.config.json @alice\n' }), []);
  const [f, ...more] = find({ codeowners: '/brain.config.json @bob\n' });
  assert.equal(more.length, 0);
  assert.equal(f.severity, 'warning');
  assert.match(f.message, /bob/);
  assert.match(f.message, /alice/);
  assert.ok(f.fix);
  const [fes] = diagnoseAxes({ config, env: {}, dotenv: {}, codeowners: '/brain.config.json @bob\n', catalog: es }).filter((x) => x.code === 'codeowners-drift');
  assert.ok(fes.message !== f.message, 'Spanish catalog is used');
  for (const cat of [en, es]) for (const k of ['axes.diagnose.codeownersDrift', 'axes.diagnose.codeownersDrift.fix']) assert.ok(cat[k], k);
});

test('the forge applies the last rule that MATCHES the path, globs included: a later `*` overrides an earlier explicit rule', () => {
  assert.deepEqual(codeownersDrift('/brain.config.json @alice\n* @bob\n', ['alice']), { codeowners: ['bob'], owners: ['alice'] });
  assert.equal(codeownersDrift('* @bob\n/brain.config.json @alice\n', ['alice']), null, 'the explicit rule is last, so it wins');
});

test('CODEOWNERS globs against the root file: *, *.json, **, /**, /*, **/name, ?; and what does not match', () => {
  const owned = (pattern) => codeownersDrift(`${pattern} @x\n`, ['y']) !== null; // drift <=> the rule matched
  for (const m of ['*', '*.json', '/*.json', '**', '/**', '/*', '**/brain.config.json', 'brain.config.*', '/brain.config.jso?', 'brain.config.json', '/brain.config.json']) assert.ok(owned(m), `${m} matches`);
  for (const n of ['/brain/', 'brain.config.json/', '*.md', '/sub/*.json', 'docs/**', '/brain.config.yaml', '/*/brain.config.json', '/brain']) assert.ok(!owned(n), `${n} does not match`);
});

test('a matching rule with NO owners un-owns the file: drift against declared owners', () => {
  assert.deepEqual(codeownersDrift('* @bob\n/brain.config.json\n', ['bob']), { codeowners: [], owners: ['bob'] });
});

test('readCodeowners is provider-aware: GitHub reads .github/, root, docs/; GitLab reads root, docs/, .gitlab/ and NEVER .github/', () => {
  const root = mkdtempSync(join(tmpdir(), 'codeowners-prov-'));
  try {
    mkdirSync(join(root, '.github')); mkdirSync(join(root, '.gitlab')); mkdirSync(join(root, 'docs'));
    writeFileSync(join(root, '.github', 'CODEOWNERS'), 'GH');
    assert.equal(readCodeowners(root, 'github'), 'GH');
    assert.equal(readCodeowners(root, 'gitlab'), null, 'GitLab does not read .github/');
    writeFileSync(join(root, '.gitlab', 'CODEOWNERS'), 'GL-dir');
    assert.equal(readCodeowners(root, 'gitlab'), 'GL-dir');
    assert.equal(readCodeowners(root, 'github'), 'GH', 'GitHub does not read .gitlab/');
    writeFileSync(join(root, 'docs', 'CODEOWNERS'), 'DOCS');
    assert.equal(readCodeowners(root, 'gitlab'), 'DOCS', 'docs/ beats .gitlab/ for GitLab');
    writeFileSync(join(root, 'CODEOWNERS'), 'ROOT');
    assert.equal(readCodeowners(root, 'gitlab'), 'ROOT');
    assert.equal(readCodeowners(root, 'github'), 'GH', '.github/ beats root for GitHub');
    assert.equal(readCodeowners(root), 'GH', 'an unknown provider falls back to the GitHub order');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('readCodeowners reads .github/CODEOWNERS (then root, docs/, .gitlab/), and returns null when there is none', () => {
  const root = mkdtempSync(join(tmpdir(), 'codeowners-'));
  try {
    assert.equal(readCodeowners(root, 'github'), null);
    mkdirSync(join(root, '.github'));
    writeFileSync(join(root, '.github', 'CODEOWNERS'), '/brain.config.json @alice\n');
    assert.equal(readCodeowners(root, 'github'), '/brain.config.json @alice\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// ── GitLab sections (#1283): https://docs.gitlab.com/user/project/codeowners/reference/#sections ──────────────────────

test('GitLab: a correct sectioned mirror reports no drift — section defaults are inherited, [N] counts and ^ are headers', () => {
  const text = [
    '[Docs] @writer',
    'docs/ @writer',
    '^[Governance] @alice @bob',
    '/brain.config.json',
    '[Release][2] @carol',
    '/dist/',
  ].join('\n');
  assert.equal(codeownersDrift(text, ['alice', 'bob'], 'gitlab'), null);
  assert.equal(codeownersDrift('[Governance][2] @alice @bob\n/brain.config.json\n', ['bob', 'alice'], 'gitlab'), null);
  assert.equal(codeownersDrift('[Governance]\n/brain.config.json @alice\n', ['alice'], 'gitlab'), null, 'a header without defaults is still a header');
});

test('GitLab: a sectioned mirror with the WRONG defaults is drift, naming both sides', () => {
  assert.deepEqual(codeownersDrift('[Governance] @mallory\n/brain.config.json\n', ['alice'], 'gitlab'), { codeowners: ['mallory'], owners: ['alice'] });
  assert.deepEqual(codeownersDrift('^[Governance][2] @mallory\n/brain.config.json @alice\n', ['alice'], 'gitlab'), null, 'the pattern\'s own owners beat the defaults');
  assert.deepEqual(codeownersDrift('[A] @alice\n/brain.config.json\n[B] @bob\n/brain.config.json\n', ['alice'], 'gitlab'), { codeowners: ['bob'], owners: ['alice'] }, 'every section applies');
});

test('GitLab: a section name repeated in another case is the same section; a pattern without owners and no defaults is unowned', () => {
  assert.equal(codeownersDrift('[Gov] @alice\n[gov]\n/brain.config.json\n', ['alice'], 'gitlab'), null);
  assert.deepEqual(codeownersDrift('[Gov]\n/brain.config.json\n', ['alice'], 'gitlab'), { codeowners: [], owners: ['alice'] });
});

test('GitHub keeps its semantics: no sections — a `[Section] @x` line is just a pattern and defaults are never inherited', () => {
  const text = '[Governance] @alice\n/brain.config.json\n';
  assert.deepEqual(codeownersDrift(text, ['alice'], 'github'), { codeowners: [], owners: ['alice'] });
  assert.deepEqual(codeownersDrift(text, ['alice']), { codeowners: [], owners: ['alice'] });
  assert.equal(codeownersDrift('/brain.config.json @alice\n', ['alice'], 'gitlab'), null, 'a plain GitLab file without sections behaves the same');
});

test('diagnoseAxes passes the declared vcs provider: a sectioned GitLab mirror is no drift, the same text under GitHub is', () => {
  const codeowners = '[Governance] @alice\n/brain.config.json\n';
  const find = (vcs) => diagnoseAxes({ config: { vcs: { default: vcs }, governance: { owners: ['alice'] } }, env: {}, dotenv: {}, codeowners }).filter((f) => f.code === 'codeowners-drift');
  assert.deepEqual(find('gitlab'), []);
  assert.equal(find('github').length, 1);
});
