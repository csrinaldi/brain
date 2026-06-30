// adopt.test.mjs — CLI integration test for brain:adopt S1.
//
// Imports adopt.mjs's run() function directly (no subprocess) and exercises the
// full pipeline against __fixtures__/catastro-flat/, which includes a minimal
// node_modules/brain/ mock so the upstream upstream comparison works end-to-end.
//
// Assertions (spec requirements §CLI integration test):
//   - plan.json is written and parses as valid JSON matching the canonical schema
//   - report.md is written and contains all expected sections
//   - catastro ES intro.md is classified as 'translation', languageFlag:true,
//     and appears in the Replacements section of report.md
//   - Read-only contract: no file in the fixture tree is modified by run()
//
// The temp output directory is cleaned up in all code paths (try/finally).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

import { run } from './adopt.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_ROOT = join(__dirname, 'lib', 'adopt', '__fixtures__', 'catastro-flat');

// ── Shared state set up once across all tests ─────────────────────────────────

let outDir;
let plan;
let reportMd;
let fixtureMtimesBefore;
let fixtureMtimesAfter;

/**
 * Recursively snapshots {absolutePath → mtimeMs} for all files under root.
 * Used to assert the fixture tree is not modified by the CLI.
 */
function snapshotMtimes(root) {
  const snap = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else snap[abs] = statSync(abs).mtimeMs;
    }
  };
  walk(root);
  return snap;
}

before(async () => {
  outDir = mkdtempSync(join(tmpdir(), 'brain-adopt-test-'));
  fixtureMtimesBefore = snapshotMtimes(FIXTURE_ROOT);

  // Run the CLI once; share results across all tests in this file.
  await run([FIXTURE_ROOT, '--out', outDir]);

  fixtureMtimesAfter = snapshotMtimes(FIXTURE_ROOT);
  plan = JSON.parse(readFileSync(join(outDir, 'plan.json'), 'utf8'));
  reportMd = readFileSync(join(outDir, 'report.md'), 'utf8');
});

after(() => {
  rmSync(outDir, { recursive: true, force: true });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test('plan.json exists and matches canonical spec schema', () => {
  assert.ok(plan, 'plan.json must parse as JSON');
  assert.equal(plan.schemaVersion, '1', 'schemaVersion must be "1"');
  assert.equal(plan.tool, 'brain:adopt', 'tool must be "brain:adopt"');
  assert.ok(typeof plan.generatedAt === 'string' && plan.generatedAt.length > 0,
    'generatedAt must be an ISO string');
  assert.ok(plan.target && typeof plan.target.shape === 'string', 'target.shape required');
  assert.ok(typeof plan.target.root === 'string', 'target.root required');
  assert.ok(typeof plan.manifestSource === 'string', 'manifestSource required');
  assert.ok(plan.summary && typeof plan.summary.total === 'number', 'summary.total required');
  assert.ok(Array.isArray(plan.files), 'files must be an array');
  // All per-file records must carry the required spec fields.
  for (const record of plan.files) {
    assert.ok('sourcePath' in record, `sourcePath required in ${record.sourcePath}`);
    assert.ok('logicalName' in record, `logicalName required in ${record.sourcePath}`);
    assert.ok('classification' in record, `classification required in ${record.sourcePath}`);
    assert.ok('divergenceKind' in record, `divergenceKind required in ${record.sourcePath}`);
    assert.ok('languageFlag' in record, `languageFlag required in ${record.sourcePath}`);
    assert.ok('proposedAction' in record, `proposedAction required in ${record.sourcePath}`);
    assert.ok('reason' in record, `reason required in ${record.sourcePath}`);
    assert.ok(
      ['generic', 'project'].includes(record.classification),
      `classification must be generic|project, got ${record.classification}`,
    );
    assert.equal(typeof record.languageFlag, 'boolean', 'languageFlag must be boolean');
  }
});

test('report.md exists with all expected sections', () => {
  assert.ok(typeof reportMd === 'string' && reportMd.length > 0, 'report.md must be non-empty');
  assert.ok(reportMd.includes('# brain:adopt Report'), 'report must have title');
  assert.ok(reportMd.includes('## Summary'), 'report must have Summary section');
  assert.ok(reportMd.includes('## Generic Files'), 'report must have Generic Files section');
  assert.ok(
    reportMd.includes('## Replacements (translations to be adopted from upstream)'),
    'report must have Replacements section',
  );
  assert.ok(reportMd.includes('## Project Files'), 'report must have Project Files section');
});

test('catastro intro.md shows as translation in plan.files and in Replacements section', () => {
  const intro = plan.files.find((f) => f.sourcePath === 'brain/methodology/intro.md');
  assert.ok(intro, 'intro.md must be present in plan.files');
  assert.equal(
    intro.divergenceKind,
    'translation',
    'intro.md must be classified as translation (ES dominant)',
  );
  assert.equal(intro.languageFlag, true, 'intro.md languageFlag must be true');
  assert.equal(intro.classification, 'generic', 'intro.md must be classified generic');

  // Verify the file path appears in the Replacements section of report.md.
  // Split on the Replacements heading; take content before the next h2.
  const afterReplacements = reportMd.split('## Replacements')[1] ?? '';
  const repSection = afterReplacements.split(/\n## /)[0];
  assert.ok(
    repSection.includes('brain/methodology/intro.md'),
    'intro.md must appear under ## Replacements in report.md',
  );
});

test('read-only contract: no fixture file modified and no new file created', () => {
  // Every file that existed before run() must have the same mtime after.
  for (const [path, mtime] of Object.entries(fixtureMtimesBefore)) {
    assert.equal(
      fixtureMtimesAfter[path],
      mtime,
      `fixture file must not be modified by run(): ${path}`,
    );
  }
  // No new files must have been created inside the fixture tree.
  for (const path of Object.keys(fixtureMtimesAfter)) {
    assert.ok(
      path in fixtureMtimesBefore,
      `unexpected new file in fixture after run(): ${path}`,
    );
  }
});
