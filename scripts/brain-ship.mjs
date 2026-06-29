#!/usr/bin/env node
// brain-ship.mjs — Golden-path verb: verify checks then open the PR (REQ-S5-4).
//
// Usage: npm run brain:ship
//   1. Runs brain:check (all 4 governance checks + npm test + repo:check).
//   2. Exits non-zero if any check fails.
//   3. Creates a PR via the configured VCS provider's mrCreate() verb:
//        • Title derived from branch name
//        • Body = PR template + `Closes #<issue>` footer + labels
//   4. Prints the PR URL on success.
//
// The script performs NO action on import — side effects are guarded at the bottom.

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── helpers ───────────────────────────────────────────────────────────────────

function git(args, cwd = process.cwd()) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function readTemplate(repoRoot) {
  const tmpl = resolve(repoRoot, '.github/PULL_REQUEST_TEMPLATE.md');
  if (existsSync(tmpl)) return readFileSync(tmpl, 'utf8');
  return '<!-- PR template not found -->';
}

function buildPRBody(template, issueNumber) {
  return `${template.trim()}\n\nCloses #${issueNumber}\n`;
}

function titleFromBranch(branch) {
  // e.g. feature/42-add-cli-i18n → "add cli i18n"
  return branch
    .replace(/^.*\/\d+-/, '')   // strip prefix up to and including <number>-
    .replace(/-/g, ' ')
    .trim() || branch;
}

// ── core logic (injectable for tests) ────────────────────────────────────────

/**
 * Run the brain:ship flow.
 *
 * @param {object} ctx
 * @param {string}   ctx.issueNumber   Issue number (string).
 * @param {string}   ctx.project       VCS project slug.
 * @param {string}   ctx.branchName    Current git branch.
 * @param {string}   ctx.base          Target base branch (default: 'main').
 * @param {Function} ctx.checkFn       Async fn() → {ok, output?}. Injected for tests.
 * @param {Function} ctx.mrCreateFn    Async fn({title,body,head,base,labels}) → {url,error?}.
 * @returns {Promise<{exitCode:number, message:string, url?:string}>}
 */
export async function runShip({
  issueNumber,
  project,
  branchName,
  base = 'main',
  checkFn,
  mrCreateFn,
  template = '',
}) {
  // Step 1: run all checks
  const checkResult = await checkFn();
  if (!checkResult.ok) {
    return {
      exitCode: 1,
      message:
        `brain:ship: checks failed — fix them before shipping.\n` +
        `  Run "npm run brain:check" for details.\n` +
        (checkResult.output ? `  Output: ${checkResult.output}` : ''),
    };
  }

  // Step 2: build PR body
  const body = buildPRBody(template, issueNumber);
  const title = titleFromBranch(branchName);

  // Step 3: create PR
  const mrResult = await mrCreateFn({
    title,
    body,
    head: branchName,
    base,
    labels: ['kind:feature'],
  });

  if (!mrResult.url) {
    return {
      exitCode: 1,
      message: `brain:ship: PR creation failed — ${mrResult.error ?? 'unknown error'}`,
    };
  }

  return {
    exitCode: 0,
    url: mrResult.url,
    message: `brain:ship: PR opened → ${mrResult.url}`,
  };
}

// ── CLI entry-point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cwd = process.cwd();
  const repoRoot = resolve(__dirname, '..');

  // Read config
  let config;
  try {
    config = JSON.parse(readFileSync(resolve(repoRoot, 'brain.config.json'), 'utf8'));
  } catch (e) {
    console.error(`brain:ship: cannot read brain.config.json — ${e.message}`);
    process.exit(1);
  }

  const provider = config?.vcs?.provider;
  const project = config?.project?.slug;
  if (!provider || !project) {
    console.error('brain:ship: vcs.provider and project.slug must be set in brain.config.json');
    process.exit(1);
  }

  let providerModule;
  try {
    providerModule = await import(`./vcs/providers/${provider}.mjs`);
  } catch (e) {
    console.error(`brain:ship: cannot load provider "${provider}" — ${e.message}`);
    process.exit(1);
  }

  const branch = git('rev-parse --abbrev-ref HEAD', cwd);
  if (!branch || branch === 'HEAD') {
    console.error('brain:ship: not on a named branch — run brain:start first');
    process.exit(1);
  }

  // Extract issue number from branch name (feature/<number>-<slug>)
  const issueMatch = branch.match(/\/(\d+)-/);
  const issueNumber = issueMatch ? issueMatch[1] : '0';

  const template = readTemplate(repoRoot);

  const result = await runShip({
    issueNumber,
    project,
    branchName: branch,
    base: config?.project?.defaultBranch ?? 'main',
    template,
    checkFn: async () => {
      const r = spawnSync('npm', ['run', 'brain:check'], { encoding: 'utf8', cwd, stdio: 'inherit' });
      return { ok: r.status === 0 };
    },
    mrCreateFn: (args) => providerModule.mrCreate({ project, ...args }),
  });

  if (result.exitCode === 0) {
    console.log(result.message);
  } else {
    console.error(result.message);
  }
  process.exit(result.exitCode);
}
