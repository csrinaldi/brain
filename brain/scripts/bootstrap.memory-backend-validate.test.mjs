// bootstrap.memory-backend-validate.test.mjs — issue #1112, cold-review
// should-fix 3.
//
// bootstrap.sh's interactive MEMORY_BACKEND prompt (§7) accepted ANY typed
// string and wrote it verbatim into `.env` — a typo landed in `.env`, and the
// consequence only surfaced later, deep inside `memory/cli.mjs`'s backend
// dispatch, far from where the operator typed it.
//
// The fix reuses the EXACT SAME validation loop shape as
// vcs-provider-validate.test.mjs's fragment (issue #1112, finding 2) —
// `while :; do read; case … in <valid>|'') break ;; *) reject ;; esac; done`
// — restricted to the two real backends (`axes/memory/adapters/engram.mjs`,
// `axes/memory/adapters/plainfiles.mjs`), rather than inventing a second
// validation style for the same class of prompt.
//
// Same idiom as the other bootstrap.*.test.mjs files: the fragment is LIFTED
// OUT OF bootstrap.sh between two sentinel comments and executed, so there is
// no second copy of the validation logic to drift from the real one (#340).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BOOTSTRAP = join(dirname(fileURLToPath(import.meta.url)), 'bootstrap.sh');
const LINES = readFileSync(BOOTSTRAP, 'utf8').split('\n');

function fragment(beginMarker, endMarker) {
  const start = LINES.findIndex((l) => l.includes(beginMarker));
  assert.ok(start >= 0, `bootstrap.sh must have a ${beginMarker} marker`);
  const end = LINES.findIndex((l, i) => i > start && l.includes(endMarker));
  assert.ok(end > start, `bootstrap.sh must have a matching ${endMarker} marker`);
  return LINES.slice(start + 1, end).join('\n');
}

// Extracted ONCE, outside any try/catch — a missing-marker AssertionError
// must fail the suite loudly (same discipline as vcs-provider-validate's own
// fragment extraction).
const FRAGMENT = fragment('BEGIN memory-backend-validate', 'END memory-backend-validate');

/**
 * Runs the extracted loop, feeding `stdinLines` (one `read -r -p` answer per
 * line). Prints the final `MEMORY_BACKEND` value on its own line at the end
 * so the test can read it without needing the surrounding env_get/env_set
 * machinery.
 */
function runFragment(stdinLines, { eof } = {}) {
  const script = [
    'set -euo pipefail',
    'I18N_BOOTSTRAP_MEMORY_PROMPT="Which memory backend does this team use? (engram|plainfiles): "',
    FRAGMENT,
    'printf \'%s\' "$MEMORY_BACKEND"',
  ].join('\n');
  // A closed stdin is /dev/null (`stdio: 'ignore'`), never an empty `input`: how an empty
  // `input` reaches the child varies by environment, and in the cold reviewer's sandbox it
  // left `read` blocked (#1209 rev 1). The timeout turns any future hang into a failure
  // instead of a stalled suite.
  const result = spawnSync('bash', ['-c', script], {
    ...(eof
      ? { stdio: ['ignore', 'pipe', 'pipe'] }
      : { input: stdinLines.join('\n') + '\n' }),
    encoding: 'utf8',
    timeout: 10_000,
  });
  return { backend: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status };
}

test('#1112 an invalid backend is rejected and never accepted', () => {
  const { backend } = runFragment(['not-a-backend', 'engram']);
  assert.equal(backend, 'engram', 'the invalid answer must never be the final value');
});

test('#1112 the rejection is reported, not silent', () => {
  const { stderr } = runFragment(['typo-backend', 'plainfiles']);
  assert.match(stderr, /Unknown backend/);
  assert.match(stderr, /typo-backend/);
});

test('#1112 "engram" on the first answer still works (no regression)', () => {
  const { backend } = runFragment(['engram']);
  assert.equal(backend, 'engram');
});

test('#1112 "plainfiles" is accepted — the fifth #1112 finding\'s own backend', () => {
  const { backend } = runFragment(['plainfiles']);
  assert.equal(backend, 'plainfiles');
});

test('#1205 an empty answer re-prompts and never becomes a backend', () => {
  const { backend, status } = runFragment(['', 'plainfiles']);
  assert.equal(status, 0);
  assert.equal(backend, 'plainfiles', 'Enter must not select anything; the next real answer does');
});

test('#1205 several empty answers in a row never default to engram', () => {
  const { backend } = runFragment(['', '', 'engram']);
  assert.equal(backend, 'engram');
});

test('#1205 a closed stdin leaves the backend undeclared (empty), not engram', () => {
  const result = { ...runFragment([], { eof: true }) };
  result.stdout = result.backend;
  assert.equal(result.status, 0, `EOF must not abort the script; stderr:\n${result.stderr}`);
  assert.equal(result.stdout, '', 'EOF is an undeclared backend, never a guess');
});

test('#1205 bootstrap.sh no longer defaults the backend to engram after the prompt', () => {
  assert.ok(!LINES.some((l) => l.includes('MEMORY_BACKEND:-engram')), 'ADR-0004 Amendment 3: NO default');
});

test('#1112 re-prompts as many times as needed before accepting a valid value', () => {
  const { backend, stderr } = runFragment(['x', 'y', 'z', 'plainfiles']);
  assert.equal(backend, 'plainfiles');
  const rejections = (stderr.match(/Unknown backend/g) || []).length;
  assert.equal(rejections, 3, `expected exactly 3 rejections before the valid answer; stderr:\n${stderr}`);
});
