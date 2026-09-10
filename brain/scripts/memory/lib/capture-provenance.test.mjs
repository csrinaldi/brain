// capture-provenance.test.mjs — unit tests for the pure capture-time
// provenance resolvers (#738, design A1/A2; spec "a record carries its
// provenance").
//
// Pure: no fs, no child_process. Every git/env fact is injected by the
// caller (plainfiles.mjs, via lib/git-config.mjs + process.env).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AGENT_ENV_DEFAULT,
  RESERVED_ACTORS,
  ISSUE_BRANCH_RE,
  resolveActor,
  resolveActorKind,
  deriveIssue,
  composeSource,
} from './capture-provenance.mjs';

// ---------------------------------------------------------------------------
// resolveActor
// ---------------------------------------------------------------------------

test('resolveActor: a configured handle resolves ok', () => {
  const r = resolveActor({ configured: '@csrinaldi' });
  assert.equal(r.ok, true);
  assert.equal(r.actor, '@csrinaldi');
});

for (const configured of [undefined, null, '', '   ']) {
  test(`resolveActor: unset/empty/whitespace (${JSON.stringify(configured)}) ⇒ reason 'unset'`, () => {
    const r = resolveActor({ configured });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'unset');
  });
}

for (const configured of ['Cristian Rinaldi', 'csrinaldi', 'feat/x', 'csrinaldi@gmail.com']) {
  test(`resolveActor: non-handle-shaped (${configured}) ⇒ reason 'malformed'`, () => {
    const r = resolveActor({ configured });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'malformed');
  });
}

test("resolveActor: '@legacy' ⇒ reason 'reserved' (mints the export sentinel through the capture door)", () => {
  const r = resolveActor({ configured: '@legacy' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'reserved');
  assert.ok(RESERVED_ACTORS.has('@legacy'));
});

// ---------------------------------------------------------------------------
// resolveActorKind
// ---------------------------------------------------------------------------

test('resolveActorKind: marker present ⇒ agent', () => {
  const r = resolveActorKind({ env: { [AGENT_ENV_DEFAULT]: 'claude-code' } });
  assert.equal(r.actorKind, 'agent');
  assert.equal(r.marker, AGENT_ENV_DEFAULT);
});

test('resolveActorKind: marker absent ⇒ human', () => {
  const r = resolveActorKind({ env: {} });
  assert.equal(r.actorKind, 'human');
  assert.equal(r.marker, null);
});

test('resolveActorKind: set-but-EMPTY marker ⇒ human, evidence names "set but empty"', () => {
  const r = resolveActorKind({ env: { [AGENT_ENV_DEFAULT]: '' } });
  assert.equal(r.actorKind, 'human');
  assert.match(r.evidence, /set but empty/);
});

test('resolveActorKind: a 3-name brain.agentEnv list, second name set ⇒ agent, that name in evidence', () => {
  const r = resolveActorKind({ env: { VAR2: 'gemini-cli' }, agentEnvConfig: 'VAR1,VAR2,VAR3' });
  assert.equal(r.actorKind, 'agent');
  assert.equal(r.marker, 'VAR2');
  assert.match(r.evidence, /VAR2/);
});

// ---------------------------------------------------------------------------
// deriveIssue
// ---------------------------------------------------------------------------

test('deriveIssue: declared wins over a matching branch', () => {
  const r = deriveIssue({ declared: '738', branch: 'feat/issue-999-other' });
  assert.equal(r.issue, 738);
  assert.equal(r.derived, false);
});

test("deriveIssue: 'feat/issue-738-x' branch ⇒ 738, derived", () => {
  const r = deriveIssue({ declared: undefined, branch: 'feat/issue-738-x' });
  assert.equal(r.issue, 738);
  assert.equal(r.derived, true);
  assert.ok(ISSUE_BRANCH_RE.test('feat/issue-738-x'));
});

for (const branch of ['main', 'unknown', 'feat/issue-abc']) {
  test(`deriveIssue: '${branch}' does not match ⇒ issue absent, never fabricated`, () => {
    const r = deriveIssue({ declared: undefined, branch });
    assert.equal(r.issue, undefined);
    assert.equal(r.derived, false);
  });
}

// ---------------------------------------------------------------------------
// composeSource
// ---------------------------------------------------------------------------

test('composeSource: one trimmed, single-physical-line string (W1-safe)', () => {
  const actor = resolveActor({ configured: '@csrinaldi' });
  const kind = resolveActorKind({ env: {} });
  const issue = deriveIssue({ declared: undefined, branch: 'main' });
  const line = composeSource({ host: 'devbox', actor, kind, issue });
  assert.equal(typeof line, 'string');
  assert.equal(line, line.trim());
  assert.ok(!/[\n\r]/.test(line));
});

test('composeSource: a 300-char env value is whitespace-collapsed and sliced to 64', () => {
  const actor = resolveActor({ configured: '@csrinaldi' });
  const raw = ('claude   code  ' + 'x'.repeat(280)).repeat(1).slice(0, 300);
  const kind = resolveActorKind({ env: { [AGENT_ENV_DEFAULT]: raw } });
  const issue = deriveIssue({ declared: undefined, branch: 'main' });
  const line = composeSource({ host: 'devbox', actor, kind, issue });
  const match = /AI_AGENT=(\S+)/.exec(line);
  assert.ok(match, `expected an AI_AGENT= value in: ${line}`);
  assert.ok(match[1].length <= 64, `expected <= 64 chars, got ${match[1].length}`);
  assert.ok(!/\s{2,}/.test(match[1]), 'expected whitespace collapsed to single spaces (no run of 2+)');
});

test('composeSource: declared vs derived issue are spelled in words', () => {
  const actor = resolveActor({ configured: '@csrinaldi' });
  const kind = resolveActorKind({ env: {} });

  const declared = composeSource({ host: 'devbox', actor, kind, issue: deriveIssue({ declared: 738, branch: undefined }) });
  assert.match(declared, /declared via --issue/);

  const derived = composeSource({ host: 'devbox', actor, kind, issue: deriveIssue({ declared: undefined, branch: 'feat/issue-738-x' }) });
  assert.match(derived, /derived from branch/);
});
