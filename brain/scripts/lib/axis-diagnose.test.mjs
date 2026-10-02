// axis-diagnose.test.mjs — diagnoseAxes (#1114 S3.4): a PURE reader that reports findings, never fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diagnoseAxes } from './axis-config.mjs';
import es from '../i18n/es.mjs';
import en from '../i18n/en.mjs';

const declared = {
  vcs: { default: 'github', providers: { github: { version: '2.0.0' } } },
  memory: { default: 'plainfiles', providers: { plainfiles: { version: '1.0.0' } } },
  platform: { default: 'claude', providers: { claude: { version: '1.0.0' } } },
  sdd: { default: 'gentle-ai', providers: { 'gentle-ai': { version: '1.0.0' }, brain: { version: 'self' } } },
};
// The same axes, with every closed-set provider the env-shadow cases name LISTED: a per-machine value that is not a key of
// `<axis>.providers` is refused by resolveAxis (ADR-0038 section 2), which is a different finding (`selector-refused`).
const wide = {
  vcs: { default: 'github', providers: { github: { version: '2.0.0' }, gitlab: {} } },
  memory: { default: 'plainfiles', providers: { plainfiles: { version: '1.0.0' }, engram: {} } },
  platform: { default: 'claude', providers: { claude: { version: '1.0.0' }, plain: {}, antigravity: {} } },
  sdd: { default: 'gentle-ai', providers: { 'gentle-ai': { version: '1.0.0' }, plain: {}, brain: { version: 'self' } } },
};
const codes = (fs) => fs.map((f) => `${f.axis}:${f.code}`).sort();

test('diagnoseAxes never throws and returns [] for hostile input', () => {
  for (const bad of [undefined, null, 42, 'x', [], { config: 5, env: 'x', dotenv: [], installed: 9 }]) {
    assert.ok(Array.isArray(diagnoseAxes(bad)));
  }
  assert.deepEqual(diagnoseAxes({}), []);
});

test('a fully declared, version-probed config has no findings; "self" is verified against installed.sdd.brain', () => {
  const installed = { vcs: { github: '2.0.0' }, memory: { plainfiles: '1.0.0' }, platform: { claude: '1.0.0' }, sdd: { 'gentle-ai': '1.0.0', brain: '1.11.1' } };
  assert.deepEqual(diagnoseAxes({ config: declared, env: {}, dotenv: {}, installed }), []);
});

test('env-shadows-config: .env and process env selectors that differ from the declared default are named, never their file', () => {
  const f = diagnoseAxes({
    config: wide,
    env: { AGENT_PLATFORM: 'plain' },
    dotenv: { AGENT_PLATFORM: 'antigravity', MEMORY_BACKEND: 'engram', CANARY_KEY: 'leak-canary-123', SDD_ENGINE: 'gentle-ai' },
    installed: { vcs: { github: '2.0.0' }, memory: { plainfiles: '1.0.0' }, platform: { claude: '1.0.0' }, sdd: { 'gentle-ai': '1.0.0', brain: 'x' } },
  }).filter((x) => x.code === 'env-shadows-config');
  // Only the selector that WINS is reported (#1114 S2): the process env beats `.env` on the platform axis, so the
  // `.env` antigravity is shadowed by a shadow and is not a finding of its own; the sdd value equals the default.
  assert.equal(f.length, 2, JSON.stringify(f));
  assert.ok(f.some((x) => x.axis === 'platform' && /process env/.test(x.message) && /\(plain\)/.test(x.message)));
  const dotenvPlatform = diagnoseAxes({ config: wide, env: {}, dotenv: { AGENT_PLATFORM: 'antigravity' } }).find((x) => x.code === 'env-shadows-config');
  assert.equal(dotenvPlatform.message, 'AGENT_PLATFORM in .env (antigravity) differs from platform.default (claude)');
  assert.match(dotenvPlatform.fix, /AGENT_PLATFORM/);
  assert.match(dotenvPlatform.fix, /brain:config -- set platform\.default antigravity/);
  assert.ok(f.some((x) => x.axis === 'memory' && /MEMORY_BACKEND in \.env \(engram\)/.test(x.message)));
  const all = JSON.stringify(f);
  assert.doesNotMatch(all, /leak-canary-123|CANARY_KEY/, 'no other key of .env leaks');
  assert.ok(f.every((x) => x.severity === 'warning'));
});

test('env-shadows-config: a value equal to the default, an empty one and an undeclared axis are not findings', () => {
  const quiet = diagnoseAxes({ config: { platform: { default: 'claude', providers: { claude: { version: '1' } } } }, env: {}, dotenv: { AGENT_PLATFORM: 'claude', SDD_ENGINE: 'plain' }, installed: { platform: { claude: '1' } } });
  assert.deepEqual(codes(quiet), [], 'equal is not a shadow; an undeclared sdd has nothing to differ from');
  assert.deepEqual(codes(diagnoseAxes({ config: declared, env: {}, dotenv: { AGENT_PLATFORM: '' } }).filter((x) => x.code === 'env-shadows-config')), []);
});

test('env-shadows-config: VCS has no .env level (ADR-0038 section 2), so only the process env counts', () => {
  const dot = diagnoseAxes({ config: wide, env: {}, dotenv: { VCS_PROVIDER: 'gitlab' } }).filter((x) => x.code === 'env-shadows-config');
  assert.deepEqual(dot, []);
  const proc = diagnoseAxes({ config: wide, env: { VCS_PROVIDER: 'gitlab' }, dotenv: {} }).filter((x) => x.code === 'env-shadows-config');
  assert.equal(proc.length, 1);
  assert.equal(proc[0].axis, 'vcs');
  assert.match(proc[0].message, /VCS_PROVIDER in the process env \(gitlab\) differs from vcs\.default \(github\)/);
});

test('env-shadows-config: a legacy SDD_HARNESS never shadows a declared axis: it ranks BELOW <axis>.default (#1114 S3.4 review)', () => {
  // The false positive the S3.4 cold review found: platform.default=claude, sdd.default=gentle-ai and a process env
  // SDD_HARNESS=plain. The resolvers read SDD_HARNESS only after the config default, so nothing is shadowed.
  const cfg = { platform: { default: 'claude', providers: { claude: { version: '1' } } }, sdd: { default: 'gentle-ai', providers: { 'gentle-ai': { version: '1' } } } };
  const installed = { platform: { claude: '1' }, sdd: { 'gentle-ai': '1' } };
  assert.deepEqual(codes(diagnoseAxes({ config: cfg, env: { SDD_HARNESS: 'plain' }, dotenv: {}, installed })), []);
  assert.deepEqual(codes(diagnoseAxes({ config: cfg, env: {}, dotenv: { SDD_HARNESS: 'plain' }, installed })), []);
  assert.deepEqual(codes(diagnoseAxes({ config: { ...cfg, harness: 'plain' }, env: { SDD_HARNESS: 'antigravity' }, dotenv: {}, installed })), []);
});

test('env-shadows-config: an UNDECLARED axis has nothing to be shadowed from, even when SDD_HARNESS states a value', () => {
  assert.deepEqual(diagnoseAxes({ config: {}, env: { SDD_HARNESS: 'plain' }, dotenv: {} }), []);
});

test('selector-refused: a per-machine value the resolver would refuse is reported, never silent (#1114 S2)', () => {
  const f = diagnoseAxes({ config: declared, env: { AGENT_PLATFORM: 'antigravity', MEMORY_BACKEND: 'mongo' }, dotenv: {} }).filter((x) => x.code === 'selector-refused');
  assert.deepEqual(f.map((x) => x.axis).sort(), ['memory', 'platform']);
  assert.ok(f.every((x) => x.severity === 'error' && x.fix));
  assert.match(f.find((x) => x.axis === 'platform').message, /not a key of platform\.providers/);
  assert.match(f.find((x) => x.axis === 'memory').message, /not a memory brain ships/);
});

test('version-unverified: no version declared; the message carries a detected version and the fix is the exact set command', () => {
  const config = { sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {} } } };
  const [withInstalled] = diagnoseAxes({ config, installed: { sdd: { 'gentle-ai': '1.4.2' } } });
  assert.equal(withInstalled.code, 'version-unverified');
  assert.equal(withInstalled.severity, 'info');
  assert.match(withInstalled.message, /1\.4\.2/);
  assert.equal(withInstalled.fix, 'npm run brain:config -- set sdd.providers.gentle-ai.version 1.4.2');
  const [bare] = diagnoseAxes({ config, installed: {} });
  assert.equal(bare.code, 'version-unverified');
  assert.match(bare.fix, /set sdd\.providers\.gentle-ai\.version <version>/);
});

test('version-unverified: a numeric-looking detected version is quoted so the verb stores a string', () => {
  const [f] = diagnoseAxes({ config: { sdd: { default: 'plain', providers: { plain: {} } } }, installed: { sdd: { plain: '2' } } });
  assert.equal(f.fix, `npm run brain:config -- set sdd.providers.plain.version '"2"'`);
});

test('version-unverifiable: a version is declared but nothing probed the provider', () => {
  const [f] = diagnoseAxes({ config: { vcs: { default: 'github', providers: { github: { version: '2.0.0' } } } }, installed: {} });
  assert.equal(f.code, 'version-unverifiable');
  assert.equal(f.severity, 'info');
  assert.match(f.message, /github/);
  assert.match(f.message, /no probe/);
});

test('version-mismatch: declared and installed differ (exact-string compare; ranges are #1130)', () => {
  const [f] = diagnoseAxes({ config: { vcs: { default: 'github', providers: { github: { version: '2.0.0' } } } }, installed: { vcs: { github: '2.1.0' } } });
  assert.equal(f.code, 'version-mismatch');
  assert.equal(f.severity, 'warning');
  assert.match(f.message, /2\.0\.0/);
  assert.match(f.message, /2\.1\.0/);
  assert.match(f.fix, /set vcs\.providers\.github\.version 2\.1\.0/);
});

test('"self" is verified only against installed.sdd.brain; with no installed version it is unverifiable', () => {
  const config = { sdd: { default: 'plain', providers: { plain: { version: '1' }, brain: { version: 'self' } } } };
  assert.deepEqual(diagnoseAxes({ config, installed: { sdd: { brain: '1.11.1', plain: '1' } } }), []);
  assert.deepEqual(codes(diagnoseAxes({ config, installed: { sdd: { plain: '1' } } })), ['sdd:version-unverifiable']);
});

test('invalid-config: every validateAxisConfig error is surfaced as an error finding', () => {
  const f = diagnoseAxes({ config: { platform: { default: 'codex', providers: { codex: {} } } } }).filter((x) => x.code === 'invalid-config');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'error');
  assert.equal(f[0].axis, 'platform');
  assert.match(f[0].message, /platform\.default/);
  assert.match(f[0].message, /orchestrate/);
  assert.ok(f[0].fix);
});

test('every finding has the documented shape', () => {
  const fs = diagnoseAxes({ config: { ...declared, platform: { default: 'codex', providers: { codex: {} } } }, env: { MEMORY_BACKEND: 'engram' }, dotenv: { AGENT_PLATFORM: 'plain' }, installed: { vcs: { github: '9' } } });
  assert.ok(fs.length >= 4);
  for (const f of fs) {
    assert.deepEqual(Object.keys(f).sort(), ['axis', 'code', 'fix', 'message', 'severity']);
    assert.ok(['error', 'warning', 'info'].includes(f.severity));
    assert.ok(f.message && f.fix);
  }
});

test('every diagnose message is an i18n key present in en and es (es actually translated)', () => {
  const keys = Object.keys(en).filter((k) => k.startsWith('axes.diagnose.'));
  assert.ok(keys.length >= 9, keys.join());
  for (const k of keys) {
    assert.ok(es[k], `es is missing ${k}`);
    assert.notEqual(es[k], en[k], `${k} is not translated in es`);
    assert.deepEqual([...en[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), [...es[k].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), `${k} placeholders`);
  }
});

test('diagnoseAxes renders through an injected catalog (es)', () => {
  const f = diagnoseAxes({ config: wide, env: {}, dotenv: { AGENT_PLATFORM: "plain" }, catalog: { ...en, ...es } }).find((x) => x.code === "env-shadows-config");
  assert.match(f.message, /AGENT_PLATFORM en \.env \(plain\)/);
});
