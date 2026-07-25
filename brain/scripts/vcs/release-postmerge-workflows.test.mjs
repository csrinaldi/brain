// release-postmerge-workflows.test.mjs — Structural tests for PR7 (S7).
//
// L2 release-gate (rung 2, fail-closed) + post-merge auto-revert (rung 3).
// REQ-L2-1, REQ-L2-2 — design.md §3.
//
// Both workflows reuse brain-audit.mjs unchanged and are deliberately SEPARATE
// files from governance.yml (design §10-B, gap B): the PR-time gate stays
// read-only; only the trusted post-merge context gets contents: write +
// pull-requests: write.
//
// Run with: npm test (node --test)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

// ════════════════════════════════════════════════════════════════════════════
// PR4 (#304) — WORKFLOW-EXTRACTING TEST HARNESS, BORN ISOLATED (Phase 4.0,
// design §7.4, owner Ruling #902). This is the FIRST place this branch runs
// extracted workflow bash. The isolation contract below is an ACCEPTANCE
// CRITERION of every such test, honored from its first RED — never written
// un-isolated and patched later.
// ════════════════════════════════════════════════════════════════════════════

// extractRunScript(yamlText, stepId) — return the dedented `run: |` block of the
// step whose `id:` is stepId. Pure text parse (js-yaml is not a dependency).
function extractRunScript(yamlText, stepId) {
  const lines = yamlText.split('\n');
  let i = lines.findIndex((l) => /^\s*- id:\s*/.test(l) && l.trim() === `- id: ${stepId}`);
  assert.ok(i !== -1, `extractRunScript: step id '${stepId}' not found`);
  const stepIndent = lines[i].indexOf('- ');
  // Scan within this step (until the next `- ` at the same indent, or EOF) for `run: |`.
  let runIdx = -1;
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (l.trim() && l.indexOf('- ') === stepIndent && /^\s*- /.test(l)) break; // next step
    if (/^\s*run:\s*\|\s*$/.test(l)) { runIdx = j; break; }
  }
  assert.ok(runIdx !== -1, `extractRunScript: step '${stepId}' has no 'run: |' block`);
  const runIndent = lines[runIdx].search(/\S/);
  const body = [];
  for (let j = runIdx + 1; j < lines.length; j++) {
    const l = lines[j];
    if (l.trim() === '') { body.push(''); continue; }
    const ind = l.search(/\S/);
    if (ind <= runIndent) break; // block ended
    body.push(l.slice(runIndent + 2)); // dedent (run content is runIndent+2)
  }
  return body.join('\n');
}

// THE ISOLATION CONTRACT (Phase 4.0). Every extracted-script spawn MUST run with
// these env overrides and a temp cwd/HOME — so a `git config` (even a stray
// --global) can never touch the real user's config or the real repo. No
// inherited GH_TOKEN: the isolated bash must reach a stubbed `gh`, never the network.
function isolatedEnv(homeDir, extra = {}) {
  const env = {
    PATH: `${join(homeDir, 'bin')}:${process.env.PATH}`,
    HOME: homeDir,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    RUNNER_TEMP: homeDir,
    GITHUB_OUTPUT: join(homeDir, 'github_output'),
    ...extra,
  };
  // Deliberately NO GH_TOKEN — the isolated run must not authenticate.
  return env;
}

// A recording `gh` stub: logs each invocation to $GH_LOG, prints canned output
// for read subcommands, and (by default) succeeds. Placed on PATH ahead of the
// real gh so no isolated test ever hits the network or needs a token.
function writeGhStub(binDir, { prListPrints = '', issueListPrints = '', exitCode = 0 } = {}) {
  mkdirSync(binDir, { recursive: true });
  const gh = join(binDir, 'gh');
  writeFileSync(gh, [
    '#!/usr/bin/env bash',
    'echo "gh $*" >> "${GH_LOG:-/dev/null}"',
    'case "$1 $2" in',
    `  "pr list") printf '%s' ${JSON.stringify(prListPrints)} ;;`,
    `  "issue list") printf '%s' ${JSON.stringify(issueListPrints)} ;;`,
    '  *) : ;;',
    'esac',
    `exit ${exitCode}`,
    '',
  ].join('\n'));
  chmodSync(gh, 0o755);
}

// Make the extracted script cwd-independent: the workflow calls
// `node brain/scripts/...` relative to the checkout root; rewrite those to the
// real repo's absolute path so the REAL cursor/audit/parse logic runs against
// the temp repo's git state (cursor.mjs & friends operate on process.cwd()).
function absolutizeNodePaths(script) {
  return script.replaceAll('node brain/scripts/', `node ${REPO_ROOT}/brain/scripts/`);
}

// Substitute the `${{ steps.*.outputs.* }}` expressions with test values.
function substituteExpr(script, subs) {
  let out = script;
  for (const [expr, val] of Object.entries(subs)) {
    out = out.replaceAll(expr, val);
  }
  return out;
}

// Run an extracted step script in an isolated temp repo. Returns {status, stdout, stderr, homeDir}.
function runStepIsolated(stepId, { repoSetup, subs = {}, ghOpts = {}, env = {} } = {}) {
  const homeDir = mkdtempSync(join(tmpdir(), 'pm-iso-'));
  writeGhStub(join(homeDir, 'bin'), ghOpts);
  writeFileSync(join(homeDir, 'github_output'), '');
  const repo = join(homeDir, 'repo');
  mkdirSync(repo, { recursive: true });
  const yamlText = readFileSync(POSTMERGE_YML, 'utf8');
  const g = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8', env: isolatedEnv(homeDir) });
  g('init', '--initial-branch=main');
  g('config', 'user.name', 'Test');
  g('config', 'user.email', 't@t');
  if (repoSetup) repoSetup(g, repo, homeDir);
  let script = extractRunScript(yamlText, stepId);
  script = absolutizeNodePaths(substituteExpr(script, subs));
  const r = spawnSync('bash', ['-c', script], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...isolatedEnv(homeDir, env), GH_LOG: join(homeDir, 'gh.log') },
  });
  return { ...r, homeDir, repo, ghLog: () => (existsSync(join(homeDir, 'gh.log')) ? readFileSync(join(homeDir, 'gh.log'), 'utf8') : ''), output: () => readFileSync(join(homeDir, 'github_output'), 'utf8') };
}

const RELEASE_YML = resolve(REPO_ROOT, '.github/workflows/release.yml');
const POSTMERGE_YML = resolve(REPO_ROOT, '.github/workflows/governance-postmerge.yml');
const GOVERNANCE_YML = resolve(REPO_ROOT, '.github/workflows/governance.yml');

// ── release.yml (rung 2, fail-closed) — REQ-L2-1 ────────────────────────────

test('release.yml exists', () => {
  assert.ok(existsSync(RELEASE_YML), 'expected .github/workflows/release.yml to exist');
});

test('release.yml references brain-audit.mjs', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /brain-audit\.mjs/, 'release.yml must invoke brain-audit.mjs');
});

test('release.yml triggers on tags matching v*', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /tags:\s*\[\s*['"]v\*['"]\s*\]/, "release.yml must trigger on push tags: ['v*']");
});

test('release.yml declares read-only contents permission (fail-closed, no write scope)', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /permissions:\s*\{\s*contents:\s*read\s*\}/, 'release.yml must declare permissions: { contents: read }');
});

// brain merges the release PR to main, THEN tags that commit. On the tag push,
// origin/main is at/ahead of the tagged commit, so origin/main..HEAD is EMPTY —
// brain-audit.mjs logs "No merge commits found" and exits 0 unconditionally,
// making the rung-2 gate a silent no-op. The audit must instead run from the
// PREVIOUS release tag to the tagged commit, which is always non-empty.
test('release.yml does NOT use the empty origin/main..HEAD range on a tag push', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.doesNotMatch(
    text,
    /brain-audit\.mjs\s+origin\/main\.\.HEAD/,
    'release.yml must not invoke brain-audit.mjs with origin/main..HEAD — that literal range is empty on brain\'s tag-after-merge flow'
  );
});

test('release.yml derives the audit range from the previous release tag', () => {
  const text = readFileSync(RELEASE_YML, 'utf8');
  assert.match(text, /git describe --tags/, 'release.yml must locate the previous release tag via git describe --tags');
  assert.match(text, /GITHUB_REF_NAME/, 'release.yml must use GITHUB_REF_NAME to identify the tag being released');
  assert.match(text, /PREV_TAG\}?\.\.HEAD/, 'release.yml must audit PREV_TAG..HEAD (previous tag to the tagged commit)');
});

// ── governance-postmerge.yml (rung 3, auto-revert) — REQ-L2-2 ──────────────

test('governance-postmerge.yml exists', () => {
  assert.ok(existsSync(POSTMERGE_YML), 'expected .github/workflows/governance-postmerge.yml to exist');
});

test('governance-postmerge.yml references brain-audit.mjs', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /brain-audit\.mjs/, 'governance-postmerge.yml must invoke brain-audit.mjs');
});

test('governance-postmerge.yml declares contents: write and pull-requests: write', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /contents:\s*write/, 'governance-postmerge.yml must declare contents: write (trusted post-merge context)');
  assert.match(text, /pull-requests:\s*write/, 'governance-postmerge.yml must declare pull-requests: write (to open the auto-revert PR)');
});

test('governance-postmerge.yml triggers on push to main and a daily schedule', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /branches:\s*\[main\]/, 'governance-postmerge.yml must trigger on push to main');
  assert.match(text, /schedule:/, 'governance-postmerge.yml must also trigger on a schedule (daily cron)');
});

// ── D2 (#259): the cursor-windowed, exit-code-branched, [FAIL-SHA]-consuming
// shape. These INVERT the pre-D2 assertions above: the window is no longer the
// push payload's before..sha (which skips offenders and collapses on cron) — it
// is the governance cursor range. ────────────────────────────────────────────

// The v1 range (github.event.before..github.sha) is GONE: it skips an offender
// that landed while an earlier run was pinned (REQ-D2-1), and collapses to an
// empty sha..sha on cron. The window is the cursor's — never the push payload's.
test('governance-postmerge.yml does NOT window on github.event.before (the skip-over regression)', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.doesNotMatch(
    text,
    /github\.event\.before/,
    'governance-postmerge.yml must NOT use github.event.before — the audit window is the governance cursor range (REQ-D2-1)'
  );
});

test('governance-postmerge.yml resolves the audit window from the cursor CLI', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /cursor\.mjs window/,
    'governance-postmerge.yml must resolve the window via `cursor.mjs window` (cursor..HEAD), not the push payload'
  );
});

// The audit's NUMERIC exit code is authoritative: continue-on-error flattens 1
// and 2 into a boolean, which would let an uncomputable (code 2) trigger a
// revert. The workflow must capture the numeric code and branch on it (REQ-D2-6).
test('governance-postmerge.yml does NOT flatten the audit exit code via continue-on-error', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.doesNotMatch(
    text,
    /continue-on-error:\s*true/,
    'governance-postmerge.yml must not use continue-on-error (it flattens exit 1 and 2 — a code-2 must never revert)'
  );
});

test('governance-postmerge.yml branches on the numeric audit code (0/1/2), not steps.*.outcome', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /steps\.audit\.outputs\.code\s*==\s*'0'/, 'code 0 must advance the cursor');
  assert.match(text, /steps\.audit\.outputs\.code\s*==\s*'1'/, 'code 1 must revert the parsed offenders');
  assert.match(text, /steps\.audit\.outputs\.code\s*==\s*'2'/, 'code 2 must raise a loud infra issue, never revert');
  assert.doesNotMatch(
    text,
    /steps\.audit\.outcome\s*==\s*'failure'/,
    'governance-postmerge.yml must branch on the numeric code, never the boolean outcome'
  );
});

// The revert consumes the ONE tested parser (REQ-D2-5) — never github.sha
// blindly, never an inline grep of stdout.
test('governance-postmerge.yml reverts the parsed [FAIL-SHA] offenders, not github.sha blindly', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /parse-failures\.mjs/,
    'governance-postmerge.yml must parse offenders through parse-failures.mjs (REQ-D2-5)'
  );
  assert.doesNotMatch(
    text,
    /git revert[^\n]*github\.sha/,
    'governance-postmerge.yml must not blindly revert github.sha — it reverts the parsed offenders'
  );
});

// Parents-only count (REQ-D2-4): never `grep -c '^parent '` (also matches
// commit-message lines beginning with `parent `).
test('governance-postmerge.yml counts merge parents via %P, never grep -c "^parent "', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /git show -s --format=%P/, 'must count parents via `git show -s --format=%P`');
  assert.doesNotMatch(
    text,
    /grep -c ['"]\^parent /,
    'must not use `grep -c "^parent "` (matches message lines too — REQ-D2-4)'
  );
});

// PR-keyed idempotency (REQ-D2-13): dedup on the PR (`--state all`), so a
// closed-without-merge PR is never reopened or duplicated.
test('governance-postmerge.yml dedups auto-revert on the PR (--state all), not the branch', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(
    text,
    /gh pr list --head[^\n]*--state all/,
    'governance-postmerge.yml must dedup via `gh pr list --head <br> --state all` (REQ-D2-13, PR-keyed)'
  );
});

// Untrusted audit output is routed via env: and written to a file, never
// argv-spliced into a run: block (CWE-94, §4.5.1/4.5.2).
test('governance-postmerge.yml routes audit stdout via env:, never ${{ }}-spliced into run:', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /AUDIT_STDOUT:\s*\$\{\{\s*steps\.audit\.outputs\.stdout\s*\}\}/, 'audit stdout must reach run: via env:, not inline splicing');
  assert.match(text, /--body-file/, 'loud/PR bodies must be passed via --body-file, never argv-spliced');
});

// Loud paths carry no `|| true` (a swallowed failure is a silent halt), and the
// workflow guards against overlapping runs.
test('governance-postmerge.yml has a concurrency group and no swallowed loud paths', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /concurrency:\s*\{\s*group:\s*governance-postmerge/, 'must declare a concurrency group (§5.3)');
  assert.doesNotMatch(
    text,
    /gh (issue|label|pr) create[^\n]*\|\|\s*true/,
    'no loud path (gh issue/label/pr create) may be suffixed with `|| true`'
  );
});

// The terminal-state assertion runs always() and fails the job if the audit
// produced no mapped code (e.g. it was SIGKILLed) — never a silent clean pass.
test('governance-postmerge.yml asserts a terminal audit code via always()', () => {
  const text = readFileSync(POSTMERGE_YML, 'utf8');
  assert.match(text, /if:\s*always\(\)/, 'must carry an always() terminal-state assertion step');
});

// ── design §10-B: separate-file isolation ───────────────────────────────────
//
// The read-only PR gate (governance.yml) must never gain write scope. Rung 3's
// write permissions live ONLY in governance-postmerge.yml, a file that governance.yml
// does not reference and vice versa — both files exist independently.

test('governance-postmerge.yml is a separate file from governance.yml (read-only PR gate isolation)', () => {
  assert.ok(existsSync(GOVERNANCE_YML), 'expected .github/workflows/governance.yml to exist (baseline PR gate)');
  assert.ok(existsSync(POSTMERGE_YML), 'expected .github/workflows/governance-postmerge.yml to exist as a SEPARATE file');
  assert.notEqual(GOVERNANCE_YML, POSTMERGE_YML, 'governance-postmerge.yml must not be the same path as governance.yml');

  const governanceText = readFileSync(GOVERNANCE_YML, 'utf8');
  assert.doesNotMatch(
    governanceText,
    /contents:\s*write/,
    'governance.yml (the PR-time gate) must stay read-only — write scope must not leak into it'
  );
});

// ── C1 (Phase 4.2, SELF-CONTAINED per #304 I304-C1-TARGET-ABSENT): the
// skip-over proof. Cursor pinned at C; offender M lands; clean P2 lands. The
// window step must resolve C..P2 (still containing M), NEVER a before..sha
// window that would skip M. The fixture mints its own repo + bare origin +
// governance cursor ref — it reads no live server branch. ──────────────────
test('C1 skip-over: the window step resolves cursor..HEAD (C..P2, containing M), never a payload range', () => {
  let cSha, mSha, p2Sha;
  const r = runStepIsolated('window', {
    repoSetup: (g, repo, homeDir) => {
      // bare origin so cursor.mjs's remote-authoritative ls-remote works
      const origin = join(homeDir, 'origin.git');
      spawnSync('git', ['init', '--bare', origin], { encoding: 'utf8', env: isolatedEnv(homeDir) });
      g('remote', 'add', 'origin', origin);
      writeFileSync(join(repo, 'f'), 'base\n'); g('add', '.'); g('commit', '-m', 'C0');
      // C — the cursor point
      writeFileSync(join(repo, 'f'), 'C\n'); g('add', '.'); g('commit', '-m', 'C (cursor)');
      cSha = g('rev-parse', 'HEAD').stdout.trim();
      // M — an offender merge lands after C
      g('checkout', '-b', 'off'); writeFileSync(join(repo, 'm'), 'offender\n'); g('add', '.'); g('commit', '-m', 'M work');
      g('checkout', 'main'); g('merge', '--no-ff', 'off', '-m', 'M: offender merge'); mSha = g('rev-parse', 'HEAD').stdout.trim();
      // P2 — a clean merge lands after M
      g('checkout', '-b', 'clean'); writeFileSync(join(repo, 'p'), 'clean\n'); g('add', '.'); g('commit', '-m', 'P2 work');
      g('checkout', 'main'); g('merge', '--no-ff', 'clean', '-m', 'P2: clean merge'); p2Sha = g('rev-parse', 'HEAD').stdout.trim();
      g('push', 'origin', 'main');
      // pin the governance cursor at C on origin
      g('push', 'origin', `${cSha}:refs/governance/audit-cursor`);
    },
  });
  assert.equal(r.status, 0, `window step must exit 0 on a present cursor:\n${r.stdout}\n${r.stderr}`);
  const out = r.output();
  assert.match(out, new RegExp(`range=${cSha}\\.\\.${p2Sha}`),
    `window must be C..P2 (contains M=${mSha.slice(0,7)}); got GITHUB_OUTPUT:\n${out}`);
});

// ── C2 (Phase 4.1): a cursor that resolves to UNKNOWN/ABSENT halts with exit 2
// and NEVER emits a range — an inferred empty range must never pass as clean.
// Here the repo has NO origin/governance ref → readCursor is UNKNOWN (ls-remote
// on a nonexistent remote is not status-2/absent). The step must exit 2 and
// write no range. ──────────────────────────────────────────────────────────
test('C2: an uncomputable cursor halts the window step at exit 2, emitting no range', () => {
  const r = runStepIsolated('window', {
    repoSetup: (g, repo) => {
      writeFileSync(join(repo, 'f'), 'x\n'); g('add', '.'); g('commit', '-m', 'c0');
      // no origin remote at all → ls-remote fails non-2 → UNKNOWN (fail-closed)
    },
  });
  assert.equal(r.status, 2, `an uncomputable cursor must exit 2 (fail-closed):\n${r.stdout}\n${r.stderr}`);
  assert.doesNotMatch(r.output(), /range=/, `no audit range may be emitted on an uncomputable cursor:\n${r.output()}`);
  assert.match(r.ghLog(), /gh (label|issue) create/, `a loud issue must be raised on halt:\n${r.ghLog()}`);
});

// ── C4 (Phase 4.3): the audit step normalizes an unmapped exit code to 2 BEFORE
// branching, so a killed/garbled audit can never advance the cursor or revert.
// A stub audit that exits 3 must surface as code=2 in GITHUB_OUTPUT. ─────────
test('C4: an unmapped audit exit code (3) is normalized to 2 before branching', () => {
  const r = runStepIsolated('audit', {
    subs: { '${{ steps.window.outputs.range }}': 'AAA..BBB' },
    repoSetup: (g, repo, homeDir) => {
      // shadow the audit invocation: put a fake node script path? The step calls
      // `node <REPO>/brain/scripts/brain-audit.mjs`. Stub by prepending a `node`
      // wrapper on PATH that intercepts brain-audit.mjs and exits 3.
      const bin = join(homeDir, 'bin');
      writeFileSync(join(bin, 'node'), [
        '#!/usr/bin/env bash',
        'for a in "$@"; do case "$a" in *brain-audit.mjs) echo "[FAIL] simulated"; exit 3;; esac; done',
        'exec /usr/bin/env -i PATH="/usr/bin:/bin:/usr/local/bin" node "$@"',
      ].join('\n'));
      chmodSync(join(bin, 'node'), 0o755);
    },
  });
  assert.equal(r.status, 0, `audit step itself exits 0 (it captures the code):\n${r.stdout}\n${r.stderr}`);
  assert.match(r.output(), /code=2/, `an exit-3 audit must normalize to code=2:\n${r.output()}`);
  assert.doesNotMatch(r.output(), /code=3/, 'the raw unmapped code must not survive');
});

// ── C5 (Phase 4.4): if the tested parser fails while code==1, the revert step
// fails closed — never a silently empty offender list. A stub parse-failures
// that exits non-zero must abort the step (set -e via command substitution). ─
test('C5: a parse-failures crash while reverting fails the step closed, never an empty offender list', () => {
  const r = runStepIsolated('revert', {
    env: { AUDIT_STDOUT: '[FAIL-SHA] ' + 'a'.repeat(40) },
    repoSetup: (g, repo, homeDir) => {
      writeFileSync(join(repo, 'f'), 'x\n'); g('add', '.'); g('commit', '-m', 'c0');
      const bin = join(homeDir, 'bin');
      // Intercept the parse-failures.mjs node call and make it crash.
      writeFileSync(join(bin, 'node'), [
        '#!/usr/bin/env bash',
        'for a in "$@"; do case "$a" in *parse-failures.mjs) echo "parser boom" >&2; exit 7;; esac; done',
        'exec /usr/bin/env node "$@"',
      ].join('\n'));
      chmodSync(join(bin, 'node'), 0o755);
    },
  });
  assert.notEqual(r.status, 0, `a parser crash must fail the revert step, never yield an empty list:\n${r.stdout}\n${r.stderr}`);
});

// ── D1 (Phase 4.0.1): a drift-guard over THIS test file, proven with teeth.
// Every `spawnSync('bash', ...)` that runs extracted workflow script MUST carry
// the isolation env (isolatedEnv). The guard scans source text and reports any
// bash spawn whose call is not accompanied by isolatedEnv within its options.
// Teeth: it must FLAG a deliberately non-compliant sample and PASS the real file.
function auditBashIsolation(sourceText) {
  const violations = [];
  const lines = sourceText.split('\n');
  lines.forEach((l, idx) => {
    // Scan CODE only — a drift-guard that trips on its own prose is noise. Skip
    // comment lines (a bash-spawn mentioned in a comment is not an execution).
    const t = l.trim();
    if (t.startsWith('//') || t.startsWith('*')) return;
    if (/spawnSync\(\s*['"]bash['"]/.test(l)) {
      // look at the next ~8 lines for the options object carrying isolatedEnv
      const window = lines.slice(idx, idx + 8).join('\n');
      if (!/isolatedEnv\(/.test(window)) violations.push(idx + 1);
    }
  });
  return violations;
}

test('D1 isolation drift-guard: every extracted-bash spawn in this file is isolated (proven with teeth)', () => {
  const self = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.deepEqual(
    auditBashIsolation(self), [],
    'every spawnSync("bash", ...) that runs workflow script must carry isolatedEnv(...)',
  );
  // TEETH: a non-compliant sample (bash spawn WITHOUT isolatedEnv) must be
  // flagged. The spawn token is assembled at runtime so this teeth-sample is NOT
  // itself a literal in this file's source — otherwise the guard above would
  // (correctly) flag its own sample and this test could never pass clean.
  const spawnTok = 'spawn' + 'Sync("bash"';
  const badSample = [
    `const r = ${spawnTok}, ["-c", script], {`,
    '  cwd: repo,',
    '  env: { ...process.env },',
    '});',
  ].join('\n');
  assert.ok(
    auditBashIsolation(badSample).length > 0,
    'the drift-guard has no teeth — it failed to flag a bash spawn missing isolatedEnv',
  );
});

// ── D2 (Phase 4.0.3): the real repository's git identity is UNCHANGED by running
// an isolated extracted-script step — even one that itself runs `git config`.
// The isolation contract (HOME=temp, GIT_CONFIG_GLOBAL=/dev/null) guarantees a
// stray global write cannot reach the developer's ~/.gitconfig or this repo. ─
test('D2 isolation: an isolated step running git config leaves the real repo/user identity untouched', () => {
  const before = spawnSync('git', ['config', '--get-regexp', '^user\\.'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout;
  // Run the gitidentity step isolated — it sets user.name/email on ITS repo.
  const r = runStepIsolated('gitidentity', {
    repoSetup: (g, repo) => { writeFileSync(join(repo, 'f'), 'x\n'); g('add', '.'); g('commit', '-m', 'c0'); },
  });
  assert.equal(r.status, 0, `gitidentity step must succeed in isolation:\n${r.stderr}`);
  const after = spawnSync('git', ['config', '--get-regexp', '^user\\.'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout;
  assert.equal(after, before, 'the real repository\'s user.* config changed — isolation leaked');
  // And the isolated repo DID get the bot identity (the step actually ran).
  const isoName = spawnSync('git', ['config', 'user.name'], { cwd: r.repo, encoding: 'utf8', env: isolatedEnv(r.homeDir) }).stdout.trim();
  assert.equal(isoName, 'github-actions[bot]', 'the isolated repo must have received the bot identity');
});
