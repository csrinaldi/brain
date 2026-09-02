// migration-draft.test.mjs — issue #809: the `brain-migration/1` contract.
// Parser, number proposal and splicer are PURE; every fixture is inline so
// the oracle is the contract, never the repo's current migration list.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MIGRATION_CONTRACT_TAG,
  MIGRATION_DRAFT_BASENAME_RE,
  parseMigrationDraft,
  proposeVersion,
  spliceMigrationEntry,
} from './migration-draft.mjs';

const block = (json) => `# Draft\n\nprose above\n\n\`\`\`${MIGRATION_CONTRACT_TAG}\n${json}\n\`\`\`\n`;
const GOOD = JSON.stringify({ version: '1.4.0', description: 'Add sdd.engines.', defaults: { sdd: { engines: {} } } }, null, 2);

test('#809: the basename contract', () => {
  assert.ok(MIGRATION_DRAFT_BASENAME_RE.test('config-migrations-1.4.0.md'));
  assert.ok(!MIGRATION_DRAFT_BASENAME_RE.test('adr-0034-something.md'));
  assert.ok(!MIGRATION_DRAFT_BASENAME_RE.test('config-migrations-1.4.md'), 'full semver, always');
});

test('#809: one well-formed block parses — version, description, defaults', () => {
  const { entry, refusal } = parseMigrationDraft(block(GOOD));
  assert.equal(refusal, null);
  assert.equal(entry.version, '1.4.0');
  assert.deepEqual(entry.defaults, { sdd: { engines: {} } });
});

test('#809: zero blocks and two blocks refuse, naming the count', () => {
  const none = parseMigrationDraft('# Draft\nno block here\n');
  assert.match(none.refusal, /no .*brain-migration\/1|0/i);
  const two = parseMigrationDraft(block(GOOD) + block(GOOD));
  assert.match(two.refusal, /2|two|more than one/i);
});

test('#809 D1: JS is refused — nothing is eval\'d', () => {
  const js = block(`{ version: '1.4.0', description: 'x', defaults: {} }`); // single quotes = not JSON
  const { entry, refusal } = parseMigrationDraft(js);
  assert.equal(entry, null);
  assert.match(refusal, /JSON/);
});

test('#809 D1: a `migrate` key is refused — imperative entries remain hand edits', () => {
  const imp = block(JSON.stringify({ version: '1.4.0', description: 'x', migrate: 'fn', defaults: {} }));
  assert.match(parseMigrationDraft(imp).refusal, /migrate.*hand|declarative/i);
});

test('#809 D1: missing description or non-object defaults refuse', () => {
  assert.match(parseMigrationDraft(block(JSON.stringify({ version: '1.0.0', defaults: {} }))).refusal, /description/);
  assert.match(parseMigrationDraft(block(JSON.stringify({ version: '1.0.0', description: 'x', defaults: [] }))).refusal, /defaults/);
});

test('#809 D2: the proposed number is next-minor above max(package, tail)', () => {
  assert.equal(proposeVersion({ draftVersion: '1.4.0', packageVersion: '1.1.0', tailVersion: '0.10.0' }).version, '1.2.0');
  assert.equal(proposeVersion({ draftVersion: '9.9.9', packageVersion: '1.1.0', tailVersion: '1.5.0' }).version, '1.6.0');
});

test('#809 D2: renumbered says so; an already-right draft does not', () => {
  const r = proposeVersion({ draftVersion: '1.4.0', packageVersion: '1.1.0', tailVersion: '0.10.0' });
  assert.equal(r.renumbered, true);
  const ok = proposeVersion({ draftVersion: '1.2.0', packageVersion: '1.1.0', tailVersion: '0.10.0' });
  assert.equal(ok.renumbered, false);
});

test('#809 D2: monotonic-forever holds by construction — the computed number is ALWAYS above the tail', () => {
  for (const [pkg, tail] of [['1.1.0', '0.10.0'], ['0.5.0', '2.3.0'], ['1.1.0', '1.1.0']]) {
    const { version } = proposeVersion({ draftVersion: '0.0.1', packageVersion: pkg, tailVersion: tail });
    const [a1, a2] = version.split('.').map(Number); const [b1, b2] = tail.split('.').map(Number);
    assert.ok(a1 > b1 || (a1 === b1 && a2 > b2), `${version} must exceed tail ${tail}`);
  }
});

const FILE = `// header\nexport const migrations = [\n  {\n    version: '0.1.0',\n    description: 'first',\n    defaults: { a: 1 },\n  },\n];\n\n// NOTE trailing doctrine comment\n`;

test('#809 D3: the splice appends before the closing bracket, version first', () => {
  const { next, refusal } = spliceMigrationEntry(FILE, { description: 'Add x.', defaults: { x: {} } }, '1.2.0');
  assert.equal(refusal, null);
  assert.match(next, /version: '1\.2\.0',\n\s+description: 'Add x\.'/, 'shipped key order: version, description, defaults');
  assert.ok(next.indexOf("version: '1.2.0'") > next.indexOf("version: '0.1.0'"), 'appended after the tail');
  assert.ok(next.indexOf("version: '1.2.0'") < next.indexOf('// NOTE'), 'and before the trailing doctrine notes');
});

test('#809 D3: a file without the anchor refuses — never a guess', () => {
  const { next, refusal } = spliceMigrationEntry('const nope = 1;\n', { description: 'x', defaults: {} }, '1.0.0');
  assert.equal(next, null);
  assert.match(refusal, /migrations/);
});

// ── D4: the backlog rides the contract — the three REAL drafts parse ────────

test('#809 D4: every pending draft in the repo parses under the contract', async () => {
  const { readFileSync } = await import('node:fs');
  const drafts = [
    'openspec/changes/issue-456-stage-set/brain-drafts/config-migrations-1.2.0.md',
    'openspec/changes/issue-312-role-port/brain-drafts/config-migrations-1.3.0.md',
    'openspec/changes/issue-814-engine-adapter/brain-drafts/config-migrations-1.4.0.md',
  ];
  for (const rel of drafts) {
    const { entry, refusal } = parseMigrationDraft(readFileSync(new URL(`../../../${rel}`, import.meta.url), 'utf8'));
    assert.equal(refusal, null, `${rel}: ${refusal}`);
    assert.ok(entry.description.length > 0, rel);
    assert.equal(typeof entry.defaults.sdd, 'object', `${rel}: every pending draft declares under sdd.*`);
  }
});
