// REQ-1128-7 — the agent-platform parity test. ONE body (`platformParity`, exported below)
// runs over every orchestrating platform the registry declares. A new platform joins by
// shipping its descriptor; nothing here lists it. Precedent: axes/vcs/contract.test.mjs.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { RUNTIME_REGISTRY } from '../lib/runtime-registry.mjs';
import { harnessAdapterUrl } from '../lib/harness-adapter-url.mjs';
import { dispatch } from '../../harness/cli.mjs';
import { SOURCE_DOCS } from './adapters/antigravity.mjs';

// The body is exported for the scaffold test (REQ-1128-8). Importing this file must not run the
// registry loop again, so the loop is gated on being the entry file.
const REAL_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

/** Every file under `root` -> its bytes, as a Map keyed by root-relative path. */
function snapshot(root) {
  const out = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory()) walk(abs);
      else out.set(relative(root, abs), readFileSync(abs, 'utf8'));
    }
  };
  walk(root);
  return out;
}

const changed = (before, after) => [...after.keys()].filter((k) => before.get(k) !== after.get(k)).sort();

/**
 * @param {string} name
 * @param {object} o
 * @param {object} o.descriptor
 * @param {() => Promise<object>} o.load Loads the adapter module.
 * @param {(name: string, op: string, args: any[]) => Promise<any>} o.dispatch The real dispatcher, over the loader that finds `name`.
 */
export function platformParity(name, { descriptor, load, dispatch }) {
  const roots = [];
  function tmpRoot() {
    const root = mkdtempSync(join(tmpdir(), `platform-parity-${name}-`));
    roots.push(root);
    for (const rel of SOURCE_DOCS) {
      mkdirSync(join(root, dirname(rel)), { recursive: true });
      copyFileSync(join(REAL_ROOT, rel), join(root, rel));
    }
    return root;
  }
  const run = async (mod, root) => mod.init({ _repoRoot: root, _emit: () => {} });
  const quiet = async (fn) => {
    const warn = console.warn;
    console.warn = () => {};
    try { return await fn(); } finally { console.warn = warn; }
  };

  describe(`agent-platform parity: ${name}`, () => {
    it('(a) exports init and an own AGENT_RUNTIME (null or {name, bin, versionArgs})', async () => {
      const mod = await load();
      assert.equal(typeof mod.init, 'function');
      assert.ok(Object.prototype.hasOwnProperty.call(mod, 'AGENT_RUNTIME'), 'AGENT_RUNTIME must be declared, even as null');
      if (mod.AGENT_RUNTIME !== null) {
        for (const k of ['name', 'bin', 'versionArgs']) assert.ok(k in mod.AGENT_RUNTIME, `AGENT_RUNTIME.${k}`);
      }
    });

    it('(b) init answers ok: true on an empty root', async () => {
      const mod = await load();
      const root = tmpRoot();
      const r = await quiet(() => run(mod, root));
      assert.equal(typeof r, 'object');
      assert.equal(r?.ok, true, JSON.stringify(r));
    });

    it('(c) a second run leaves every file byte-identical', async () => {
      const mod = await load();
      const root = tmpRoot();
      await quiet(() => run(mod, root));
      const first = snapshot(root);
      await quiet(() => run(mod, root));
      assert.deepEqual(changed(first, snapshot(root)), []);
      assert.equal(snapshot(root).size, first.size);
    });

    it('(d) a consumer key and a custom hook in a written .json survive a re-run', async () => {
      const mod = await load();
      const root = tmpRoot();
      const seeded = snapshot(root);
      await quiet(() => run(mod, root));
      const written = changed(seeded, snapshot(root)).filter((f) => f.endsWith('.json'));
      for (const rel of written) {
        const abs = join(root, rel);
        const doc = JSON.parse(readFileSync(abs, 'utf8'));
        doc.consumerOwnedKey = { keep: 1 };
        doc.hooks = { ...(doc.hooks ?? {}), ConsumerOnlyEvent: [{ hooks: [{ type: 'command', command: 'echo consumer-hook' }] }] };
        writeFileSync(abs, JSON.stringify(doc, null, 2) + '\n');
        await quiet(() => run(mod, root));
        const after = JSON.parse(readFileSync(abs, 'utf8'));
        assert.deepEqual(after.consumerOwnedKey, { keep: 1 }, `${rel} lost the consumer's key`);
        assert.match(JSON.stringify(after.hooks), /consumer-hook/, `${rel} lost the consumer's hook`);
      }
    });

    it('(e) a malformed .json it wrote is refused: ok:false, file untouched, reason names the path', async () => {
      const mod = await load();
      const root = tmpRoot();
      const seeded = snapshot(root);
      await quiet(() => run(mod, root));
      const written = changed(seeded, snapshot(root)).filter((f) => f.endsWith('.json'));
      for (const rel of written) {
        const abs = join(root, rel);
        writeFileSync(abs, '{ this is not json');
        const r = await quiet(() => run(mod, root));
        assert.equal(r?.ok, false, `${rel}: ${JSON.stringify(r)}`);
        assert.equal(readFileSync(abs, 'utf8'), '{ this is not json', `${rel} was overwritten`);
        assert.ok(String(r.reason).includes(rel), `the reason must name ${rel}: ${r.reason}`);
        writeFileSync(abs, JSON.stringify({}) + '\n');
      }
      if (written.length === 0) {
        // A platform that writes no .json has nothing to refuse; the observed set is asserted, never assumed.
        assert.deepEqual(changed(seeded, snapshot(root)).filter((f) => f.endsWith('.json')), []);
      }
    });

    it('(f) the capabilities agree with the module', async () => {
      const mod = await load();
      if (descriptor.capabilities.orchestrate) assert.equal(typeof mod.init, 'function');
      if (descriptor.capabilities.executeStage) {
        assert.equal(typeof mod.runStage, 'function');
        assert.ok(descriptor.stage, 'executeStage needs a stage declaration');
      } else {
        assert.equal(descriptor.stage, undefined);
      }
    });

    it('(g) dispatch through the real harness resolves the same answer', async () => {
      const mod = await load();
      const direct = await quiet(() => run(mod, tmpRoot()));
      const viaCli = await quiet(() => dispatch(name, 'init', [{ _repoRoot: tmpRoot(), _emit: () => {} }]));
      assert.deepEqual(viaCli, direct);
    });

    it('cleans up its temp roots', () => {
      for (const r of roots.splice(0)) if (existsSync(r)) rmSync(r, { recursive: true, force: true });
    });
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const name of RUNTIME_REGISTRY.orchestrators) {
    platformParity(name, {
      descriptor: RUNTIME_REGISTRY.descriptor(name),
      load: () => import(harnessAdapterUrl(name).href),
      dispatch,
    });
  }
}
