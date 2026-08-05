#!/usr/bin/env node
// TEMPORARY — companion to .github/workflows/zz-issue-462-halt-proof.yml (#462).
// Removed with it once the halt path has been proven on a real run.
//
// Extracts the `run: |` body of the step whose `id:` is `window` out of the REAL
// governance-postmerge.yml and writes it to $RUNNER_TEMP/window-step.sh, so the
// proof executes the shipped halt path verbatim instead of a copy that can drift.
// Same pure text-parse as extractRunScript() in
// brain/scripts/vcs/release-postmerge-workflows.test.mjs (js-yaml is not a dep).

import { readFileSync, writeFileSync } from 'node:fs';

const YML = '.github/workflows/governance-postmerge.yml';
const STEP_ID = 'window';

const lines = readFileSync(YML, 'utf8').split('\n');

const stepIdx = lines.findIndex((l) => l.trim() === `- id: ${STEP_ID}`);
if (stepIdx === -1) {
  process.stderr.write(`extract: step id '${STEP_ID}' not found in ${YML}\n`);
  process.exit(1);
}

let runIdx = -1;
for (let j = stepIdx + 1; j < lines.length; j += 1) {
  if (/^\s*run:\s*\|\s*$/.test(lines[j])) { runIdx = j; break; }
}
if (runIdx === -1) {
  process.stderr.write(`extract: step '${STEP_ID}' has no 'run: |' block\n`);
  process.exit(1);
}

const runIndent = lines[runIdx].search(/\S/);
const body = [];
for (let j = runIdx + 1; j < lines.length; j += 1) {
  const l = lines[j];
  if (l.trim() === '') { body.push(''); continue; }
  if (l.search(/\S/) <= runIndent) break;
  body.push(l.slice(runIndent + 2));
}

const out = `${process.env.RUNNER_TEMP}/window-step.sh`;
writeFileSync(out, `${body.join('\n')}\n`);
process.stdout.write(`extracted ${body.length} lines of the real '${STEP_ID}' step -> ${out}\n`);
