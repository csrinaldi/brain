#!/usr/bin/env node
// ticket-start.mjs — Take an issue and create the working branch.
// Provider-agnostic: fetches the issue and the base branch through the VCS
// adapter (scripts/vcs/cli.mjs), so it works with GitHub, GitLab, or any host
// configured via vcs.provider in brain.config.json.
//
// Usage: npm run ticket:start -- <id>                 (in-place checkout from main)
//        npm run ticket:start -- <id> --worktree      (isolated worktree from main)
//        npm run ticket:start -- <id> --base <branch> (different base, e.g. a story tracker)
//        node scripts/ticket-start.mjs <id> [--worktree] [--base <branch>]

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { loadBrainConfig } from './lib/brain-config.mjs';
import { getVcs, resolveProviderName } from './vcs/cli.mjs';
import { originIdentity } from './vcs/lib/repo.mjs';
import { vcsToken, readEnvVar } from './vcs/lib/token.mjs';
import { t } from './i18n/t.mjs';
import { tryFeatureResume } from './memory/lib/auto-resume.mjs';

const ROOT = process.cwd();

const argv = process.argv.slice(2);
const useWorktree = argv.includes('--worktree');
const baseIdx = argv.indexOf('--base');
const baseBranch = baseIdx >= 0 ? argv[baseIdx + 1] : 'main';
if (baseIdx >= 0 && !baseBranch) {
  console.error(`  ${await t('ticket.error.baseRequiresArg')}`);
  process.exit(1);
}
// id = first numeric argument that is NOT the value of --base
const id = argv.find((a, i) => /^\d+$/.test(a) && (baseIdx < 0 || i !== baseIdx + 1));
if (!id) {
  console.error(await t('ticket.error.usage'));
  console.error(await t('ticket.error.usageExample1'));
  console.error(await t('ticket.error.usageExample2'));
  process.exit(1);
}

const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: ROOT, stdio: 'pipe', ...opts });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};

// ── Resolve the VCS provider + repo identity ──────────────────────────────────
const { host, project } = originIdentity();
if (!project) {
  console.error(`  ${await t('ticket.error.noRemote')}`);
  process.exit(1);
}

let vcsProvider;
let vcs;
try {
  const config = loadBrainConfig();
  vcsProvider = resolveProviderName({ config });
  vcs = await getVcs({ config });
} catch (e) {
  console.error(`  ${await t('ticket.error.vcsInit', { message: e.message })}`);
  process.exit(1);
}

const token = vcsToken(vcsProvider, ROOT);
if (!token) {
  console.error(`  ${await t('ticket.error.tokenNotFound')}`);
  process.exit(1);
}

// Propagate NO_PROXY from .env so Go binaries (gh/glab) bypass the internal proxy.
const noProxy = readEnvVar('NO_PROXY', ROOT) ?? readEnvVar('no_proxy', ROOT);
if (noProxy) {
  process.env.NO_PROXY = noProxy;
  process.env.no_proxy = noProxy;
}

// ── Fetch the issue through the adapter ───────────────────────────────────────
console.log(`\n  ${await t('ticket.fetching', { id })}`);
let issue;
try {
  issue = await vcs.issueView({ project, number: id });
} catch (e) {
  console.error(`  ${await t('ticket.error.fetchFailed', { id, message: e.message })}`);
  process.exit(1);
}
if (!issue?.number) {
  console.error(`  ${await t('ticket.error.notFound', { id, project })}`);
  process.exit(1);
}

// ── Determine the branch type from labels ─────────────────────────────────────
const LABEL_TYPE = {
  feat: 'feat', feature: 'feat',
  fix: 'fix', bug: 'fix',
  chore: 'chore',
  docs: 'docs',
  refactor: 'refactor',
  ci: 'ci',
  build: 'build',
};
const labels = issue.labels ?? [];
const branchType = labels.map(l => LABEL_TYPE[String(l).toLowerCase()]).find(Boolean) ?? 'feat';

// ── Build the slug from the title ─────────────────────────────────────────────
const slug = issue.title
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s-]/g, '')
  .trim()
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .slice(0, 40)
  .replace(/-$/, '');

const branchName = `${branchType}/issue-${issue.number}-${slug}`;

// ── Show the issue context ────────────────────────────────────────────────────
console.log('');
console.log(`  #${issue.number}  ${issue.title}`);
if (labels.length > 0) console.log(`  ${await t('ticket.labels', { labels: labels.join(', ') })}`);
if (issue.body?.trim()) {
  const preview = issue.body.trim().split('\n').slice(0, 6).join('\n');
  console.log('\n' + preview.split('\n').map(l => `  ${l}`).join('\n'));
}
console.log(`\n  \x1b[1m${await t('ticket.branch', { branch: branchName })}\x1b[0m`);

// ── Update the base branch ────────────────────────────────────────────────────
console.log(`\n  ${await t('ticket.updatingBase', { base: baseBranch })}`);
const authenticatedRemote = await vcs.repoCloneUrl({ host, project, token });
const fetchRes = spawnSync('git',
  ['fetch', authenticatedRemote, `${baseBranch}:refs/remotes/origin/${baseBranch}`],
  { cwd: ROOT, encoding: 'utf8' });
if (fetchRes.status !== 0) {
  console.error(`  ${await t('ticket.error.fetchBase', { branch: baseBranch })}`);
  console.error(await t('ticket.error.fetchBaseHint'));
  process.exit(1);
}
const startPoint = `origin/${baseBranch}`;

// ── Create the branch ─────────────────────────────────────────────────────────
// Two modes: in-place (checkout on the current working tree) or an isolated
// worktree (sibling folder with its own branch, for parallel work without clashes).
const branchExists = sh('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}`]).ok;
let worktreePath = null;

if (useWorktree) {
  worktreePath = join(dirname(ROOT), `${basename(ROOT)}-issue-${id}`);

  if (existsSync(worktreePath)) {
    console.error(`  ${await t('ticket.error.worktreeExists', { path: worktreePath })}`);
    console.error(await t('ticket.error.worktreeExistsHint'));
    process.exit(1);
  }

  // If the branch already exists, attach it to the worktree; otherwise create it from the base.
  const wtArgs = branchExists
    ? ['worktree', 'add', worktreePath, branchName]
    : ['worktree', 'add', worktreePath, '-b', branchName, startPoint];
  const wt = sh('git', wtArgs);
  if (!wt.ok) {
    console.error(`  ${await t('ticket.error.worktreeCreate', { error: wt.err })}`);
    process.exit(1);
  }
  console.log(`  ${await t('ticket.worktreeCreated', { path: worktreePath })}`);

  // Auto-resume: when attaching to an existing branch, surface the feature context.
  // tryFeatureResume is fully isolated — any failure returns null, never throws.
  if (branchExists) {
    const resumeOutput = tryFeatureResume(worktreePath);
    if (resumeOutput != null) {
      console.log(resumeOutput);
    } else {
      console.log(`  ${await t('ticket.resume.noContext')}`);
    }
  }

  // Gotcha: the worktree does NOT inherit untracked/ignored files like .env (which
  // holds the VCS token, needed by this script and the adapter). Copy it over.
  const srcEnv = join(ROOT, '.env');
  if (existsSync(srcEnv)) {
    copyFileSync(srcEnv, join(worktreePath, '.env'));
    console.log(`  ${await t('ticket.envCopied')}`);
  } else {
    console.log(`  ${await t('ticket.noEnv', { root: ROOT })}`);
  }
} else {
  const create = sh('git', ['checkout', '-b', branchName, startPoint]);
  if (!create.ok) {
    if (branchExists || create.err.includes('already exists')) {
      console.log(`  ${await t('ticket.branchExists')}`);
      spawnSync('git', ['checkout', branchName], { stdio: 'inherit', cwd: ROOT });
      // Auto-resume: surface feature context when re-checking out an existing branch.
      // tryFeatureResume is fully isolated — any failure returns null, never throws.
      const resumeOutput = tryFeatureResume(ROOT);
      if (resumeOutput != null) {
        console.log(resumeOutput);
      } else {
        console.log(`  ${await t('ticket.resume.noContext')}`);
      }
    } else {
      console.error(`  ${await t('ticket.error.branchCreate', { error: create.err })}`);
      process.exit(1);
    }
  } else {
    console.log(`  ${await t('ticket.branchCreated')}`);
  }
}

// ── Next steps ────────────────────────────────────────────────────────────────
const cdStep = useWorktree
  ? `\n${await t('ticket.nextSteps.cd', { path: worktreePath })}`
  : '';
console.log(`
  ${await t('ticket.nextSteps.header')}${cdStep}
${await t('ticket.nextSteps.step1', { id })}
${await t('ticket.nextSteps.step2')}
${await t('ticket.nextSteps.step3')}
${await t('ticket.nextSteps.step4', { branch: branchName })}
`);
