// project-slug.guard.test.mjs — #1273: the repository slug has ONE reader.
//
// A non-test `.mjs` under brain/scripts that reads `project.slug` / `project?.slug` outside the
// resolver (`lib/project-slug.mjs`) re-creates the defect: a verb that breaks where the tracked
// slug is empty and the origin remote would have answered (ADR-0040 stopped `env:init` from
// backfilling it). Comments and strings are masked (`maskNonCode`), so only real property reads
// count. The allowlist is keyed by file, carries a reason, and fails when stale.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, globSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { maskNonCode } from './mask-non-code.mjs';

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), '..');
const READ = /\bproject\s*(?:\?\.|\.)\s*slug\b/g;

const ALLOWLIST = [
  { file: 'lib/project-slug.mjs', reason: 'The resolver itself: the one place that reads the tracked value.' },
  { file: 'lib/brain-config.mjs', reason: 'Writer/migrator: ensureProjectIdentity and ensureBrainConfig WRITE the slug from the origin; they do not resolve it for a verb.' },
  { file: 'axes/memory/adapters/plainfiles.mjs', reason: 'Derives the bare repo name stamped on a record, with config.project.name and the checkout directory as fallbacks; not a VCS slug and must not refuse.' },
  { file: 'axes/memory/adapters/engram.mjs', reason: 'Same bare-name derivation (exported deriveProject) for the engram project; adapters stay independent of each other.' },
  { file: 'axes/sdd-engine/adapters/gentle-ai.mjs', reason: 'Resolves the engram project name from the slug and already falls back to the origin remote itself; a bare name, not a VCS slug.' },
];

function productionFiles() {
  return globSync('**/*.mjs', { cwd: SCRIPTS })
    .map((f) => f.split(sep).join('/'))
    .filter((f) => !/\.test\.mjs$/.test(f) && !f.startsWith('i18n/') && !f.includes('fixtures/') && !f.includes('node_modules/'));
}

function hits(file) {
  const masked = maskNonCode(readFileSync(join(SCRIPTS, file), 'utf8'));
  return (masked.match(READ) ?? []).length;
}

test('#1273: no production file reads project.slug outside the resolver and the allowlisted writers', () => {
  const allowed = new Set(ALLOWLIST.map((e) => e.file));
  const offenders = productionFiles().filter((f) => !allowed.has(f) && hits(f) > 0);
  assert.deepEqual(offenders, [], `read project.slug directly — use lib/project-slug.mjs (resolveProjectSlug / projectSlugOrNull):\n  ${offenders.join('\n  ')}`);
});

test('#1273: every allowlist entry is live and carries a real reason', () => {
  for (const e of ALLOWLIST) {
    assert.ok(e.reason.trim().length >= 20, `${e.file}: reason too thin`);
    assert.ok(hits(e.file) > 0, `${e.file}: stale allowlist entry — it no longer reads project.slug; delete it`);
  }
});

test('#1273: the guard is a real detector (it sees a direct read in masked code, not in a comment)', () => {
  const sample = maskNonCode("// config.project.slug\nconst s = config?.project?.slug;\nconst r = 'project.slug';\n");
  assert.equal((sample.match(READ) ?? []).length, 1);
});
