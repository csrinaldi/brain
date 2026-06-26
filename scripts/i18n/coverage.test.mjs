// scripts/i18n/coverage.test.mjs — PR2 parity and translation coverage tests.
// Run with: node --test scripts/i18n/coverage.test.mjs
// No external dependencies — uses Node built-in node:test.
//
// Validates that:
//  1. All PR2 keys exist in en.mjs with the expected English values.
//  2. es.mjs has an entry for every key in en.mjs (complete Spanish parity).
//  3. translate() reproduces the prior Spanish output for a representative sample.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import en from './en.mjs';
import es from './es.mjs';
import { translate } from './t.mjs';

// ── PR2 key existence in en.mjs ────────────────────────────────────────────────

test('PR2 day-start: section header keys exist in en', () => {
  assert.equal(en['day.vcs.section'],       'VCS authentication');
  assert.equal(en['day.main.section'],      'Main branch sync');
  assert.equal(en['day.ecosystem.section'], 'Ecosystem updates');
  assert.equal(en['day.brain.section'],     'brain version (core)');
  assert.equal(en['day.memory.section'],    'Team memory');
  assert.equal(en['day.board.section'],     'Ticket board');
});

test('PR2 day-start: VCS auth message keys exist in en', () => {
  assert.equal(en['day.vcs.notConfigured'],  'VCS provider not configured — set vcs.provider in brain.config.json.');
  assert.equal(en['day.vcs.authOk'],         'Authenticated ({provider}).');
  assert.equal(en['day.vcs.sessionExpired'], 'Session not started or expired — re-authenticating from .env...');
  assert.equal(en['day.vcs.tokenNotFound'],  'Token not found in .env — run npm run env:init');
  assert.equal(en['day.vcs.authFailed'],     'Auth failed — check the token or that the provider CLI is installed. npm run env:init');
});

test('PR2 day-start: main sync keys exist in en', () => {
  assert.equal(en['day.main.noVcs'],        'Cannot sync main — VCS provider or token not available.');
  assert.equal(en['day.main.fetchFailed'],  'Fetch of main failed — check connectivity to {host}');
  assert.equal(en['day.main.updated'],      'main updated (fast-forward applied).');
  assert.equal(en['day.main.pullFailed'],   'Could not pull main — there may be uncommitted local changes.');
  assert.equal(en['day.main.remoteUpdated'],'Remote main updated (active branch: {branch}).');
  assert.equal(en['day.main.newCommits'],   '{count} new commit(s) in main:');
  assert.equal(en['day.main.upToDate'],     'main was already up to date.');
});

test('PR2 day-start: ecosystem + brain + memory + done keys exist in en', () => {
  assert.equal(en['day.ecosystem.allUpToDate'],    'All tools up to date.');
  assert.equal(en['day.ecosystem.updatesAvailable'], '{count} update(s) available:');
  assert.equal(en['day.brain.newVersion'],         'New brain version available: {installed} → {latest}');
  assert.equal(en['day.brain.upToDate'],           'brain up to date ({installed}).');
  assert.equal(en['day.memory.hookActive'],        'Pre-push hook active — materializes memory before push.');
  assert.equal(en['day.memory.exported'],          'Memory exported to .memory/ — ready to commit with the next push.');
  assert.equal(en['day.done.withTicket'],          'With a ticket:');
  assert.equal(en['day.done.noTicket'],            'No ticket — explore or propose:');
  assert.equal(en['day.run.exitCode'],             '↳ exited with code {code} (non-blocking).');
  assert.equal(en['common.signal'],                'signal');
});

test('PR2 tracker-board: new keys exist in en', () => {
  assert.equal(en['tracker.noRemote'],        '⚠ Could not detect origin remote.');
  assert.equal(en['tracker.vcsNotConfigured'],'⚠ VCS provider not configured: {error}');
  assert.equal(en['tracker.noSession'],       '⚠ No authenticated VCS session for {host} — see https://{host}/{project}');
  assert.equal(en['tracker.noUser'],          '⚠ Could not get user — only unassigned tickets are shown.');
  assert.equal(en['tracker.unassigned'],      'Unassigned');
});

test('PR2 project-status: VCS section and header keys exist in en', () => {
  assert.equal(en['ps.title'],           '# Project state — generated projection, DO NOT edit or save');
  assert.equal(en['ps.maven.section'],   '## Maven Reactor');
  assert.equal(en['ps.maven.count'],     '{count} module(s) in the reactor (includes aggregators).');
  assert.equal(en['ps.maven.missingPom'],'(pom MISSING: {dir})');
  assert.equal(en['ps.frontend.section'],'## Frontend (Nx)');
  assert.equal(en['ps.frontend.empty'], 'No Nx projects yet (empty frontend).');
  assert.equal(en['ps.frontend.count'], '{count} Nx project(s).');
  assert.equal(en['ps.vcs.section'],    '## Open work');
  assert.equal(en['ps.vcs.noRemote'],   '⚠ Could not detect origin remote.');
  assert.equal(en['ps.vcs.issues'],     'Open issues ({count}):');
  assert.equal(en['ps.vcs.prs'],        'Open PRs/MRs ({count}):');
  assert.equal(en['ps.footer'],         '— End of projection. To regenerate: npm run project:status');
});

test('PR2 ticket-start: key sample exists in en', () => {
  assert.equal(en['ticket.fetching'],           'Searching for issue #{id}...');
  assert.equal(en['ticket.branchCreated'],      '✓ Branch created and active.');
  assert.equal(en['ticket.worktreeCreated'],    '✓ Worktree created at {path}');
  assert.equal(en['ticket.nextSteps.header'],   'Next steps:');
  assert.equal(en['ticket.nextSteps.step1'],    '    1. Implement — use /sdd-new {id} if the change is complex');
  assert.equal(en['ticket.error.tokenNotFound'],'✗ VCS token not found in .env — run npm run env:init');
});

// ── Parity: es has every key that en has ───────────────────────────────────────

test('es catalog has an entry for every key in en (complete Spanish parity)', () => {
  const enKeys = Object.keys(en);
  const missingFromEs = enKeys.filter((k) => !(k in es));
  assert.deepEqual(
    missingFromEs,
    [],
    `es.mjs is missing keys: ${missingFromEs.join(', ')}`,
  );
});

// ── Spanish translation accuracy for representative PR2 keys ──────────────────

test('translate: day.vcs.section returns prior Spanish section title', () => {
  assert.equal(translate('day.vcs.section', {}, es, en), 'Autenticación del VCS');
});

test('translate: day.main.newCommits interpolates count into Spanish', () => {
  assert.equal(
    translate('day.main.newCommits', { count: 3 }, es, en),
    '3 commit(s) nuevos en main:',
  );
});

test('translate: day.brain.newVersion interpolates versions into Spanish', () => {
  assert.equal(
    translate('day.brain.newVersion', { installed: '1.0.0', latest: '1.1.0' }, es, en),
    'Hay una versión nueva de brain: 1.0.0 → 1.1.0',
  );
});

test('translate: day.memory.hookMissing interpolates path into Spanish', () => {
  assert.equal(
    translate('day.memory.hookMissing', { path: 'scripts/hooks' }, es, en),
    'Hook pre-push ausente en scripts/hooks/pre-push — la memoria no se materializa en el push.',
  );
});

test('translate: tracker.unassigned returns prior Spanish', () => {
  assert.equal(translate('tracker.unassigned', {}, es, en), 'Sin asignar');
});

test('translate: tracker.noSession interpolates host and project into Spanish', () => {
  assert.equal(
    translate('tracker.noSession', { host: 'github.com', project: 'user/repo' }, es, en),
    '⚠ Sin sesión de VCS autenticada para github.com — mirá https://github.com/user/repo',
  );
});

test('translate: ps.vcs.section returns prior Spanish section header', () => {
  assert.equal(translate('ps.vcs.section', {}, es, en), '## Trabajo abierto');
});

test('translate: ps.footer returns prior Spanish footer', () => {
  assert.equal(
    translate('ps.footer', {}, es, en),
    '— Fin de la proyección. Para regenerar: npm run project:status',
  );
});

test('translate: ps.maven.count interpolates count into Spanish', () => {
  assert.equal(
    translate('ps.maven.count', { count: 5 }, es, en),
    '5 módulo(s) en el reactor (incluye agregadores).',
  );
});

test('translate: ticket.fetching interpolates id into Spanish', () => {
  assert.equal(
    translate('ticket.fetching', { id: '42' }, es, en),
    'Buscando issue #42...',
  );
});

test('translate: ticket.nextSteps.step1 interpolates id into Spanish', () => {
  assert.equal(
    translate('ticket.nextSteps.step1', { id: '7' }, es, en),
    '    1. Implementar — usá /sdd-new 7 si el cambio es complejo',
  );
});

test('translate: day.run.exitCode interpolates code into Spanish', () => {
  assert.equal(
    translate('day.run.exitCode', { code: 1 }, es, en),
    '↳ salió con código 1 (no bloqueante).',
  );
});
