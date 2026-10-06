// REQ-1128-1 — every runtime provider ships one import-free descriptor leaf (#1128, #1129).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FILES = {
  claude: 'platform/adapters/claude.descriptor.mjs',
  antigravity: 'platform/adapters/antigravity.descriptor.mjs',
  plain: 'platform/adapters/plain.descriptor.mjs',
  codex: 'review-engine/adapters/codex.descriptor.mjs',
  gemini: 'review-engine/adapters/gemini.descriptor.mjs',
};

// Today's PLATFORM_CAPABILITIES (lib/axis-config.mjs, ADR-0038 section 5), pinned by value.
const CAPABILITIES = {
  claude: { orchestrate: true, executeStage: true },
  antigravity: { orchestrate: true, executeStage: false },
  plain: { orchestrate: true, executeStage: false },
  codex: { orchestrate: false, executeStage: true },
  gemini: { orchestrate: false, executeStage: true },
};

const load = (name) => import(new URL(FILES[name], import.meta.url).href).then((m) => m.DESCRIPTOR);

describe('descriptor leaves', () => {
  for (const name of Object.keys(FILES)) {
    describe(name, () => {
      it('has no import, no export-from and no top-level await', () => {
        const src = readFileSync(new URL(FILES[name], import.meta.url), 'utf8');
        assert.doesNotMatch(src, /^\s*import\b/m);
        assert.doesNotMatch(src, /\bexport\s+(\*|\{[^}]*\})\s*from\b/);
        assert.doesNotMatch(src, /\bawait\b/);
      });

      it('is frozen and carries the shipped capabilities', async () => {
        const d = await load(name);
        assert.ok(Object.isFrozen(d));
        assert.equal(d.name, name);
        assert.deepEqual({ ...d.capabilities }, CAPABILITIES[name]);
      });
    });
  }

  it('declares the stage facts of the D1 table', async () => {
    assert.deepEqual(JSON.parse(JSON.stringify((await load('claude')).stage)), { outputMode: 'file', model: { policy: 'opaque' } });
    assert.deepEqual(JSON.parse(JSON.stringify((await load('codex')).stage)), { outputMode: 'final-message', model: { policy: 'pinned', id: 'gpt-5.5' } });
    assert.deepEqual(JSON.parse(JSON.stringify((await load('gemini')).stage)), { outputMode: 'final-message', model: { policy: 'default', id: 'gemini-2.5-pro' } });
    assert.equal((await load('antigravity')).stage, undefined);
    assert.equal((await load('plain')).stage, undefined);
  });

  it('declares readiness for codex and gemini only', async () => {
    const got = {};
    for (const n of Object.keys(FILES)) got[n] = (await load(n)).readiness;
    assert.deepEqual(got, { claude: false, antigravity: false, plain: false, codex: true, gemini: true });
  });

  it('ranks the platforms in ADR-0024 Amendment 2 order: claude, antigravity, plain', async () => {
    assert.deepEqual([(await load('claude')).rank, (await load('antigravity')).rank, (await load('plain')).rank], [1, 2, 3]);
  });
});
