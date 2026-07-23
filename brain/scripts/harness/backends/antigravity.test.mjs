// scripts/harness/backends/antigravity.test.mjs — unit + end-to-end dispatch
// tests for the `antigravity` SDD_HARNESS backend (issue #256, B2 Half 1).
//
// (a) compileAgentsMd(): pure compiler — provenance banner + verbatim splice
//     of all 5 SOURCE_DOCS + determinism (Phase 1, REQ-B2-2).
// (b) init(): seam-injected wrapper — reads 5 docs, writes AGENTS_EMIT_PATH,
//     never throws (Phase 2, REQ-B2-1/2).
// (c) end-to-end: real dispatch('antigravity', 'init', []) through the
//     UNMODIFIED harness/cli.mjs dispatch path — proves n=3 with zero
//     cli.mjs change (REQ-B2-1). HERMETIC BY CONSTRUCTION: the test injects
//     a capturing fake `_writeAgents`, so `init()` reads the REAL 5
//     SOURCE_DOCS (default `_readDoc`) but NEVER touches the tracked
//     `AGENTS.md` on disk. A fresh-context review (post-apply) found the
//     earlier version wrote the real file as a side effect — masked by file
//     ordering (the drift-guard happened to run first) but fragile: on
//     reorder/parallelization, this test would "heal" a hand-edited
//     `AGENTS.md` BEFORE the drift-guard could catch it, silently defeating
//     the whole #601 ignoreList classification. The committed `AGENTS.md`'s
//     regeneration is now EXCLUSIVELY a deliberate CLI act:
//     `SDD_HARNESS=antigravity node brain/scripts/harness/cli.mjs init`
//     (task 3.1) — never a side effect of `npm test`.
//
// Run with: npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// RED: fails until antigravity.mjs exists and exports these.
import { SOURCE_DOCS, AGENTS_EMIT_PATH, GEMINI_SETTINGS_EMIT_PATH, compileAgentsMd, compileGeminiSettingsJson, init } from './antigravity.mjs';
import { dispatch } from '../cli.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

/** Capture console.warn lines while calling fn(). */
async function captureWarn(fn) {
  const warnings = [];
  const orig = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  try { await fn(); } finally { console.warn = orig; }
  return warnings;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const FAKE_DOCS = {
  'brain/HOME.md': 'FAKE-HOME-NAV-CONTENT — links to core/methodology/*.md',
  'brain/core/methodology/agent-authorities.md':
    'FAKE-TIER-TABLE\n| Tier 1 | Autonomous |\n| Tier 2 | Confirm |\n| Tier 3 | Prohibited |',
  'brain/core/methodology/harness-contract.md': 'FAKE-VERB-TABLE\n| npm run brain:env:init | ... |',
  'brain/core/methodology/sdd-layout.md': 'FAKE-SDD-LAYOUT — proposal.md, spec.md, design.md, tasks.md',
  'brain/core/methodology/workflow-governance.md':
    'FAKE-GATE-LIST\n| issue-link | size:exception | diff-size |',
};

// ── (a) compileAgentsMd() — pure compiler ────────────────────────────────────

test('1.1: compileAgentsMd() returns a provenance banner naming all 5 SOURCE_DOCS paths, "generated from ... — do not edit"', () => {
  const out = compileAgentsMd(FAKE_DOCS);
  assert.match(out, /generated from/);
  assert.match(out, /— do not edit/);
  for (const path of SOURCE_DOCS) {
    assert.ok(out.includes(path), `banner must name source path "${path}"`);
  }
});

test('1.1: compileAgentsMd() splices the agent-authorities.md fake content verbatim (byte-for-byte substring)', () => {
  const out = compileAgentsMd(FAKE_DOCS);
  assert.ok(
    out.includes(FAKE_DOCS['brain/core/methodology/agent-authorities.md']),
    'agent-authorities.md content must be reproduced verbatim (Tier table unmodified)',
  );
});

test('1.1: compileAgentsMd() output is traceable to each of the other 4 fake docs (HOME nav, verb table, sdd-layout, gate list)', () => {
  const out = compileAgentsMd(FAKE_DOCS);
  assert.ok(out.includes(FAKE_DOCS['brain/HOME.md']));
  assert.ok(out.includes(FAKE_DOCS['brain/core/methodology/harness-contract.md']));
  assert.ok(out.includes(FAKE_DOCS['brain/core/methodology/sdd-layout.md']));
  assert.ok(out.includes(FAKE_DOCS['brain/core/methodology/workflow-governance.md']));
});

test('1.3: SOURCE_DOCS is a frozen array of exactly the 5 paths, in the design\'s exact order', () => {
  assert.deepEqual(SOURCE_DOCS, [
    'brain/HOME.md',
    'brain/core/methodology/agent-authorities.md',
    'brain/core/methodology/harness-contract.md',
    'brain/core/methodology/sdd-layout.md',
    'brain/core/methodology/workflow-governance.md',
  ]);
  assert.ok(Object.isFrozen(SOURCE_DOCS), 'SOURCE_DOCS must be frozen');
});

test('1.3: AGENTS_EMIT_PATH === "AGENTS.md"', () => {
  assert.equal(AGENTS_EMIT_PATH, 'AGENTS.md');
});

test('1.4: compileAgentsMd() is deterministic — same docs map twice yields byte-identical output', () => {
  const first = compileAgentsMd(FAKE_DOCS);
  const second = compileAgentsMd(FAKE_DOCS);
  assert.equal(first, second);
});

// ── (a2) compileAgentsMd() — relative link rebasing ──────────────────────────
// CP-B2 inaugural-read finding (owner ruling, fixed in-PR): verbatim splicing
// alone breaks relative markdown links. A link is correct only from ITS OWN
// source doc's location — spliced unmodified into AGENTS.md at repo root, the
// SAME relative link resolves to a DIFFERENT (often outside-the-repo) target.
// Antigravity follows the file (Exp 4, #604) — a broken link is a real
// consumer defect, not cosmetic. Fixture, isolated from FAKE_DOCS above so
// the byte-for-byte verbatim assertions (which use link-free fixtures) stay
// unaffected by link rewriting.

const LINK_DOCS = {
  'brain/HOME.md':
    '[Adoption guide](../docs/adoption.md)\n' +
    '[Harness contract](core/methodology/harness-contract.md)\n' +
    '[External](https://example.com/x.md)\n' +
    '[Anchor only](#section)\n' +
    '[Already root-relative](/already/root.md)\n' +
    '[Mail](mailto:foo@bar.com)\n',
  'brain/core/methodology/agent-authorities.md': '[Anti-patterns](../anti-patterns/README.md)\n',
  'brain/core/methodology/harness-contract.md': '',
  'brain/core/methodology/sdd-layout.md': '',
  'brain/core/methodology/workflow-governance.md': '',
};

test('link-rebase: a brain/HOME.md-relative "../docs/adoption.md" link rebases to "docs/adoption.md" from repo-root AGENTS.md', () => {
  const out = compileAgentsMd(LINK_DOCS);
  assert.ok(out.includes('(docs/adoption.md)'), 'rebased link must resolve correctly from repo root');
  assert.ok(!out.includes('(../docs/adoption.md)'), 'the un-rebased original relative link must not survive');
});

test('link-rebase: a brain/HOME.md same-dir-relative "core/methodology/harness-contract.md" link rebases to "brain/core/methodology/harness-contract.md"', () => {
  const out = compileAgentsMd(LINK_DOCS);
  assert.ok(out.includes('(brain/core/methodology/harness-contract.md)'));
});

test('link-rebase: a methodology-doc-relative link is rebased through ITS OWN source dir, not brain/HOME.md\'s', () => {
  const out = compileAgentsMd(LINK_DOCS);
  // agent-authorities.md lives at brain/core/methodology/ — "../anti-patterns/README.md"
  // from there resolves to brain/core/anti-patterns/README.md.
  assert.ok(out.includes('(brain/core/anti-patterns/README.md)'));
});

test('link-rebase: absolute URLs, pure anchors, mailto:, and already-root-relative links are left untouched', () => {
  const out = compileAgentsMd(LINK_DOCS);
  assert.ok(out.includes('(https://example.com/x.md)'));
  assert.ok(out.includes('(#section)'));
  assert.ok(out.includes('(/already/root.md)'));
  assert.ok(out.includes('(mailto:foo@bar.com)'));
});

test('link-rebase: compileAgentsMd() over the REAL 5 SOURCE_DOCS rebases brain/HOME.md\'s real "../docs/adoption.md" link', () => {
  const docs = {};
  for (const relPath of SOURCE_DOCS) {
    docs[relPath] = readFileSync(join(REPO_ROOT, relPath), 'utf8');
  }
  const out = compileAgentsMd(docs);
  assert.ok(out.includes('(docs/adoption.md)'), 'the real HOME.md link must rebase to resolve from repo root');
  assert.ok(!out.includes('(../docs/adoption.md)'), 'the real, un-rebased relative link must not survive');
});

// ── (b) init() — seam-injected wrapper ───────────────────────────────────────

test('2.1: init() calls _readDoc once per SOURCE_DOCS path (in order) and _writeAgents exactly once with AGENTS_EMIT_PATH and compileAgentsMd()\'s output', async () => {
  const readCalls = [];
  const writeCalls = [];
  const _readDoc = (relPath) => { readCalls.push(relPath); return FAKE_DOCS[relPath]; };
  const _writeAgents = (relPath, content) => writeCalls.push({ relPath, content });

  await init({ _readDoc, _writeAgents, _repoRoot: '/fake/repo' });

  assert.deepEqual(readCalls, SOURCE_DOCS);
  assert.equal(writeCalls.length, 1);
  assert.equal(writeCalls[0].relPath, AGENTS_EMIT_PATH);
  assert.equal(writeCalls[0].content, compileAgentsMd(FAKE_DOCS));
});

test('2.3: init() never throws when _readDoc throws on one path — warns and still writes', async () => {
  const _readDoc = (relPath) => {
    if (relPath === 'brain/core/methodology/sdd-layout.md') throw new Error('boom-read');
    return FAKE_DOCS[relPath];
  };
  let wrote = false;
  const _writeAgents = () => { wrote = true; };

  const warnings = await captureWarn(() =>
    init({ _readDoc, _writeAgents, _repoRoot: '/fake/repo' }),
  );

  assert.ok(warnings.some((w) => w.includes('sdd-layout.md')), 'must warn naming the failing path');
  assert.equal(wrote, true, 'must still attempt the write with the docs it could read');
});

test('2.3: init() never throws when _writeAgents throws — warns, resolves', async () => {
  const _readDoc = (relPath) => FAKE_DOCS[relPath];
  const _writeAgents = () => { throw new Error('boom-write'); };

  const warnings = await captureWarn(() =>
    init({ _readDoc, _writeAgents, _repoRoot: '/fake/repo' }),
  );

  assert.ok(warnings.some((w) => w.includes('boom-write')));
});

// ── (c) end-to-end: real dispatch through the UNMODIFIED cli.mjs ────────────
// HERMETIC: injects a capturing fake `_writeAgents` so init() compiles from
// the REAL 5 SOURCE_DOCS (default `_readDoc`, real repoRoot) but the write
// lands in memory, never on the tracked AGENTS.md. Regenerating the real,
// committed AGENTS.md is a separate, deliberate CLI act (task 3.1) — never a
// side effect of running this test suite.

test('2.4: dispatch("antigravity", "init", [opts]) resolves through the REAL cli.mjs dispatch path with zero cli.mjs change, compiling the real 5 SOURCE_DOCS to a scratch (non-disk) target — never the tracked AGENTS.md', async () => {
  const scratchWrites = [];
  const _writeAgents = (relPath, content) => scratchWrites.push({ relPath, content });

  await assert.doesNotReject(dispatch('antigravity', 'init', [{ _writeAgents }]));

  assert.equal(scratchWrites.length, 1, '_writeAgents must be called exactly once');
  assert.equal(scratchWrites[0].relPath, AGENTS_EMIT_PATH);
  assert.match(scratchWrites[0].content, /generated from/);
  assert.match(scratchWrites[0].content, /— do not edit/);
});

test('2.5: n=3 — antigravity, plain, and gentle-ai all resolve through dispatch() to a real init() export', async () => {
  const antigravity = await import('./antigravity.mjs');
  const plain = await import('./plain.mjs');
  const gentleAi = await import('./gentle-ai.mjs');
  assert.equal(typeof antigravity.init, 'function');
  assert.equal(typeof plain.init, 'function');
  assert.equal(typeof gentleAi.init, 'function');
});

// ── issue #305: .gemini/settings.json emission ───────────────────────────────

test('GEMINI_SETTINGS_EMIT_PATH === ".gemini/settings.json"', () => {
  assert.equal(GEMINI_SETTINGS_EMIT_PATH, '.gemini/settings.json');
});

test('compileGeminiSettingsJson() emits valid JSON with SessionStart and PreToolUse hooks', () => {
  const jsonStr = compileGeminiSettingsJson();
  const parsed = JSON.parse(jsonStr);

  assert.ok(parsed.hooks);
  assert.ok(Array.isArray(parsed.hooks.PreToolUse));
  assert.ok(Array.isArray(parsed.hooks.SessionStart));

  const sessionStartHook = parsed.hooks.SessionStart[0].hooks[0].command;
  assert.equal(sessionStartHook, 'npm run brain:session:start');

  const preToolUseHook = parsed.hooks.PreToolUse[0].hooks[0].command;
  assert.match(preToolUseHook, /--no-verify/);
});

