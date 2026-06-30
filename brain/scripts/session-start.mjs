#!/usr/bin/env node
// session-start.mjs — universal, read-only, LOCAL-ONLY session context loader
// (issue #138, design.md). Restores brain's operational context (manifest,
// engram, active change, ticket memory) for any agent or human, without the
// cost or network surface of day:start.
//
// The module performs NO action on import — all side effects are guarded by
// the `if (process.argv[1] === fileURLToPath(import.meta.url))` block at the
// bottom (mirrors brain-start.mjs:10-11,94). Each ordered step is a small
// exported/local function that takes `cwd` plus an injectable dependency
// seam, so it is unit-testable without subprocesses.
//
// Dependency boundary (design §1.5a — statically asserted by
// session-start.test.mjs's import-graph test): this module imports ONLY
// node:* builtins, lib/git-branch.mjs, lib/memory-manifest.mjs, and
// memory/lib/auto-resume.mjs. It MUST NOT import day-start.mjs, vcs/*,
// lib/installer.mjs, or memory/cli.mjs's `pull` path.
//
// No-network gate (design §1.5b): every subprocess this module's steps issue
// is routed through `gatedSpawn` (assertLocalArgv before the real spawn) —
// directly in step2, and via the `{_spawn}` seam injected into the two PR1
// libs (steps 1, 3). Step 4's call to `tryFeatureResume` is gated too, via
// the `{_runner}` injection point `auto-resume.mjs` already exposes — that
// file is NOT modified (it belongs to the already-merged
// feature-working-memory change, out of scope here); its existing seam is
// reused as-is from the caller side.

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { currentBranch } from './lib/git-branch.mjs';
import { restoreManifestChurn } from './lib/memory-manifest.mjs';
import { tryFeatureResume } from './memory/lib/auto-resume.mjs';
import { t } from './i18n/t.mjs';

// ── deriveChangeFromBranch — branch → openspec/changes/* resolver (design §1.4) ──

/**
 * Extracts an `issue-<N>` token from a branch name and matches it against
 * `openspec/changes/*` directory names (excluding `archive`).
 *
 * 0 / 1 / N handling is resolved by the caller (step3ResolveChange) — this
 * function only reports the facts. NEVER throws under any input.
 *
 * @param {string|null|undefined} branchName
 * @param {string} changesDir            Absolute path to openspec/changes.
 * @param {{ _readdir?: typeof readdirSync }} [opts]  Injectable seam for tests.
 * @returns {{ token: string|null, matches: string[] }}
 */
export function deriveChangeFromBranch(branchName, changesDir, { _readdir = readdirSync } = {}) {
  const out = { token: null, matches: [] };
  try {
    if (!branchName || typeof branchName !== 'string') return out;
    const m = branchName.match(/issue-(\d+)/i);
    if (!m) return out;
    out.token = `issue-${m[1]}`;

    let entries = [];
    try {
      entries = _readdir(changesDir, { withFileTypes: true });
    } catch {
      return out; // missing/unreadable changesDir → token known, zero matches
    }

    out.matches = entries
      .filter((e) => e && typeof e.isDirectory === 'function' && e.isDirectory() && e.name !== 'archive')
      .map((e) => e.name)
      // Delimiter-anchored match (NOT substring `.includes`): a dir name only
      // matches when it IS the token (bare `issue-<N>`) or starts with
      // `<token>-` (the usual `issue-<N>-<slug>` shape). Plain `.includes`
      // let a short token substring-match a longer one, e.g.
      // 'issue-138-session-start'.includes('issue-13') === true — a
      // confident WRONG resolution for branch `issue-13`.
      .filter((name) => name === out.token || name.startsWith(`${out.token}-`))
      .sort();
    return out;
  } catch {
    return out; // NEVER throws
  }
}

// ── assertLocalArgv — runtime local-op allowlist gate (design §1.5b) ─────────

const GIT_ALLOWED_SUBCOMMANDS = new Set(['status', 'restore', 'rev-parse']);
const MEMORY_CLI_ALLOWED_OPS = new Set(['import', 'feature-resume']);

// Defense in depth: reject these anywhere in argv, even on an otherwise-
// allowed cmd — guards against a future bug appending a network verb or flag
// (e.g. `import --export`) to an allowlisted call. The first alternative is
// anchored (`^...$`) so it only matches a *whole* argv token, not a
// substring; `--export`/`--cloud` match anywhere since they are themselves
// unambiguous flag names.
const FORBIDDEN_ARGV_TOKEN = /^(pull|fetch|merge|clone|ls-remote|push)$|--export|--cloud/i;

/**
 * Throws synchronously if `(cmd, args)` is not on the local-only allowlist:
 *   - `git status|restore|rev-parse` (read/local index only; trailing path
 *     args are permitted — these ops legitimately take them).
 *   - `<node> brain/scripts/memory/cli.mjs import|feature-resume`, called
 *     with EXACTLY those 2 args — no trailing flags (local-only ops per
 *     memory/cli.mjs:7-10 — never `pull`).
 *
 * Any other argv (notably `git fetch|pull|merge|clone|ls-remote|push`,
 * `memory/cli.mjs pull`, `memory/cli.mjs import --export`, `engram sync
 * --export`) is rejected. This is the runtime gate ALL subprocess calls
 * session-start.mjs controls are routed through — directly (step 2) and via
 * the injected `_spawn` seam threaded into the PR1 libs and the
 * feature-resume runner (steps 1, 3, 4) — before they reach the real spawn.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @throws {Error} when the argv is not allowlisted.
 */
export function assertLocalArgv(cmd, args = []) {
  const a = Array.isArray(args) ? args : [];
  const describe = () => `${cmd} ${a.join(' ')}`;

  if (a.some((arg) => typeof arg === 'string' && FORBIDDEN_ARGV_TOKEN.test(arg))) {
    throw new Error(`assertLocalArgv: blocked non-allowlisted local op: ${describe()}`);
  }

  if (cmd === 'git' && GIT_ALLOWED_SUBCOMMANDS.has(a[0])) return;

  const isMemoryCli = typeof a[0] === 'string' && a[0].includes('memory/cli.mjs');
  if (isMemoryCli && a.length === 2 && MEMORY_CLI_ALLOWED_OPS.has(a[1])) return;

  throw new Error(`assertLocalArgv: blocked non-allowlisted local op: ${describe()}`);
}

/**
 * The ONE gated runner every subprocess session-start.mjs controls funnels
 * through: validates `(cmd, args)` via `assertLocalArgv` BEFORE invoking the
 * underlying spawn function (real `spawnSync` in production, an injectable
 * spy in tests) — design §1.5(b)'s "every subprocess goes through ONE gated
 * runner" made literally true for both production and test code paths.
 *
 * @param {string} cmd
 * @param {string[]} args
 * @param {object} opts
 * @param {Function} [spawnFn]  Defaults to the real `spawnSync`.
 */
export function gatedSpawn(cmd, args, opts, spawnFn = spawnSync) {
  assertLocalArgv(cmd, args);
  return spawnFn(cmd, args, opts);
}

// ── renderContextBlock — pure, sync, deterministic output (design §1.7/§1.8) ─

// Structural separators only — NOT translatable user-facing text, so they
// stay plain constants outside the i18n layer (design §1.7's fixed format).
const RULE_DOUBLE = '========================';
const RULE_SINGLE = '------------------------------------------';

/**
 * Synchronous `{placeholder}` substitution — mirrors i18n/t.mjs's own
 * `translate()` interpolation rule, duplicated here (not imported) because
 * `translate()` also performs catalog/locale selection, which renderContextBlock
 * must NOT do (it stays pure: the caller already resolved the locale-correct
 * template via `t()` before calling in).
 *
 * @param {string} template
 * @param {Record<string, string|number>} params
 * @returns {string}
 */
function fill(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

function formatChangeLine(change, strings) {
  const { matches } = change;
  if (matches.length === 0) return strings.changeNone;
  if (matches.length === 1) return fill(strings.changeOne, { change: matches[0] });
  return fill(strings.changeAmbiguous, { count: matches.length, list: matches.join(', ') });
}

/**
 * Pure, synchronous string builder — no clocks, no randomness, no ANSI, no
 * i18n resolution (the caller resolves `session.*` templates ONCE via `t()`
 * and passes the resolved map in as `strings` — design §1.8). Fixed section
 * order; lines are present/absent based only on the inputs.
 *
 * @param {{ manifest: {restored: boolean}, engram: {ok: boolean},
 *           change: {branch: string|null, token: string|null, matches: string[]},
 *           ticket: string|null }} model
 * @param {{ header: string, branch: string, changeOne: string, changeNone: string,
 *           changeAmbiguous: string, memoryOk: string, memorySkip: string,
 *           manifestRestored: string, ticketLabel: string, ticketNone: string }} strings
 *           Resolved `session.*` templates (placeholders intact), e.g. from
 *           `resolveSessionStrings()`.
 * @returns {string}
 */
export function renderContextBlock(model, strings) {
  const { manifest, engram, change, ticket } = model;
  const s = strings;

  const lines = [
    s.header,
    RULE_DOUBLE,
    fill(s.branch, { branch: change.branch ?? '(unknown)' }),
    formatChangeLine(change, s),
    engram.ok ? s.memoryOk : s.memorySkip,
  ];

  if (manifest.restored) {
    lines.push(s.manifestRestored);
  }

  lines.push(
    RULE_SINGLE,
    s.ticketLabel,
    ticket ?? s.ticketNone,
    RULE_DOUBLE,
  );

  return lines.join('\n');
}

// ── ordered step functions — injectable deps seam (design §1.1) ─────────────
//
// `deps` is the single seam for tests: { _spawn, _branch, _changes, _resume }.
// Each defaults to the real local implementation; production passes nothing.
// Every step is independently try/caught and folds failure into its return
// shape — a missing engram, a non-git dir, or an ambiguous branch must
// degrade to a printed note, never an exception.
//
// Gate coverage (fresh review MAJOR 2): every subprocess call a step issues —
// directly (step 2) or via an injected `{_spawn}` seam into a PR1 lib (steps
// 1, 3) or via tryFeatureResume's own `_runner` injection point (step 4) —
// is routed through `boundGatedSpawn(deps)`, so `assertLocalArgv` runs
// before the call reaches the real `spawnSync` (production) or a test spy.
// `currentBranch` and `restoreManifestChurn` already accept `{_spawn}`;
// `tryFeatureResume` is not modified (out of scope — owned by the
// already-merged feature-working-memory change) — instead we supply a
// `_runner` that itself calls through the same gated spawn.

/**
 * Builds a `(cmd, args, opts) => result` function that runs `assertLocalArgv`
 * before delegating to `deps._spawn` (the shared test seam) or the real
 * `spawnSync`. Every step below builds its own bound instance from the same
 * `deps`, so a single injected `_spawn` spy observes every subprocess call
 * the loader makes, already passed through the gate.
 */
function boundGatedSpawn(deps) {
  const spawnFn = deps._spawn ?? spawnSync;
  return (cmd, args, opts) => gatedSpawn(cmd, args, opts, spawnFn);
}

/**
 * Step 1 — restore `.memory/manifest.json` churn before any git or engram
 * operation (REQ-3). Thin wrapper over `restoreManifestChurn`, gated.
 *
 * @returns {{ restored: boolean }}
 */
export function step1RestoreManifest(cwd, deps = {}) {
  try {
    return restoreManifestChurn(cwd, { _spawn: boundGatedSpawn(deps) });
  } catch {
    return { restored: false };
  }
}

/**
 * Step 2 — hydrate local engram from `.memory/` via the allowlisted
 * `memory/cli.mjs import` (REQ-4). Local-only: gated by `assertLocalArgv`.
 *
 * @returns {{ ok: boolean }}
 */
export function step2HydrateEngram(cwd, deps = {}) {
  try {
    const spawn = boundGatedSpawn(deps);
    const cmd = process.execPath;
    const args = ['brain/scripts/memory/cli.mjs', 'import'];
    const r = spawn(cmd, args, { cwd, encoding: 'utf8' });
    return { ok: Boolean(r) && r.status === 0 };
  } catch {
    return { ok: false };
  }
}

/**
 * Step 3 — resolve the current branch and its matching change folder(s)
 * (REQ-5). Combines `currentBranch` (gated) + `deriveChangeFromBranch`.
 *
 * @returns {{ branch: string|null, token: string|null, matches: string[] }}
 */
export function step3ResolveChange(cwd, deps = {}) {
  try {
    const branchFn = deps._branch ?? ((c) => currentBranch(c, { _spawn: boundGatedSpawn(deps) }));
    const branch = branchFn(cwd);
    const changesDir = join(cwd, 'openspec', 'changes');
    const readdir = deps._changes ?? readdirSync;
    const { token, matches } = deriveChangeFromBranch(branch, changesDir, { _readdir: readdir });
    return { branch: branch ?? null, token, matches };
  } catch {
    return { branch: null, token: null, matches: [] };
  }
}

/**
 * Step 4 — surface active-ticket operational memory via the existing
 * `tryFeatureResume` (REQ-6). `deps._resume` (if provided) fully overrides
 * the call for tests; otherwise `tryFeatureResume` is invoked with a
 * `_runner` that routes through the same gated, shared `_spawn` seam the
 * other steps use — closing the gap where this step used to call the real
 * subprocess directly, bypassing both the gate and the shared test spy.
 *
 * @returns {string|null}
 */
export function step4LoadTicketMemory(cwd, deps = {}) {
  try {
    if (deps._resume) return deps._resume(cwd) ?? null;
    const spawn = boundGatedSpawn(deps);
    const runner = (root) =>
      spawn(process.execPath, ['brain/scripts/memory/cli.mjs', 'feature-resume'], { cwd: root, encoding: 'utf8' });
    return tryFeatureResume(cwd, { _runner: runner }) ?? null;
  } catch {
    return null;
  }
}

// ── runSessionStart — top-level orchestrator (design §1.1) ──────────────────

/**
 * Runs the full session:start loop in order: restore manifest churn →
 * hydrate engram → resolve branch/change → load ticket memory → render.
 *
 * ALWAYS resolves with `exitCode: 0`. session:start is a best-effort context
 * loader — a missing engram, a non-git dir, or an ambiguous branch must
 * degrade to a printed note, never a non-zero exit (an agent's session must
 * not be blocked by a context-load failure).
 *
 * @param {string} cwd
 * @param {{ _spawn?: Function, _branch?: Function, _changes?: Function, _resume?: Function }} [deps]
 * @param {object} strings  Resolved `session.*` templates (placeholders intact),
 *        forwarded as-is into `renderContextBlock` — see `resolveSessionStrings()`.
 * @returns {Promise<{ exitCode: 0, output: string }>}
 */
export async function runSessionStart(cwd, deps = {}, strings) {
  const manifest = step1RestoreManifest(cwd, deps);
  const engram = step2HydrateEngram(cwd, deps);
  const change = step3ResolveChange(cwd, deps);
  const ticket = step4LoadTicketMemory(cwd, deps);
  const output = renderContextBlock({ manifest, engram, change, ticket }, strings);
  return { exitCode: 0, output };
}

// ── i18n wiring — resolve session.* strings ONCE (design §1.8) ──────────────
//
// `t()` is async; `renderContextBlock` must stay sync (so it is trivially
// snapshot-testable). The split: resolve every `session.*` template ONCE
// here (still containing {placeholder} tokens — no params passed to `t()`,
// so unresolved placeholders pass through verbatim per t.mjs's own
// substitution rule), then `renderContextBlock` fills the placeholders
// synchronously with the actual runtime values (branch name, change list,
// etc.) that are only known after the steps run.

const SESSION_I18N_KEYS = {
  header:           'session.header',
  branch:           'session.branch',
  changeOne:        'session.change.one',
  changeNone:       'session.change.none',
  changeAmbiguous:  'session.change.ambiguous',
  memoryOk:         'session.memory.ok',
  memorySkip:       'session.memory.skip',
  manifestRestored: 'session.manifest.restored',
  ticketLabel:      'session.ticket.label',
  ticketNone:       'session.ticket.none',
};

/**
 * Resolves the full `session.*` template map from the active locale (design
 * §1.8). Exported for the CLI entry and for tests that want to exercise the
 * real i18n wiring end-to-end.
 *
 * @returns {Promise<object>} field-keyed map matching `renderContextBlock`'s
 *          `strings` contract.
 */
export async function resolveSessionStrings() {
  const entries = await Promise.all(
    Object.entries(SESSION_I18N_KEYS).map(async ([field, key]) => [field, await t(key)]),
  );
  return Object.fromEntries(entries);
}

// ── CLI entry-point ──────────────────────────────────────────────────────────
//
// Import-pure: NO action runs unless this file is the process entry point.
// Prints the context block to stdout and exits 0 implicitly — session:start
// must never block an agent's session on a context-load failure (REQ-1, REQ-7).

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const strings = await resolveSessionStrings();
  const { output } = await runSessionStart(process.cwd(), {}, strings);
  console.log(output);
}
