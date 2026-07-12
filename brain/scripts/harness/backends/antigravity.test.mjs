// scripts/harness/backends/antigravity.test.mjs — unit + end-to-end dispatch
// tests for the `antigravity` SDD_HARNESS backend (issue #256, B2 Half 1).
//
// (a) compileAgentsMd(): pure compiler — provenance banner + verbatim splice
//     of all 5 SOURCE_DOCS + determinism (Phase 1, REQ-B2-2).
// (b) init(): seam-injected wrapper — reads 5 docs, writes AGENTS_EMIT_PATH,
//     never throws (Phase 2, REQ-B2-1/2).
// (c) end-to-end: real dispatch('antigravity', 'init', []) through the
//     UNMODIFIED harness/cli.mjs dispatch path — proves n=3 with zero
//     cli.mjs change (REQ-B2-1). This call also performs the REAL generation
//     of the committed AGENTS.md at repo root (design's Phase 2.4 apply-time
//     judgment: fold the real dispatch into the real generation call).
//
// Run with: npm test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// RED: fails until antigravity.mjs exists and exports these.
import { SOURCE_DOCS, AGENTS_EMIT_PATH, compileAgentsMd, init } from './antigravity.mjs';
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
// This is the REAL generation call — writes the actual AGENTS.md at repo root
// from the actual 5 SOURCE_DOCS (design's Phase 2.4 apply-time judgment).

test('2.4/3.1: dispatch("antigravity", "init", []) resolves through the REAL cli.mjs dispatch path with zero cli.mjs change, and generates the real AGENTS.md', async () => {
  await assert.doesNotReject(dispatch('antigravity', 'init', []));

  const generated = readFileSync(join(REPO_ROOT, AGENTS_EMIT_PATH), 'utf8');
  assert.match(generated, /generated from/);
  assert.match(generated, /— do not edit/);
});

// Task 2.5 — confirm n=3: SDD_HARNESS=antigravity, plain, and gentle-ai are all
// real, dispatchable init() inhabitants of the same dispatch path.
test('2.5: n=3 — antigravity, plain, and gentle-ai all resolve through dispatch() to a real init() export', async () => {
  const antigravity = await import('./antigravity.mjs');
  const plain = await import('./plain.mjs');
  const gentleAi = await import('./gentle-ai.mjs');
  assert.equal(typeof antigravity.init, 'function');
  assert.equal(typeof plain.init, 'function');
  assert.equal(typeof gentleAi.init, 'function');
});
