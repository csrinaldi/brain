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
// Run with: npm run brain:repo:check  (deprecated alias: npm run repo:check)

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CHANGES_ROOT, missingRequiredArtifacts, isGrandfathered } from './lib/sdd-layout.mjs';
import { resolveTier, requiredArtifactsFor } from './vcs/governance-tiers.mjs';

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

// S-1: every active, non-grandfathered change in openspec/changes/ must carry
// the artifacts ITS DECLARED TIER requires — the B0
// contract (sdd-layout.mjs), enforced here (#595 pin 1). Behavior-preserving
// over the frozen corpus + B0-contract enforcement going forward — NEVER
// "pure wiring": every frozen dir already carries all 4 artifacts (see
// lib/sdd-layout.golden.json, issue #253/B1), so this changes nothing
// today; it is latent-stricter for any future incomplete dir.
const changesDir = join(ROOT, CHANGES_ROOT);
if (existsSync(changesDir)) {
  const fsSeam = {
    exists: (p) => existsSync(join(ROOT, p)),
    listDir: (p) => readdirSync(join(ROOT, p)),
  };
  // #555 — DECISION, recorded because the ticket demands it rather than assumed.
  // This check runs inside `local-checks`, which knows no tier in its current form,
  // so a choice had to be made: tier it, or leave it fixed and declare the
  // divergence. IT IS TIERED, and not for symmetry — leaving it fixed only RELOCATES
  // the defect. `phase-order` is tiered (#358 Q5), so at `lite` a change carrying
  // only `spec.md` would pass that gate and fail this one, which is the exact
  // "same change passes one gate and blocks on another" this fix exists to remove.
  //
  // The tier comes from the same `resolveTier(loadBrainConfig())` every other
  // consumer uses, and `resolveTier` returns `standard` when `governance.tier` is
  // absent (REQ-TIER-10) — so a repo that declares nothing keeps today's stricter
  // behaviour byte for byte. The loosening only reaches a repo that ASKED for it.
  // The tier of the repo UNDER CHECK, read from ROOT — not `loadBrainConfig()`,
  // which resolves its path from its own module location. In a consumer install
  // those coincide; here they do not, and the first cut of this fix read THIS
  // repo's tier while validating a different tree. A fixture caught it.
  //
  // Absent or unreadable config falls back to `standard`, matching `resolveTier`'s
  // own default (REQ-TIER-10): a repo that declares nothing keeps the stricter set,
  // so the loosening only ever reaches a repo that asked for it.
  let declaredTier = 'standard';
  try {
    declaredTier = resolveTier(JSON.parse(readFileSync(join(ROOT, 'brain.config.json'), 'utf8')));
  } catch { /* absent or malformed — the stricter default stands */ }
  const declaredArtefacts = requiredArtifactsFor(declaredTier);
  for (const entry of readdirSync(changesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'archive') continue;
    if (isGrandfathered(entry.name)) continue;
    const missing = missingRequiredArtifacts(entry.name, { artefacts: declaredArtefacts, ...fsSeam });
    if (missing.length > 0) {
      structViolations.push({
        path: `${CHANGES_ROOT}/${entry.name}`,
        rule: 'openspec-incomplete',
        reason:
          `Active change missing ${missing.join(', ')} — required by the SDD workflow ` +
          '(see brain/core/methodology/sdd-layout.md).',
      });
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
