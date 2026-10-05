// post-merge calls ONLY `hydrate` (#1115, REQ-1115-4) and treats a deferral (exit 6) as non-fatal (ruling Q4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { testTmp } from '../lib/test-tmp.mjs';

const HOOK = fileURLToPath(new URL('./post-merge', import.meta.url));

/** A stub `node` that appends its argv to a log and, for `hydrate`, exits with `hydrateCode` after a stderr reason. */
function run(hydrateCode) {
  const bin = testTmp('pm-1115-bin-');
  const root = testTmp('pm-1115-root-');
  const log = join(root, 'argv.log');
  writeFileSync(
    join(bin, 'node'),
    `#!/usr/bin/env sh\nprintf '%s\\n' "$*" >> "${log}"\ncase "$2" in\n  hydrate) echo 'stub: hydration deferred — engram binary not found' >&2; exit ${hydrateCode} ;;\nesac\nexit 0\n`,
  );
  writeFileSync(join(bin, 'git'), `#!/usr/bin/env sh\nprintf '%s\\n' "${root}"\n`);
  chmodSync(join(bin, 'node'), 0o755);
  chmodSync(join(bin, 'git'), 0o755);
  const r = spawnSync('sh', [HOOK], { env: { PATH: `${bin}:/bin`, HOME: root }, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] });
  return { r, calls: readFileSync(log, 'utf8').trim().split('\n') };
}

test('post-merge invokes `cli.mjs hydrate` and never `import`', () => {
  const { r, calls } = run(0);
  assert.equal(r.status, 0);
  const memoryCalls = calls.filter((c) => c.includes('memory/cli.mjs'));
  assert.ok(memoryCalls.some((c) => /memory\/cli\.mjs hydrate$/.test(c)), `no hydrate call in:\n${calls.join('\n')}`);
  assert.ok(memoryCalls.every((c) => !/memory\/cli\.mjs import/.test(c)), 'the deprecated alias must not be called');
});

test('post-merge does NOT pass --verify: it is where the derived index gets rebuilt after a pull', () => {
  const { calls } = run(0);
  assert.ok(calls.every((c) => !/--verify/.test(c)));
});

test('Q4: a deferred hydration (exit 6) never blocks the merge, and its reason still reaches stderr', () => {
  const { r, calls } = run(6);
  assert.equal(r.status, 0, 'the hook must exit 0 on a deferral');
  assert.match(r.stderr, /hydration deferred/);
  assert.doesNotMatch(r.stderr, /not declared/, 'exit 6 is not the declaration refusal');
  assert.ok(calls.some((c) => /resolve-index/.test(c)), 'the hook carries on to resolve-index after a deferral');
});
