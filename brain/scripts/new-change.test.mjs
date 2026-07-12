// new-change.test.mjs — SDD scaffold must produce all four required artifacts (issue #249).
//
// new-change.mjs derives repoRoot from its own script location
// (dirname(__dirname)/../..), so we copy the script into an isolated tmp dir that
// mirrors the real brain/scripts/ layout before spawning it. This keeps writes
// confined to the tmp dir and never touches the real openspec/changes/.
//
// harness-contract.md and docs/workflow-guide.md both list proposal.md, spec.md,
// design.md, tasks.md as the four required SDD artifacts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_SRC = join(__dirname, 'new-change.mjs');

function makeIsolatedScript() {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'brain-new-change-'));
  const scriptsDir = join(tmpRoot, 'brain', 'scripts');
  mkdirSync(scriptsDir, { recursive: true });
  const scriptDest = join(scriptsDir, 'new-change.mjs');
  cpSync(SCRIPT_SRC, scriptDest);
  return { tmpRoot, scriptDest };
}

test('new-change: scaffolds all four SDD artifacts (proposal, spec, design, tasks)', () => {
  const { tmpRoot, scriptDest } = makeIsolatedScript();
  try {
    const result = spawnSync(
      'node',
      [scriptDest, '--issue', '999999', '--title', 'scaffold check'],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}: ${result.stderr}`);

    const changeDir = join(tmpRoot, 'openspec', 'changes', 'issue-999999-scaffold-check');
    const files = readdirSync(changeDir).sort();
    assert.deepEqual(
      files,
      ['design.md', 'proposal.md', 'spec.md', 'tasks.md'],
      'scaffold must write exactly the four required SDD artifacts',
    );
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
