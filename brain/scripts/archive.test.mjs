// archive.test.mjs — Unit tests for E1 brain:change:archive (issue 260)
// Following strict TDD: these tests are written first and will fail (RED)
// until the logic in archive-logic.mjs is implemented.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

// Task 1.1 (RED): Imports from a non-existent logic module
import {
  parseYamlFrontmatter,
  mergeSpecs,
  archiveChange,
} from './lib/archive-logic.mjs';

// ── Test 1: parseYamlFrontmatter ──────────────────────────────────────────
test('1.1: parseYamlFrontmatter extracts frontmatter fields and body correctly', () => {
  const content = `---
status: approved
issue: 260
capability: memory
---

# Title
Body content here.
`;
  const result = parseYamlFrontmatter(content);
  assert.deepEqual(result.frontmatter, {
    status: 'approved',
    issue: '260',
    capability: 'memory',
  });
  assert.equal(result.body.trim(), '# Title\nBody content here.');
});

test('1.2: parseYamlFrontmatter handles content without frontmatter', () => {
  const content = '# Title without frontmatter\nJust body.';
  const result = parseYamlFrontmatter(content);
  assert.deepEqual(result.frontmatter, {});
  assert.equal(result.body.trim(), '# Title without frontmatter\nJust body.');
});

// ── Test 2: mergeSpecs ────────────────────────────────────────────────────
test('2.1: mergeSpecs appends delta body to empty central spec with provenance header', () => {
  const deltaContent = `---
status: approved
issue: 138
---
# Requirements
- REQ-1: Do something
`;
  const centralContent = '';
  const result = mergeSpecs(deltaContent, centralContent, 'issue-138-session-start', '2026-07-13');
  
  const expected = `
### [issue-138] session-start — 2026-07-13

# Requirements
- REQ-1: Do something
`;
  assert.equal(result.trim(), expected.trim());
});

test('2.2: mergeSpecs appends delta body to non-empty central spec with white space separator', () => {
  const deltaContent = `---
status: approved
issue: 138
---
# Requirements
- REQ-1: Do something
`;
  const centralContent = '# Existing Central Spec\n- REQ-0: Pre-existing';
  const result = mergeSpecs(deltaContent, centralContent, 'issue-138-session-start', '2026-07-13');
  
  const expected = `# Existing Central Spec
- REQ-0: Pre-existing

### [issue-138] session-start — 2026-07-13

# Requirements
- REQ-1: Do something
`;
  assert.equal(result.trim(), expected.trim());
});

// ── Test 3: archiveChange (DI Injected FS Orchestrator) ──────────────────
test('3.1: archiveChange performs legacy format specs merge and folder rename', async () => {
  const files = {
    'openspec/changes/issue-138-session-start': true,
    'openspec/changes/issue-138-session-start/proposal.md': 'proposal text',
    'openspec/changes/issue-138-session-start/design.md': 'design text',
    'openspec/changes/issue-138-session-start/tasks.md': 'tasks text',
    'openspec/changes/issue-138-session-start/specs': ['session'],
    'openspec/changes/issue-138-session-start/specs/session/spec.md': `---
status: approved
issue: 138
---
# Requirements
- REQ-1: Do something
`,
    'openspec/specs/session/spec.md': '# Existing Session Spec\n',
  };

  const renames = [];
  const writes = {};
  const mkdirs = [];

  const fakeFs = {
    exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
    listDir: (p) => {
      const entry = files[p];
      if (!Array.isArray(entry)) throw new Error(`not a dir: ${p}`);
      return entry;
    },
    readFile: (p) => {
      if (!files[p]) throw new Error(`file not found: ${p}`);
      return files[p];
    },
    writeFile: (p, content) => {
      writes[p] = content;
    },
    mkdir: (p) => {
      mkdirs.push(p);
    },
    rename: (src, dest) => {
      renames.push({ src, dest });
    },
  };

  await archiveChange({
    changeId: 'issue-138-session-start',
    fs: fakeFs,
    dateStr: '2026-07-13',
  });

  // Verify rename happened from changes to archive/138
  assert.equal(renames.length, 1);
  assert.deepEqual(renames[0], {
    src: 'openspec/changes/issue-138-session-start',
    dest: 'openspec/changes/archive/138',
  });

  // Verify spec was merged correctly
  assert.ok(Object.prototype.hasOwnProperty.call(writes, 'openspec/specs/session/spec.md'));
  assert.match(writes['openspec/specs/session/spec.md'], /### \[issue-138\] session-start — 2026-07-13/);
  assert.match(writes['openspec/specs/session/spec.md'], /- REQ-1: Do something/);
});

test('3.2: archiveChange fails when target archive directory already exists', async () => {
  const files = {
    'openspec/changes/issue-138-session-start': true,
    'openspec/changes/issue-138-session-start/proposal.md': 'proposal text',
    'openspec/changes/archive/138': true, // already exists
  };

  const fakeFs = {
    exists: (p) => Object.prototype.hasOwnProperty.call(files, p),
    readFile: (p) => files[p],
  };

  await assert.rejects(
    async () => {
      await archiveChange({
        changeId: 'issue-138-session-start',
        fs: fakeFs,
      });
    },
    /Destination directory openspec\/changes\/archive\/138 already exists/
  );
});

// ── Test 4: Integration E2E ──────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';

test('4.1: Integration: E2E CLI run over sandbox layout', () => {
  const sandbox = join(process.cwd(), 'scratch/test-archive-sandbox');

  if (existsSync(sandbox)) rmSync(sandbox, { recursive: true, force: true });
  mkdirSync(sandbox, { recursive: true });

  const changeId = 'issue-999-integration-test';
  const changeDirRel = `openspec/changes/${changeId}`;
  mkdirSync(join(sandbox, changeDirRel, 'specs/my-cap'), { recursive: true });
  mkdirSync(join(sandbox, 'openspec/specs'), { recursive: true });

  writeFileSync(join(sandbox, changeDirRel, 'proposal.md'), 'prop text');
  writeFileSync(join(sandbox, changeDirRel, 'design.md'), 'design text');
  writeFileSync(join(sandbox, changeDirRel, 'tasks.md'), 'tasks text');
  writeFileSync(join(sandbox, changeDirRel, 'specs/my-cap/spec.md'), `---
status: approved
issue: 999
---
# Cap Requirements
- REQ-CAP-1: Integrate
`);

  const scriptPath = join(process.cwd(), 'brain/scripts/archive.mjs');
  execFileSync('node', [scriptPath, changeId], {
    cwd: sandbox,
    env: { ...process.env, MEMORY_BACKEND: 'plainfiles' },
  });

  assert.ok(existsSync(join(sandbox, `openspec/changes/archive/999`)));
  assert.ok(existsSync(join(sandbox, `openspec/changes/archive/999/proposal.md`)));
  assert.equal(existsSync(join(sandbox, changeDirRel)), false);

  const centralSpec = join(sandbox, 'openspec/specs/my-cap/spec.md');
  assert.ok(existsSync(centralSpec));
  const content = readFileSync(centralSpec, 'utf8');
  assert.match(content, /### \[issue-999\] integration-test/);
  assert.match(content, /- REQ-CAP-1: Integrate/);

  rmSync(sandbox, { recursive: true, force: true });
});

