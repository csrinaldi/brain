#!/usr/bin/env node
// brain/scripts/harness/cli.mjs — SDD_HARNESS dispatcher.
//
// Usage: node brain/scripts/harness/cli.mjs <op>
//   op: init
//
// Resolves AGENT_PLATFORM and SDD_ENGINE (resolveAxis: env, .env, brain.config.json; no default, #1114 S2).
// Imports the corresponding backend from axes/<axis>/adapters/<harness>.mjs
// (harnessAdapterUrl, issue #1141) and
// dispatches the requested operation.
//
// Mirrors brain/scripts/memory/cli.mjs exactly (ADR-0012).
// See also: ADR-0005 (original inline binding), ADR-0012 (this refactor).

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseEnvFile } from '../lib/env-read.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

// ---------------------------------------------------------------------------
// Read the .env file (the precedence itself is resolveAxis's: process env > .env > brain.config.json)
// ---------------------------------------------------------------------------
// The PARSE is shared (#316); the precedence stays where it always was — at the
// consumption site below, `process.env.X ?? envVars.X`, which is already
// shell-first and is now the rule the whole tree follows. What changed is that
// keys and values are trimmed individually and one matched pair of surrounding
// quotes is stripped: this loop produced the key `"KEY "` for `KEY = v` and left
// `X="y"` as `"y"` with the quotes attached.
function readEnvFile(root = repoRoot) {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return {};
  return parseEnvFile(readFileSync(envPath, 'utf8'));
}

// `resolvePlatform` LIVES IN A LEAF, and is re-exported here so this module's
// own importers are unaffected. It moved because a backend needs it and a
// backend importing THIS file closes a cycle through the top-level await below
// — see `platform.mjs` for the measurement. Re-exported rather than relocated
// silently: `resolvePlatform` has been part of this module's surface since
// ADR-0024, and moving it out from under its callers would be a second defect
// to fix the first.
import { resolvePlatform, SDD_ENGINES } from './platform.mjs';
import { resolveAxis, AxisRefusal } from '../lib/axis-config.mjs';
import { readUserConfig } from '../lib/user-config.mjs';
import { loadBrainConfig } from '../lib/brain-config.mjs';
import { t } from '../i18n/t.mjs';
import { harnessAdapterUrl } from '../axes/lib/harness-adapter-url.mjs';
export { resolvePlatform, SDD_ENGINES };

/** A refusal's params with its validation `detail` re-rendered in the active locale (resolveAxis has no async access to it). */
async function localizedParams(err) {
  if (!Array.isArray(err.details)) return err.params;
  const parts = await Promise.all(err.details.map((d) => (d.key ? t(d.key, d.params ?? {}) : d.message)));
  return { ...err.params, detail: parts.join('; ') };
}

/**
 * Resolves the active SDD engine: a thin caller of `resolveAxis` (process env > `.env` > `sdd.default` > the legacy
 * flat key and `SDD_HARNESS`, one minor version). No default: an undeclared engine is refused (#1114 S2).
 *
 * @param {{ env?: object, envVars?: object, config?: object, user?: ReturnType<typeof readUserConfig> }} [opts]  `user`: the user layer, read through the ONE reader when not injected
 * @returns {string}
 * @throws {AxisRefusal} when nothing declares an SDD engine
 */
export function resolveEngine({ env = process.env, envVars = {}, config = {}, user = readUserConfig({ env }) } = {}) {
  return resolveAxis('sdd', { env, dotenv: envVars, config, ...user }).value;
}

// `resolveMemory` was here and is REMOVED (issue #1165): it was exported, dead (memory/cli.mjs
// re-read the env on its own), and wrong — it read `config.memory` as a string when that key is an
// object, and it defaulted to 'engram'. The memory backend has ONE resolver now:
// memory/lib/backend-resolve.mjs, a caller of `resolveAxis` (lib/axis-config.mjs).

/**
 * The legacy harness name. `harness` was the one selector before the platform/engine split (#643); the name is the
 * SDD engine now, so this is `resolveEngine` and carries no precedence of its own (#1114 S2).
 *
 * @param {{ env?: object, envVars?: object, config?: object }} [opts]
 * @returns {string}
 */
export function resolveHarness(opts = {}) {
  return resolveEngine(opts);
}

// ---------------------------------------------------------------------------
// Valid ops
// ---------------------------------------------------------------------------
// `run-stage` is ADDITIVE, and ADR-0019's SECOND rejected alternative is the
// authority — the one never cited in this discussion:
//
//   > "Treat the single-`init`-op surface as the normative ceiling. REJECTED: it
//   >  would force a future legitimate surface op … the four surfaces are the
//   >  invariant, THE OP COUNT IS JUST TODAY'S STATE."
//
// So growing this list needs no amendment. What ADR-0019 forbids is the SDD
// artifact LIFECYCLE forking per harness, and `assertRoutableStage` refuses that
// case in code rather than promising it in a comment (#682 slice B, ADR-0033).
// ── ONE DECLARATION, TWO SURFACES (#682, judgment:cold-5) ───────────────────
//
// `dispatch()` is reached two ways and they are NOT the same surface:
//
//   programmatically — `stage-seam.mjs` calls `dispatch(engine, 'run-stage',
//                      [{stage, prompt, model, cwd, credentialEnv}])`, ONE
//                      options object, and READS the `{ok, reason}` it returns.
//   from argv        — this file's `isMain` block, written when `init` was the
//                      only op: `process.argv.slice(3)`, raw strings, result
//                      discarded, and the op run on BOTH axes.
//
// `run-stage` was in one list, so adding it to `dispatch` published it on the
// command line too. MEASURED on the shipped tree:
//
//   $ node harness/cli.mjs run-stage cold-review "review the diff"
//   → exit 0, no output
//
// `dispatch` spreads its args, so the backend got `runStage('cold-review',
// 'review the diff')` — two positionals where the contract is one object.
// Destructuring a STRING yields `undefined` for every field, `runStage`
// returned `{ok: false, reason: 'no prompt for stage "undefined" …'}`, and the
// entry point threw the answer away. **You ask it to run a stage, it does not
// run one, and it reports success in silence.** That is #552's fold — "it
// broke" collapsed into "there was nothing to do" — in the entry point of the
// very op this slice added to prevent it.
//
// THE FIX IS THE SURFACE, NOT THE PARSING. There is no coherent argv spelling
// for this op: its payload is a PROMPT built by `assembleReviewPrompt()` from
// the reader's own constants, plus a cwd and a credential scrub-list. A human
// typing it would have to paste a generated document as a shell argument. The
// op is not a CLI op and never was — it leaked onto the command line because
// one list served both readers.
//
// So the classification lives with the op instead of in a second list that
// could drift from the first. Adding an op means answering `cli:` for it;
// there is no default, and no list to forget to update.
const OPS = Object.freeze([
  { name: 'init', cli: true },
  { name: 'run-stage', cli: false },
]);

/** Every op `dispatch()` accepts — the programmatic surface. */
export const VALID_OPS = OPS.map((o) => o.name);

/** The subset the argv entry point exposes. Derived, never respelled. */
export const CLI_OPS = OPS.filter((o) => o.cli).map((o) => o.name);

// Normalize hyphenated op to camelCase function name.
// e.g. 'feature-checkpoint' → 'featureCheckpoint'
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// ---------------------------------------------------------------------------
// Backend loader (injectable seam for testing)
// ---------------------------------------------------------------------------
async function defaultBackendLoader(harness) {
  const url = harnessAdapterUrl(harness);
  try {
    return await import(url);
  } catch (err) {
    throw new Error(
      `harness/cli: backend '${harness}' not found at ${url.pathname} — ${err.message}`,
    );
  }
}

/**
 * Dispatch an op to the resolved harness backend.
 *
 * @param {string} harness       The harness name (e.g. 'gentle-ai').
 * @param {string} op            The operation to run (e.g. 'init').
 * @param {string[]} [args]      Extra positional args forwarded to the backend function.
 * @param {{ backendLoader?: (harness: string) => Promise<object> }} [opts]
 *   Injectable backend factory — defaults to a real ESM dynamic import.
 *   Tests pass in a fake loader to avoid touching real backends.
 * @returns {Promise<*>} whatever the backend's op returned.
 * @throws {Error} if the op is unknown, the backend is not found, or the
 *   backend does not implement the requested op.
 *
 * THE RESULT IS RETURNED, and until #682 slice B.6 it was DISCARDED — the line
 * was `await backend[fn](...args);` with `@returns {Promise<void>}` beside it.
 * That was harmless while `init` was the only op: `init` answers nothing, so
 * there was nothing to drop. B.3 added `run-stage`, whose entire purpose is its
 * `{ok, reason}` answer, and the dispatcher swallowed it — a failed engine
 * reached the caller as `undefined`.
 *
 * Reproduced before fixing: a backend returning
 * `{ok: false, reason: 'the engine exited with status 137'}` came back from
 * `dispatch` as `undefined`, while calling the backend directly returned the
 * object. Same shape as #734, where `runSingle` discards `archiveChange`'s
 * return value and reports a fusion it did not perform — a caller that drops an
 * answer nobody notices is missing, because the absent value reads as a quiet
 * success.
 */
export async function dispatch(harness, op, args = [], { backendLoader = defaultBackendLoader } = {}) {
  if (!VALID_OPS.includes(op)) {
    throw new Error(
      `harness/cli: unknown op '${op}'. Valid ops: ${VALID_OPS.join(', ')}`,
    );
  }

  const fn = kebabToCamel(op);
  const backend = await backendLoader(harness);

  if (typeof backend[fn] !== 'function') {
    throw new Error(
      `harness/cli: backend '${harness}' does not implement op '${op}'`,
    );
  }

  return await backend[fn](...args);
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
const isMain = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMain) {
  const op = process.argv[2];
  if (!op) {
    console.error(`harness/cli: missing <op>. Valid ops: ${CLI_OPS.join(', ')}`);
    process.exit(1);
  }

  // CLI_OPS, NOT VALID_OPS — see the OPS table above. A programmatic op named
  // here gets its own refusal rather than the generic one, because "unknown op"
  // about an op that plainly exists sends the reader looking for a typo.
  if (!CLI_OPS.includes(op)) {
    const known = VALID_OPS.includes(op);
    console.error(
      known
        ? `harness/cli: '${op}' is not a command-line op. It is dispatched programmatically ` +
          `(brain/scripts/harness/stage-seam.mjs) because its payload is a generated prompt, ` +
          `not something argv can carry. Command-line ops: ${CLI_OPS.join(', ')}`
        : `harness/cli: unknown op '${op}'. Valid ops: ${CLI_OPS.join(', ')}`,
    );
    process.exit(1);
  }

  const envVars = readEnvFile();
  let platform;
  let engine;
  try {
    const config = loadBrainConfig();
    platform = resolvePlatform({ env: process.env, envVars, config });
    engine = resolveEngine({ env: process.env, envVars, config });
  } catch (err) {
    // A refusal names its fix (#1114 S2): print it in the active locale and stop, never run a guessed harness.
    console.error(`harness/cli: ${err instanceof AxisRefusal ? await t(err.key, await localizedParams(err)) : err.message}`);
    process.exit(1);
  }

  try {
    // THE ANSWER IS READ. Every platform answers `{ok, ...}` (#1128): claude, antigravity
    // and plain return `{ok: true}` or `{ok: false, reason}`, so a refusal to merge a
    // malformed settings file, or a write that failed, exits 1 here instead of reading as
    // success. This is the discard that was wrong SILENTLY: `run-stage` shipped broken the
    // same way, because `dispatch` itself discarded its result while `init` was the only op.
    //
    // `undefined` stays success, for SDD engines (`gentle-ai`) that answer nothing. Only an
    // explicit `{ok: false}` is a failure: an op that answers nothing has not failed at anything.
    const results = [await dispatch(platform, op, process.argv.slice(3))];
    if (engine !== platform) {
      // BOTH AXES, deliberately, and only `init` reaches here now. A repo can
      // declare a platform and an engine separately (ADR-0024), and `init` must
      // land in both: that is what makes a repo running `antigravity` + a
      // `gentle-ai` engine get both harnesses configured from one command.
      results.push(await dispatch(engine, op, process.argv.slice(3)));
    }

    const failed = results.find((r) => r && r.ok === false);
    if (failed) {
      console.error(`harness/cli: ${op}() failed — ${failed.reason ?? 'no reason given'}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`harness/cli: ${op}() failed — ${err.message}`);
    process.exit(1);
  }
}
