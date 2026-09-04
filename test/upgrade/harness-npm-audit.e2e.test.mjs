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
import { readFileSync, globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, sep } from 'node:path';

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

// ── The class, not the instance ─────────────────────────────────────────────
// This guard's own first cut was invisible to `npm test`. That is a defect
// shape, not a typo: any test file whose path does not match one of the two
// globs passes review, passes when run by hand, and protects nothing.
//
// THREE THINGS THIS DELIBERATELY DOES NOT DO, each one a round of review
// catching the guard repeating, in miniature, the defect it exists to catch:
//   · it does not walk a hand-picked list of ROOTS (round 2). The first cut
//     visited `brain/scripts` and `test` while claiming "every test file in the
//     tree", so a `*.test.mjs` under `brain/core/` would have been unreachable
//     by the globs AND unseen by the guard — the same silence, one directory
//     over.
//   · it does not reimplement GLOB matching (round 2). The first cut hand-rolled
//     a glob→RegExp function tested only against its own author's expectations,
//     which is the shape that diverges from the real runner without telling
//     anyone. `fs.globSync` is the platform's own matcher. It prints an
//     ExperimentalWarning on every run — EXPECTED OUTPUT, not a fault to
//     chase: the alternative is a private reimplementation of glob semantics,
//     and one warning beats a second implementation whose disagreement with
//     the first is the entire hazard. If Node ever removes it this test fails
//     loudly, which is the correct way for that news to arrive.
//   · it does not hand-pick EXCLUSIONS either (round 3). The replacement walk
//     skipped three literal names while its comment claimed parity with
//     `.gitignore` — a list that ignores ten more. Same defect, one layer down.
//     So the file list comes from `git ls-files`: git already knows what this
//     repository contains, and asking it removes the list entirely.
//
// The pattern across all three: when a guard needs to know something a tool
// already knows — which paths a glob reaches, which files a repo holds — ask
// the tool. A second answer is a second thing that can be wrong, and the
// disagreement between the two is precisely the hazard being guarded.

/** Pure: of the files this repo holds, those named like tests that no glob reaches. */
export function orphanTests(repoFiles, reachedFiles) {
  const reached = new Set(reachedFiles);
  return repoFiles.filter((f) => f.endsWith('.test.mjs') && !reached.has(f)).sort();
}

test('#850: the orphan rule is exact — named like a test, and not reached', () => {
  const repo = ['a/x.test.mjs', 'a/y.test.mjs', 'b/helper.mjs', 'c/z.test.mjs'];
  assert.deepEqual(orphanTests(repo, ['a/x.test.mjs']), ['a/y.test.mjs', 'c/z.test.mjs'],
    'every unreached test file is reported, wherever it lives');
  assert.deepEqual(orphanTests(repo, repo), [], 'nothing is reported when everything is reached');
  assert.deepEqual(orphanTests(['b/helper.mjs'], []), [],
    'a non-test file is never an orphan — the rule is the NAME, not mere absence');
});

test('#850: every test file the repo holds is REACHED by one of npm test\'s globs', () => {
  const repo = join(HERE, '..', '..');
  const { test: testScript } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).scripts;
  const globs = [...testScript.matchAll(/"([^"]*\*[^"]*)"/g)].map((m) => m[1]);
  assert.ok(globs.length >= 2, `expected the test script to carry globs, got: ${testScript}`);

  const reached = globSync(globs, { cwd: repo }).map((f) => f.split(sep).join('/'));
  assert.ok(reached.length > 100, `the globs must resolve the real suite (saw ${reached.length})`);

  // git, not a walk: no exclusion list to keep in step with .gitignore.
  const tracked = execFileSync('git', ['ls-files'], { cwd: repo, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  assert.ok(tracked.length > 100, `git must list the tree (saw ${tracked.length})`);

  assert.deepEqual(orphanTests(tracked, reached), [],
    'these files are named like tests and are never run by `npm test` — rename them to match a glob ' +
    '(`test/**/*.e2e.test.mjs` under test/), or widen the script. A test the suite does not reach is ' +
    'a guard that protects nothing while looking like it does (#850).');
});

test('#850: the orphan check would actually SEE a stray test — the walk is not vacuous', () => {
  const repo = join(HERE, '..', '..');
  const reached = new Set(globSync(['brain/scripts/**/*.test.mjs', 'test/**/*.e2e.test.mjs'], { cwd: repo })
    .map((f) => f.split(sep).join('/')));
  // The name this guard shipped with the first time, and a plausible future one.
  for (const stray of ['test/upgrade/harness-offline.test.mjs', 'brain/core/something.test.mjs']) {
    assert.ok(!reached.has(stray), `${stray} must read as unreached — it is exactly what the walk must report`);
  }
});
