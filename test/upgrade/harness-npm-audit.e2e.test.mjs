// harness-npm-audit.e2e.test.mjs — the container harnesses must not pay for an
// audit they have nothing to audit (#850).
//
// THE NAME OF THIS FILE IS LOAD-BEARING. `npm test` globs
// `brain/scripts/**/*.test.mjs` and `test/**/*.e2e.test.mjs`; the first cut of
// this guard was `test/upgrade/harness-offline.test.mjs`, which matches
// NEITHER — it passed when run by hand and never ran in the suite. A guard
// that only runs when someone remembers to run it is not a guard, and
// verifying that a test passes is not verifying that the suite runs it.
//
// The scope claim is also narrower than the first cut said. `danger-paths.sh`
// is genuinely offline (local `git+file://` remote, no token). `run.sh` is
// NOT: it clones a real consumer repo and installs over `git+https`. What both
// share is the thing this pins — brain has ZERO dependencies, so npm's audit
// call finds nothing in either harness and costs whatever the registry costs
// that minute.
//
// What this pins, and why it is a test rather than a comment: `m4-danger-paths`
// ran green in ~15 seconds per scenario for months, then began timing out at
// the 20-minute cap with no commit correlating. The cause was never a
// regression — the harness had always called `npm i` without disabling audit,
// so its duration was a function of registry latency rather than of the work.
// Measured, one container run, same tree and image: 175s plain, 4s with these
// variables, 5s with the network removed entirely.
//
// There is nothing to audit and nothing to fund: brain ships no dependencies.
//
// ENVIRONMENT, not flags on the install lines: each scenario runs two installs
// — the harness's own and the one `brain:upgrade` spawns — and the second is
// production code. A test that needs production to skip its audit is a test
// asking production to lie for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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
  test(`#850: ${script} runs its container with audit and fund OFF — no dependencies, nothing to audit`, () => {
    const env = dockerRunEnv(readFileSync(join(HERE, script), 'utf8'));
    assert.ok(env, `${script} must invoke docker run`);
    assert.equal(env.get('npm_config_audit'), 'false',
      `${script}: without this the scenarios' duration is registry latency, not work — 175s vs 4s, measured (#850). ` +
      'Set it as environment so it also covers the install brain:upgrade spawns, never as a flag on production code.');
    assert.equal(env.get('npm_config_fund'), 'false', `${script}: same call, same reason`);
  });
}

/** Pure: a shell glob → an anchored RegExp over repo-relative paths.
 * ONE pass, because two passes is how the first cut broke: replacing `**\/`
 * with `(?:.*\/)?` inserts a `*`, and the next replace then ate it. */
export function globToRegExp(glob) {
  let out = '';
  for (let i = 0; i < glob.length; i++) {
    if (glob.startsWith('**/', i)) { out += '(?:[^/]+/)*'; i += 2; continue; }
    if (glob[i] === '*') { out += '[^/]*'; continue; }
    out += glob[i].replace(/[.+^${}()|[\]\\?]/, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

test('#850: the glob matcher is right about paths it must reach and paths it must not', () => {
  const deep = globToRegExp('brain/scripts/**/*.test.mjs');
  assert.ok(deep.test('brain/scripts/governance/checks/issue-link.test.mjs'), 'nested paths are reached');
  assert.ok(deep.test('brain/scripts/archive.test.mjs'), 'and so is the top level');
  assert.ok(!deep.test('test/upgrade/x.test.mjs'), 'a different root is not');
  const e2e = globToRegExp('test/**/*.e2e.test.mjs');
  assert.ok(e2e.test('test/upgrade/harness-npm-audit.e2e.test.mjs'), 'this very file is reached');
  assert.ok(!e2e.test('test/upgrade/harness-offline.test.mjs'),
    'and the name this guard shipped with the FIRST time is not — the bug it exists for');
});

// ── The class, not the instance ─────────────────────────────────────────────
// This guard's own first cut was invisible to `npm test`. That is a defect
// shape, not a typo: any test file whose path does not match one of the two
// globs passes review, passes when run by hand, and protects nothing. Nothing
// in the tree detected it — the reviewer did, by reading package.json.
test('#850: every test file in the tree is REACHED by one of npm test\'s globs', () => {
  const repo = join(HERE, '..', '..');
  const { test: testScript } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).scripts;
  // The globs, read from the script rather than restated — a second copy here
  // would drift from the one that actually runs the suite.
  const globs = [...testScript.matchAll(/"([^"]*\*[^"]*)"/g)].map((m) => m[1]);
  assert.ok(globs.length >= 2, `expected the test script to carry globs, got: ${testScript}`);

  const matchers = globs.map(globToRegExp);
  const orphans = [];
  const walk = (dir, rel) => {
    for (const name of readdirSync(join(repo, dir), { withFileTypes: true })) {
      if (name.name === 'node_modules' || name.name === '.git') continue;
      const relPath = rel ? `${rel}/${name.name}` : name.name;
      if (name.isDirectory()) walk(join(dir, name.name), relPath);
      else if (name.name.endsWith('.test.mjs') && !matchers.some((re) => re.test(relPath))) {
        orphans.push(relPath);
      }
    }
  };
  for (const root of ['brain/scripts', 'test']) walk(root, root);

  assert.deepEqual(orphans, [],
    'these files are named like tests and are never run by `npm test` — rename them to match a glob ' +
    '(`test/**/*.e2e.test.mjs` under test/), or widen the script. A test the suite does not reach is ' +
    'a guard that protects nothing while looking like it does (#850).');
});
