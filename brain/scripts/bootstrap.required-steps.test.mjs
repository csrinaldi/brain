// bootstrap.required-steps.test.mjs — a bootstrap step whose failure leaves the
// environment unusable must join REQUIRED_FAILURES (#1127, class C; slice A).
//
// Before: SDD init, the git hooks path, the engram/plainfiles setup, `brain:memory:pull`,
// `brain:memory:index`, the VCS login and the provider-override write each warned (the
// override write did not even warn) and the run then read as `Environment ready`,
// exit 0. #1155's REQUIRED_FAILURES list turns a non-empty list into the summary line
// and exit 1; these steps append to THAT list, never a second one.
//
// Every snippet is LIFTED out of bootstrap.sh and executed (bootstrap.cross-tree-code
// discipline), so there is no second copy to drift from the first.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { removeTempTree } from './__fixtures__/tmp-tree.mjs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LINES = readFileSync(join(HERE, 'bootstrap.sh'), 'utf8').split('\n');

/** Lines from the first one starting with `from` up to (not including) the next starting with `to`. */
function region(from, to) {
  const start = LINES.findIndex((l) => l.trimStart().startsWith(from));
  assert.ok(start !== -1, `bootstrap.sh must have a line starting with "${from}"`);
  const end = LINES.findIndex((l, i) => i > start && l.trimStart().startsWith(to));
  assert.ok(end !== -1, `bootstrap.sh must have a line starting with "${to}" after "${from}"`);
  return LINES.slice(start, end).join('\n');
}

const PRELUDE = [
  'REQUIRED_FAILURES=()',
  'MISSING_OPTIONAL=()',
  'ok()   { printf "  ok %s\\n" "$1"; }',
  'warn() { printf "  warn %s\\n" "$1" >&2; }',
  `eval "$(node ${JSON.stringify(join(HERE, 'i18n', 'sh.mjs'))})"`,
].join('\n');

function inTmp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'brain-1127-req-'));
  try { return fn(dir); } finally { removeTempTree(dir); }
}

function failing(dir) {
  const p = join(dir, 'fail.sh');
  writeFileSync(p, '#!/bin/sh\nexit 1\n');
  chmodSync(p, 0o755);
  return p;
}

function required(snippet, setup, dir) {
  const r = spawnSync('bash', ['-c', `${PRELUDE}\n${setup}\n${snippet}\nprintf 'REQ=%s\\n' "\${REQUIRED_FAILURES[*]}"`], {
    cwd: dir,
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: dir, DBUS_SESSION_BUS_ADDRESS: '' },
  });
  return `${r.stdout}${r.stderr}`;
}

const scriptsWith = (dir, rel, body) => {
  const scripts = join(dir, 'scripts');
  mkdirSync(join(scripts, dirname(rel)), { recursive: true });
  writeFileSync(join(scripts, rel), body);
  return scripts;
};

test('#1127 bootstrap: a failing SDD init is a REQUIRED failure', () => inTmp((dir) => {
  const scripts = scriptsWith(dir, 'harness/cli.mjs', 'process.exit(1);\n');
  const out = required(region('node "$BRAIN_SCRIPTS/harness/cli.mjs" init', '# --- 7.'), `BRAIN_SCRIPTS=${JSON.stringify(scripts)}`, dir);
  assert.match(out, /REQ=.*SDD/, out);
}));

test('#1127 bootstrap: a failing core.hooksPath config is a REQUIRED failure', () => inTmp((dir) => {
  const out = required(region('git config core.hooksPath', 'case "$MEMORY_BACKEND"'), 'git() { return 1; }', dir);
  assert.match(out, /REQ=.*hooks/i, out);
}));

test('#1127 bootstrap: engram setup, pull and index failures are each a REQUIRED failure', () => inTmp((dir) => {
  const scripts = scriptsWith(dir, 'memory/cli.mjs', 'process.exit(1);\n');
  const engram = region('node "$BRAIN_SCRIPTS/memory/cli.mjs" setup', '# Run IN the worktree');
  const setup = required(`if true; then\n${engram}`, `BRAIN_SCRIPTS=${JSON.stringify(scripts)}`, dir);
  assert.match(setup, /REQ=.*engram memory setup/i, setup);

  const pm = failing(dir);
  const pullIndex = region('(cd "$WORKTREE_ROOT" && $PM run --silent brain:memory:pull)', ';;');
  const out = required(pullIndex, `WORKTREE_ROOT=${JSON.stringify(dir)}; PM=${JSON.stringify(pm)}`, dir);
  assert.match(out, /REQ=.*memory pull/i, out);
  assert.match(out, /REQ=.*memory index/i, out);
}));

test('#1127 bootstrap: a failing plainfiles setup and pull are REQUIRED failures', () => inTmp((dir) => {
  const scripts = scriptsWith(dir, 'memory/cli.mjs', 'process.exit(1);\n');
  const pm = failing(dir);
  const out = required(region('plainfiles)', ';;').replace(/^\s*plainfiles\)/, ''),
    `BRAIN_SCRIPTS=${JSON.stringify(scripts)}; WORKTREE_ROOT=${JSON.stringify(dir)}; PM=${JSON.stringify(pm)}`, dir);
  assert.match(out, /REQ=.*plainfiles memory setup/i, out);
  assert.match(out, /REQ=.*memory pull/i, out);
}));

test('#1127 bootstrap: a failing VCS login (a token was provided) is a REQUIRED failure; no token is not', () => inTmp((dir) => {
  const scripts = scriptsWith(dir, 'vcs/cli.mjs', 'process.exit(1);\n');
  const snippet = `if false; then :\n${region('elif [ -n "$VCS_TOKEN" ]', 'else')}\nelse\n  warn "$I18N_BOOTSTRAP_AUTH_NOTOKEN"\nfi`;
  const failed = required(snippet, `BRAIN_SCRIPTS=${JSON.stringify(scripts)}; VCS_HOST=h; VCS_TOKEN=tok`, dir);
  assert.match(failed, /REQ=.*login/i, failed);
  const noToken = required(snippet, `BRAIN_SCRIPTS=${JSON.stringify(scripts)}; VCS_HOST=h; VCS_TOKEN=`, dir);
  assert.match(noToken, /REQ=\n?$/m, 'an operator who skipped the token is not a failed step');
}));

test('#1127 bootstrap: an unwritable VCS-provider override is a REQUIRED failure, not a swallowed catch', () => inTmp((dir) => {
  writeFileSync(join(dir, 'brain.config.json'), '{ this is not json');
  const out = required(region('VCS_PROVIDER_OVERRIDE="$_override" node', 'fi'), '_override=github', dir);
  assert.match(out, /REQ=.*provider override/i, out);
}));

test('#1127 bootstrap: the open-ticket board failing stays optional (read-only listing, loses no state)', () => inTmp((dir) => {
  const scripts = scriptsWith(dir, 'tracker-board.mjs', 'process.exit(1);\n');
  const out = required(region('node "$BRAIN_SCRIPTS/tracker-board.mjs"', '# --- 9.'), `BRAIN_SCRIPTS=${JSON.stringify(scripts)}; VCS_HOST=h; PROJECT_PATH=p`, dir);
  assert.match(out, /REQ=\n?$/m, out);
}));
