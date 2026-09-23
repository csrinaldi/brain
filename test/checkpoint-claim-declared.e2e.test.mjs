// checkpoint-claim-declared.e2e.test.mjs — every `checkpoint-report.md` in this
// tree, read by the reader that ships (issue #495 task 4.1).
//
// WHY THIS IS A TEST AND NOT A NOTE IN THE PR. The maintainer's ruling names the
// existing reports as the migration's FIRST test case: *"whatever 'unparseable
// and said so' looks like, it has to produce the right answer on them before this
// closes."* A number measured once in a terminal is a number nobody can
// re-measure; this re-measures on every run.
//
// WHAT IT ASSERTS, and it is deliberately not "17 of 17 are absent":
//
//   1. TOTALITY — every report yields a decided answer. `ok: true`, or `ok:
//      false` with a non-empty `error`. Never `null`, never `undefined`, never a
//      throw. That is ruling point 2 and it is the whole reason the reader has
//      three answers instead of two.
//   2. THE ARCHIVE IS FROZEN — every report under `openspec/changes/archive/**`
//      reads `absent`. Those are records of what was reported at the time; the
//      past is recorded, not edited, so they must never silently start parsing
//      because someone widened the reader.
//   3. NO SILENT MIS-PARSE — a report that DOES parse carries two non-negative
//      integers, so "it parsed" can never mean "it produced junk that looked
//      like a claim".
//
// It does NOT assert a count of in-flight reports. That number changes with
// every change dir opened, and a test that has to be edited whenever normal work
// happens gets edited without being read.
//
// This file lives under `test/` on purpose: it reads `openspec/changes/**`,
// which is absent from the published package (`files` allowlist, #607). A guard
// under `brain/scripts/**` would ship to consumers and fail there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCheckpointClaim } from '../brain/scripts/review/lib/checkpoint-block.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGES = join(repoRoot, 'openspec', 'changes');

/** Every `checkpoint-report.md` under `openspec/changes/**`, recursively. */
function reports(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) reports(full, acc);
    else if (entry === 'checkpoint-report.md') acc.push(full);
  }
  return acc;
}

test('#495: every checkpoint report in the tree gets a DECIDED answer — never null, never a throw', () => {
  const found = reports(CHANGES);
  assert.ok(found.length > 0, 'no checkpoint reports found — the walker is broken, not the tree');

  const undecided = [];
  for (const path of found) {
    const rel = relative(repoRoot, path);
    let r;
    try {
      r = parseCheckpointClaim(readFileSync(path, 'utf8'));
    } catch (err) {
      undecided.push(`${rel} — THREW: ${err.message}`);
      continue;
    }
    if (r === null || r === undefined) { undecided.push(`${rel} — answered ${String(r)}`); continue; }
    if (r.ok === true) {
      if (!Number.isInteger(r.countedLines) || r.countedLines < 0) undecided.push(`${rel} — ok with countedLines=${r.countedLines}`);
      if (!Number.isInteger(r.diffBudget) || r.diffBudget < 0) undecided.push(`${rel} — ok with diffBudget=${r.diffBudget}`);
      continue;
    }
    if (typeof r.error !== 'string' || r.error.length === 0) undecided.push(`${rel} — refused without a reason`);
  }

  assert.deepEqual(undecided, [],
    'A report the reader cannot decide about is the silence #495 removed, reintroduced by another door:\n' +
    undecided.map((u) => `  ${u}`).join('\n'));
});

test('#495: every ARCHIVED report older than #495 reads `absent` — the past is recorded, not edited', () => {
  const archived = reports(join(CHANGES, 'archive'));
  assert.ok(archived.length > 0, 'no archived reports found — the walker is broken, not the tree');

  // The rule is "predates #495", not "lives under archive/" — those were the
  // same set only until #557's sweep archived #495's own folder alongside
  // everything older. #495 is the issue that INTRODUCED the `brain-checkpoint/1`
  // declared form: commit 93f3853e added `checkpoint-block.mjs` and
  // `openspec/changes/archive/495/checkpoint-report.md` (now archived, but
  // `openspec/changes/issue-495-*/` at the time) in the same commit, and that
  // report carries the first ever declared block on purpose — dogfooded, per
  // its own prose ("This is the first checkpoint report in this repository
  // that the reviewer can read"). So `archive/495/` parsing is not the past
  // being edited; it is the boundary itself. The walk keys the boundary off
  // the archive folder's own numeric id (`archive/<id>/checkpoint-report.md`),
  // not off which reports happen to live in the folder today.
  const DECLARED_FORM_ISSUE = 495;
  const archiveRoot = join(CHANGES, 'archive');

  const surprises = archived
    .map((path) => {
      const idSegment = relative(archiveRoot, path).split(/[\\/]/)[0];
      const issueId = /^\d+$/.test(idSegment) ? Number(idSegment) : null;
      return { rel: relative(repoRoot, path), issueId, r: parseCheckpointClaim(readFileSync(path, 'utf8')) };
    })
    // Unresolvable/non-numeric archive folder ids stay under the old,
    // conservative rule (must read absent) rather than silently exempted.
    .filter(({ issueId }) => issueId === null || issueId < DECLARED_FORM_ISSUE)
    .filter(({ r }) => r.absent !== true)
    .map(({ rel, r }) => `${rel} — ${r.ok ? 'parsed a claim' : `refused as MALFORMED: ${r.error}`}`);

  assert.deepEqual(surprises, [],
    'Every report archived before #495 predates the declared form, so each must read as ABSENT — a\n' +
    'stated "this report makes no machine-readable claim", not a parsed claim and not a malformed one.\n' +
    'A reader that starts finding claims in these has gone back to inferring from prose:\n' +
    surprises.map((s) => `  ${s}`).join('\n'));
});
