// env-init-setup.test.mjs — env:init creates the governance labels and resolves
// brain.actor (issues #1163, #1164). A fresh consumer has neither: its first PR
// fails `issue-link` (no `status:approved` label to apply) and its first
// `brain:memory:save` fails with "no configured actor".
//
// All VCS traffic goes through an injected port double — never the real API.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { desiredLabels, ensureLabels, resolveBrainActor, ALARM_LABELS } from './env-init-setup.mjs';
import { TYPE_LABELS } from '../vcs/contributor-scaffold.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** A port double over a mutable label set; records every create. */
function fakeVcs({ existing = [], listThrows = null, createFails = {}, whoamiName = 'octo', whoamiThrows = null } = {}) {
  const labels = new Set(existing);
  const creates = [];
  return {
    creates,
    labels,
    labelList: async () => { if (listThrows) throw new Error(listThrows); return [...labels]; },
    labelCreate: async ({ name }) => {
      creates.push(name);
      if (createFails[name]) return { ok: false, error: createFails[name] };
      if (labels.has(name)) return { ok: true, created: false };
      labels.add(name);
      return { ok: true, created: true };
    },
    whoami: async () => { if (whoamiThrows) throw new Error(whoamiThrows); return { username: whoamiName }; },
  };
}

// ── #1163 labels ────────────────────────────────────────────────────────────

test('#1163 desiredLabels (github): the approved label, every TYPE_LABELS entry and the workflow alarm labels', () => {
  const names = desiredLabels({ config: {}, provider: 'github' }).map((l) => l.name);
  assert.ok(names.includes('status:approved'));
  for (const { label } of TYPE_LABELS) assert.ok(names.includes(label), `${label} — the set brain:ship and ticket:start read`);
  for (const a of ALARM_LABELS) assert.ok(names.includes(a));
  assert.equal(new Set(names).size, names.length, 'no duplicates');
});

test('#1163 desiredLabels honours a renamed governance.approvedLabel, and scopes names on gitlab', () => {
  const gh = desiredLabels({ config: { governance: { approvedLabel: 'ok:go' } }, provider: 'github' }).map((l) => l.name);
  assert.ok(gh.includes('ok:go') && !gh.includes('status:approved'));
  const gl = desiredLabels({ config: {}, provider: 'gitlab' }).map((l) => l.name);
  assert.ok(gl.includes('status::approved'), 'the same resolver every gate reads');
  assert.ok(gl.includes('type::bug'), 'gitlab scoped form, matched by /^type::?/');
});

test('#1163 desiredLabels: the alarm set covers every governance:* label the postmerge workflow files', () => {
  const yml = readFileSync(join(REPO, '.github', 'workflows', 'governance-postmerge.yml'), 'utf8');
  const filed = new Set(yml.match(/governance:[a-z-]+/g));
  for (const l of filed) assert.ok(ALARM_LABELS.includes(l), `${l} is filed by the workflow but env:init does not create it`);
});

test('#1163 ensureLabels creates the missing ones and reports them; a second run creates nothing (idempotent)', async () => {
  const vcs = fakeVcs();
  const first = await ensureLabels({ config: {}, provider: 'github', project: 'a/b', vcs });
  assert.equal(first.pending, null);
  assert.ok(first.created.includes('status:approved'));
  assert.deepEqual(first.existing, []);
  const before = vcs.creates.length;
  const second = await ensureLabels({ config: {}, provider: 'github', project: 'a/b', vcs });
  assert.deepEqual(second.created, []);
  assert.equal(second.existing.length, first.created.length);
  assert.equal(vcs.creates.length, before, 'labelCreate is not even called for a label the list already shows');
});

test('#1163 ensureLabels: a label that already exists is left alone, never recreated or restyled', async () => {
  const vcs = fakeVcs({ existing: ['status:approved'] });
  const r = await ensureLabels({ config: {}, provider: 'github', project: 'a/b', vcs });
  assert.ok(r.existing.includes('status:approved'));
  assert.ok(!vcs.creates.includes('status:approved'));
});

test('#1163 ensureLabels degrades to a pending step with the exact command when the VCS is unreachable', async () => {
  const vcs = fakeVcs({ listThrows: 'gh failed (status 1): not logged in' });
  const r = await ensureLabels({ config: {}, provider: 'github', project: 'a/b', vcs });
  assert.deepEqual(r.created, []);
  assert.equal(vcs.creates.length, 0, 'no write attempted against an unreadable remote');
  assert.match(r.pending.reason, /not logged in/);
  assert.match(r.pending.next, /npm run brain:env:init/);
  assert.match(r.pending.next, /gh label create "status:approved"/, 'the exact hand command for the label issue-link needs');
  const gl = await ensureLabels({ config: {}, provider: 'gitlab', project: 'a/b', vcs });
  assert.match(gl.pending.next, /glab label create --name "status::approved"/);
});

test('#1163 ensureLabels: a create the remote refuses is pending too, and names what failed (no silent partial)', async () => {
  const vcs = fakeVcs({ createFails: { 'type:bug': 'HTTP 403' } });
  const r = await ensureLabels({ config: {}, provider: 'github', project: 'a/b', vcs });
  assert.ok(r.created.includes('status:approved'), 'the others are still created');
  assert.deepEqual(r.failed, [{ name: 'type:bug', error: 'HTTP 403' }]);
  assert.ok(r.pending, 'a refused create must not read as done');
  const two = await ensureLabels({ config: {}, provider: 'github', project: 'a/b', vcs: fakeVcs({ createFails: { 'type:bug': 'HTTP 403', 'type:docs': 'HTTP 403' } }) });
  assert.match(two.pending.next, /gh label create "type:bug"; gh label create "type:docs"/, 'the hand-fix covers EVERY refused label');
});

test('#1163 ensureLabels: no project slug is pending, not a guess', async () => {
  const r = await ensureLabels({ config: {}, provider: 'github', project: '', vcs: fakeVcs() });
  assert.match(r.pending.reason, /project\.slug/);
});

// ── #1164 actor ─────────────────────────────────────────────────────────────

function gitDouble(initial = null) {
  const state = { value: initial, writes: [] };
  return { state, get: () => state.value, set: (v) => { state.value = v; state.writes.push(v); } };
}

test('#1164 resolveBrainActor: from the authenticated VCS identity, written to the LOCAL git config', async () => {
  const git = gitDouble();
  const r = await resolveBrainActor({ vcs: fakeVcs({ whoamiName: 'octo' }), gitGet: git.get, gitSet: git.set });
  assert.equal(r.status, 'set');
  assert.equal(r.actor, '@octo');
  assert.deepEqual(git.state.writes, ['@octo']);
});

test('#1164 resolveBrainActor: an existing valid brain.actor is kept and never overwritten', async () => {
  const git = gitDouble('@mine');
  const r = await resolveBrainActor({ vcs: fakeVcs({ whoamiName: 'octo' }), gitGet: git.get, gitSet: git.set });
  assert.equal(r.status, 'kept');
  assert.equal(r.actor, '@mine');
  assert.deepEqual(git.state.writes, []);
});

test('#1164 resolveBrainActor: no identity and no config is a pending step with the exact command — never guessed from user.name', async () => {
  const git = gitDouble();
  const r = await resolveBrainActor({ vcs: fakeVcs({ whoamiThrows: 'not logged in' }), gitGet: git.get, gitSet: git.set });
  assert.equal(r.status, 'pending');
  assert.match(r.next, /git config --local brain\.actor @<handle>/);
  assert.deepEqual(git.state.writes, [], 'nothing written');
});

test('#1164 resolveBrainActor: a VCS username that is not a handle, or a malformed existing value, is pending', async () => {
  const bad = await resolveBrainActor({ vcs: fakeVcs({ whoamiName: 'a b' }), gitGet: () => null, gitSet: () => assert.fail('must not write') });
  assert.equal(bad.status, 'pending');
  const malformed = await resolveBrainActor({ vcs: fakeVcs({ whoamiName: 'octo' }), gitGet: () => 'Jane Doe', gitSet: () => {} });
  assert.equal(malformed.status, 'set', 'a malformed existing value is replaced by the authenticated identity, not trusted');
});
