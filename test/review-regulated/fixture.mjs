// fixture.mjs — builds a REGULATED consumer repo for the reviewer e2e (issue #409).
//
// The shape is a real consumer's (design D2/D3-amended): a bare origin + a working
// clone with brain VENDORED into it (`brain/core` + `brain/scripts`, exactly what
// `brain:upgrade`'s copyManaged delivers), its OWN `brain.config.json` declaring the
// tier, and a PR-shaped branch whose head sha really exists in origin — cold-boot
// does a real `git fetch origin <sha>` and a real detached-worktree checkout, and
// nothing here fakes git.
//
// The PR diff adds `big.txt` with `diffLines` lines: at `regulated` the diff budget
// is 200 and `size:exception` is not honored, so >200 added lines trips exactly one
// deterministic finding (design D4) — the assertions on `/2` annotation can never
// pass vacuously.
//
// Everything the network would serve comes from `stub-data/` (read by the `gh` PATH
// stub); everything git-shaped is real.

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const BRAIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const git = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } }).trim();

/**
 * @param {{ tier?: string, diffLines?: number, handle?: string, author?: string, prNumber?: number, redJob?: string|null }} opts
 * `base` is the temp root the caller MUST remove — see `withFixture` in the test
 * file. Each fixture vendors brain/core + brain/scripts, measured at ~8 MB with the
 * clone and the bare origin, so seven un-cleaned runs leak ~57 MB per suite pass.
 *
 * `redJob` marks ONE required gate FAILURE in the canned rollup. It defaulted to
 * `'phase-order'` for as long as the diff-budget path was broken (#443) — with the
 * fix landed, the budget breach is the finding source again, as design D4 intended,
 * and `redJob` stays available as a second, gate-shaped source for #405/#408.
 *
 * @returns {{ base: string, repoDir: string, stubDir: string, headSha: string, baseSha: string, prNumber: number }}
 */

/**
 * A flat `brain/HOME.md` index linking every `brain/**\/*.md` in the vendored tree.
 *
 * `check-brain-nav.mjs` enforces two invariants: no broken links, and no orphan —
 * every `brain/**\/*.md` reachable transitively from HOME.md. A generated flat index
 * satisfies both for ANY core payload, so this fixture does not silently start
 * failing `brain:nav` the next time a doc lands in `brain/core/`.
 */
function buildHomeIndex(brainDir) {
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
    );
  const docs = walk(brainDir)
    .filter((f) => f.endsWith('.md') && !f.endsWith(`${sep}HOME.md`))
    .map((f) => relative(brainDir, f).split(sep).join('/'))
    .sort();
  return ['# HOME — fixture consumer', '', ...docs.map((d) => `- [${d}](${d})`), ''].join('\n');
}

export function buildFixture({
  tier = 'regulated',
  diffLines = 250,
  handle = 'stub-reviewer',
  author = 'alice',
  prNumber = 1,
  redJob = null,
  breakBase = false,
} = {}) {
  const base = mkdtempSync(join(tmpdir(), 'brain-rev-e2e-'));
  const originDir = join(base, 'origin.git');
  const repoDir = join(base, 'consumer');
  const stubDir = join(base, 'stub-data');
  mkdirSync(originDir, { recursive: true });
  mkdirSync(repoDir, { recursive: true });
  mkdirSync(stubDir, { recursive: true });

  git(originDir, 'init', '--bare', '--initial-branch=main');
  git(repoDir, 'init', '--initial-branch=main');
  git(repoDir, 'config', 'user.email', 'fixture@example.test');
  git(repoDir, 'config', 'user.name', 'Fixture Consumer');
  git(repoDir, 'remote', 'add', 'origin', originDir);

  // The consumer tree: vendored brain + its own config. `commitBaseline` below is
  // what a consumer's default branch looks like after adopt + first upgrade.
  cpSync(join(BRAIN_ROOT, 'brain', 'core'), join(repoDir, 'brain', 'core'), { recursive: true });
  cpSync(join(BRAIN_ROOT, 'brain', 'scripts'), join(repoDir, 'brain', 'scripts'), { recursive: true });
  mkdirSync(join(repoDir, '.memory', 'records'), { recursive: true });
  writeFileSync(join(repoDir, '.memory', 'records', '.gitkeep'), '');
  writeFileSync(join(repoDir, 'README.md'), '# fixture consumer\n');
  // brain/HOME.md — issue #408. It is neither `managed` nor `local` in
  // managed-paths.mjs: a real consumer's is written by `brain:env:init` at adopt
  // time, so a fixture that vendors brain/core WITHOUT it is not a consumer after
  // adopt — it is a consumer mid-adopt, and `brain:nav` fails on it for that reason
  // alone. That mattered the moment a base probe started RUNNING `brain:nav`
  // (#408): every fixture would have reported "the tree was already broken", which
  // is true of the fixture and false of the thing it models.
  //
  // GENERATED, not copied. brain's own HOME.md links `brain/project/decisions/**`,
  // which is `local` and not vendored here — copying it would trade an orphan
  // failure for a broken-link one. A flat index over whatever `brain/**` actually
  // contains satisfies both nav invariants by construction, whatever ships in core.
  writeFileSync(join(repoDir, 'brain', 'HOME.md'), buildHomeIndex(join(repoDir, 'brain')));
  writeFileSync(join(repoDir, 'brain.config.json'), JSON.stringify({
    schemaVersion: '1.0.0',
    project: { slug: 'fixture/consumer', name: 'fixture-consumer', gitHost: 'github.com' },
    vcs: { provider: 'github' },
    reviewer: { handle, tokenEnv: 'BRAIN_REVIEWER_TOKEN' },
    governance: { tier, ignoreList: [] },
  }, null, 2) + '\n');

  // `breakBase` (issue #408): the baseline commit carries a defect the PR does NOT
  // introduce and does NOT fix — a broken wikilink in the index, which `brain:nav`
  // rejects. This is what makes `gate:local-checks` honestly INHERITED: the base
  // probe re-runs the gate at this commit and finds it already red.
  if (breakBase) {
    writeFileSync(
      join(repoDir, 'brain', 'HOME.md'),
      buildHomeIndex(join(repoDir, 'brain')) + '\n- [roto](core/no-existe-en-el-base.md)\n',
    );
  }

  git(repoDir, 'add', '-A');
  git(repoDir, 'commit', '-q', '-m', 'baseline: consumer after adopt');
  git(repoDir, 'push', '-q', 'origin', 'main');
  const baseSha = git(repoDir, 'rev-parse', 'HEAD');

  // The "PR": a real branch in origin whose diff breaches regulated's 200 budget.
  git(repoDir, 'checkout', '-q', '-b', `pr-${prNumber}`);
  writeFileSync(join(repoDir, 'big.txt'), Array.from({ length: diffLines }, (_, i) => `line ${i}`).join('\n') + '\n');
  git(repoDir, 'add', 'big.txt');
  git(repoDir, 'commit', '-q', '-m', 'feat: the PR under review');
  git(repoDir, 'push', '-q', 'origin', `pr-${prNumber}`);
  const headSha = git(repoDir, 'rev-parse', 'HEAD');
  git(repoDir, 'checkout', '-q', 'main');

  // ── canned network responses (the gh stub serves these verbatim) ──────────
  const j = (name, obj) => writeFileSync(join(stubDir, name), JSON.stringify(obj, null, 2) + '\n');
  j('user.json', { login: handle });
  j('prview.json', {
    number: prNumber,
    labels: [],
    body: 'Fixture PR body.\n\nCloses #1',
    author: { login: author },
    headRefOid: headSha,
  });
  writeFileSync(join(stubDir, 'basesha.txt'), baseSha + '\n');
  const jobs = [
    'issue-link', 'local-checks', 'decision-gate', 'diff-size',
    'actor-check', 'brain-writes-reviewed', 'memory-gate', 'phase-order',
  ];
  // Every gate green by default (#443 landed): the deterministic finding of
  // design D4 is the DIFF-BUDGET BREACH again — 250 lines against regulated's
  // 200 — which is what this harness was designed around. The e2e's FIRST RUN
  // had found tranche.mjs's LINE_BUDGET hardcoded at 400 (untiered), so until
  // that was fixed a red required gate stood in as the finding path.
  // `redJob` is still honored when a caller passes one.
  j('rollup.json', {
    statusCheckRollup: jobs.map(name => ({
      name,
      status: 'COMPLETED',
      conclusion: name === redJob ? 'FAILURE' : 'SUCCESS',
    })),
  });
  j('reviews.json', []);
  j('events.json', []);
  j('commits.json', [{
    sha: headSha,
    author: { login: author },
    commit: { author: { date: new Date(2026, 0, 1).toISOString() } },
  }]);
  j('labels.json', []);

  return { base, repoDir, stubDir, headSha, baseSha, prNumber };
}
