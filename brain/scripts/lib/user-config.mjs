// user-config.mjs — the ONE reader of the user layer (ADR-0040 section 1, issue #1263 slice 1).
//
// The user layer is `<BRAIN_HOME>/config.json`, or `<os.homedir()>/.brain/config.json` when `BRAIN_HOME` is unset, on every
// operating system (ADR-0040 Ratified points 1 and 2). It is untracked and per person: the ADR-0038 shape
// (`<axis>.default`, `<axis>.providers.<name>`) for the person's orchestrator and installed runtimes. This slice only READS it:
// nothing in this module, or anywhere in slice 1, writes `~/.brain`.
//
// PURE apart from the one file read. A missing file is an EMPTY layer; an unreadable or invalid one is reported as `userError`
// (a refusal with a fix in `resolveAxis`), never silently ignored.
//
// THE TEST RULE (ratified point 1): no test may read a developer's real home. `os.homedir()` is therefore consulted in THIS file
// only, and only when `BRAIN_HOME` is unset; under `node --test` (NODE_TEST_CONTEXT) reaching that fallback THROWS, so a test
// that forgot `BRAIN_HOME` fails at the exact call that would have read the real home. `user-config.guard.test.mjs` pins it.

import { readFileSync, writeFileSync, renameSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import { join, resolve } from 'node:path';

import { AXES, validateUserConfig } from './axis-config.mjs';

/** The file name inside the user's brain directory. */
export const USER_CONFIG_FILE = 'config.json';

/** Thrown when a test would have read the real home directory: the fix is `BRAIN_HOME=<temp dir>`. */
export class UserHomeUnderTestError extends Error {
  constructor() {
    super('readUserConfig would read the real home directory under a test: set BRAIN_HOME to a temp dir (ADR-0040 ratified point 1)');
    this.name = 'UserHomeUnderTestError';
  }
}

const nonEmpty = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : '');

/**
 * The directory the user layer lives in. `homedir` is a test seam: an injected one is not the real home, so it never trips the guard.
 * @param {{env?: object, homedir?: () => string}} [opts]
 * @throws {UserHomeUnderTestError} under `node --test` when `BRAIN_HOME` is unset and no `homedir` was injected
 */
export function userConfigDir({ env = process.env, homedir } = {}) {
  // An injected `env` that does not name BRAIN_HOME falls back to the PROCESS's own: in production they are the same object, and
  // under a test the process's is the empty temp dir the preload set, so an injected env can never fall through to the real home.
  const fromEnv = nonEmpty(env?.BRAIN_HOME) || nonEmpty(process.env.BRAIN_HOME);
  if (fromEnv !== '') return resolve(fromEnv);
  if (homedir === undefined && nonEmpty(process.env.NODE_TEST_CONTEXT) !== '') throw new UserHomeUnderTestError();
  return join((homedir ?? osHomedir)(), '.brain');
}

/**
 * @param {{env?: object, homedir?: () => string}} [opts]
 * @returns {{userConfig: object, userPath: string, userError: string|null}}
 *   spread straight into `resolveAxis` / `diagnoseAxes`. `userConfig` is `{}` for a missing file and for an unreadable one
 *   (its `userError` says why); a caller that ignores `userError` would be ignoring a refusal.
 */
export function readUserConfig({ env = process.env, homedir } = {}) {
  const userPath = join(userConfigDir({ env, homedir }), USER_CONFIG_FILE);
  let raw;
  try {
    raw = readFileSync(userPath, 'utf8');
  } catch (err) { // surfaced: an unreadable file is returned as `userError` and refused by resolveAxis, with its fix
    if (err?.code === 'ENOENT') return { userConfig: {}, userPath, userError: null };
    return { userConfig: {}, userPath, userError: `${userPath}: ${err.message}` };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { userConfig: {}, userPath, userError: `${userPath}: the top level must be a JSON object` };
    }
    return { userConfig: parsed, userPath, userError: null };
  } catch (err) { // surfaced: malformed JSON is returned as `userError` and refused by resolveAxis, with its fix
    return { userConfig: {}, userPath, userError: `${userPath}: ${err.message}` };
  }
}

// ── the ONE writer (issue #1263 slice 2) ─────────────────────────────────────────────────────────────────────────────
// Every write to the user layer goes through `writeUserConfig`: atomic (a temp file in the same directory, then rename), the
// directory 0700 and the file 0600, and never a `locked` key (a key of the team config only). The layer holds a person's
// selectors (`<axis>.default`, `<axis>.providers.<name>.version`), never a credential: `setUserDefault` only ever adds a provider
// NAME, and refuses anything that is not shaped like one.

/** Thrown when a write to the user layer is refused; the message names the reason. Nothing was written. */
export class UserConfigWriteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserConfigWriteError';
  }
}

const PROVIDER_NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/**
 * @param {object} next  the WHOLE user layer to store
 * @param {{env?: object, homedir?: () => string}} [opts]
 * @returns {{userPath: string}}
 * @throws {UserConfigWriteError} not an object, or a shape the layer may not have (a `locked` key, a non-map `providers`...)
 */
export function writeUserConfig(next, { env = process.env, homedir } = {}) {
  if (next === null || typeof next !== 'object' || Array.isArray(next)) throw new UserConfigWriteError('the user config must be a JSON object');
  const bad = validateUserConfig(next).errors;
  if (bad.length > 0) throw new UserConfigWriteError(`the user config was not written: ${bad.map((e) => e.message).join('; ')}`);
  const dir = userConfigDir({ env, homedir });
  const userPath = join(dir, USER_CONFIG_FILE);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = `${userPath}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    chmodSync(tmp, 0o600); // the create mode is masked by umask and ignored on an existing temp: say it
    renameSync(tmp, userPath);
  } catch (err) {
    try { unlinkSync(tmp); } catch { /* swallow-ok: the temp file may never have been created; the original error is the one rethrown */ }
    throw err;
  }
  return { userPath };
}

/**
 * Sets `<axis>.default` to a provider NAME and lists it under `<axis>.providers` (the union makes it a valid selection), keeping
 * everything else the person had. A user file that cannot be read is never overwritten.
 * @param {string} axis  memory | platform | sdd (the user layer holds no vcs)
 * @throws {UserConfigWriteError}
 */
export function setUserDefault(axis, name, { env = process.env, homedir } = {}) {
  if (!AXES.includes(axis) || axis === 'vcs') throw new UserConfigWriteError(`the user config holds no '${axis}' axis (one of ${AXES.filter((a) => a !== 'vcs').join(', ')})`);
  if (typeof name !== 'string' || !PROVIDER_NAME.test(name)) throw new UserConfigWriteError(`'${name}' is not a provider name`);
  const { userConfig, userError } = readUserConfig({ env, homedir });
  if (userError) throw new UserConfigWriteError(`the existing user config was not overwritten: ${userError}`);
  const node = userConfig[axis] !== null && typeof userConfig[axis] === 'object' && !Array.isArray(userConfig[axis]) ? userConfig[axis] : {};
  const providers = node.providers !== null && typeof node.providers === 'object' && !Array.isArray(node.providers) ? node.providers : {};
  const next = { ...userConfig, [axis]: { ...node, default: name, providers: { ...providers, [name]: providers[name] ?? {} } } };
  return writeUserConfig(next, { env, homedir });
}
