// axis-resolve.test.mjs — resolveAxis (#1114 S2, ADR-0038 sections 2, 3 and 7): the ONE resolver of every axis.
// Pure tests: no file, no spawn. The callers' parity (resolvePlatform, resolveEngine, resolveProviderName,
// resolveMemoryBackend) is held next door in axis-config.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  AXES, AXIS_MEMBERS, AxisRefusal, resolveAxis, tryResolveAxis,
  AGENT_PLATFORMS, SDD_ENGINES, MEMORY_BACKENDS, VCS_PROVIDERS,
} from './axis-config.mjs';
import en from '../i18n/en.mjs';
import es from '../i18n/es.mjs';

const quiet = { notice: () => {} };
const KEY = { vcs: 'VCS_PROVIDER', memory: 'MEMORY_BACKEND', platform: 'AGENT_PLATFORM', sdd: 'SDD_ENGINE' };
const LEGACY_KEY = { vcs: (v) => ({ vcs: { provider: v } }), memory: (v) => ({ memory: { backend: v } }), platform: (v) => ({ platform: v }), sdd: (v) => ({ engine: v }) };
/** A shaped config listing every closed-set member, so a per-machine value of any member is a key of providers. */
const listing = (axis, def) => ({ [axis]: { default: def, providers: Object.fromEntries(AXIS_MEMBERS[axis].map((m) => [m, {}])) } });
const m = (axis, i) => AXIS_MEMBERS[axis][i];
const refuses = (axis, opts, code) => assert.throws(() => resolveAxis(axis, { ...quiet, ...opts }), (e) => e instanceof AxisRefusal && e.code === code && e.axis === axis, `${axis}: expected ${code}`);

test('the closed memberships are the adapters brain ships, declared once', () => {
  assert.deepEqual([...AXIS_MEMBERS.vcs], [...VCS_PROVIDERS]);
  assert.deepEqual([...AXIS_MEMBERS.memory], [...MEMORY_BACKENDS]);
  assert.deepEqual([...AXIS_MEMBERS.platform], [...AGENT_PLATFORMS]);
  assert.deepEqual([...AXIS_MEMBERS.sdd], [...SDD_ENGINES]);
  assert.deepEqual([...VCS_PROVIDERS], ['github', 'gitlab']);
});

// ── every axis x every level ────────────────────────────────────────────────
for (const axis of AXES) {
  test(`${axis}: process env > .env > <axis>.default > legacy key (VCS has no .env level)`, () => {
    const a = m(axis, 0); const b = m(axis, 1);
    const cfg = listing(axis, a);
    const win = resolveAxis(axis, { env: { [KEY[axis]]: b }, dotenv: { [KEY[axis]]: a }, config: cfg, ...quiet });
    assert.deepEqual([win.value, win.source, win.key], [b, 'process-env', KEY[axis]]);
    // the loser is REPORTED, never dropped (#1165): the .env value beneath the process env (VCS has no .env level)
    // (the config's own value is beneath it too)
    assert.deepEqual(win.shadowed, axis === 'vcs' ? [{ source: 'config', value: a }] : [{ source: 'file', value: a }, { source: 'config', value: a }]);
    const proc = resolveAxis(axis, { env: { [KEY[axis]]: b }, dotenv: {}, config: cfg, ...quiet });
    assert.equal(proc.value, b); assert.equal(proc.source, 'process-env');

    const cfgLevel = resolveAxis(axis, { env: {}, dotenv: {}, config: cfg, ...quiet });
    assert.equal(cfgLevel.value, a); assert.equal(cfgLevel.source, 'config'); assert.equal(cfgLevel.where, 'config'); assert.equal(cfgLevel.key, `${axis}.default`);

    const legacy = resolveAxis(axis, { env: {}, dotenv: {}, config: LEGACY_KEY[axis](a), ...quiet });
    assert.equal(legacy.value, a); assert.equal(legacy.source, 'legacy-config'); assert.equal(legacy.where, 'config');

    // the shape beats the legacy key
    const both = { ...LEGACY_KEY[axis](b), ...listing(axis, a) };
    assert.equal(resolveAxis(axis, { env: {}, dotenv: {}, config: both, ...quiet }).value, a);
  });

  test(`${axis}: .env ${axis === 'vcs' ? 'is IGNORED (ADR-0038 section 2: the provider is dictated by where the repo lives)' : 'sits between the process env and the config'}`, () => {
    const a = m(axis, 0); const b = m(axis, 1);
    const cfg = listing(axis, a);
    const r = resolveAxis(axis, { env: {}, dotenv: { [KEY[axis]]: b }, config: cfg, ...quiet });
    if (axis === 'vcs') {
      assert.equal(r.value, a);
      assert.equal(r.source, 'config');
      refuses(axis, { env: {}, dotenv: { VCS_PROVIDER: a }, config: {} }, 'undeclared');
    } else {
      assert.equal(r.value, b);
      assert.equal(r.source, 'dotenv');
      assert.equal(r.where, 'dotenv');
    }
  });

  test(`${axis}: an empty value is unset at every level (never a value, never a stop)`, () => {
    const a = m(axis, 0);
    const r = resolveAxis(axis, { env: { [KEY[axis]]: '' }, dotenv: { [KEY[axis]]: '  ' }, config: listing(axis, a), ...quiet });
    assert.equal(r.value, a);
    assert.equal(r.source, 'config');
  });

  test(`${axis}: nothing declared is REFUSED, naming the axis, the levels and the fix with the closed set`, () => {
    for (const config of [{}, undefined, null, { [axis]: { default: '', providers: {} } }]) {
      let err;
      try { resolveAxis(axis, { env: {}, dotenv: {}, config, ...quiet }); } catch (e) { err = e; }
      assert.ok(err instanceof AxisRefusal, `${axis}: ${JSON.stringify(config)}`);
      assert.equal(err.code, 'undeclared');
      assert.equal(err.key, 'axes.refusal.undeclared');
      assert.match(err.message, new RegExp(`no ${axis} is declared`));
      assert.match(err.message, new RegExp(`${KEY[axis]}`), 'it names the per-machine key');
      assert.match(err.message, new RegExp(`brain:config -- set ${axis}\\.default <${AXIS_MEMBERS[axis].join('\\|')}>`), 'and the fix, with the closed set');
      assert.equal(err.fix, `npm run brain:config -- set ${axis}.default <${AXIS_MEMBERS[axis].join('|')}>`);
      assert.equal(axis === 'vcs' ? /\.env/.test(err.message) : /\.env/.test(err.message), axis !== 'vcs', 'the levels name .env everywhere but VCS');
    }
  });

  test(`${axis}: a value outside the closed set is REFUSED at every level, never coerced to another provider`, () => {
    const bogus = 'bogus';
    refuses(axis, { env: { [KEY[axis]]: bogus }, config: listing(axis, m(axis, 0)) }, 'invalid-value');
    if (axis !== 'vcs') refuses(axis, { env: {}, dotenv: { [KEY[axis]]: bogus }, config: listing(axis, m(axis, 0)) }, 'invalid-value');
    // a bogus platform.default is caught by the validator first (it cannot orchestrate); every other axis by the membership check
    refuses(axis, { env: {}, config: { [axis]: { default: bogus, providers: { [bogus]: {} } } } }, axis === 'platform' ? 'invalid-config' : 'invalid-value');
    refuses(axis, { env: {}, config: LEGACY_KEY[axis](bogus) }, 'invalid-value');
  });

  test(`${axis}: a closed-set value that is not a key of ${axis}.providers is REFUSED (a per-machine override must be listed)`, () => {
    const a = m(axis, 0); const b = m(axis, 1);
    const cfg = { [axis]: { default: a, providers: { [a]: {} } } };
    let err;
    try { resolveAxis(axis, { env: { [KEY[axis]]: b }, dotenv: {}, config: cfg, ...quiet }); } catch (e) { err = e; }
    assert.equal(err.code, 'not-a-provider');
    assert.match(err.message, new RegExp(`not a key of ${axis}\\.providers \\(${a}\\)`));
    assert.equal(err.fix, `npm run brain:config -- set ${axis}.providers.${b} '{}'`);
    // listing it lifts the refusal
    assert.equal(resolveAxis(axis, { env: { [KEY[axis]]: b }, config: { [axis]: { default: a, providers: { [a]: {}, [b]: {} } } }, ...quiet }).value, b);
    // a legacy config (no providers map) has nothing to check an override against
    assert.equal(resolveAxis(axis, { env: { [KEY[axis]]: b }, config: LEGACY_KEY[axis](a), ...quiet }).value, b);
  });

  test(`${axis}: an invalid axis config refuses with the validator's errors, before any level is read`, () => {
    let err;
    try { resolveAxis(axis, { env: { [KEY[axis]]: m(axis, 0) }, config: { [axis]: { default: m(axis, 0), providers: { other: {} } } }, ...quiet }); } catch (e) { err = e; }
    assert.equal(err.code, 'invalid-config');
    assert.equal(err.key, 'axes.refusal.invalidConfig');
    assert.match(err.message, new RegExp(`invalid for ${axis}`));
    assert.match(err.message, new RegExp(`${axis}\\.default is "${m(axis, 0)}", which is not a key of ${axis}\\.providers`));
  });
}

test('an invalid config of ONE axis does not refuse another axis', () => {
  const config = { platform: { default: 'claude', providers: { other: {} } }, ...listing('memory', 'engram') };
  assert.equal(resolveAxis('memory', { env: {}, config, ...quiet }).value, 'engram');
  refuses('platform', { env: {}, config }, 'invalid-config');
});

test('platform.default must be able to orchestrate: codex (an engine only) is refused even when listed (ADR-0038 section 5)', () => {
  refuses('platform', { env: {}, config: { platform: { default: 'codex', providers: { codex: {} } } } }, 'invalid-config');
  refuses('platform', { env: { AGENT_PLATFORM: 'codex' }, config: {} }, 'invalid-value');
});

// ── the runtime-detected VCS provider ───────────────────────────────────────
test('vcs: the CI-detected provider sits OUTSIDE the precedence and needs only an adapter, not a vcs.providers entry', () => {
  const cfg = listing('vcs', 'github');
  const r = resolveAxis('vcs', { env: { VCS_PROVIDER: 'github' }, config: { vcs: { default: 'github', providers: { github: {} } } }, runtimeProvider: 'gitlab', ...quiet });
  assert.deepEqual(r, { value: 'gitlab', source: 'runtime', where: 'runtime', key: 'runtimeProvider', shadowed: [] });
  assert.equal(resolveAxis('vcs', { env: {}, config: {}, runtimeProvider: 'gitlab', ...quiet }).value, 'gitlab', 'even on an undeclared axis');
  assert.equal(resolveAxis('vcs', { config: cfg, runtimeProvider: null, env: {}, ...quiet }).source, 'config', 'null falls through');
  assert.equal(resolveAxis('vcs', { config: cfg, runtimeProvider: '', env: {}, ...quiet }).source, 'config', 'empty falls through');
  refuses('vcs', { env: {}, config: cfg, runtimeProvider: 'bitbucket' }, 'invalid-value');
});

test('only vcs takes a runtime provider: it is ignored on every other axis', () => {
  assert.equal(resolveAxis('memory', { env: {}, config: listing('memory', 'engram'), runtimeProvider: 'gitlab', ...quiet }).value, 'engram');
});

// ── the legacy SDD_HARNESS / config.harness (one-minor window) ─────────────
test('platform and sdd: the legacy harness feeds an axis only when it names a MEMBER of THAT axis, and says so each time', () => {
  const notices = [];
  const notice = (l) => notices.push(l);
  const platform = resolveAxis('platform', { env: { SDD_HARNESS: 'antigravity' }, config: {}, notice });
  assert.deepEqual([platform.value, platform.source, platform.where, platform.key], ['antigravity', 'legacy-harness', 'process-env', 'SDD_HARNESS']);
  const sdd = resolveAxis('sdd', { env: {}, dotenv: { SDD_HARNESS: 'gentle-ai' }, config: {}, notice });
  assert.deepEqual([sdd.value, sdd.source, sdd.where], ['gentle-ai', 'legacy-harness', 'dotenv']);
  const cfg = resolveAxis('platform', { env: {}, config: { harness: 'plain' }, notice });
  assert.deepEqual([cfg.value, cfg.source, cfg.where, cfg.key], ['plain', 'legacy-harness', 'config', 'harness']);

  assert.equal(notices.length, 3, 'every use is announced, none is silent');
  assert.match(notices[0], /SDD_HARNESS \(antigravity, from the process env\) is a deprecated way to name the platform/);
  assert.match(notices[0], /one more minor version/);
  assert.match(notices[0], /brain:config -- set platform\.default antigravity/);
  assert.match(notices[1], /SDD_HARNESS \(gentle-ai, from \.env\)/);
  assert.match(notices[2], /harness \(plain, from brain\.config\.json\)/);

  // gentle-ai is an ENGINE: it never feeds the platform axis; antigravity is a PLATFORM: it never feeds sdd
  refuses('platform', { env: { SDD_HARNESS: 'gentle-ai' }, config: {} }, 'undeclared');
  refuses('sdd', { env: { SDD_HARNESS: 'antigravity' }, config: {} }, 'undeclared');
  refuses('sdd', { env: { SDD_HARNESS: 'not-a-real-engine' }, config: {} }, 'undeclared');
  assert.equal(notices.length, 3, 'a refused harness is not "used", so it is not announced');
});

test('the legacy harness ranks BELOW every other level, and below <axis>.default', () => {
  const quietCfg = { notice: () => {} };
  const cfg = { platform: { default: 'claude', providers: { claude: {}, plain: {} } }, harness: 'plain' };
  assert.equal(resolveAxis('platform', { env: { SDD_HARNESS: 'plain' }, config: cfg, ...quietCfg }).value, 'claude');
  assert.equal(resolveAxis('platform', { env: {}, config: { platform: 'claude', harness: 'plain' }, ...quietCfg }).value, 'claude', 'the flat legacy key outranks the legacy harness');
  assert.equal(resolveAxis('platform', { env: { AGENT_PLATFORM: 'plain', SDD_HARNESS: 'antigravity' }, config: {}, ...quietCfg }).value, 'plain');
  // the first level that STATES a harness decides, in process env > .env > config order
  assert.equal(resolveAxis('platform', { env: { SDD_HARNESS: 'plain' }, dotenv: { SDD_HARNESS: 'antigravity' }, config: { harness: 'claude' }, ...quietCfg }).value, 'plain');
});

test('the default notice sink writes once per distinct line to stderr, and never to stdout', () => {
  const written = [];
  const orig = process.stderr.write;
  process.stderr.write = (chunk) => { written.push(String(chunk)); return true; };
  try {
    const opts = { env: { SDD_HARNESS: 'plain' }, dotenv: {}, config: { harness: undefined } };
    resolveAxis('sdd', opts);
    resolveAxis('sdd', opts);
    resolveAxis('platform', opts);
  } finally {
    process.stderr.write = orig;
  }
  assert.equal(written.length, 2, written.join(''));
  assert.match(written[0], /^brain: SDD_HARNESS \(plain, from the process env\) is a deprecated way to name the sdd/);
  assert.match(written[1], /name the platform/);
});

test('the legacy harness is below the PROCESS-ENV and .env selectors of its own axis, whatever it says', () => {
  const r = resolveAxis('sdd', { env: { SDD_ENGINE: 'plain', SDD_HARNESS: 'gentle-ai' }, config: {}, ...quiet });
  assert.deepEqual([r.value, r.source], ['plain', 'process-env']);
});

// ── tryResolveAxis ──────────────────────────────────────────────────────────
test('tryResolveAxis returns the refusal, rethrows anything that is not one', () => {
  const ok = tryResolveAxis('vcs', { env: {}, config: listing('vcs', 'github'), ...quiet });
  assert.deepEqual([ok.ok, ok.value], [true, 'github']);
  const no = tryResolveAxis('vcs', { env: {}, config: {}, ...quiet });
  assert.equal(no.ok, false);
  assert.ok(no.refusal instanceof AxisRefusal);
  assert.throws(() => tryResolveAxis('nope', { env: {} }), TypeError);
});

test('resolveAxis never reads more than the selector keys: an unrelated .env key is never a value and never shown', () => {
  const r = tryResolveAxis('memory', { env: {}, dotenv: { UNRELATED_KEY: 'leak-canary-123', MEMORY_BACKEND: 'bogus' }, config: {}, ...quiet });
  assert.equal(r.ok, false);
  assert.doesNotMatch(JSON.stringify(r.refusal.params) + r.refusal.message, /leak-canary-123/);
});

// ── the refusal texts ───────────────────────────────────────────────────────
test('every refusal and notice key exists in en and es, translated, with the same placeholders', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('axes.refusal.') || k === 'axes.notice.legacyHarness' || k.startsWith('bootstrap.axis.refused'));
  assert.ok(keys.length >= 7, keys.join());
  for (const k of keys) {
    assert.ok(es[k], `es is missing ${k}`);
    assert.notEqual(es[k], en[k], `${k} is not translated in es`);
    assert.deepEqual([...en[k].matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort(), [...es[k].matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort(), `${k} placeholders`);
  }
});

test('a refusal carries the catalog key and params, so a CLI renders it in the active locale', () => {
  const e = (() => { try { resolveAxis('platform', { env: {}, config: {} }); } catch (x) { return x; } })();
  const render = (cat) => cat[e.key].replace(/\{(\w+)\}/g, (_, k) => e.params[k]);
  assert.equal(render(en), e.message);
  assert.match(render(es), /no hay platform declarado/);
  assert.match(render(es), /brain:config -- set platform\.default <claude\|antigravity\|plain>/);
});

test('there is no default anywhere: no resolver module names claude or gentle-ai as a fallback', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  for (const rel of ['../harness/platform.mjs', '../harness/cli.mjs', '../vcs/cli.mjs', '../memory/lib/backend-resolve.mjs']) {
    const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
      .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(src, /['"](claude|gentle-ai)['"]/, `${rel} must not name a default platform or engine`);
  }
});

// ── this repository's own config (#1114 S2): brain's tools, tests and CI refuse on an undeclared axis ──
test('this repository declares every axis in tracked config, and resolves each from it alone', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { validateAxisConfig } = await import('./axis-config.mjs');
  const config = JSON.parse(readFileSync(fileURLToPath(new URL('../../../brain.config.json', import.meta.url)), 'utf8'));
  assert.deepEqual(validateAxisConfig(config).errors, []);
  const got = Object.fromEntries(AXES.map((a) => {
    const r = resolveAxis(a, { env: {}, dotenv: {}, config });
    return [a, [r.value, r.source]];
  }));
  assert.deepEqual(got, {
    vcs: ['github', 'config'],
    memory: ['engram', 'config'],
    platform: ['claude', 'config'],
    sdd: ['gentle-ai', 'config'],
  });
  assert.deepEqual(config.sdd.providers.brain, { version: 'self' }, "brain's own SDD provider is declared on every consumer");
  assert.deepEqual(config.sdd.roles['cold-review'], { agent: 'brain:cold-review', engine: 'codex', model: 'gpt-5.5' });
  assert.ok(Object.hasOwn(config.platform.providers, 'codex'), 'the routed cold-review runtime is a platform provider');
});
