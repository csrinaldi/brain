// REQ-1128-8 / REQ-1129-9 — a third platform and a third engine plug in with ONE adapter file,
// one descriptor and config. Test-only: the fixtures live in a temp `base` that the registry's
// scan of the shipped tree never sees and `npm pack` cannot ship. The shipped modules are
// reached only through their injectable entry points (loadRuntimeRegistry, validateAxisConfig,
// resolveAxis, harnessAdapterUrl, dispatch, runColdReviewStage). This file is the proof that
// `lib/axis-config.mjs`, `roles/first-party/project-role.mjs` and `axes/layout.test.mjs` need no
// edit for a new runtime; the commit that added it touched none of them.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

import { loadRuntimeRegistry } from './lib/runtime-registry.mjs';
import { harnessAdapterUrl } from './lib/harness-adapter-url.mjs';
import { validateAxisConfig, resolveAxis } from '../lib/axis-config.mjs';
import { dispatch } from '../harness/cli.mjs';
import { makeRunStageSeam } from '../harness/stage-seam.mjs';
import { runColdReviewStage } from '../review/lib/run-cold-review-stage.mjs';
import { artifactPathFor, ARTIFACT_TAG } from '../review/lib/findings-artifact.mjs';
import { platformParity } from '../__fixtures__/platform-parity.mjs';
import { engineParity } from '../__fixtures__/engine-parity.mjs';

const STAGE_OUTPUT = pathToFileURL(fileURLToPath(new URL('./lib/stage-output.mjs', import.meta.url))).href;

const PLATFORM_ADAPTER = `
export const AGENT_RUNTIME = null;
export async function init() { return { ok: true }; }
`;
const PLATFORM_DESCRIPTOR = `export const DESCRIPTOR = Object.freeze({
  name: 'zed',
  capabilities: Object.freeze({ orchestrate: true, executeStage: false }),
  readiness: false,
});
`;
const ENGINE_ADAPTER = `
import { isAbsolute } from 'node:path';
import { writeFileSync } from 'node:fs';
import { validateFinalMessageOutput } from ${JSON.stringify(STAGE_OUTPUT)};

export async function runStage({ stage, prompt, cwd, output, _run = () => ({ status: 0 }), _now = Date.now } = {}) {
  const t0 = _now();
  const elapsedMs = () => _now() - t0;
  if (typeof prompt !== 'string' || prompt.trim() === '') return { ok: false, reason: 'zed-engine: no prompt for stage ' + stage };
  const bad = validateFinalMessageOutput(output, cwd, { engine: 'zed-engine' });
  if (bad) return { ok: false, reason: bad };
  let r;
  try { r = _run('zed-engine', [prompt], { cwd }); } catch (err) { return { ok: false, elapsedMs: elapsedMs(), reason: 'zed-engine could not be spawned: ' + err.message }; }
  if (r?.error) return { ok: false, elapsedMs: elapsedMs(), reason: 'zed-engine failed to run: ' + r.error.message };
  if (r?.status !== 0) return { ok: false, elapsedMs: elapsedMs(), reason: 'zed-engine exited with status ' + r?.status };
  if (!isAbsolute(output.tempPath)) return { ok: false, reason: 'relative output' };
  writeFileSync(output.tempPath, '\`\`\`${ARTIFACT_TAG}\\n[]\\n\`\`\`\\n');
  return { ok: true, elapsedMs: elapsedMs() };
}
`;
const ENGINE_DESCRIPTOR = `export const DESCRIPTOR = Object.freeze({
  name: 'zed-engine',
  capabilities: Object.freeze({ orchestrate: false, executeStage: true }),
  stage: Object.freeze({ outputMode: 'final-message', model: Object.freeze({ policy: 'opaque' }) }),
  readiness: false,
});
`;

let dir;
let base;
let registry;
const loader = (name) => import(harnessAdapterUrl(name, { base }).href);
const scaffoldDispatch = (name, op, args) => dispatch(name, op, args, { backendLoader: loader });

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'runtime-scaffold-'));
  for (const [rel, text] of Object.entries({
    'platform/adapters/zed.mjs': PLATFORM_ADAPTER,
    'platform/adapters/zed.descriptor.mjs': PLATFORM_DESCRIPTOR,
    'review-engine/adapters/zed-engine.mjs': ENGINE_ADAPTER,
    'review-engine/adapters/zed-engine.descriptor.mjs': ENGINE_DESCRIPTOR,
  })) {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
  }
  base = pathToFileURL(`${dir}/`);
  registry = await loadRuntimeRegistry({ base });
});
after(() => rmSync(dir, { recursive: true, force: true }));

describe('a third platform and a third engine, with no shipped file touched', () => {
  it('the registry discovers both', () => {
    assert.deepEqual(registry.names, ['zed', 'zed-engine']);
    assert.deepEqual(registry.orchestrators, ['zed']);
    assert.deepEqual(registry.stageRuntimes, ['zed-engine']);
  });

  const CONFIG = {
    platform: { default: 'zed', providers: { zed: {}, 'zed-engine': {} } },
    sdd: { default: 'plain', providers: { plain: {}, brain: {} }, roles: { 'cold-review': { agent: 'brain:cold-review', engine: 'zed-engine' } } },
  };

  it('validateAxisConfig accepts them, and the shipped registry would not', () => {
    assert.deepEqual(validateAxisConfig(CONFIG, { registry }).errors, []);
    assert.ok(validateAxisConfig(CONFIG).errors.length > 0, 'unknown to the shipped tree');
  });

  it('resolveAxis resolves the new platform', () => {
    assert.equal(resolveAxis('platform', { config: CONFIG, registry, env: {}, dotenv: {}, userConfig: {} }).value, 'zed');
  });

  it('a fixture engine cannot be the platform default, and a platform cannot be a stage engine', () => {
    const asDefault = { ...CONFIG, platform: { default: 'zed-engine', providers: CONFIG.platform.providers } };
    assert.ok(validateAxisConfig(asDefault, { registry }).errors.some((e) => e.code === 'default-cannot-orchestrate'));
    const asEngine = { ...CONFIG, sdd: { ...CONFIG.sdd, roles: { 'cold-review': { agent: 'brain:cold-review', engine: 'zed' } } } };
    assert.ok(validateAxisConfig(asEngine, { registry }).errors.some((e) => e.code === 'role-engine-cannot-execute'));
  });

  platformParity('zed', {
    descriptor: { name: 'zed', capabilities: { orchestrate: true, executeStage: false }, readiness: false },
    load: () => loader('zed'),
    dispatch: scaffoldDispatch,
  });

  engineParity('zed-engine', {
    descriptor: { name: 'zed-engine', capabilities: { orchestrate: false, executeStage: true }, stage: { outputMode: 'final-message', model: { policy: 'opaque' } }, readiness: false },
    load: () => loader('zed-engine'),
    cases: ['a', 'd', 'f'],
  });

  it('runColdReviewStage routes to the fixture engine and materialises its artifact', async () => {
    const root = mkdtempSync(join(tmpdir(), 'scaffold-root-'));
    const worktree = mkdtempSync(join(tmpdir(), 'scaffold-worktree-'));
    try {
      const result = await runColdReviewStage({
        config: { sdd: { map: { 'cold-review': { engine: 'zed-engine' } } } },
        prNumber: 1128, root, worktreePath: worktree, baseRef: 'aaa', headRef: 'bbb',
        deps: {
          registry,
          forgeProbe: () => ({ status: 1, stderr: 'not logged into any hosts' }),
          runStage: makeRunStageSeam({ dispatch: scaffoldDispatch }),
        },
      });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.match(readFileSync(join(root, artifactPathFor(1128)), 'utf8'), new RegExp(ARTIFACT_TAG));
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(worktree, { recursive: true, force: true });
    }
  });
});
