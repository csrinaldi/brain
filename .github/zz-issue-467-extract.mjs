#!/usr/bin/env node
// TEMPORARY — companion to .github/workflows/zz-issue-467-audit-token-proof.yml.
// Removed once the audit step's authentication has been proven on a real run;
// the durable evidence is the run URL recorded on the PR and on #467.
//
// Same discipline as the #462 harness (e02445b): the proof must execute the
// SHIPPED step, not a copy that can drift. This extracts, out of a REAL
// governance-postmerge.yml, both halves of the `audit` step:
//
//   --emit run  -> the dedented `run: |` body            ($OUT)
//   --emit env  -> `export K=V` lines for its `env:` map  ($OUT)
//
// The env half is the whole point: #467 is a MISSING `env:` block, so a proof
// that hardcodes the token proves nothing. Whatever the shipped step declares
// is what the extracted script gets — no more.
//
// Two faithful emulations of what GitHub Actions itself does before running a
// step, and nothing else:
//   • `${{ steps.window.outputs.range }}` in the run body is replaced with the
//     value of --range (Actions splices step outputs the same way).
//   • `${{ github.token }}` in an env value becomes ${HARNESS_GITHUB_TOKEN},
//     supplied by the harness workflow as ${{ github.token }} — the runner has
//     no other token in scope.
// Any OTHER `${{ … }}` expression is a hard error: a silently mis-emulated
// expression would make the proof lie.
//
// Usage:
//   node .github/zz-issue-467-extract.mjs --yaml <file> --step audit \
//        --emit run|env --out <file> [--range <git-range>]

import { readFileSync, writeFileSync } from 'node:fs';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1];
}

function die(msg) {
  process.stderr.write(`extract: ${msg}\n`);
  process.exit(1);
}

const yamlPath = arg('yaml') || die('--yaml is required');
const stepId = arg('step') || die('--step is required');
const emit = arg('emit') || die('--emit run|env is required');
const outPath = arg('out') || die('--out is required');
const range = arg('range', '');

const lines = readFileSync(yamlPath, 'utf8').split('\n');

// ── Bound the step ─────────────────────────────────────────────────────────
// A step starts at `- id:` / `- name:` / `- uses:` and ends at the next one at
// the same indent. Bounding matters: without it, an `env:` belonging to a LATER
// step (revert, uncomputable — both of which DO have one) would be attributed
// to this step and the proof would report a token that is not there.
const startIdx = lines.findIndex((l) => l.trim() === `- id: ${stepId}`);
if (startIdx === -1) die(`step id '${stepId}' not found in ${yamlPath}`);
const stepIndent = lines[startIdx].indexOf('- ');
let endIdx = lines.length;
for (let j = startIdx + 1; j < lines.length; j += 1) {
  const l = lines[j];
  if (l.trim() && l.indexOf('- ') === stepIndent && /^\s*- /.test(l)) { endIdx = j; break; }
}
const step = lines.slice(startIdx, endIdx);

/** Dedented body of a `<key>: |` block inside the step, or null when absent. */
function blockBody(key) {
  const i = step.findIndex((l) => new RegExp(`^\\s*${key}:\\s*\\|\\s*$`).test(l));
  if (i === -1) return null;
  const indent = step[i].search(/\S/);
  const body = [];
  for (let j = i + 1; j < step.length; j += 1) {
    const l = step[j];
    if (l.trim() === '') { body.push(''); continue; }
    if (l.search(/\S/) <= indent) break;
    body.push(l.slice(indent + 2));
  }
  return body.join('\n');
}

if (emit === 'run') {
  const body = blockBody('run');
  if (body === null) die(`step '${stepId}' has no 'run: |' block`);
  const spliced = body.replaceAll('${{ steps.window.outputs.range }}', range);
  const leftover = spliced.match(/\$\{\{[^}]*\}\}/);
  if (leftover) die(`un-emulated Actions expression in the run body: ${leftover[0]}`);
  writeFileSync(outPath, `${spliced}\n`);
  process.stdout.write(`extracted the real '${stepId}' run: block (${spliced.split('\n').length} lines) -> ${outPath}\n`);
  process.exit(0);
}

if (emit === 'env') {
  // `env:` as a block mapping (`env:\n  KEY: value`), the form every step in
  // governance-postmerge.yml uses.
  const i = step.findIndex((l) => /^\s*env:\s*$/.test(l));
  const exports = [];
  if (i !== -1) {
    const indent = step[i].search(/\S/);
    for (let j = i + 1; j < step.length; j += 1) {
      const l = step[j];
      if (l.trim() === '') continue;
      if (l.search(/\S/) <= indent) break;
      if (/^\s*#/.test(l.trim())) continue;
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
      if (!m) die(`unparsed env line in step '${stepId}': ${l}`);
      const [, key, rawValue] = m;
      let value = rawValue.trim().replace(/^['"]|['"]$/g, '');
      if (value === '${{ github.token }}') value = '${HARNESS_GITHUB_TOKEN}';
      else if (/\$\{\{/.test(value)) die(`un-emulated Actions expression in env ${key}: ${value}`);
      exports.push(`export ${key}="${value}"`);
    }
  }
  writeFileSync(outPath, exports.length ? `${exports.join('\n')}\n` : '# (the step declares no env: block)\n');
  process.stdout.write(`extracted ${exports.length} env binding(s) from the real '${stepId}' step -> ${outPath}\n`);
  for (const e of exports) process.stdout.write(`  ${e.replace(/\$\{HARNESS_GITHUB_TOKEN\}/, '<token>')}\n`);
  process.exit(0);
}

die(`--emit must be 'run' or 'env', got '${emit}'`);
