#!/usr/bin/env node
// brain/scripts/memory/session-end-ship.mjs — the SessionEnd hook launcher
// (#906, design.md A1-A3, ruling D1). The compiled SessionEnd hook
// (harness/backends/settings-hooks.mjs) runs `npm run brain:memory:session-end`
// UNCONDITIONALLY on every platform (D2: emit-always, guard at runtime) — this
// file is that runtime guard.
//
// Order, exactly as design.md's A1 table:
//   1. `_loadConfig()` → `memory.lane.enabled === true`; false or absent ⇒
//      exit 0, spawn nothing, print nothing (loadBrainConfig parses raw JSON,
//      no migration, so an absent key reads as undefined — false by
//      construction).
//   2. `openSync(log, O_WRONLY|O_CREAT|O_APPEND|O_NOFOLLOW, 0o600)` — one fd,
//      reused for the child's stdout+stderr. `O_NOFOLLOW` refuses a
//      pre-existing symlink at the log path instead of following it (#906
//      cold review C2); `0o600` keeps a freshly created log unreadable to
//      other local users. Either failure routes through step 5's catch.
//   3. `_spawn(execPath, [cli.mjs, 'ship', '--json'], { detached: true,
//      stdio: ['ignore', fd, fd] })`, then `.unref()`, then `closeSync(fd)`.
//   4. Return / exit 0, ALWAYS — the child's own exit code is never read.
//      `ship` exits 1 on a raced push; a session must not end red for that.
//   5. Any throw along the way ⇒ exactly one stderr line, still exit 0.
//
// `env: process.env` is passed UNCHANGED (A2) — `credentialEnvNames()`
// (lib/credential-env.mjs) includes FORGE_TOKEN_ENV, so a reflexive scrub
// would drop GH_TOKEN/GITLAB_TOKEN and kill the ambient `lite` identity
// ADR-0034 L5 permits, invisibly, inside a detached child. Do not "harden"
// this by scrubbing — that is the exact trap A2 documents.
//
// `--json` (not the human-readable form): the tmp log is the ONLY record a
// detached run leaves, and `t()` would translate a human-readable line into
// the operator's `docs.language` — a locale-dependent postmortem. `ship`
// writes its stderr evidence regardless of `--json`, so the log keeps both.

import { openSync, closeSync, constants as fsConstants } from 'node:fs';
import { spawn } from 'node:child_process';
import { hostname, tmpdir as osTmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBrainConfig } from '../lib/brain-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const CLI_PATH = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * Ships the lane, detached, IFF `memory.lane.enabled` is true. Never throws,
 * never reports a non-zero outcome to its caller — the hook that invokes
 * this must always see exit 0.
 *
 * @param {{ _loadConfig?: Function, _spawn?: Function, _tmpdir?: Function, _now?: Function }} [seams]
 * @returns {{ spawned: boolean, logPath: string|null }}
 */
export function shipOnSessionEnd({
  _loadConfig = loadBrainConfig,
  _spawn = spawn,
  _tmpdir = osTmpdir,
  _now = () => new Date(),
} = {}) {
  try {
    const config = _loadConfig();
    if (config?.memory?.lane?.enabled !== true) {
      return { spawned: false, logPath: null };
    }

    const date = _now().toISOString().slice(0, 10);
    const logPath = join(_tmpdir(), `brain-lane-ship-${hostname()}-${date}.log`);
    // `tmpdir()` is a predictable, world-writable directory: a local user
    // can pre-create `logPath` as a symlink before this ever runs. A plain
    // `openSync(logPath, 'a')` (default flags, default mode 0664) would
    // FOLLOW that symlink and append the ship op's stderr evidence into
    // whatever file the attacker named (#906 cold review C2). `O_NOFOLLOW`
    // refuses instead of following — the resulting ELOOP is caught by the
    // outer `catch` below, which already does exactly the right thing: one
    // stderr line, exit 0, no spawn. `0o600` denies read to every other
    // local user for a freshly created file.
    const fd = openSync(
      logPath,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_APPEND | fsConstants.O_NOFOLLOW,
      0o600,
    );
    try {
      const child = _spawn(
        process.execPath,
        [CLI_PATH, 'ship', '--json'],
        {
          detached: true,
          stdio: ['ignore', fd, fd],
          cwd: REPO_ROOT,
          env: process.env,
        },
      );
      child.unref();
    } finally {
      closeSync(fd);
    }

    return { spawned: true, logPath };
  } catch (err) {
    process.stderr.write(`brain:memory:session-end: ${err?.message ?? String(err)}\n`);
    return { spawned: false, logPath: null };
  }
}

// Main-module guard (lib/brain-config.mjs:240 pattern) — importable for
// tests, executable as the SessionEnd hook. Exit 0 always (step 4).
if (process.argv[1] === __filename) {
  shipOnSessionEnd();
  process.exit(0);
}
