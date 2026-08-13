// workflow-triggers.e2e.test.mjs — the bootstrap smoke must RUN when the
// bootstrap can break (issue #458, review finding F1).
//
// The suite itself was sound and its trigger was not. `bootstrap-smoke.yml`
// listed `brain/scripts/**`, following #458's own wording — but `bootstrap.sh`
// runs `brain/scripts/lib/brain-config.mjs ensure`, and that module imports
// `../../core/config-migrations.mjs`. MEASURED: breaking
// `brain/core/config-migrations.mjs` turns 11 of the suite's assertions red,
// and a PR touching only that path would never have started the job.
//
// That is #446's failure mode reintroduced one level up — a real break in the
// bootstrap path shipping green — so the fix is a path in the YAML, and this is
// what stops that path being deleted again in silence. A `paths:` list with
// nothing asserting it is not a protection.
//
// It lives in `npm test` (a file read, milliseconds) rather than in the smoke
// suite, because the smoke suite only runs when this list says it should — a
// guard over a trigger cannot be gated on that trigger.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = '.github/workflows/bootstrap-smoke.yml';

/**
 * Every path prefix a change to which can break `brain:env:init`,
 * `brain:session:start` or `brain:day:start`, with why it is here.
 *
 * Add to this list rather than to the YAML alone: an entry here without the
 * matching `paths:` line fails below.
 */
const MUST_TRIGGER_ON = Object.freeze([
  { path: 'brain/scripts/**', why: 'the three verbs and bootstrap.sh themselves' },
  { path: 'brain/core/**', why: 'brain-config.mjs imports core/config-migrations.mjs; breaking it turns 11 assertions red (F1)' },
  { path: 'test/bootstrap-smoke/**', why: 'the suite itself' },
  { path: '.github/workflows/bootstrap-smoke.yml', why: 'this workflow' },
  { path: 'package.json', why: 'the npm script names every verb is invoked through' },
]);

/**
 * The `paths:` entries of the workflow's `pull_request:` trigger.
 *
 * String-sliced rather than YAML-parsed — the repo takes no YAML dependency,
 * and the sibling drift-guards slice the same way. Throws rather than returning
 * `[]`: an empty list read from an unparseable file would satisfy nothing below
 * by looking like a file with no triggers at all, which is the same
 * empty-on-failure shape this suite's other guards refuse.
 */
function pullRequestPaths(yml) {
  const lines = yml.split('\n');
  const start = lines.findIndex((l) => /^\s{4}paths:\s*$/.test(l));
  if (start === -1) throw new Error(`${WORKFLOW}: no \`paths:\` block found under the pull_request trigger`);
  const entries = [];
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^\s+-\s+'([^']+)'\s*$/);
    if (!m) break;
    entries.push(m[1]);
  }
  if (entries.length === 0) throw new Error(`${WORKFLOW}: the \`paths:\` block parsed to zero entries`);
  return entries;
}

const yml = readFileSync(join(REPO_ROOT, WORKFLOW), 'utf8');
const declared = pullRequestPaths(yml);

test('bootstrap-smoke: the trigger covers every path that can break the bootstrap (F1)', () => {
  const missing = MUST_TRIGGER_ON.filter((e) => !declared.includes(e.path));
  assert.deepEqual(
    missing.map((e) => e.path), [],
    'these paths can break a bootstrap verb but do not start the smoke job — a real break would ship green:\n'
      + missing.map((e) => `  ${e.path} — ${e.why}`).join('\n')
      + `\n\ndeclared: ${JSON.stringify(declared)}`,
  );
});

test('bootstrap-smoke: the parse read a real trigger list (a vacuous pass is a failure)', () => {
  assert.ok(declared.length >= MUST_TRIGGER_ON.length,
    `only ${declared.length} path(s) parsed out of ${WORKFLOW} — the slicer, not the YAML, is what to look at`);
  assert.ok(declared.every((p) => typeof p === 'string' && p.length > 0),
    'the parse produced an empty entry');
});

test('bootstrap-smoke: it stays out of the ratified governance job set', () => {
  // The placement decision this PR applies from ADR-0018. If someone ever moves
  // the job into governance.yml, this names why that is wrong before the
  // drift-guards there do it more cryptically.
  assert.match(yml, /^name: bootstrap-smoke$/m, 'the workflow name moved');
  assert.equal(
    readFileSync(join(REPO_ROOT, '.github/workflows/governance.yml'), 'utf8').includes('bootstrap-smoke'),
    false,
    'bootstrap-smoke appeared in governance.yml — that job set is a ratified contract and a managed path '
      + 'vendored to every consumer; this suite runs only in the brain source repo',
  );
});
