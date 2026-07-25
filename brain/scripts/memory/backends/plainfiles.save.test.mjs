// plainfiles.save.test.mjs — unit tests for backends/plainfiles.mjs#save (C3,
// issue #246, REQ-C3-2). Every seam is injected (root, getBranch, getTimestamp,
// getHostname) so no real git/clock/hostname dependency runs in `npm test`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// RED: plainfiles.mjs does not exist yet.
import { save } from './plainfiles.mjs';

function tmpRoot() {
  return mkdtempSync(join(tmpdir(), 'plainfiles-save-'));
}

// ── 2.1 — a secret hit aborts BEFORE appendRecord: no write, no index change ──

test('save: a secret hit aborts before any write (fail-closed, no index change)', async () => {
  const root = tmpRoot();
  try {
    await assert.rejects(() =>
      save(
        'leaked token',
        'ghp_abcdefghijklmnopqrstuvwx',
        { type: 'discovery', project: 'brain' },
        { root, getBranch: () => 'main', getTimestamp: () => '2026-07-12T09:00:00Z', getHostname: () => 'host1' },
      ),
    );
    assert.equal(existsSync(join(root, '.memory', 'records')), false, 'no records/ dir should be created on a secret hit');
    assert.equal(existsSync(join(root, '.memory', 'index.jsonl')), false, 'no index should be written on a secret hit');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 2.2 — a successful save records MEASURED provenance, not caller input ────

test('save: argument shape has no actor/actorKind/ts field; the appended record uses measured provenance', async () => {
  const root = tmpRoot();
  try {
    const opts = { type: 'discovery', project: 'brain' };
    // The options bag itself must never carry these fields — asserting this
    // documents the spoof-resistance contract at the call site.
    assert.equal('actor' in opts, false);
    assert.equal('actorKind' in opts, false);
    assert.equal('ts' in opts, false);

    const result = await save('a title', 'the body', opts, {
      root,
      getBranch: () => 'feat/some-branch',
      getTimestamp: () => '2026-07-12T09:41:07Z',
      getHostname: () => 'my-host',
    });

    assert.equal(result.written, true);
    assert.ok(result.id.startsWith('rec-'));
    assert.ok(existsSync(result.file), 'the returned file path must exist');

    const raw = readFileSync(result.file, 'utf8').trim();
    const record = JSON.parse(raw);
    assert.equal(record.actor, 'feat/some-branch', 'actor must come from the injected getBranch seam');
    assert.equal(record.actorKind, 'agent', 'actorKind must be the door-typed constant \'agent\'');
    assert.equal(record.ts, '2026-07-12T09:41:07Z', 'ts must come from the injected getTimestamp seam');
    assert.equal(record.id, result.id);

    // rebuildIndex() must have run after the append.
    const indexPath = join(root, '.memory', 'index.jsonl');
    assert.ok(existsSync(indexPath), 'index.jsonl must be rebuilt after a successful save');
    const indexRaw = readFileSync(indexPath, 'utf8');
    assert.ok(indexRaw.includes(record.id), 'the rebuilt index must include the new record id');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── fresh-context review MINOR 2 — scope/topic are ignored LOUDLY, never silently ──

function captureWarn(fn) {
  const warnings = [];
  const orig = console.warn;
  console.warn = (...args) => warnings.push(args.join(' '));
  return fn().finally(() => { console.warn = orig; }).then((result) => ({ result, warnings }));
}

test('save: warns when --scope/--topic are passed (ignored — no home in the record format), naming them', async () => {
  const root = tmpRoot();
  try {
    const { result, warnings } = await captureWarn(() =>
      save('t', 'c', { type: 'discovery', project: 'brain', scope: 'project', topic: 'sdd/x/y' }, {
        root, getBranch: () => 'main', getTimestamp: () => '2026-07-12T09:00:00Z', getHostname: () => 'h',
      }),
    );
    assert.equal(result.written, true, 'the record must still be written normally');
    assert.equal(warnings.length, 1, `expected exactly one warning, got: ${JSON.stringify(warnings)}`);
    assert.ok(warnings[0].includes('scope'), `warning must name 'scope': ${warnings[0]}`);
    assert.ok(warnings[0].includes('topic'), `warning must name 'topic': ${warnings[0]}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('save: does NOT warn when scope/topic are absent', async () => {
  const root = tmpRoot();
  try {
    const { result, warnings } = await captureWarn(() =>
      save('t', 'c', { type: 'discovery', project: 'brain' }, {
        root, getBranch: () => 'main', getTimestamp: () => '2026-07-12T09:00:00Z', getHostname: () => 'h',
      }),
    );
    assert.equal(result.written, true);
    assert.deepEqual(warnings, [], 'no warning should fire when scope/topic are not passed');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── 2.4 — seam defaults: getBranch/getTimestamp/getHostname default to the real impls ──

test('save: getBranch/getTimestamp/getHostname default to real implementations when not injected', async () => {
  const root = tmpRoot(); // NOT a git repo — real getBranch must fall back to 'unknown'
  try {
    const result = await save('another title', 'another body', { type: 'discovery', project: 'brain' }, { root });
    assert.equal(result.written, true);

    const raw = readFileSync(result.file, 'utf8').trim();
    const record = JSON.parse(raw);
    assert.equal(record.actor, 'unknown', 'default getBranch on a non-git tmp dir must resolve to \'unknown\'');
    assert.match(record.ts, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'default getTimestamp must be C2a canonical UTC-seconds');
    assert.ok(record.source.startsWith('plainfiles save on '), 'source must fold in the (real or injected) hostname');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
