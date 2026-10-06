// REQ-1129-8 — the review-engine parity test. ONE body (`engineParity`, exported below)
// runs over every stage runtime the registry declares. A new engine joins by shipping its
// descriptor; nothing here lists it. Precedent: axes/vcs/contract.test.mjs.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { credentialEnvNames } from '../../lib/credential-env.mjs';
import { SDD_LIFECYCLE_STAGES } from '../../lib/stage-engine.mjs';

import { RUNTIME_REGISTRY } from '../lib/runtime-registry.mjs';
import { harnessAdapterUrl } from '../lib/harness-adapter-url.mjs';

// The body is exported for the scaffold test (REQ-1129-9), which runs a subset over a fixture engine.
// Importing this file must not run the registry loop again, so the loop is gated on being the entry file.
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/;

/**
 * @param {string} name The engine name.
 * @param {object} o
 * @param {object} o.descriptor The engine's descriptor.
 * @param {() => Promise<{runStage: Function}>} o.load Loads the adapter module.
 * @param {(root: string) => {env?: object, args?: object}} [o.seams] Per-engine success seams: extra `_env` entries and extra runStage args, built under a temp root.
 * @param {string[]} [o.cases] Which lettered cases to run (default all).
 * @param {string} [o.readinessDir] Directory URL holding `<name>.readiness.mjs` (case g).
 */
export function engineParity(name, { descriptor, load, seams = () => ({}), cases = 'abcdefgh'.split(''), readinessDir } = {}) {
  const want = (c) => cases.includes(c);
  const stage = descriptor.stage;
  const model = stage.model.policy === 'opaque' ? null : stage.model.id;
  const finalMessage = stage.outputMode === 'final-message';
  const roots = [];

  function setup() {
    const root = mkdtempSync(join(tmpdir(), `engine-parity-${name}-`));
    roots.push(root);
    const candidate = join(root, 'candidate');
    const host = join(root, 'host');
    mkdirSync(candidate);
    mkdirSync(host);
    const s = seams(root);
    const output = { mode: 'final-message', tempPath: join(host, 'last.md'), artifactPath: join(host, 'artifact.md') };
    const calls = [];
    const base = (extra = {}) => ({
      stage: 'cold-review', prompt: 'review it', model, cwd: candidate, output, routed: undefined,
      _env: { PATH: process.env.PATH ?? '', SAFE: 'kept', ...(s.env ?? {}) },
      _now: (() => { let t = 1000; return () => (t += 5); })(),
      ...(s.args ?? {}),
      ...extra,
    });
    const okRun = (_bin, _args, opts) => { calls.push(opts); if (finalMessage) writeFileSync(output.tempPath, '```brain-findings/1\n[]\n```\n'); return { status: 0, stdout: '```brain-findings/1\n[]\n```\n', stderr: '' }; };
    return { root, candidate, output, base, calls, okRun };
  }

  describe(`review-engine parity: ${name}`, () => {
    if (want('a')) {
      it('(a) an empty prompt is refused without spawning', async () => {
        const { runStage } = await load();
        const t = setup();
        let spawned = 0;
        const r = await runStage(t.base({ prompt: '  ', _run: () => { spawned++; return { status: 0 }; } }));
        assert.equal(r.ok, false);
        assert.equal(spawned, 0);
      });
    }

    if (want('b')) {
      it('(b) a lifecycle stage without routed evidence throws', async () => {
        const { runStage } = await load();
        const t = setup();
        let spawned = 0;
        await assert.rejects(Promise.resolve().then(() => runStage(t.base({ stage: SDD_LIFECYCLE_STAGES[0], _run: () => { spawned++; return { status: 0 }; } }))));
        assert.equal(spawned, 0);
      });
    }

    if (want('c')) {
      it('(c) the spawn env lacks every credential name, and the forge shadow applies after the scrub', async () => {
        const { runStage } = await load();
        const t = setup();
        const names = credentialEnvNames();
        const dirty = Object.fromEntries(names.map((n) => [n, 'leak']));
        const shadow = join(t.root, 'forge-shadow');
        const args = t.base({ forgeConfigDir: shadow, _run: t.okRun });
        args._env = { ...args._env, ...dirty };
        const r = await runStage(args);
        assert.equal(r.ok, true, JSON.stringify(r));
        const env = t.calls[0].env;
        for (const n of names) {
          if (n === 'GH_CONFIG_DIR' || n === 'GLAB_CONFIG_DIR') continue;
          assert.equal(env[n], undefined, `${n} reached the engine`);
        }
        assert.equal(env.GH_CONFIG_DIR, shadow);
        assert.equal(env.GLAB_CONFIG_DIR, shadow);
        assert.equal(env.SAFE, 'kept');
      });
    }

    if (want('d')) {
      for (const [label, run] of [
        ['a spawn throw', () => { throw new Error('ENOENT: no such binary'); }],
        ['ETIMEDOUT', () => ({ error: Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }), stdout: '', stderr: '' })],
        ['a non-zero status', () => ({ status: 2, stdout: '', stderr: 'boom' })],
      ]) {
        it(`(d) ${label} is ok:false with a numeric elapsedMs`, async () => {
          const { runStage } = await load();
          const t = setup();
          const r = await runStage(t.base({ _run: run }));
          assert.equal(r.ok, false);
          assert.equal(typeof r.elapsedMs, 'number');
          assert.equal(typeof r.reason, 'string');
        });
      }
    }

    if (want('e')) {
      it('(e) the redaction contract: secrets redacted, control bytes gone, tail bounded', async () => {
        const { runStage } = await load();
        const t = setup();
        const secret = ['ghp', 'PARITYSECRET0123'].join('_');
        const noisy = `auth failed for ${secret} \u001b[31mred\u001b[0m\n${'filler '.repeat(1500)}\nlast line with ${secret} \u0007bell`;
        const args = t.base({ _run: () => ({ status: 1, stdout: '', stderr: noisy }) });
        args._env = { ...args._env, GH_TOKEN: secret };
        const r = await runStage(args);
        assert.equal(r.ok, false);
        assert.ok(!r.reason.includes(secret), 'the secret leaked into the reason');
        assert.match(r.reason, /\[redacted\]/);
        assert.doesNotMatch(r.reason, CONTROL);
        const said = r.reason.split(' — the engine last said: ')[1] ?? '';
        assert.ok(said.length <= 301, `the tail is ${said.length} characters`);
      });
    }

    if (want('f')) {
      if (finalMessage) {
        it('(f) a missing or in-candidate output is refused before spawning', async () => {
          const { runStage } = await load();
          const t = setup();
          let spawned = 0;
          const run = () => { spawned++; return { status: 0 }; };
          assert.equal((await runStage(t.base({ output: undefined, _run: run }))).ok, false);
          assert.equal((await runStage(t.base({ output: { ...t.output, tempPath: join(t.candidate, 'x.tmp') }, _run: run }))).ok, false);
          assert.equal((await runStage(t.base({ output: { ...t.output, tempPath: join(t.candidate, '..x') }, _run: run }))).ok, false);
          assert.equal(spawned, 0);
        });
      } else {
        it('(f) a file-mode engine ignores the output descriptor', async () => {
          const { runStage } = await load();
          const t = setup();
          const r = await runStage(t.base({ output: undefined, _run: t.okRun }));
          assert.equal(r.ok, true, JSON.stringify(r));
          const r2 = await runStage(t.base({ output: { mode: 'final-message', tempPath: 'relative' }, _run: t.okRun }));
          assert.equal(r2.ok, true, JSON.stringify(r2));
        });
      }
    }

    if (want('g') && readinessDir) {
      it('(g) readiness: true if and only if <name>.readiness.mjs exports checkReadiness', async () => {
        const file = new URL(`${name}.readiness.mjs`, readinessDir);
        const exists = existsSync(new URL(file));
        assert.equal(exists, descriptor.readiness, `readiness is ${descriptor.readiness} but the file ${exists ? 'exists' : 'is absent'}`);
        if (exists) assert.equal(typeof (await import(file.href)).checkReadiness, 'function');
      });
    }

    if (want('h') && stage.model.policy === 'pinned') {
      it('(h) a pinned model policy refuses any other model before spawning', async () => {
        const { runStage } = await load();
        const t = setup();
        let spawned = 0;
        const r = await runStage(t.base({ model: 'not-the-pinned-model', _run: () => { spawned++; return { status: 0 }; } }));
        assert.equal(r.ok, false);
        assert.equal(spawned, 0);
        assert.match(r.reason, new RegExp(stage.model.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      });
    }

    it('cleans up its temp roots', () => {
      for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
    });
  });
}

// What differs per engine is test knowledge: how to make a success reachable on a bare temp box.
const SEAMS = {
  claude: () => ({}),
  codex: (root) => {
    const home = join(root, 'home');
    mkdirSync(join(home, '.codex'), { recursive: true });
    writeFileSync(join(home, '.codex', 'auth.json'), '{"access_token":"x"}\n', { mode: 0o600 });
    return { env: { HOME: home } };
  },
  gemini: () => ({ args: { _commandExists: () => true, _hasAgyAuth: () => true } }),
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  for (const name of RUNTIME_REGISTRY.stageRuntimes) {
    engineParity(name, {
      descriptor: RUNTIME_REGISTRY.descriptor(name),
      load: () => import(harnessAdapterUrl(name).href),
      seams: SEAMS[name],
      readinessDir: RUNTIME_REGISTRY.dirs[name],
    });
  }
}
