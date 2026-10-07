#!/usr/bin/env node
// tools-update.mjs — the ONLY verb that applies global tool updates (#1386).
// Usage: npm run brain:tools:update
//
// `day:start` and the other routine verbs never update a global tool: the tool is
// machine-wide, so one run in a throwaway repo changes every repository on the box
// (brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md).
// This verb runs `gentle-ai update` then `gentle-ai upgrade`, showing their output,
// and refuses under CI or without a terminal: it must be run interactively.
//
// It becomes a subcommand of `brain:doctor` (#1130), which will own tool updates.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { t } from './i18n/t.mjs';

const isCi = (env) => Boolean(env.CI) && !['0', 'false'].includes(String(env.CI).toLowerCase());

/**
 * @param {{spawn?: Function, env?: object, isTTY: boolean, log?: Function, err?: Function}} ctx
 * @returns {Promise<{exitCode: number}>}
 */
export async function runToolsUpdate({
  spawn = spawnSync, env = process.env, isTTY,
  log = (m) => console.log(m), err = (m) => console.error(m),
} = {}) {
  if (isCi(env)) {
    err(await t('tools.update.refusedCi'));
    return { exitCode: 1 };
  }
  if (!isTTY) {
    err(await t('tools.update.refusedNoTty'));
    return { exitCode: 1 };
  }
  const probe = spawn('gentle-ai', ['--version'], { stdio: 'pipe', encoding: 'utf8' });
  if (probe.status !== 0) {
    err(await t('tools.update.notAvailable'));
    return { exitCode: 1 };
  }
  log(await t('tools.update.checking'));
  const update = spawn('gentle-ai', ['update'], { stdio: 'inherit' });
  if (update.status !== 0) return { exitCode: update.status ?? 1 };
  log(await t('tools.update.applying'));
  const upgrade = spawn('gentle-ai', ['upgrade'], { stdio: 'inherit' });
  return { exitCode: upgrade.status ?? 1 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { exitCode } = await runToolsUpdate({
    isTTY: Boolean(process.stdin.isTTY && process.stdout.isTTY),
  });
  process.exit(exitCode);
}
