// REQ-1128-1/2/5 — the runtime registry discovers, validates and serves descriptors (#1128, #1129).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadRuntimeRegistry, RUNTIME_REGISTRY } from './runtime-registry.mjs';

const desc = (o = {}) => ({
  name: 'zed',
  capabilities: { orchestrate: true, executeStage: false },
  readiness: false,
  ...o,
});
const descSrc = (d) => `export const DESCRIPTOR = Object.freeze(${JSON.stringify(d)});\n`;

let root;
let n = 0;
before(() => { root = mkdtempSync(join(tmpdir(), 'runtime-registry-')); });
after(() => rmSync(root, { recursive: true, force: true }));

/** Build a temp `base` from { 'platform/adapters/zed.mjs': '...' } and return its URL. */
function fixture(files) {
  const dir = join(root, `f${n++}`);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  return pathToFileURL(`${dir}/`);
}
const A = 'platform/adapters/';
const E = 'review-engine/adapters/';

describe('loadRuntimeRegistry', () => {
  it('serves a valid descriptor', async () => {
    const base = fixture({ [`${A}zed.mjs`]: '', [`${A}zed.descriptor.mjs`]: descSrc(desc()) });
    const r = await loadRuntimeRegistry({ base });
    assert.deepEqual(r.names, ['zed']);
    assert.deepEqual(r.orchestrators, ['zed']);
    assert.deepEqual(r.stageRuntimes, []);
    assert.deepEqual(r.capabilities.zed, { orchestrate: true, executeStage: false });
    assert.equal(r.descriptor('zed').name, 'zed');
    assert.equal(r.descriptor('nope'), null);
  });

  it('refuses an adapter with no descriptor, naming both files', async () => {
    const base = fixture({ [`${A}zed.mjs`]: '' });
    await assert.rejects(loadRuntimeRegistry({ base }), (e) => /zed\.mjs/.test(e.message) && /zed\.descriptor\.mjs/.test(e.message));
  });

  it('refuses a duplicate name across the two directories, naming both paths', async () => {
    const d = descSrc(desc());
    const base = fixture({ [`${A}zed.mjs`]: '', [`${A}zed.descriptor.mjs`]: d, [`${E}zed.descriptor.mjs`]: d });
    await assert.rejects(loadRuntimeRegistry({ base }), (e) => /duplicate/i.test(e.message) && e.message.includes(`${A}zed.descriptor.mjs`) && e.message.includes(`${E}zed.descriptor.mjs`));
  });

  it('refuses a name that differs from its basename', async () => {
    const base = fixture({ [`${A}zed.mjs`]: '', [`${A}zed.descriptor.mjs`]: descSrc(desc({ name: 'other' })) });
    await assert.rejects(loadRuntimeRegistry({ base }), /zed\.descriptor\.mjs.*name/s);
  });

  it('refuses a malformed shape', async () => {
    const base = fixture({ [`${A}zed.mjs`]: '', [`${A}zed.descriptor.mjs`]: descSrc(desc({ capabilities: { orchestrate: 'yes' } })) });
    await assert.rejects(loadRuntimeRegistry({ base }), /zed\.descriptor\.mjs/);
  });

  it('refuses a stage without executeStage, and executeStage without a stage', async () => {
    const stage = { outputMode: 'file', model: { policy: 'opaque' } };
    const b1 = fixture({ [`${A}zed.mjs`]: '', [`${A}zed.descriptor.mjs`]: descSrc(desc({ stage })) });
    await assert.rejects(loadRuntimeRegistry({ base: b1 }), /stage/);
    const b2 = fixture({ [`${E}zed.mjs`]: '', [`${E}zed.descriptor.mjs`]: descSrc(desc({ capabilities: { orchestrate: false, executeStage: true } })) });
    await assert.rejects(loadRuntimeRegistry({ base: b2 }), /stage/);
  });

  it('refuses an unknown outputMode and a pinned model without an id', async () => {
    const caps = { orchestrate: false, executeStage: true };
    const b1 = fixture({ [`${E}zed.mjs`]: '', [`${E}zed.descriptor.mjs`]: descSrc(desc({ capabilities: caps, stage: { outputMode: 'sideways', model: { policy: 'opaque' } } })) });
    await assert.rejects(loadRuntimeRegistry({ base: b1 }), /outputMode/);
    const b2 = fixture({ [`${E}zed.mjs`]: '', [`${E}zed.descriptor.mjs`]: descSrc(desc({ capabilities: caps, stage: { outputMode: 'file', model: { policy: 'pinned' } } })) });
    await assert.rejects(loadRuntimeRegistry({ base: b2 }), /model/);
    const b3 = fixture({ [`${E}zed.mjs`]: '', [`${E}zed.descriptor.mjs`]: descSrc(desc({ capabilities: caps, stage: { outputMode: 'file', model: { policy: 'opaque', id: 'x' } } })) });
    await assert.rejects(loadRuntimeRegistry({ base: b3 }), /model/);
  });

  it('ignores dotted helper basenames and tests', async () => {
    const base = fixture({
      [`${A}zed.mjs`]: '', [`${A}zed.descriptor.mjs`]: descSrc(desc()),
      [`${A}zed.readiness.mjs`]: '', [`${A}zed.test.mjs`]: '', [`${A}zed.roles.mjs`]: '',
    });
    assert.deepEqual((await loadRuntimeRegistry({ base })).names, ['zed']);
  });

  it('tolerates a missing adapters directory', async () => {
    const base = fixture({ [`${E}zed.mjs`]: '', [`${E}zed.descriptor.mjs`]: descSrc(desc({ capabilities: { orchestrate: false, executeStage: true }, stage: { outputMode: 'file', model: { policy: 'opaque' } } })) });
    const r = await loadRuntimeRegistry({ base });
    assert.deepEqual(r.stageRuntimes, ['zed']);
    assert.deepEqual(r.orchestrators, []);
  });

  it('orders the derived lists by rank, then name; unranked last', async () => {
    const mk = (name, rank) => ({
      [`${A}${name}.mjs`]: '',
      [`${A}${name}.descriptor.mjs`]: descSrc(desc({ name, ...(rank === undefined ? {} : { rank }) })),
    });
    const base = fixture({ ...mk('beta'), ...mk('alpha'), ...mk('zulu', 1), ...mk('mid', 2) });
    const r = await loadRuntimeRegistry({ base });
    assert.deepEqual(r.orchestrators, ['zulu', 'mid', 'alpha', 'beta']);
    assert.deepEqual(r.names, ['alpha', 'beta', 'mid', 'zulu'], 'names are plain sorted');
  });

  it('refuses a non-numeric rank', async () => {
    const base = fixture({ [`${A}zed.mjs`]: '', [`${A}zed.descriptor.mjs`]: descSrc(desc({ rank: 'first' })) });
    await assert.rejects(loadRuntimeRegistry({ base }), /rank/);
  });

  it('freezes the registry', async () => {
    const base = fixture({ [`${A}zed.mjs`]: '', [`${A}zed.descriptor.mjs`]: descSrc(desc()) });
    const r = await loadRuntimeRegistry({ base });
    assert.ok(Object.isFrozen(r) && Object.isFrozen(r.capabilities) && Object.isFrozen(r.orchestrators));
  });
});

describe('RUNTIME_REGISTRY (the shipped tree)', () => {
  it('holds the five shipped runtimes in the ratified platform order', () => {
    assert.deepEqual(RUNTIME_REGISTRY.names, ['antigravity', 'claude', 'codex', 'gemini', 'plain']);
    assert.deepEqual(RUNTIME_REGISTRY.orchestrators, ['claude', 'antigravity', 'plain']);
    assert.deepEqual(RUNTIME_REGISTRY.stageRuntimes, ['claude', 'codex', 'gemini']);
  });
});

describe('the registry module is a leaf (REQ-1128-5)', () => {
  it('imports only node: builtins', () => {
    const src = readFileSync(new URL('./runtime-registry.mjs', import.meta.url), 'utf8');
    const specs = [...src.matchAll(/^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gms)].map((m) => m[1]);
    assert.ok(specs.length > 0);
    for (const s of specs) assert.match(s, /^node:/, `non-builtin import: ${s}`);
  });
});
