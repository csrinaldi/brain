// sdd-layout.test.mjs — rehearsal-tests + drift-guard for sdd-layout.mjs (issue #250, B0;
// A3 landed in B1, issue #253).
// Owner ruling #587, item 2: each helper's test is written AS THE MEASURED SITE
// WILL CALL IT — citing the site by file:line — so the API is validated by
// rehearsal, not speculation. Run with: npm test (node --test, no dependencies).
//
// Phase 2 (A1 + A2 + A3) is the drift-guard: a TEST, not a lint rule (design §3).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Task 1.1 (RED): fails with "module not found" until sdd-layout.mjs exists.
import {
  REQUIRED_ARTIFACTS,
  OPERATIONAL_ARTIFACTS,
  CHANGES_ROOT,
  LEGACY_GRANDFATHERED,
  changeDir,
  artifactPaths,
  archivePath,
  parseChangeId,
  isGrandfathered,
  hasSpec,
  missingRequiredArtifacts,
} from './sdd-layout.mjs';

const SCRIPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Task 1.2: the four frozen constants ──────────────────────────────────────

test('1.2: REQUIRED_ARTIFACTS / OPERATIONAL_ARTIFACTS / CHANGES_ROOT / LEGACY_GRANDFATHERED are frozen', () => {
  assert.ok(Object.isFrozen(REQUIRED_ARTIFACTS));
  assert.ok(Object.isFrozen(OPERATIONAL_ARTIFACTS));
  assert.ok(Object.isFrozen(CHANGES_ROOT));
  assert.ok(Object.isFrozen(LEGACY_GRANDFATHERED));
  assert.deepEqual(REQUIRED_ARTIFACTS, ['proposal.md', 'spec.md', 'design.md', 'tasks.md']);
  assert.equal(LEGACY_GRANDFATHERED.length, 12);
});

// ── Task 1.3: changeDir — rehearses new-change.mjs:48-110, engram.mjs:804-805 &
// 925-926, feature-resolution.mjs:37-45, phase-order-check.mjs's CHANGE_DIR_PREFIX ──

test('1.3: changeDir rehearses join(repoRoot,"openspec","changes",changeId) (new-change.mjs:48-49)', () => {
  assert.equal(changeDir('issue-250-b0'), 'openspec/changes/issue-250-b0');
});

test('1.3: changeDir rehearses join(root,"openspec","changes",resolvedFeature) (engram.mjs:804-805 & 925-926)', () => {
  assert.equal(changeDir('issue-250-b0'), `${CHANGES_ROOT}/issue-250-b0`);
});

test('1.3: changeDir documents the shared change-dir literal ("openspec/changes/") that phase-order-check.mjs\'s private CHANGE_DIR_PREFIX also hardcodes today — CHANGE_DIR_PREFIX is unexported, so this test cannot rehearse it directly; B1\'s consolidation is what makes phase-order-check.mjs import CHANGES_ROOT instead of re-declaring the literal', () => {
  assert.equal(`${changeDir('issue-250-b0')}/`, `${CHANGES_ROOT}/issue-250-b0/`);
});

// ── Task 1.4: artifactPaths — rehearses new-change.mjs:48-110's four scaffolded targets ──

test('1.4: artifactPaths rehearses new-change.mjs writeFileSync targets (proposal/spec/design/tasks)', () => {
  const paths = artifactPaths('issue-250-b0');
  assert.deepEqual(paths, {
    proposal: 'openspec/changes/issue-250-b0/proposal.md',
    spec: 'openspec/changes/issue-250-b0/spec.md',
    design: 'openspec/changes/issue-250-b0/design.md',
    tasks: 'openspec/changes/issue-250-b0/tasks.md',
  });
  // Note: #251 (fix/issue-249-spec-scaffold) already landed on main — today's
  // new-change.mjs writes all four files, spec.md included. B1 wires the
  // scaffold onto artifactPaths(); this rehearsal only proves the shape matches.
});

// ── Task 1.5: archivePath — direct unit test (no rehearsal site; E1 unbuilt) ──

test('1.5: archivePath matches the measured value from design §5 (PLAN-adapters-v3.md §E1 line 361)', () => {
  assert.equal(archivePath('250'), 'openspec/changes/archive/250');
});

// ── Task 1.6: parseChangeId — rehearses session-start.mjs:38-69's deriveChangeFromBranch
// delimiter-anchored match + new-change.mjs:48's changeId construction shape ──

test('1.6: parseChangeId("issue-250-b0") rehearses new-change.mjs:48 changeId construction', () => {
  assert.deepEqual(parseChangeId('issue-250-b0'), { iid: '250', slug: 'b0' });
});

test('1.6: parseChangeId("issue-250") — a valid parse, slug:null is a violation for NEW dirs', () => {
  assert.deepEqual(parseChangeId('issue-250'), { iid: '250', slug: null });
});

test('1.6: parseChangeId("not-a-change-dir") → null', () => {
  assert.equal(parseChangeId('not-a-change-dir'), null);
});

test('1.6: rehearses session-start.mjs:70-77 delimiter-anchored match — "issue-138-session-start" must NOT match token "issue-13"', () => {
  // deriveChangeFromBranch matches `name === token || name.startsWith(`${token}-`)`.
  // parseChangeId proves the underlying dir-name shape session-start.mjs relies on:
  // 'issue-138-session-start' parses to iid '138', NOT a substring '13'.
  assert.deepEqual(parseChangeId('issue-138-session-start'), { iid: '138', slug: 'session-start' });
  assert.notEqual(parseChangeId('issue-138-session-start').iid, '13');
});

// ── Task 1.7: isGrandfathered — rehearses phase-order-check.mjs's BASELINE_EXEMPT_DIRS
// (subset proof) + check-refs.mjs:96-112's S-1 per-dir loop ──

test('1.7: isGrandfathered — the historical BASELINE_EXEMPT_DIRS (deleted in B1, REQ-B1-3) is a strict subset of LEGACY_GRANDFATHERED (proves B1\'s swap was behavior-preserving)', () => {
  // phase-order-check.mjs's own BASELINE_EXEMPT_DIRS export was removed in B1
  // (issue #253) once its default arg was swapped to LEGACY_GRANDFATHERED —
  // the 3 historical names are hardcoded here (documentation-only) since
  // there is no longer a live export to import for the subset proof.
  const HISTORICAL_BASELINE_EXEMPT_DIRS = ['installer-versionado', 'vcs-adapter', 'cli-i18n'];
  assert.equal(HISTORICAL_BASELINE_EXEMPT_DIRS.length, 3);
  for (const dir of HISTORICAL_BASELINE_EXEMPT_DIRS) {
    assert.ok(isGrandfathered(dir), `expected ${dir} to be grandfathered`);
  }
});

test('1.7: isGrandfathered — rehearses check-refs.mjs:96-112 S-1 per-dir loop, true for all 12 sealed names', () => {
  for (const dir of LEGACY_GRANDFATHERED) {
    assert.ok(isGrandfathered(dir), `expected ${dir} to be grandfathered`);
  }
});

test('1.7: isGrandfathered — false for an arbitrary new issue-<N>-<slug>', () => {
  assert.equal(isGrandfathered('issue-999-not-real'), false);
});

// ── Task 1.8: hasSpec — rehearses check-refs.mjs:96-112 extended to the flat-OR-nested
// tolerance pin (D1/Pin 1). Injectable {exists, listDir} — no real fs in this test ──

function fakeFs(entries) {
  // entries: relPath -> true (file/dir exists) | string[] (dir listing)
  return {
    exists: (p) => Object.prototype.hasOwnProperty.call(entries, p),
    listDir: (p) => {
      const v = entries[p];
      if (!Array.isArray(v)) throw new Error(`not a dir: ${p}`);
      return v;
    },
  };
}

test('1.8: hasSpec — true for a flat spec.md (canonical, rehearses check-refs.mjs S-1)', () => {
  const fs = fakeFs({ 'openspec/changes/issue-1-x/spec.md': true });
  assert.equal(hasSpec('issue-1-x', fs), true);
});

test('1.8: hasSpec — true for nested specs/<capability>/spec.md, no flat file (legacy governance/auto-adrs shape)', () => {
  const fs = fakeFs({
    'openspec/changes/governance/specs': ['workflow-governance'],
    'openspec/changes/governance/specs/workflow-governance/spec.md': true,
  });
  assert.equal(hasSpec('governance', fs), true);
});

test('1.8: hasSpec — false when neither flat nor nested spec exists', () => {
  const fs = fakeFs({});
  assert.equal(hasSpec('issue-1-x', fs), false);
});

// ── Task 1.9: missingRequiredArtifacts — rehearses check-refs.mjs:96-112 end-to-end ──

test('1.9: missingRequiredArtifacts — a NEW dir missing spec.md and design.md returns exactly those two', () => {
  const fs = fakeFs({
    'openspec/changes/issue-999-x/proposal.md': true,
    'openspec/changes/issue-999-x/tasks.md': true,
  });
  assert.deepEqual(missingRequiredArtifacts('issue-999-x', fs), ['spec.md', 'design.md']);
});

test('1.9: missingRequiredArtifacts — a grandfathered dir missing everything short-circuits to [] ("the past is recorded, not edited")', () => {
  const fs = fakeFs({});
  assert.deepEqual(missingRequiredArtifacts('vcs-adapter', fs), []);
});

test('1.9: missingRequiredArtifacts — spec slot delegates to hasSpec (nested spec counts as present)', () => {
  const fs = fakeFs({
    'openspec/changes/issue-999-x/proposal.md': true,
    'openspec/changes/issue-999-x/design.md': true,
    'openspec/changes/issue-999-x/tasks.md': true,
    'openspec/changes/issue-999-x/specs': ['cap'],
    'openspec/changes/issue-999-x/specs/cap/spec.md': true,
  });
  assert.deepEqual(missingRequiredArtifacts('issue-999-x', fs), []);
});

// ── Task 1.10: OPERATIONAL_ARTIFACTS — rehearses feature-resolution.mjs:79-84
// (existsSync(join(changesDir, candidate, 'resume.md'))) + engram.mjs:805/926 ──

test('1.10: OPERATIONAL_ARTIFACTS includes resume.md, and it is excluded from REQUIRED_ARTIFACTS', () => {
  assert.ok(OPERATIONAL_ARTIFACTS.includes('resume.md'));
  assert.equal(REQUIRED_ARTIFACTS.includes('resume.md'), false);
});

test('1.10: resume.md is never consulted by missingRequiredArtifacts (feature-resolution.mjs:79-84 shape)', () => {
  const fs = fakeFs({
    'openspec/changes/issue-999-x/proposal.md': true,
    'openspec/changes/issue-999-x/spec.md': true,
    'openspec/changes/issue-999-x/design.md': true,
    'openspec/changes/issue-999-x/tasks.md': true,
    // resume.md deliberately absent — must not affect the result.
  });
  assert.deepEqual(missingRequiredArtifacts('issue-999-x', fs), []);
});

// Task 1.11 (stop-condition, owner ruling #587 item 2): every helper above
// expressed its cited site's call shape without needing to reshape the site
// itself. STOP-CONDITION DID NOT FIRE — no B0 finding to report.

// ── Phase 2: the drift-guard — a TEST, not a lint rule (design §3) ──────────

// A1 — single source (blocking, B0). Scan brain/scripts/**/*.mjs (excluding
// sdd-layout.mjs and *.test.mjs) for a rival array literal that stands in as
// a second REQUIRED_ARTIFACTS-shaped definition. Precision-tuned (task 2.2 /
// CP concern): an array literal counts as a rival only when it co-occurs AT
// LEAST 3 of the 4 canonical filenames — this is what excludes check-refs.mjs's
// pre-existing, narrower `['proposal.md', 'tasks.md']` S-1 loop (a real,
// already-known 2-of-4 partial array — B1 worklist item 1 migrates it; it is
// NOT a new rival full-set definition and must not false-positive the guard).
const ARTIFACT_NAMES = ['proposal.md', 'spec.md', 'design.md', 'tasks.md'];
const BRACKET_RE = /\[[^\]]*\]/gs;

// Known heuristic limit (documented, not chased — mirrors how C3 documented its
// indirect-binding residual rather than closing it): splitting the 4 canonical
// filenames across TWO separate `[...]` array literals stays under the 3-of-4
// threshold in each bracket and evades this scan. Not hardened, because a
// genuine accidental second REQUIRED_ARTIFACTS definition is naturally written
// as ONE literal — chasing the split-literal case risks new false positives
// (the guard's actual death mode) for a threat model that isn't realistic.
function countArtifactTokens(bracketText) {
  return ARTIFACT_NAMES.filter((name) =>
    bracketText.includes(`'${name}'`) || bracketText.includes(`"${name}"`) || bracketText.includes(`\`${name}\``),
  ).length;
}

function scanForRivalArtifactArray(root, { readdir = readdirSync, readFile = readFileSync } = {}) {
  const offenders = [];
  const entries = readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
    if (entry.name.endsWith('.test.mjs') || entry.name === 'sdd-layout.mjs') continue;
    const relDir = entry.parentPath ?? entry.path;
    const full = join(relDir, entry.name);
    const content = readFile(full, 'utf8');
    const brackets = content.match(BRACKET_RE) ?? [];
    if (brackets.some((b) => countArtifactTokens(b) >= 3)) offenders.push(full);
  }
  return offenders;
}

test('2.1: A1 false-positive fixture — a rival array literal co-occurring 3+ of the 4 canonical names IS caught, naming the file', () => {
  const files = {
    'fixture/rival.mjs': `export const REQUIRED = ['proposal.md', 'design.md', 'tasks.md'];`,
  };
  const offenders = scanForRivalArtifactArray('fixture', {
    readdir: () => [{ isFile: () => true, name: 'rival.mjs', parentPath: 'fixture' }],
    readFile: (p) => files[p],
  });
  assert.deepEqual(offenders, ['fixture/rival.mjs']);
});

test('2.1b (MINOR 2, fresh-review hardening): A1 catches a BACKTICK-quoted rival array literal (evasion: backticks instead of \'/" quotes)', () => {
  const files = {
    'fixture/rival-backtick.mjs': 'export const REQUIRED = [`proposal.md`, `spec.md`, `design.md`, `tasks.md`];',
  };
  const offenders = scanForRivalArtifactArray('fixture', {
    readdir: () => [{ isFile: () => true, name: 'rival-backtick.mjs', parentPath: 'fixture' }],
    readFile: (p) => files[p],
  });
  assert.deepEqual(offenders, ['fixture/rival-backtick.mjs']);
});

test('2.2: A1 precision guard — a BASELINE_EXEMPT_DIRS-shaped 3-element array does NOT trip the scan', () => {
  const content = `export const BASELINE_EXEMPT_DIRS = ['installer-versionado', 'vcs-adapter', 'cli-i18n'];`;
  const brackets = content.match(BRACKET_RE) ?? [];
  assert.ok(brackets.every((b) => countArtifactTokens(b) < 3));
});

test('2.2: A1 precision guard — a 2-element subset mentioning only proposal.md (check-refs.mjs\'s own pre-existing S-1 shape) does NOT trip the scan', () => {
  const content = `for (const required of ['proposal.md', 'tasks.md']) {`;
  const brackets = content.match(BRACKET_RE) ?? [];
  assert.ok(brackets.every((b) => countArtifactTokens(b) < 3));
});

test('2.2: A1 precision guard — the same 4 strings scattered across separate const declarations (no shared array literal) does NOT trip the scan', () => {
  const content = `const a = 'proposal.md';\nconst b = 'spec.md';\nconst c = 'design.md';\nconst d = 'tasks.md';`;
  const brackets = content.match(BRACKET_RE) ?? [];
  assert.equal(brackets.length, 0);
});

test('2.3: A1 real-repo-tree pass — brain/scripts/** has no rival REQUIRED_ARTIFACTS-shaped array today', () => {
  const offenders = scanForRivalArtifactArray(SCRIPTS_DIR);
  assert.deepEqual(offenders, []);
});

// A2 — sealed set (blocking, B0).
const THE_12_HARDCODED = [
  'installer-versionado', 'vcs-adapter', 'cli-i18n',
  'feature-working-memory', 'auto-adrs', 'governance',
  'managed-paths-namespace', 'issue-138-session-start',
  'issue-144-governance-v3', 'install-home-scaffold',
  'issue-193-ci-context-design', 'issue-196-ci-context-impl',
];

test('2.4: A2 sealed-12 lock — the comparison mechanism itself distinguishes 12 from a hypothetical 13th entry', () => {
  const thirteen = [...LEGACY_GRANDFATHERED, 'issue-999-not-real'];
  assert.notDeepEqual([...thirteen].sort(), [...THE_12_HARDCODED].sort());
});

test('2.5: A2 sealed-12 lock — the real export equals EXACTLY the 12 hardcoded names (a 13th entry, removal, or typo fails here)', () => {
  assert.deepEqual([...LEGACY_GRANDFATHERED].sort(), [...THE_12_HARDCODED].sort());
});

// A3 — consumers reference the module via their real ESM import shape (B1,
// issue #253, design §4, REQ-B1-4). Precision over coverage — the A1 lesson
// carried forward: never a loose substring, never a single shared depth
// literal (a shared '../lib/' would false-negative 5 of 6 sites).

const LAYOUT_ABS = fileURLToPath(new URL('./sdd-layout.mjs', import.meta.url));

// The six sites (REQ-B1-1), relative to SCRIPTS_DIR — five physical files
// (engram's two call sites share one import).
const CONSUMING_SITE_RELPATHS = [
  'check-refs.mjs',
  'session-start.mjs',
  'new-change.mjs',
  'vcs/phase-order-check.mjs',
  'memory/backends/engram.mjs',
  'memory/lib/feature-resolution.mjs',
];

/** Never hand-typed — self-corrects if a file moves (design §4). */
function computeExpectedSpecifier(siteAbsPath) {
  const rel = relative(dirname(siteAbsPath), LAYOUT_ABS).split(sep).join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

const CONSUMING_SITES = CONSUMING_SITE_RELPATHS.map((rel) => {
  const abs = join(SCRIPTS_DIR, rel);
  return { rel, abs, specifier: computeExpectedSpecifier(abs) };
});

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The real A3 assertion (task 4.3): a genuine `import { ... } from '<specifier>'`. */
function siteImportsLayoutViaRealShape(content, specifier) {
  const re = new RegExp(`import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapeRegExp(specifier)}['"]`);
  return re.test(content);
}

/** The REJECTED naive approach — a loose substring match (design §4's death mode). */
function naiveLooseSubstringMatch(content) {
  return content.includes('sdd-layout');
}

// ── Task 4.2 — false-positive/false-negative traps, written FIRST, proven
// against the NAIVE matcher before the real assertion is trusted ───────────

test('A3 trap (a): a doc-comment mention of sdd-layout fools the naive substring matcher (false positive) but NOT the real import-shape assertion', () => {
  const content = '// see sdd-layout.mjs for the contract this file should eventually consume\nexport const x = 1;\n';
  assert.equal(naiveLooseSubstringMatch(content), true, 'naive matcher is expected to be fooled here');
  assert.equal(siteImportsLayoutViaRealShape(content, './lib/sdd-layout.mjs'), false);
});

test('A3 trap (b): the .test.mjs filename itself satisfies the naive substring matcher (false positive) but NOT the real assertion', () => {
  const content = "// companion of sdd-layout.test.mjs\nexport const x = 1;\n";
  assert.equal(naiveLooseSubstringMatch(content), true, 'naive matcher is expected to be fooled here');
  assert.equal(siteImportsLayoutViaRealShape(content, './lib/sdd-layout.mjs'), false);
});

test('A3 trap (c): a shared "../lib/" literal false-NEGATIVES a real "./lib/" site — depth precision matters (design §4\'s core concern)', () => {
  // check-refs.mjs's REAL, correct import (depth './lib/') — but tested
  // against the WRONG shared specifier a naive single-depth guard would use.
  const content = "import { CHANGES_ROOT, missingRequiredArtifacts, isGrandfathered } from './lib/sdd-layout.mjs';\n";
  assert.equal(
    siteImportsLayoutViaRealShape(content, '../lib/sdd-layout.mjs'),
    false,
    'a shared "../lib/" literal must false-negative this real "./lib/" import',
  );
  assert.equal(
    siteImportsLayoutViaRealShape(content, './lib/sdd-layout.mjs'),
    true,
    'the correctly computed per-site specifier must match',
  );
});

test('A3 trap (d): a bare side-effect import (no braces) satisfies the naive matcher (false positive) but NOT the real assertion (requires a named { } consumption)', () => {
  const content = "import '../lib/sdd-layout.mjs';\n";
  assert.equal(naiveLooseSubstringMatch(content), true, 'naive matcher is expected to be fooled here');
  assert.equal(siteImportsLayoutViaRealShape(content, '../lib/sdd-layout.mjs'), false);
});

// ── Task 4.3 — the real assertion, run against all six wired sites ─────────

test('A3: all six wired sites reference sdd-layout.mjs via their real, per-site-depth import shape', () => {
  for (const site of CONSUMING_SITES) {
    const content = readFileSync(site.abs, 'utf8');
    assert.ok(
      siteImportsLayoutViaRealShape(content, site.specifier),
      `${site.rel}: expected a real "import { ... } from '${site.specifier}'" statement`,
    );
  }
});

test('A3: the per-site specifiers are NOT a single shared literal (proves depth precision is exercised, not vacuously)', () => {
  const specifiers = new Set(CONSUMING_SITES.map((s) => s.specifier));
  assert.ok(specifiers.size >= 3, `expected at least 3 distinct depths (./, ../, ../../), got: ${[...specifiers]}`);
});

// ── Task 4.4 — negative case: a site re-declaring a rival literal fails A3,
// naming the offending file ─────────────────────────────────────────────────

function scanSitesForA3(sites) {
  const offenders = [];
  for (const site of sites) {
    if (!siteImportsLayoutViaRealShape(site.content, site.specifier)) offenders.push(site.rel);
  }
  return offenders;
}

test('A3 negative case: a hypothetical site re-declaring its own artifact-name array / openspec-changes literal / grandfather list, without importing the accessor, fails A3 and is named', () => {
  const rivalSite = {
    rel: 'fixture/rival-site.mjs',
    specifier: './lib/sdd-layout.mjs',
    content: [
      "const REQUIRED_ARTIFACTS = ['proposal.md', 'spec.md', 'design.md', 'tasks.md'];",
      "const CHANGES_DIR = 'openspec/changes';",
      "const GRANDFATHERED = ['installer-versionado', 'vcs-adapter', 'cli-i18n'];",
    ].join('\n'),
  };
  const legitSite = {
    rel: 'fixture/legit-site.mjs',
    specifier: './lib/sdd-layout.mjs',
    content: "import { CHANGES_ROOT } from './lib/sdd-layout.mjs';",
  };
  const offenders = scanSitesForA3([legitSite, rivalSite]);
  assert.deepEqual(offenders, ['fixture/rival-site.mjs']);
});

// ── Task 4.5 — A3 against all six sites as wired in Phases 2–3 ─────────────

test('A3 (task 4.5): scanning the six real wired sites reports zero offenders', () => {
  const sites = CONSUMING_SITES.map((s) => ({ ...s, content: readFileSync(s.abs, 'utf8') }));
  assert.deepEqual(scanSitesForA3(sites), []);
});
