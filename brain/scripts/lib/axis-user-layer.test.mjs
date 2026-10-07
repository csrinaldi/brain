// axis-user-layer.test.mjs — the user layer and `locked` in resolveAxis / diagnoseAxes (ADR-0040, issue #1263 slice 1).
// resolveAxis is PURE: the user layer is injected as `userConfig`, so nothing here touches a home directory.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolvePlatform } from '../harness/platform.mjs';
import { resolveEngine } from '../harness/cli.mjs';
import { resolveAxis, tryResolveAxis, AxisRefusal, diagnoseAxes, validateUserConfig } from './axis-config.mjs';

const quiet = () => {};
const codes = (findings, code) => findings.filter((f) => f.code === code);
const team = (extra = {}) => ({
  platform: { default: 'claude', providers: { claude: { version: '2.1.0' }, plain: {} } },
  memory: { default: 'engram', providers: { engram: {}, plainfiles: {} } },
  sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {}, plain: {} } },
  vcs: { default: 'github', providers: { github: {} } },
  ...extra,
});
const user = (platform) => ({ platform });
const run = (axis, o) => resolveAxis(axis, { notice: quiet, ...o });
const refusal = (axis, o) => {
  const r = tryResolveAxis(axis, { notice: quiet, ...o });
  assert.equal(r.ok, false, `expected a refusal, got ${JSON.stringify(r)}`);
  return r.refusal;
};

// ── precedence ──────────────────────────────────────────────────────────────
test('user layer: a user default wins over the team default, with source and where `user`', () => {
  const r = run('platform', { config: team(), userConfig: user({ default: 'antigravity', providers: { antigravity: {} } }) });
  assert.equal(r.value, 'antigravity');
  assert.equal(r.source, 'user');
  assert.equal(r.where, 'user');
  assert.deepEqual(r.shadowed, [{ source: 'config', value: 'claude' }]);
});

test('user layer: process env > .env > user default > team default', () => {
  const userConfig = user({ default: 'antigravity', providers: { antigravity: {}, plain: {} } });
  const config = team();
  assert.equal(run('platform', { config, userConfig }).value, 'antigravity');
  const dot = run('platform', { config, userConfig, dotenv: { AGENT_PLATFORM: 'plain' } });
  assert.deepEqual([dot.value, dot.source], ['plain', 'dotenv']);
  const shell = run('platform', { config, userConfig, dotenv: { AGENT_PLATFORM: 'plain' }, env: { AGENT_PLATFORM: 'claude' } });
  assert.deepEqual([shell.value, shell.source], ['claude', 'process-env']);
  assert.ok(shell.shadowed.some((s) => s.source === 'user' && s.value === 'antigravity'), 'the user value a winner covers is reported');
});

test('user layer: user default > team default > legacy alias > undeclared', () => {
  // team default beats the legacy alias (already true), the user default beats both
  const legacy = { platform: 'plain' };
  const r = run('platform', { config: legacy, userConfig: user({ default: 'antigravity', providers: { antigravity: {} } }) });
  assert.deepEqual([r.value, r.source], ['antigravity', 'user']);
  // no user layer: the legacy alias still resolves
  assert.equal(run('platform', { config: legacy, userConfig: {} }).source, 'legacy-config');
  // nothing declares it: still refused, and the user layer with no default changes nothing
  assert.equal(refusal('platform', { config: {}, userConfig: user({ providers: { antigravity: {} } }) }).code, 'undeclared');
});

test('user layer: it can declare an axis the team left undeclared', () => {
  const config = { platform: { default: '', providers: {} } };
  const r = run('platform', { config, userConfig: user({ default: 'plain', providers: { plain: {} } }) });
  assert.deepEqual([r.value, r.source], ['plain', 'user']);
});

test('user layer: an empty user default is undeclared, the team default stands', () => {
  const r = run('platform', { config: team(), userConfig: user({ default: '', providers: { antigravity: {} } }) });
  assert.deepEqual([r.value, r.source], ['claude', 'config']);
});

test('user layer: absent or non-object userConfig is the empty layer', () => {
  for (const userConfig of [undefined, null, [], 'x', {}]) {
    assert.deepEqual(run('platform', { config: team(), userConfig }).source, 'config');
  }
});

// ── the union ───────────────────────────────────────────────────────────────
test('union: the reviewer case — team lists claude, the user lists antigravity, this machine runs antigravity', () => {
  const config = { platform: { default: 'claude', providers: { claude: {} } } };
  const r = run('platform', { config, userConfig: user({ default: 'antigravity', providers: { antigravity: {} } }) });
  assert.deepEqual([r.value, r.source, r.where], ['antigravity', 'user', 'user']);
});

test('union: a user default that is not in the union is refused, never replaced by the team default', () => {
  const rf = refusal('platform', { config: team(), userConfig: user({ default: 'antigravity' }) });
  assert.equal(rf.code, 'not-a-provider');
  assert.equal(rf.where, 'user');
  assert.match(rf.message, /antigravity/);
  assert.match(rf.message, /claude, plain/);
  assert.match(rf.fix, /config\.json/);
});

test('union: an env value is checked against the union (a user-listed provider is valid in .env)', () => {
  const userConfig = user({ providers: { antigravity: {} } });
  assert.equal(run('platform', { config: team(), userConfig, dotenv: { AGENT_PLATFORM: 'antigravity' } }).value, 'antigravity');
  assert.equal(refusal('platform', { config: team(), userConfig: {}, dotenv: { AGENT_PLATFORM: 'antigravity' } }).code, 'not-a-provider');
});

test('union: the closed membership still applies to a user value', () => {
  const rf = refusal('platform', { config: team(), userConfig: user({ default: 'emacs', providers: { emacs: {} } }) });
  assert.equal(rf.code, 'invalid-value');
});

test('union: capability rules apply — a user default must still orchestrate', () => {
  const rf = refusal('platform', { config: team(), userConfig: user({ default: 'codex', providers: { codex: {} } }) });
  assert.ok(['invalid-value', 'invalid-config'].includes(rf.code));
});

test('team structure: sdd.roles are validated against the TEAM providers alone — a user layer cannot complete the pipeline', () => {
  const config = team({ platform: { default: 'claude', providers: { claude: {} } }, sdd: { default: 'gentle-ai', providers: { 'gentle-ai': {} }, roles: { review: { engine: 'codex' } } } });
  for (const userConfig of [{}, { platform: { providers: { codex: {} } } }]) {
    const rf = refusal('sdd', { config, userConfig });
    assert.equal(rf.code, 'invalid-config');
    assert.match(rf.message, /sdd\.roles\.review\.engine/);
  }
});

test('team structure: a user layer cannot "fix" a team default missing from the team providers', () => {
  const config = { platform: { default: 'antigravity', providers: { claude: {} } } };
  const rf = refusal('platform', { config, userConfig: user({ providers: { antigravity: {} } }) });
  assert.equal(rf.code, 'invalid-config');
});

test('union: a user-only provider is still selectable as this machine\'s platform default', () => {
  const r = run('platform', { config: team(), userConfig: user({ default: 'antigravity', providers: { antigravity: {} } }) });
  assert.deepEqual([r.value, r.source], ['antigravity', 'user']);
});

// ── version ─────────────────────────────────────────────────────────────────
test('version: the user layer version is what this machine runs; the team version stays the expectation', () => {
  const config = team();
  // equal: nothing to report
  const same = diagnoseAxes({ config, userConfig: user({ providers: { claude: { version: '2.1.0' } } }) });
  assert.deepEqual(codes(same, 'version-mismatch'), []);
  // a difference between the two is a mismatch: declared by the team, found on this machine
  const f = codes(diagnoseAxes({ config, userConfig: user({ providers: { claude: { version: '2.5.0' } } }) }), 'version-mismatch').filter((x) => x.axis === 'platform');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /2\.1\.0/);
  assert.match(f[0].message, /2\.5\.0/);
  // a detected version still wins over the user's declaration
  const probed = codes(diagnoseAxes({ config, userConfig: user({ providers: { claude: { version: '2.5.0' } } }), installed: { platform: { claude: '2.1.0' } } }), 'version-mismatch');
  assert.deepEqual(probed, []);
});

test('version: a provider only the user lists has no team expectation and no finding', () => {
  const f = diagnoseAxes({ config: team(), userConfig: user({ providers: { antigravity: { version: '1.4.0' } } }) });
  assert.ok(f.every((x) => !/antigravity/.test(x.message)));
});

// ── locked ──────────────────────────────────────────────────────────────────
const locked = (axis, def, providers = { [def]: {} }) => ({ [axis]: { default: def, locked: true, providers } });

test('locked: the user layer is refused on a locked axis, naming the file, the axis and the owner fix', () => {
  const config = team(locked('memory', 'engram', { engram: {}, plainfiles: {} }));
  const rf = refusal('memory', { config, userConfig: { memory: { default: 'plainfiles', providers: { plainfiles: {} } } }, userPath: '/h/.brain/config.json' });
  assert.equal(rf.code, 'locked');
  assert.equal(rf.where, 'user');
  assert.match(rf.message, /locked/);
  assert.match(rf.message, /memory/);
  assert.match(rf.message, /\/h\/\.brain\/config\.json/);
  assert.match(rf.fix, /governance\.owners|owner/);
  assert.match(rf.fix, /brain:config -- set memory\.default plainfiles/);
});

test('locked: .env and the process env are refused too (ratified point 5)', () => {
  const config = team(locked('memory', 'engram', { engram: {}, plainfiles: {} }));
  const dot = refusal('memory', { config, dotenv: { MEMORY_BACKEND: 'plainfiles' } });
  assert.deepEqual([dot.code, dot.where], ['locked', 'dotenv']);
  const shell = refusal('memory', { config, env: { MEMORY_BACKEND: 'plainfiles' } });
  assert.deepEqual([shell.code, shell.where], ['locked', 'process-env']);
});

test('locked: an override equal to the team value is no override — the run resolves from the team', () => {
  const config = team(locked('sdd', 'gentle-ai', { 'gentle-ai': {}, plain: {} }));
  const r = run('sdd', { config, env: { SDD_ENGINE: 'gentle-ai' }, dotenv: { SDD_ENGINE: 'gentle-ai' } });
  assert.deepEqual([r.value, r.source, r.where], ['gentle-ai', 'config', 'config']);
});

test('locked: with no override the team value resolves normally', () => {
  const config = team(locked('memory', 'engram', { engram: {}, plainfiles: {} }));
  assert.equal(run('memory', { config, userConfig: {} }).value, 'engram');
});

test('locked: a locked axis the team has NOT declared refuses no override (#1263 slice 3: nothing declared, nothing to override)', () => {
  const config = team({ memory: { default: '', locked: true, providers: {} } });
  const r = tryResolveAxis('memory', { env: { MEMORY_BACKEND: 'engram' }, dotenv: {}, config, notice: () => {} });
  assert.equal(r.ok, true);
  assert.equal(r.value, 'engram');
  assert.equal(tryResolveAxis('memory', { env: {}, dotenv: {}, config, notice: () => {} }).refusal.code, 'undeclared');
});

test('locked: the reviewer case repeated with `locked: true` refuses', () => {
  const config = { platform: { default: 'claude', locked: true, providers: { claude: {} } } };
  const userConfig = user({ default: 'antigravity', providers: { antigravity: {} } });
  assert.equal(refusal('platform', { config, userConfig }).code, 'locked');
});

test('locked: only the locked axis is affected', () => {
  const config = team({ ...locked('memory', 'engram', { engram: {}, plainfiles: {} }) });
  const r = run('platform', { config, userConfig: user({ default: 'antigravity', providers: { antigravity: {} } }) });
  assert.equal(r.value, 'antigravity');
});

test('locked: `locked: false` locks nothing; a non-boolean value is invalid-config, never a silent unlock (#1263 slice 2)', () => {
  const config = team({ memory: { default: 'engram', locked: false, providers: { engram: {}, plainfiles: {} } } });
  assert.equal(run('memory', { config, env: { MEMORY_BACKEND: 'plainfiles' } }).value, 'plainfiles');
  for (const lockedValue of ['true', 1, null]) {
    const bad = team({ memory: { default: 'engram', locked: lockedValue, providers: { engram: {}, plainfiles: {} } } });
    assert.equal(refusal('memory', { config: bad, env: { MEMORY_BACKEND: 'plainfiles' } }).code, 'invalid-config');
  }
});

test('locked: the legacy harness does not override a locked axis (it ranks below the team default)', () => {
  const config = team(locked('sdd', 'gentle-ai', { 'gentle-ai': {}, plain: {} }));
  assert.equal(run('sdd', { config, env: { SDD_HARNESS: 'plain' } }).value, 'gentle-ai');
});

// ── the user layer's own validity ───────────────────────────────────────────
test('user layer: it may never set `locked` — refused', () => {
  const rf = refusal('platform', { config: team(), userConfig: user({ default: 'plain', locked: true, providers: { plain: {} } }) });
  assert.equal(rf.code, 'user-layer-invalid');
  assert.match(rf.message, /locked/);
  assert.match(rf.fix, /remove|delete/i);
});

test('user layer: a read error (unreadable or invalid file) is a refusal with a fix, never ignored', () => {
  const rf = refusal('platform', { config: team(), userConfig: {}, userError: '/h/.brain/config.json: Unexpected token', userPath: '/h/.brain/config.json' });
  assert.equal(rf.code, 'user-layer-invalid');
  assert.match(rf.message, /Unexpected token/);
  assert.match(rf.fix, /\/h\/\.brain\/config\.json/);
});

test('user layer: a malformed axis node is refused', () => {
  assert.equal(refusal('platform', { config: team(), userConfig: user({ default: 3, providers: [] }) }).code, 'user-layer-invalid');
});

test('validateUserConfig: pure and total', () => {
  assert.deepEqual(validateUserConfig({}).errors, []);
  assert.deepEqual(validateUserConfig(undefined).errors, []);
  const bad = validateUserConfig({ memory: { locked: false }, platform: { providers: 'x' } });
  assert.deepEqual(bad.errors.map((e) => e.code).sort(), ['providers-not-a-map', 'user-locked-forbidden']);
  assert.equal(bad.ok, false);
});

// ── vcs ─────────────────────────────────────────────────────────────────────
test('vcs: the user layer is ignored — it has no user or .env level', () => {
  const config = team();
  const r = run('vcs', { config, userConfig: { vcs: { default: 'gitlab', providers: { gitlab: {} } } }, dotenv: { VCS_PROVIDER: 'gitlab' } });
  assert.deepEqual([r.value, r.source], ['github', 'config']);
});

test('vcs: a broken user layer does not refuse vcs; the CI runtimeProvider stays outside the precedence', () => {
  assert.equal(run('vcs', { config: team(), userConfig: {}, userError: 'broken' }).value, 'github');
  assert.equal(run('vcs', { config: team(), runtimeProvider: 'gitlab', userConfig: { vcs: { default: 'github' } } }).value, 'gitlab');
});

test('vcs: a process env value still wins; locked on vcs refuses a differing one', () => {
  assert.equal(run('vcs', { config: team({ vcs: { default: 'github', providers: { github: {}, gitlab: {} } } }), env: { VCS_PROVIDER: 'gitlab' } }).value, 'gitlab');
  const config = team({ vcs: { default: 'github', locked: true, providers: { github: {}, gitlab: {} } } });
  assert.equal(refusal('vcs', { config, env: { VCS_PROVIDER: 'gitlab' } }).code, 'locked');
  assert.equal(run('vcs', { config, runtimeProvider: 'gitlab' }).value, 'gitlab');
});

// ── diagnoseAxes ────────────────────────────────────────────────────────────
test('diagnose: user-layer-invalid (error) for an unreadable file and for a shape error', () => {
  const unreadable = diagnoseAxes({ config: team(), userConfig: {}, userError: '/h/.brain/config.json: bad json', userPath: '/h/.brain/config.json' });
  const f = codes(unreadable, 'user-layer-invalid');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'error');
  assert.match(f[0].message, /bad json/);
  const shape = codes(diagnoseAxes({ config: team(), userConfig: user({ locked: true }) }), 'user-layer-invalid');
  assert.equal(shape.length, 1);
  assert.equal(shape[0].axis, 'platform');
});

test('diagnose: locked-override-refused (error) for each level the lock forbids', () => {
  const config = team(locked('memory', 'engram', { engram: {}, plainfiles: {} }));
  const f = codes(diagnoseAxes({
    config,
    env: { MEMORY_BACKEND: 'plainfiles' },
    dotenv: { MEMORY_BACKEND: 'plainfiles' },
    userConfig: { memory: { default: 'plainfiles', providers: { plainfiles: {} } } },
    userPath: '/h/.brain/config.json',
  }), 'locked-override-refused');
  assert.equal(f.length, 3);
  assert.ok(f.every((x) => x.severity === 'error' && x.axis === 'memory'));
  assert.match(f.map((x) => x.message).join('\n'), /process env/);
  assert.match(f.map((x) => x.message).join('\n'), /\.env/);
  assert.match(f.map((x) => x.message).join('\n'), /\/h\/\.brain\/config\.json/);
});

test('diagnose: a value equal to the locked team value is not an override', () => {
  const config = team(locked('sdd', 'gentle-ai', { 'gentle-ai': {}, plain: {} }));
  assert.deepEqual(codes(diagnoseAxes({ config, env: { SDD_ENGINE: 'gentle-ai' } }), 'locked-override-refused'), []);
});

test('diagnose: env-shadows-config accounts for the user layer', () => {
  const config = team();
  const userConfig = user({ default: 'antigravity', providers: { antigravity: {} } });
  // the user layer wins by precedence and differs from the team default: this machine does not run the team's choice
  const user1 = codes(diagnoseAxes({ config, userConfig }), 'env-shadows-config');
  assert.equal(user1.length, 1);
  assert.match(user1[0].message, /antigravity/);
  assert.match(user1[0].message, /claude/);
  // an env value that wins over a user value is reported against the team default, as before
  const env1 = codes(diagnoseAxes({ config, userConfig, env: { AGENT_PLATFORM: 'plain' } }), 'env-shadows-config');
  assert.equal(env1.length, 1);
  assert.match(env1[0].message, /AGENT_PLATFORM/);
  // no user layer, no env: nothing shadows
  assert.deepEqual(codes(diagnoseAxes({ config }), 'env-shadows-config'), []);
});

test('diagnose: a user value that is not in the union is a selector-refused error', () => {
  const f = codes(diagnoseAxes({ config: team(), userConfig: user({ default: 'antigravity' }) }), 'selector-refused');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'error');
});

test('diagnose: a broken user layer does not bury other findings, and diagnosis never throws', () => {
  assert.doesNotThrow(() => diagnoseAxes({ config: team(), userConfig: 'nonsense', userError: 7 }));
});

test('AxisRefusal still carries code, axis, key, params and fix for the new refusals', () => {
  const rf = refusal('platform', { config: team(), userConfig: user({ locked: true }) });
  assert.ok(rf instanceof AxisRefusal);
  assert.equal(rf.axis, 'platform');
  assert.equal(typeof rf.key, 'string');
  assert.equal(typeof rf.fix, 'string');
});

test('callers: resolvePlatform and resolveEngine take the user layer the reader returns', () => {
  const config = team();
  const carol = { userConfig: user({ default: 'antigravity', providers: { antigravity: {} } }), userPath: '/h/.brain/config.json', userError: null };
  assert.equal(resolvePlatform({ env: {}, config, user: carol }), 'antigravity');
  assert.equal(resolveEngine({ env: {}, config, user: carol }), 'gentle-ai', 'the user layer states no sdd');
  assert.throws(() => resolvePlatform({ env: {}, config, user: { userConfig: {}, userError: 'broken' } }), (e) => e instanceof AxisRefusal && e.code === 'user-layer-invalid');
});

// ── slice-1 review corrections (#1263 slice 2) ──────────────────────────────
test('validateAxisConfig: <axis>.locked must be a boolean; "true" and 1 are invalid-config, never a silent unlock', () => {
  for (const bad of ['true', 1, 'false', null, {}]) {
    const config = team({ memory: { default: 'engram', locked: bad, providers: { engram: {} } } });
    const f = codes(diagnoseAxes({ config }), 'invalid-config').filter((x) => x.axis === 'memory');
    assert.equal(f.length, 1, `locked=${JSON.stringify(bad)} must be invalid-config`);
    assert.match(f[0].message, /locked/);
    assert.equal(refusal('memory', { config }).code, 'invalid-config');
  }
  for (const good of [true, false]) {
    const config = team({ memory: { default: 'engram', locked: good, providers: { engram: {} } } });
    assert.deepEqual(codes(diagnoseAxes({ config }), 'invalid-config'), []);
  }
});

test('version: a user-layer version is never the found value; with no probe it stays version-unverifiable (info)', () => {
  const config = team();
  const f = codes(diagnoseAxes({ config, userConfig: user({ providers: { claude: { version: '2.1.0' } } }) }), 'version-unverifiable').filter((x) => x.axis === 'platform');
  assert.equal(f.length, 1, 'a self-declared version equal to the expectation does not verify it');
  assert.equal(f[0].severity, 'info');
  // and for a team provider with NO declared version, the user's claim is not reported as "installed here"
  const bare = { platform: { default: 'claude', providers: { claude: {} } } };
  const u = codes(diagnoseAxes({ config: bare, userConfig: user({ providers: { claude: { version: '9.9.9' } } }) }), 'version-unverified').filter((x) => x.axis === 'platform');
  assert.equal(u.length, 1);
  assert.doesNotMatch(u[0].message, /9\.9\.9/);
});

test('diagnose: an undeclared memory backend is an ERROR finding (ADR-0040: a no-TTY foundation leaves it undeclared)', () => {
  const f = codes(diagnoseAxes({ config: team({ memory: { default: '', providers: {} } }) }), 'axis-undeclared').filter((x) => x.axis === 'memory');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'error');
  assert.match(f[0].fix, /brain:config -- set memory\.default/);
  assert.deepEqual(codes(diagnoseAxes({ config: team() }), 'axis-undeclared'), []);
});
