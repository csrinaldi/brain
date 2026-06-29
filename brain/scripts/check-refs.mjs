#!/usr/bin/env node
// check-refs.mjs — Generic prohibited-reference validator.
//
// Fails (exit 1) if tracked files contain references that violate project rules.
// Historical/immutable records (brain/decisions, brain/audits) and draft files
// are globally exempt — they intentionally document what is no longer in use.
//
// Project-specific rules are loaded from brain/project/check-refs-rules.mjs:
//   export const prohibitedRefs = [...];   // rule objects
//   export const globalExempt   = [...];   // additional globally exempt paths
//
// If that file does not exist, the engine runs with structural checks only.
// See ADR-0007 for the design rationale.
//
// Run with: npm run repo:check

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// Base global exemptions — always applied regardless of project rules.
const BASE_GLOBAL_EXEMPT = [
  'brain/project/decisions/',
  'brain/project/audits/',
  'brain/project/methodology/_drafts/',
  'openspec/',
  'brain/scripts/check-refs.mjs',
  '.atl/',
  '.claude/settings.json',
];

// Load project-specific rules from brain/project/check-refs-rules.mjs (if present).
let projectRules = [];
let projectExempt = [];

const rulesPath = join(ROOT, 'brain/project/check-refs-rules.mjs');
if (existsSync(rulesPath)) {
  try {
    const mod = await import(pathToFileURL(rulesPath).href);
    projectRules = mod.prohibitedRefs ?? [];
    projectExempt = mod.globalExempt ?? [];
  } catch (err) {
    console.warn(`warn: could not load brain/project/check-refs-rules.mjs: ${err.message}`);
  }
}

const GLOBAL_EXEMPT = [...BASE_GLOBAL_EXEMPT, ...projectExempt];
const RULES = projectRules;

const isExempt = (file) =>
  GLOBAL_EXEMPT.some((p) => file === p || file.startsWith(p));

const ls = (cmd) => execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
const files = [...new Set([...ls('git ls-files'), ...ls('git ls-files --others --exclude-standard')])];

const violations = [];

for (const file of files) {
  if (isExempt(file)) continue;

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue; // binary or unreadable
  }

  const ext = file.slice(file.lastIndexOf('.'));
  const lines = content.split('\n');

  for (const rule of RULES) {
    if (rule.onlyExt && !rule.onlyExt.includes(ext)) continue;
    if (rule.exempt && rule.exempt.includes(file)) continue;

    lines.forEach((line, i) => {
      if (rule.pattern.test(line)) {
        violations.push({
          file,
          line: i + 1,
          rule: rule.id,
          reason: rule.reason,
          text: line.trim(),
        });
      }
    });
  }
}

// Structural validations (generic — always active)
const structViolations = [];

// S-1: every active change in openspec/changes/ must have proposal.md and tasks.md
const changesDir = join(ROOT, 'openspec/changes');
if (existsSync(changesDir)) {
  for (const entry of readdirSync(changesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'archive') continue;
    const dir = join(changesDir, entry.name);
    for (const required of ['proposal.md', 'tasks.md']) {
      if (!existsSync(join(dir, required))) {
        structViolations.push({
          path: `openspec/changes/${entry.name}/${required}`,
          rule: 'openspec-incomplete',
          reason: `Active change missing ${required} — required by the SDD workflow.`,
        });
      }
    }
  }
}

// S-2: files in brain/project/decisions/ must follow naming adr-NNNN-*.md
const decisionsDir = join(ROOT, 'brain/project/decisions');
if (existsSync(decisionsDir)) {
  for (const f of readdirSync(decisionsDir)) {
    if (!f.endsWith('.md')) continue;
    if (!/^adr-\d{4}-/.test(f)) {
      structViolations.push({
        path: `brain/project/decisions/${f}`,
        rule: 'adr-naming',
        reason: `File does not follow naming convention adr-NNNN-<slug>.md.`,
      });
    }
  }
}

// S-3: files in brain/*/anti-patterns/ must have at least 10 lines
for (const apDir of ['brain/core/anti-patterns', 'brain/project/anti-patterns']) {
  const antipatternsDir = join(ROOT, apDir);
  if (!existsSync(antipatternsDir)) continue;
  for (const f of readdirSync(antipatternsDir)) {
    if (!f.endsWith('.md') || f === 'README.md') continue;
    const content = readFileSync(join(antipatternsDir, f), 'utf8');
    const lines = content.split('\n').filter(Boolean).length;
    if (lines < 10) {
      structViolations.push({
        path: `${apDir}/${f}`,
        rule: 'anti-pattern-empty',
        reason: `Anti-pattern has ${lines} line(s) — minimum 10 to be useful.`,
      });
    }
  }
}

const totalErrors = violations.length + structViolations.length;

if (totalErrors === 0) {
  console.log('✓ No prohibited references found.');
  console.log('✓ Artifact structure is valid.');
  process.exit(0);
}

if (violations.length > 0) {
  console.error(`✗ ${violations.length} prohibited reference(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]`);
    console.error(`    ${v.reason}`);
    console.error(`    > ${v.text}\n`);
  }
}

if (structViolations.length > 0) {
  console.error(`✗ ${structViolations.length} structural problem(s):\n`);
  for (const v of structViolations) {
    console.error(`  ${v.path}  [${v.rule}]`);
    console.error(`    ${v.reason}\n`);
  }
}

process.exit(1);
