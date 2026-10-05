#!/usr/bin/env node
// session-start.mjs — universal, read-only, LOCAL-ONLY session context loader
// (issue #138, design.md). Restores brain's operational context (engram,
// active change, ticket memory) for any agent or human, without the
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
// node:* builtins, lib/git-branch.mjs, memory/lib/auto-resume.mjs and
// memory/lib/backend-resolve.mjs (local config reads only). It
// MUST NOT import day-start.mjs, vcs/*, lib/installer.mjs, or
// memory/cli.mjs's `pull` path.
//
// No-network gate (design §1.5b): every subprocess this module's steps issue
// is routed through `gatedSpawn` (assertLocalArgv before the real spawn) —
// directly in step2, and via the `{_spawn}` seam injected into the two PR1
// libs (steps 1, 3). Step 4's call to `tryFeatureResume` is gated too, via
// the `{_runner}` injection point `auto-resume.mjs` already exposes — that
// file is NOT modified (it belongs to the already-merged
// feature-working-memory change, out of scope here); its existing seam is
// reused as-is from the caller side.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { currentBranch } from './lib/git-branch.mjs';
import { tryFeatureResume, EXIT_UNDECLARED, EXIT_INVALID, DECLARE_FIX } from './memory/lib/auto-resume.mjs';
import { resolveMemoryBackend, EXIT_DEFERRED } from './memory/lib/backend-resolve.mjs';
import { synthesizeContext } from './context/synthesizer.mjs';
import { t } from './i18n/t.mjs';
import { CHANGES_ROOT, parseChangeId } from './lib/sdd-layout.mjs';

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
      // Delimiter-anchored match via parseChangeId's dir-shape parser (NOT
      // substring `.includes`): a dir name only matches when its parsed iid
      // equals the branch token's iid — bare `issue-<N>` or the usual
      // `issue-<N>-<slug>` shape. Plain `.includes` let a short token
      // substring-match a longer one, e.g.
      // 'issue-138-session-start'.includes('issue-13') === true — a
      // confident WRONG resolution for branch `issue-13`.
      .filter((name) => parseChangeId(name)?.iid === m[1])
      .sort();
    return out;
  } catch {
    return out; // NEVER throws
  }
}

// ── assertLocalArgv — runtime local-op allowlist gate (design §1.5b) ─────────

const GIT_ALLOWED_SUBCOMMANDS = new Set(['rev-parse']);
const MEMORY_CLI_ALLOWED_OPS = new Set(['hydrate', 'feature-resume']);
// `hydrate --verify` (#1115, ruling Q1) is the READ-ONLY form, and the only flag any allowed op may carry:
// session-start never writes the tracked tree. `import` (the deprecated alias) is NOT allowed here.
const HYDRATE_READONLY_FLAG = '--verify';

// Defense in depth: reject these anywhere in argv, even on an otherwise-
// allowed cmd — guards against a future bug appending a network verb or flag
// (e.g. `import --export`) to an allowlisted call. The first alternative is
// anchored (`^...$`) so it only matches a *whole* argv token, not a
// substring; `--export`/`--cloud` match anywhere since they are themselves
// unambiguous flag names.
const FORBIDDEN_ARGV_TOKEN = /^(pull|fetch|merge|clone|ls-remote|push)$|--export|--cloud/i;

/**
 * Throws synchronously if `(cmd, args)` is not on the local-only allowlist:
 *   - `git rev-parse` (read-only, no working-tree mutation; trailing path
 *     args are permitted — this op legitimately takes them). `status` and
 *     `restore` were dropped (#955, D3): their only user was the manifest
 *     restore step, now retired — a dead `restore` entry would let a
 *     read-only loader run a tree-mutating git verb.
 *   - `<node> brain/scripts/memory/cli.mjs hydrate|feature-resume`, called
 *     with EXACTLY those 2 args — no trailing flags (local-only ops per
 *     memory/cli.mjs:7-10 — never `pull`) — plus the one 3-arg form
 *     `hydrate --verify`, the read-only hydration (#1115). The deprecated
 *     `import` alias is not allowed.
 *
 * Any other argv (notably `git fetch|pull|merge|clone|ls-remote|push`,
 * `memory/cli.mjs pull`, `memory/cli.mjs hydrate --export`, `engram sync
 * --export`) is rejected. This is the runtime gate ALL subprocess calls
 * session-start.mjs controls are routed through — directly (step2) and via
 * the injected `_spawn` seam threaded into `currentBranch` (step3) and the
 * feature-resume runner (step4) — before they reach the real spawn.
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
  if (isMemoryCli && a.length === 3 && a[1] === 'hydrate' && a[2] === HYDRATE_READONLY_FLAG) return;

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
// #519 — the age at which a silent memory layer is worth a line. A REPORTING
// threshold: nothing gates on it, and it is deliberately not derived from the tier
// matrix, because it decides what to SAY, never what to allow.
const STALE_MEMORY_DAYS = 2;

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
 * @param {{ hydration: {ok: boolean, backend: string|null},
 *           change: {branch: string|null, token: string|null, matches: string[]},
 *           ticket: string|null }} model
 * @param {{ header: string, branch: string, branchUnknown: string, changeOne: string,
 *           changeNone: string, changeAmbiguous: string, memoryOk: string,
 *           memorySkip: string, ticketLabel: string,
 *           ticketNone: string }} strings
 *           Resolved `session.*` templates (placeholders intact), e.g. from
 *           `resolveSessionStrings()`.
 * @returns {string}
 */
export function renderContextBlock(model, strings) {
  const { hydration, change, ticket, recency = null, records = null } = model;
  const s = strings;
  const backend = hydration.backend ?? s.backendUnknown;

  const lines = [
    s.header,
    RULE_DOUBLE,
    fill(s.branch, { branch: change.branch ?? s.branchUnknown }),
    formatChangeLine(change, s),
    // The memory line names the backend the one resolver reports — never a hardcoded one — and is
    // the same shape for every backend (#1115). #923: when a failure reason is available, surface
    // it, additive over the bare skip line.
    formatMemoryLine(hydration, backend, s),
  ];

  // The durable records context (#1115), read from .memory/records/ with no backend. Unknown is
  // never rendered as zero. Issue lines only when an issue resolved and the store was readable.
  if (records) {
    if (records.count === null || records.count === undefined || !records.newest) {
      lines.push(s.memoryRecordsUnknown);
    } else {
      lines.push(fill(s.memoryRecords, { count: records.count, date: records.newest.ts.slice(0, 10), title: records.newest.title }));
      if (records.issue !== null && records.issue !== undefined) {
        if (records.scopedCount > 0) {
          lines.push(fill(s.memoryIssue, { issue: records.issue, count: records.scopedCount }));
          for (const item of records.scoped) lines.push(fill(s.memoryIssueItem, { date: item.ts.slice(0, 10), title: item.title }));
        } else {
          lines.push(fill(s.memoryIssueNone, { issue: records.issue }));
        }
      }
    }
  }

  // Only when it is worth saying. A store captured today needs no line; an unknown or
  // stale one does. The threshold is a REPORTING choice, not a policy — nothing branches
  // on it but this string.
  if (recency) {
    if (recency.ageDays === null) {
      lines.push(s.memoryRecencyUnknown);
    } else if (recency.ageDays >= STALE_MEMORY_DAYS) {
      lines.push(fill(s.memoryRecencyStale, { days: String(recency.ageDays) }));
    }
  }

  lines.push(
    RULE_SINGLE,
    s.ticketLabel,
    ticket ?? s.ticketNone,
    RULE_DOUBLE,
  );

  return lines.join('\n');
}

function formatMemoryLine(h, backend, s) {
  if (h.undeclared) return fill(s.memoryNotDeclared, { reason: h.reason });
  if (h.deferred) return fill(s.memoryDeferred, { backend, reason: h.reason ?? '' });
  if (h.ok) {
    if (h.verified) return fill(h.stale ? s.memoryStale : s.memoryVerified, { backend });
    return fill(s.memoryOk, { backend });
  }
  return h.reason ? fill(s.memorySkipReason, { backend, reason: h.reason }) : fill(s.memorySkip, { backend });
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
// directly (step2) or via an injected `{_spawn}` seam into `currentBranch`
// (step3) or via tryFeatureResume's own `_runner` injection point (step4) —
// is routed through `boundGatedSpawn(deps)`, so `assertLocalArgv` runs
// before the call reaches the real `spawnSync` (production) or a test spy.
// `currentBranch` already accepts `{_spawn}`; `tryFeatureResume` is not
// modified (out of scope — owned by the
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
 * Step 2 — hydrate the ACTIVE memory backend from `.memory/records/` through the backend-owned
 * `memory/cli.mjs hydrate --verify` (REQ-4, #1115). Local-only: gated by `assertLocalArgv`.
 *
 * `--verify` is the read-only form (ruling Q1): session-start is read-only and `.memory/index.jsonl`
 * is tracked, so on plainfiles the verb only CHECKS the derived index and reports drift; the rebuild
 * is `post-merge`'s. Engram's import projects into the engram store, not the tracked tree, and runs
 * as it always did here. This function names no backend op and branches on no backend name: the
 * backend is whatever the one resolver (`memory/lib/backend-resolve.mjs`) says is declared, and every
 * outcome renders the same way for every backend.
 *
 * Outcomes (all non-fatal — `runSessionStart()` always resolves `exitCode: 0`):
 *   - exit 0               → `{ ok: true, backend }`, plus `{ verified, stale }` when the CLI's stdout
 *                            line says the form that ran was a verification.
 *   - exit 6 (`EXIT_DEFERRED`, ruling Q4) → `{ ok: false, deferred: true, backend, reason }`.
 *   - exit 3 / 4           → the declaration refusal (#1165): `{ ok: false, undeclared: true, reason }`.
 *   - anything else        → `{ ok: false, backend, reason }` (#923: the cause is kept).
 *
 * @returns {{ ok: boolean, backend: string|null, verified?: true, stale?: boolean,
 *             deferred?: true, undeclared?: true, reason?: string }}
 */
export function step2Hydrate(cwd, deps = {}) {
  let backend = null;
  try {
    const resolved = (deps._resolveBackend ?? (() => resolveMemoryBackend({ root: cwd })))(cwd);
    if (resolved?.status === 'declared' && typeof resolved.backend === 'string') backend = resolved.backend;
  } catch { /* the name is cosmetic: an unresolvable backend renders as "unknown backend", never breaks the step */ }
  try {
    const spawn = boundGatedSpawn(deps);
    const cmd = process.execPath;
    const args = ['brain/scripts/memory/cli.mjs', 'hydrate', HYDRATE_READONLY_FLAG];
    const r = spawn(cmd, args, { cwd, encoding: 'utf8' });
    const line = lastJsonLine(r?.stdout);
    if (Boolean(r) && r.status === 0) {
      return line?.hydrate === 'verified'
        ? { ok: true, backend, verified: true, stale: line.stale === true }
        : { ok: true, backend };
    }
    // The declaration refusal (#1165) — nothing was tried, so it is NOT an outage of any backend.
    if (r?.status === EXIT_UNDECLARED || r?.status === EXIT_INVALID) {
      return { ok: false, undeclared: true, backend: null, reason: `memory backend ${r.status === EXIT_INVALID ? 'invalid' : 'not declared'} — ${DECLARE_FIX}` };
    }
    const stderr = typeof r?.stderr === 'string' ? r.stderr.trim() : '';
    if (r?.status === EXIT_DEFERRED) {
      const reason = (typeof line?.reason === 'string' && line.reason) || stderr || 'deferred';
      return { ok: false, deferred: true, backend, reason };
    }
    const reason = stderr || `exited ${r?.status ?? 'unknown'}`;
    return { ok: false, backend, reason };
  } catch (err) {
    return { ok: false, backend, reason: err?.message ?? String(err) };
  }
}

/** The last stdout line that parses as a JSON object, or null. The CLI prints one such line for a verified or deferred hydration. */
function lastJsonLine(stdout) {
  if (typeof stdout !== 'string') return null;
  const lines = stdout.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{'));
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed !== null && typeof parsed === 'object') return parsed;
    } catch { /* not ours — keep looking */ }
  }
  return null;
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
    const changesDir = join(cwd, CHANGES_ROOT);
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

/**
 * Step 4b — how old is the newest durable memory record? (issue #519.)
 *
 * The durable layer went SIX DAYS without a record and nothing said so. Two phases,
 * and only the first was legitimate: materialization was genuinely blocked by #469
 * until 2026-08-08, and then the block lifted and the practice simply did not resume.
 * The only signal in either phase was `memory: engram unavailable (skipped)` — a line
 * that reads as housekeeping, in a banner nobody reads as a warning.
 *
 * This REPORTS. It blocks nothing, gates nothing, and takes no position on whether
 * `memory-gate` should be able to see this (that is #519's open ruling). The claim it
 * makes is narrow and checkable: a system whose memory layer can go silent should not
 * be silent about it.
 *
 * Reads `.memory/records/*.jsonl` directly rather than asking engram, deliberately —
 * the case worth reporting is exactly the one where engram is ABSENT, so a probe that
 * needs engram to answer cannot answer it. Committed records are the durable truth
 * (ADR-0002); engram is the queryable projection.
 *
 * An unreadable or empty store yields `null` (unknown), never `0` (fresh). "Cannot
 * determine" and "captured today" are different answers, and collapsing them is the
 * `evidence-reader-empty-on-failure` class this repo has now paid for nine times.
 *
 * @returns {{ ageDays: number|null, newest: string|null }}
 */
export function step4bMemoryRecency(cwd, deps = {}) {
  try {
    if (deps._recency) return deps._recency(cwd);
    const dir = join(cwd, '.memory', 'records');
    if (!existsSync(dir)) return { ageDays: null, newest: null };
    let newestMs = null;
    let newestTs = null;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.jsonl')) continue;
      for (const line of readFileSync(join(dir, name), 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let ts;
        try { ts = JSON.parse(line)?.ts; } catch { continue; }
        if (typeof ts !== 'string') continue;
        const ms = Date.parse(ts);
        if (!Number.isFinite(ms)) continue;
        if (newestMs === null || ms > newestMs) { newestMs = ms; newestTs = ts; }
      }
    }
    if (newestMs === null) return { ageDays: null, newest: null };
    const nowMs = deps._now ? deps._now() : Date.now();
    return { ageDays: Math.floor((nowMs - newestMs) / 86400000), newest: newestTs };
  } catch {
    return { ageDays: null, newest: null };
  }
}

/**
 * Step 4c — the durable-records context (#1115, REQ-1115-7; rulings 5 and Q3).
 *
 * Reads `.memory/records/*.jsonl` DIRECTLY — no backend, no spawn, so the no-network invariant (REQ-2)
 * holds and the context is the same for every backend. Shown for engram consumers too: branching on
 * the backend name here is exactly the axis leak the axis-port guard flags. The richer,
 * backend-provided context is follow-up #1350.
 *
 * Records are deduplicated by `id` (a `merge=union` pull mints repeated lines). The title is the first
 * non-empty line of `content`, `**` stripped, cut at 80 characters. `scoped` is the records whose
 * `issue === N`, newest first, at most 5; `scopedCount` is how many exist.
 *
 * An unreadable, absent or EMPTY store is `count: null` — "unknown", never `0` (the
 * `evidence-reader-empty-on-failure` class). The loop deliberately duplicates step4b's tolerant read
 * rather than importing `memory/lib/store.mjs`, which would widen this module's import graph for a
 * 20-line loop; #1350 replaces both with the backend's payload.
 *
 * @param {string} cwd
 * @param {{ issue: number|null }} ctx
 * @returns {{ count: number|null, newest: {ts: string, title: string}|null,
 *             scoped: Array<{ts: string, title: string}>, scopedCount: number }}
 */
export function step4cMemoryRecords(cwd, { issue = null } = {}, deps = {}) {
  const none = { count: null, newest: null, scoped: [], scopedCount: 0 };
  try {
    if (deps._records) return deps._records(cwd, { issue });
    const dir = join(cwd, '.memory', 'records');
    if (!existsSync(dir)) return none;
    /** @type {Map<string, {ts: string, title: string, issue: unknown, ms: number}>} */
    const byId = new Map();
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.jsonl')) continue;
      for (const line of readFileSync(join(dir, name), 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let rec;
        try { rec = JSON.parse(line); } catch { continue; }
        if (!rec || typeof rec.id !== 'string' || typeof rec.ts !== 'string' || byId.has(rec.id)) continue;
        const ms = Date.parse(rec.ts);
        if (!Number.isFinite(ms)) continue;
        byId.set(rec.id, { ts: rec.ts, title: recordTitle(rec.content), issue: rec.issue, ms });
      }
    }
    if (byId.size === 0) return none;
    const newestFirst = [...byId.values()].sort((a, b) => b.ms - a.ms);
    const scopedAll = issue === null ? [] : newestFirst.filter((r) => r.issue === issue);
    const slim = ({ ts, title }) => ({ ts, title });
    return {
      count: byId.size,
      newest: slim(newestFirst[0]),
      scoped: scopedAll.slice(0, 5).map(slim),
      scopedCount: scopedAll.length,
    };
  } catch {
    return none;
  }
}

/** First non-empty line of `content`, with the bold markers stripped, at most 80 characters. */
function recordTitle(content) {
  const first = String(content ?? '').split('\n').map((l) => l.trim()).find((l) => l !== '') ?? '';
  const clean = first.replaceAll('**', '').trim();
  return clean.length > 80 ? `${clean.slice(0, 79)}…` : clean;
}

/**
 * Step 5 — synthesize targeted agent context floor + ADRs (REQ-CTX-4).
 * @returns {Promise<{ coreFloor: string[], matchedDecisions: string[], markdown: string }>}
 */
export async function step5SynthesizeContext(cwd, deps = {}) {
  try {
    const change = step3ResolveChange(cwd, deps);
    const synth = deps._synthesize ?? synthesizeContext;
    return await synth({ touchedFiles: change.matches, rootDir: cwd });
  } catch {
    const defaultFloor = [
      'brain/core/methodology/agent-authorities.md',
      'brain/core/methodology/sdd-layout.md',
      'brain/core/methodology/workflow-governance.md',
      'brain/core/methodology/reviewer-protocol.md',
    ];
    return {
      coreFloor: defaultFloor,
      matchedDecisions: [],
      matchedMemories: [],
      failsafeActivated: true,
      failsafeMode: 'core_floor',
      markdown: '# Synthesized Agent Context (.brain-context.md)\n\n## Core Methodology Baseline Floor (Mandatory)\n- [agent-authorities.md](brain/core/methodology/agent-authorities.md)\n- [sdd-layout.md](brain/core/methodology/sdd-layout.md)\n- [workflow-governance.md](brain/core/methodology/workflow-governance.md)\n- [reviewer-protocol.md](brain/core/methodology/reviewer-protocol.md)\n\n> [!NOTE]\n> Core Baseline Floor Activated: Synthesizer execution fallback.',
    };
  }
}

// ── runSessionStart — top-level orchestrator (design §1.1) ──────────────────

/**
 * Runs the full brain:session:start loop in order: hydrate (verify) the active
 * backend → resolve branch/change → load ticket memory → records context → render.
 *
 * ALWAYS resolves with `exitCode: 0`. brain:session:start is a best-effort
 * context loader — a missing engram, a non-git dir, or an ambiguous branch must
 * degrade to a printed note, never a non-zero exit (an agent's session must
 * not be blocked by a context-load failure).
 *
 * #923 (acceptance B, triage finding, deliberate — NOT a bug fix): this
 * orchestrator calls steps 2-4b only. `step5SynthesizeContext` is defined,
 * exported, and independently tested (see its own test above), but nothing
 * wires it in here. Whether it is dead code or an intended-but-unwired stage
 * is a product decision, not something this fix resolves — wiring it in
 * changes runSessionStart()'s output shape and (being `async`, unlike every
 * step before it) its performance profile, both consumer-facing decisions
 * that belong with #267 (the consumption/diagnostics ticket this triage
 * question is linked to), not silently bundled into an observability fix.
 * Recorded here so the open question has one canonical home instead of
 * being rediscovered from scratch.
 *
 * @param {string} cwd
 * @param {{ _spawn?: Function, _branch?: Function, _changes?: Function, _resume?: Function }} [deps]
 * @param {object} strings  Resolved `session.*` templates (placeholders intact),
 *        forwarded as-is into `renderContextBlock` — see `resolveSessionStrings()`.
 * @returns {Promise<{ exitCode: 0, output: string }>}
 */
export async function runSessionStart(cwd, deps = {}, strings) {
  const hydration = step2Hydrate(cwd, deps);
  const change = step3ResolveChange(cwd, deps);
  const ticket = step4LoadTicketMemory(cwd, deps);
  const recency = step4bMemoryRecency(cwd, deps);
  // The issue for the records context: only when exactly one change folder resolves. Zero or several
  // is "no issue", never a guess.
  const iid = change.matches.length === 1 ? Number(parseChangeId(change.matches[0])?.iid) : NaN;
  const issue = Number.isInteger(iid) ? iid : null;
  const records = { ...step4cMemoryRecords(cwd, { issue }, deps), issue };
  const output = renderContextBlock({ hydration, change, ticket, recency, records }, strings);
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
  branchUnknown:    'session.branch.unknown',
  changeOne:        'session.change.one',
  changeNone:       'session.change.none',
  changeAmbiguous:  'session.change.ambiguous',
  memoryOk:         'session.memory.ok',
  memorySkip:       'session.memory.skip',
  memorySkipReason: 'session.memory.skip.reason',
  memoryNotDeclared: 'session.memory.notDeclared',
  memoryDeferred:   'session.memory.deferred',
  memoryVerified:   'session.memory.verified',
  memoryStale:      'session.memory.stale',
  backendUnknown:   'session.memory.backend.unknown',
  memoryRecords:    'session.memory.records',
  memoryRecordsUnknown: 'session.memory.records.unknown',
  memoryIssue:      'session.memory.issue',
  memoryIssueItem:  'session.memory.issue.item',
  memoryIssueNone:  'session.memory.issue.none',
  memoryRecencyStale:   'session.memory.recency.stale',
  memoryRecencyUnknown: 'session.memory.recency.unknown',
  ticketLabel:      'session.ticket.label',
  ticketNone:       'session.ticket.none',
};

/**
 * Resolves the full `session.*` template map from a locale (design §1.8).
 * Exported for the CLI entry and for tests that want to exercise the real i18n
 * wiring end-to-end.
 *
 * `locale` is optional: omit it (CLI path) to use the ambient locale from
 * `brain.config.json`; pass an explicit locale (e.g. tests) to resolve
 * deterministically, independent of the consumer's ambient config.
 *
 * @param {string} [locale] explicit locale override; ambient when omitted.
 * @returns {Promise<object>} field-keyed map matching `renderContextBlock`'s
 *          `strings` contract.
 */
export async function resolveSessionStrings(locale) {
  const entries = await Promise.all(
    Object.entries(SESSION_I18N_KEYS).map(async ([field, key]) => [field, await t(key, {}, { locale })]),
  );
  return Object.fromEntries(entries);
}

// ── CLI entry-point ──────────────────────────────────────────────────────────
//
// Import-pure: NO action runs unless this file is the process entry point.
// Prints the context block to stdout and exits 0 implicitly — brain:session:start
// must never block an agent's session on a context-load failure (REQ-1, REQ-7).

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const strings = await resolveSessionStrings();
  const { output } = await runSessionStart(process.cwd(), {}, strings);
  console.log(output);
}
