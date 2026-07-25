#!/usr/bin/env node
// brain-check.mjs — Golden-path verb: run the 4 governance checks + tests + repo:check (REQ-S5-2).
//
// Usage: npm run brain:check
//   Runs the 4 generic checks (diffSize, issueLink, adrPresence, memoryPresence)
//   against the current branch's diff vs base (origin/main), then runs:
//     • npm test          — full test suite
//     • npm run brain:repo:check — prohibited-reference check
//   Aggregates results and exits non-zero if any check fails.
//
// The script performs NO action on import — side effects are guarded at the bottom.

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { diffSize } from './governance/checks/diff-size.mjs';
import { issueLink } from './governance/checks/issue-link.mjs';
import { adrPresence } from './governance/checks/adr-presence.mjs';
import { memoryPresence } from './governance/checks/memory-presence.mjs';
import { readRecordObservations } from './memory/lib/store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── helpers ───────────────────────────────────────────────────────────────────

function git(args, cwd = process.cwd()) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function loadIgnoreList(cwd) {
  try {
    const cfg = JSON.parse(readFileSync(resolve(cwd, 'brain.config.json'), 'utf8'));
    return Array.isArray(cfg?.governance?.ignoreList) ? cfg.governance.ignoreList : [];
  } catch {
    return [];
  }
}

function getBase(cwd) {
  try {
    execSync('git rev-parse origin/main', { encoding: 'utf8', cwd, stdio: 'pipe' });
    return git('merge-base HEAD origin/main', cwd) || 'HEAD';
  } catch {
    return 'HEAD';
  }
}

function spawnCommand(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd });
  return { ok: r.status === 0, output: (r.stdout ?? '') + (r.stderr ?? '') };
}

// ── core logic (injectable for tests) ────────────────────────────────────────

/**
 * Run all governance checks.
 *
 * @param {object}   ctx
 * @param {string}   ctx.numstat       Raw `git diff --numstat` output.
 * @param {string[]} ctx.changedFiles  Files from `git diff --name-only`.
 * @param {string}   ctx.prBody        Latest commit body (for issueLink check).
 * @param {string[]} ctx.ignoreList    brain.config.json governance.ignoreList.
 * @param {Array}    ctx.observations  Parsed engram observations for memoryPresence.
 *   Injected by tests or read from .memory/chunks/ in the CLI entry-point.
 * @param {Function} ctx.npmTestFn     Async fn() → {ok,output}. Injected for tests.
 * @param {Function} ctx.repoCheckFn   Async fn() → {ok,output}. Injected for tests.
 * @returns {Promise<{exitCode:number, failures:Array, summary:string}>}
 */
export async function runCheck({
  numstat,
  changedFiles,
  prBody,
  ignoreList,
  observations = [],
  npmTestFn,
  repoCheckFn,
}) {
  const checks = [
    { check: 'diffSize',        result: diffSize(numstat, ignoreList) },
    { check: 'issueLink',       result: issueLink(prBody) },
    { check: 'adrPresence',     result: adrPresence(changedFiles) },
    { check: 'memoryPresence',  result: memoryPresence(observations) },
  ];

  // Run async checks
  const [npmResult, repoResult] = await Promise.all([npmTestFn(), repoCheckFn()]);
  if (!npmResult.ok) checks.push({ check: 'npmTest', result: { pass: false, reason: npmResult.output?.split('\n').slice(-3).join(' ') || 'npm test failed' } });
  if (!repoResult.ok) checks.push({ check: 'repoCheck', result: { pass: false, reason: repoResult.output?.split('\n').slice(-3).join(' ') || 'repo:check failed' } });
  // Ensure passing async checks are represented
  if (npmResult.ok) checks.push({ check: 'npmTest', result: { pass: true } });
  if (repoResult.ok) checks.push({ check: 'repoCheck', result: { pass: true } });

  const failures = checks
    .filter(c => !c.result.pass)
    .map(c => ({ check: c.check, reason: c.result.reason }));

  const lines = checks.map(c =>
    `  [${c.result.pass ? 'PASS' : 'FAIL'}] ${c.check}${c.result.reason ? ` — ${c.result.reason}` : ''}`
  );

  const summary = lines.join('\n');
  return { exitCode: failures.length > 0 ? 1 : 0, failures, summary };
}

// ── CLI entry-point ───────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cwd = process.cwd();
  const base = getBase(cwd);
  const numstat = git(`diff --numstat ${base} HEAD`, cwd);
  const changedFiles = git(`diff --name-only ${base} HEAD`, cwd).split('\n').filter(Boolean);
  // Use the last commit body as the PR body proxy for issueLink check.
  const prBody = git('log -1 --format=%B HEAD', cwd);
  const ignoreList = loadIgnoreList(cwd);

  const observations = readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });

  const result = await runCheck({
    numstat,
    changedFiles,
    prBody,
    ignoreList,
    observations,
    npmTestFn: () => spawnCommand('npm', ['test'], cwd),
    repoCheckFn: () => spawnCommand('node', ['brain/scripts/check-refs.mjs'], cwd),
  });

  console.log('\nbrain:check results:\n');
  console.log(result.summary);
  console.log('');

  if (result.exitCode === 0) {
    console.log('All checks passed. Ready to brain:ship.');
  } else {
    console.error(`${result.failures.length} check(s) failed. Fix before brain:ship.`);
  }

  process.exit(result.exitCode);
}
