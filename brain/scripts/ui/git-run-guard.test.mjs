// git-run-guard.test.mjs — the UI server has ONE default git runner (#1218 R1218-9).
// Three copies existed (server, change-route, watcher), each spawning with
// stderr ignored, so a failure reached the reader as the command line and
// nothing else. The helper pipes stderr; this guard keeps a fourth copy out.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const UI_DIR = dirname(fileURLToPath(import.meta.url));
const HELPER = 'git-run.mjs';
const CONSUMERS = ['server.mjs', 'change-route.mjs', 'watcher.mjs'];

function sourcesUnder(dir, out = []) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== 'vendor' && ent.name !== 'node_modules') sourcesUnder(full, out);
    } else if (/\.(mjs|js)$/.test(ent.name) && !ent.name.endsWith('.test.mjs')) out.push(full);
  }
  return out;
}

const codeOnly = (text) => text.split('\n').map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1 ')).join('\n').replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Violations for one file's text, injectable so the self-test can feed it a copy. */
export function gitRunViolations(rel, text) {
  const bad = [];
  const code = codeOnly(text);
  if (rel !== HELPER && /['"](?:node:)?child_process['"]/.test(code)) bad.push(`${rel}: imports child_process, only ${HELPER} may`);
  for (const m of code.matchAll(/\bstdio\s*:\s*\[([^\]]*)\]/g)) {
    const stderr = m[1].split(',')[2]?.trim().replace(/['"]/g, '');
    if (stderr === 'ignore') bad.push(`${rel}: a stdio array ignores stderr`);
  }
  if (CONSUMERS.includes(rel)) {
    if (!/\bimport\s*\{[^}]*\bgitRun\b[^}]*\}\s*from\s*'\.\/git-run\.mjs'/.test(code)) bad.push(`${rel}: does not import gitRun from ./git-run.mjs`);
    if (/\bexecFileSync\b|\bspawnSync\b/.test(code)) bad.push(`${rel}: defines its own runner`);
  }
  return bad;
}

test('#1218 R1218-9: child_process lives only in git-run.mjs, no stdio ignores stderr, and the three consumers use gitRun', () => {
  const files = sourcesUnder(UI_DIR);
  assert.ok(files.some((f) => relative(UI_DIR, f) === HELPER), 'the scan sees the helper');
  for (const consumer of CONSUMERS) assert.ok(files.some((f) => relative(UI_DIR, f) === consumer), `the scan sees ${consumer}`);
  const bad = files.flatMap((f) => gitRunViolations(relative(UI_DIR, f), readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});

test('#1218 R1218-9 self-test: a copy of change-route.mjs with its own default run fails the guard and names the file', () => {
  const copy = [
    "import { execFileSync } from 'node:child_process';",
    "const run = (file, args) => execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });",
  ].join('\n');
  const bad = gitRunViolations('change-route.mjs', copy);
  assert.ok(bad.length >= 3);
  assert.ok(bad.every((line) => line.startsWith('change-route.mjs:')));
  assert.deepEqual(gitRunViolations(HELPER, "import { execFileSync } from 'node:child_process';\nconst o = { stdio: ['ignore', 'pipe', 'pipe'] };"), []);
});
