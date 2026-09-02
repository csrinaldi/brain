// config-verb.test.mjs — issue #823 (Compuerta 4's verb, first slice).
// `planConfigWrite` is PURE: config, migrations and target version are
// RECEIVED, never read — `role-port.mjs`'s discipline. Every test hands in a
// synthetic migration list so the oracle is the rule, not whatever
// brain/core/config-migrations.mjs happens to ship this week.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deriveKnownPaths, parseValue, planConfigWrite, resolvePath } from './config-verb.mjs';

const MIGRATIONS = [
  { version: '0.1.0', description: 't', defaults: { project: { name: '', slug: '' } } },
  { version: '0.2.0', description: 't', defaults: { docs: { language: 'en' } } },
  { version: '0.3.0', description: 't', defaults: { sdd: { map: {} } } },
];

test('#823: KNOWN_PATHS is DERIVED from migration defaults — leaves exact, empty objects open families', () => {
  const known = deriveKnownPaths(MIGRATIONS);
  assert.ok(known.leaves.has('docs.language'));
  assert.ok(known.leaves.has('project.name'));
  assert.ok(known.families.has('sdd.map'), 'a defaults node of {} is an OPEN family — sdd.map.<stage> is writable');
});

test('#823: an unknown path fails CLOSED, naming the nearest known family', () => {
  const { refusal, next } = planConfigWrite({ config: {}, path: 'sdd.mpa.tasks', value: 'x', migrations: MIGRATIONS, targetVersion: '0.3.0' });
  assert.equal(next, null, 'nothing may be written on a refusal');
  assert.match(refusal, /sdd\.mpa\.tasks/);
  assert.match(refusal, /sdd\.map/, 'the refusal must point at the family the typo missed');
});

test('#823: a known leaf writes, and the write is the ONLY change beside migrations', () => {
  const { next, refusal } = planConfigWrite({ config: { docs: { language: 'en' }, schemaVersion: '0.3.0' }, path: 'docs.language', value: 'es', migrations: MIGRATIONS, targetVersion: '0.3.0' });
  assert.equal(refusal, null);
  assert.equal(next.docs.language, 'es');
});

test('#823: an open-family subpath writes — sdd.map.<stage> is the ruled spelling', () => {
  const { next } = planConfigWrite({ config: { schemaVersion: '0.3.0' }, path: 'sdd.map.cold-review', value: '{"engine":"plain"}', migrations: MIGRATIONS, targetVersion: '0.3.0' });
  assert.deepEqual(next.sdd.map['cold-review'], { engine: 'plain' });
});

test('#823: pending migrations run FIRST, in the verb — the caller never migrates', () => {
  const { next, migrationsApplied } = planConfigWrite({ config: { schemaVersion: '0.1.0' }, path: 'docs.language', value: 'es', migrations: MIGRATIONS, targetVersion: '0.3.0' });
  assert.deepEqual(migrationsApplied, ['0.2.0', '0.3.0']);
  assert.equal(next.schemaVersion, '0.3.0');
  assert.deepEqual(next.sdd.map, {}, "0.3.0's default landed before the write");
});

test('#823: values parse JSON-first, bare string on failure', () => {
  assert.deepEqual(parseValue('{"engine":"plain"}'), { engine: 'plain' });
  assert.equal(parseValue('true'), true);
  assert.equal(parseValue('es'), 'es', 'a bare word is a string, not a parse error');
});

test('#823: resolvePath answers get — a missing path is undefined, never a throw', () => {
  assert.equal(resolvePath({ docs: { language: 'es' } }, 'docs.language'), 'es');
  assert.equal(resolvePath({}, 'docs.language'), undefined);
});

test('#823: migrations NEVER overwrite an existing value on the way through (ADR-0006)', () => {
  const { next } = planConfigWrite({ config: { schemaVersion: '0.1.0', docs: { language: 'fr' } }, path: 'sdd.map.x', value: '{"engine":"plain"}', migrations: MIGRATIONS, targetVersion: '0.3.0' });
  assert.equal(next.docs.language, 'fr', 'the 0.2.0 default must not clobber the consumer value');
});
