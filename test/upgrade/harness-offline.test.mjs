// harness-offline.test.mjs — the container harnesses must not couple an OFFLINE
// test to a network service (#850).
//
// What this pins, and why it is a test rather than a comment: `m4-danger-paths`
// ran green in ~15 seconds per scenario for months, then began timing out at
// the 20-minute cap with no commit correlating. The cause was never a
// regression — the harness had always called `npm i` without disabling audit,
// so its duration was a function of registry latency rather than of the work.
// Measured, one container run, same tree and image: 175s plain, 4s with these
// variables, 5s with the network removed entirely.
//
// The scenarios install a package with ZERO dependencies from a LOCAL
// `git+file://` remote. There is nothing to audit and nothing to fund.
//
// ENVIRONMENT, not flags on the install lines: each scenario runs two installs
// — the harness's own and the one `brain:upgrade` spawns — and the second is
// production code. A test that needs production to skip its audit is a test
// asking production to lie for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Pure: the env assignments a `docker run` invocation carries. */
export function dockerRunEnv(scriptText) {
  // A LINE that begins with `docker run`, never the first occurrence of the
  // string: both scripts discuss `docker run` in prose above the invocation,
  // and this test's first cut matched the comment and read no env at all.
  const all = scriptText.split('\n');
  const start = all.findIndex((l) => /^\s*docker run\b/.test(l));
  if (start === -1) return null;
  // The invocation ends at the first line that does not continue with `\`.
  const lines = all.slice(start);
  const invocation = [];
  for (const line of lines) {
    invocation.push(line);
    if (!line.trimEnd().endsWith('\\')) break;
  }
  const text = invocation.join('\n');
  const env = new Map();
  for (const m of text.matchAll(/-e\s+([A-Za-z_][A-Za-z0-9_]*)=("[^"]*"|\S+)/g)) {
    env.set(m[1], m[2].replace(/^"|"$/g, ''));
  }
  return env;
}

test('#850: the matcher reads only the docker run invocation, not the whole script', () => {
  const env = dockerRunEnv('# prose mentioning docker run -e FOO=nope\ndocker run --rm \\\n  -e A=1 \\\n  -e B="two" \\\n  img cmd\necho -e LATER=nope\n');
  assert.deepEqual([...env.entries()], [['A', '1'], ['B', 'two']],
    'prose above it and lines after it are not part of the invocation');
});

for (const script of ['danger-paths.sh', 'run.sh']) {
  test(`#850: ${script} runs its container with audit and fund OFF — an offline test never waits on the registry`, () => {
    const env = dockerRunEnv(readFileSync(join(HERE, script), 'utf8'));
    assert.ok(env, `${script} must invoke docker run`);
    assert.equal(env.get('npm_config_audit'), 'false',
      `${script}: without this the scenarios' duration is registry latency, not work — 175s vs 4s, measured (#850). ` +
      'Set it as environment so it also covers the install brain:upgrade spawns, never as a flag on production code.');
    assert.equal(env.get('npm_config_fund'), 'false', `${script}: same call, same reason`);
  });
}
