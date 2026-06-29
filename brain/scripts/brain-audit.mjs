#!/usr/bin/env node
// brain-audit.mjs — audit merged commits for governance invariants (REQ-S4-5, REQ-S4-6).
//
// Usage: node brain/scripts/brain-audit.mjs [<git-range>]
// Default range: origin/main..HEAD (falls back to HEAD if origin/main is absent).
//
// For each merge commit in the range, runs all 4 generic checks:
//   diffSize · issueLink · adrPresence · memoryPresence
//
// Output (one line per merge):
//   [PASS] <sha7> <subject>
//   [FAIL] <sha7> <subject> — <check>: <reason>; ...
//
// Exit: 0 when all pass, 1 when any fail.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { diffSize } from './governance/checks/diff-size.mjs';
import { issueLink } from './governance/checks/issue-link.mjs';
import { adrPresence } from './governance/checks/adr-presence.mjs';
import { memoryPresence } from './governance/checks/memory-presence.mjs';

function git(args, cwd = process.cwd()) {
  try {
    return execSync(`git ${args}`, { encoding: 'utf8', cwd, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

function loadIgnoreList(cwd) {
  try {
    const cfg = JSON.parse(readFileSync(join(cwd, 'brain.config.json'), 'utf8'));
    return Array.isArray(cfg?.governance?.ignoreList) ? cfg.governance.ignoreList : [];
  } catch {
    return [];
  }
}

function resolveRange(cwd) {
  const arg = process.argv[2];
  if (arg) return arg;
  try {
    execSync('git rev-parse origin/main', { encoding: 'utf8', cwd, stdio: 'pipe' });
    return 'origin/main..HEAD';
  } catch {
    return 'HEAD';
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cwd = process.cwd();
  const range = resolveRange(cwd);
  const ignoreList = loadIgnoreList(cwd);

  // --first-parent: audit only the INTEGRATION merges that landed on the audited
  // branch (e.g. main), NOT the nested slice merges inside a feature branch.
  // Nested slice merges legitimately carry "Part of #N" bodies and no per-slice
  // memory — auditing them produces false failures.  The integration merge (the
  // one that actually landed on main) is the canonical governance checkpoint.
  const log = git(`log --first-parent --merges --format=%H%x09%s ${range}`, cwd);
  if (!log) {
    console.log(`[INFO] No merge commits found in range: ${range}`);
    process.exit(0);
  }

  const merges = log.split('\n').filter(Boolean).map(line => {
    const i = line.indexOf('\t');
    return { sha: line.slice(0, i), subject: line.slice(i + 1) };
  });

  let anyFail = false;

  for (const { sha, subject } of merges) {
    const parents = git(`log -1 --format=%P ${sha}`, cwd).split(/\s+/).filter(Boolean);
    const parent1 = parents[0];
    if (!parent1) {
      console.log(`[SKIP] ${sha.slice(0, 7)} ${subject} — no parent`);
      continue;
    }

    const numstat = git(`diff --numstat ${parent1} ${sha}`, cwd);
    const changedFiles = git(`diff --name-only ${parent1} ${sha}`, cwd)
      .split('\n').filter(Boolean);
    const body = git(`log -1 --format=%B ${sha}`, cwd);

    const results = {
      diffSize: diffSize(numstat, ignoreList),
      issueLink: issueLink(body),
      adrPresence: adrPresence(changedFiles),
      memoryPresence: memoryPresence(changedFiles),
    };

    const failures = Object.entries(results)
      .filter(([, r]) => !r.pass)
      .map(([name, r]) => `${name}: ${r.reason}`);

    if (failures.length === 0) {
      console.log(`[PASS] ${sha.slice(0, 7)} ${subject}`);
    } else {
      anyFail = true;
      console.log(`[FAIL] ${sha.slice(0, 7)} ${subject} — ${failures.join('; ')}`);
    }
  }

  process.exit(anyFail ? 1 : 0);
}
