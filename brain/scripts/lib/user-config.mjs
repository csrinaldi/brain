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

import { readFileSync } from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import { join, resolve } from 'node:path';

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
