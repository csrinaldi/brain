// upstream-records.mjs — the ONE predicate issue #701 is about: which record
// `id`s are already durable at the upstream base. design.md Decisions 1-4.
//
// A candidate record is declined when its `id` is already present in
// `.memory/records/` at the upstream base — content-addressed, no
// authorship semantics. `store.mjs#recordFilename` is the ONE place a record
// maps to a path (`<yyyy-mm>-<id>.jsonl`), so the id IS the filename for
// every in-tree producer; reading basenames at a ref costs one `git ls-tree`
// spawn and zero blob reads (design.md Decision 1).
//
// Three functions, two of them pure:
//   resolveUpstreamRef()   — I/O: which ref answers "what is already durable"
//   upstreamRecordEntries() — I/O: the discriminated `{ok, ...}` result
//   parseLsTree()          — PURE: `-z` ls-tree text → {byId, byPath, unnamed}

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The filename grammar `store.mjs#recordFilename` writes (issue #677). */
const RECORD_NAME_RE = /^\d{4}-\d{2}-(rec-[0-9a-f]{16})\.jsonl$/;

/**
 * refResolves() — `git rev-parse --verify --quiet <ref>^{tree}`, true only on
 * a clean zero exit. No git binary, a non-git directory, and an unresolvable
 * ref all collapse to `false` here — the caller does not need to tell them
 * apart, only to know "this ref does not answer".
 *
 * @param {string} ref
 * @param {string} root
 * @param {typeof spawnSync} _spawn
 * @returns {boolean}
 */
/**
 * loadBrainConfigAt() — reads `brain.config.json` relative to a given root.
 *
 * `lib/brain-config.mjs`'s `loadBrainConfig()` resolves its path from the
 * MODULE's own location and takes no argument, so it cannot answer "the config
 * of this root" — which is what a seam-injectable, root-parameterised lookup
 * needs, and what the tests drive against a tmpdir. Missing or malformed reads
 * as `{}`: a config that cannot be parsed must not be an error path here, it
 * means "no stated ref", and the derived candidates take over.
 *
 * @param {string} root
 * @returns {object}
 */
function loadBrainConfigAt(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'brain.config.json'), 'utf8'));
  } catch {
    return {};
  }
}

function refResolves(ref, root, _spawn) {
  try {
    const r = _spawn('git', ['rev-parse', '--verify', '--quiet', `${ref}^{tree}`], { cwd: root, encoding: 'utf8' });
    if (r?.error) return false;
    return r?.status === 0;
  } catch {
    return false;
  }
}

/**
 * resolveUpstreamRef() — design.md Decision 2's table: env >
 * `brain.config.json` `memory.upstreamRef` > `origin/HEAD` > `origin/main`.
 *
 * STATED (levels 1-2) vs DERIVED (levels 3-4), the same split
 * `backend-selection.mjs` already uses for `MEMORY_BACKEND` (#641): a stated
 * ref is an operator's explicit escape hatch and is NEVER silently overridden
 * by falling through to a different ref they did not ask for — if it does not
 * resolve, resolution stops there and reports `resolved: false` against THAT
 * ref. A derived ref may fall through to the next derived candidate.
 *
 * `config` DEFAULTS TO READING `brain.config.json` from `root`, and that
 * default is the fix for a real defect (cold review of #705/#706): level 2 was
 * documented here, named in this module's own refusal text, and **dead in
 * production** — neither call site passed a `config`, so `memory.upstreamRef`
 * resolved to `undefined` and fell through to `origin/HEAD`, silently
 * overriding a stated ref, which is exactly what the paragraph above promises
 * never happens.
 *
 * It is read HERE rather than threaded from each caller on purpose: this module
 * owns the key, so one definition serves every call site and a future one
 * cannot forget to pass it. Tests still inject `config` explicitly, and passing
 * `{}` still means "no stated ref" — only `undefined`/omitted triggers the read.
 * Every wrapper in this module's call chain therefore leaves `config`
 * UNDEFAULTED: an intervening `config = {}` is not nullish, so it would defeat
 * the `??` and leave level 2 dead exactly as it was before the default existed.
 *
 * @param {object} args
 * @param {string} args.root
 * @param {object} [args.env]     Defaults to `process.env`; a plain object in tests.
 * @param {object} [args.config]  Parsed `brain.config.json`. Omitted → read from `root`.
 * @param {typeof spawnSync} [args._spawn]
 * @param {(root: string) => object} [args._loadConfig]  Omitted → `loadBrainConfigAt`.
 * @returns {{ref: string, stated: boolean, resolved: boolean}}
 */
export function resolveUpstreamRef({
  root,
  env = process.env,
  config,
  _spawn = spawnSync,
  _loadConfig = loadBrainConfigAt,
}) {
  const cfg = config ?? _loadConfig(root);
  const statedRef = env?.BRAIN_MEMORY_UPSTREAM_REF || cfg?.memory?.upstreamRef;
  if (statedRef) {
    return { ref: statedRef, stated: true, resolved: refResolves(statedRef, root, _spawn) };
  }
  for (const ref of ['origin/HEAD', 'origin/main']) {
    if (refResolves(ref, root, _spawn)) return { ref, stated: false, resolved: true };
  }
  return { ref: 'origin/main', stated: false, resolved: false };
}

/**
 * parseLsTree() — PURE. Parses `git ls-tree -r -z --full-tree <ref> --
 * .memory/records` output: `<mode> SP <type> SP <oid> TAB <path>` entries
 * separated by `\0`.
 *
 * A path whose basename matches `RECORD_NAME_RE` (every in-tree producer's
 * shape, issue #677) contributes its id to `byId` and its full path to
 * `byPath` (the gate, design.md Decision 6, needs the oid keyed by path — the
 * SAME ls-tree result, never a second git call). A path that does not match —
 * a pre-#677 month file, or any unknown shape — is invisible to the id set by
 * construction and is counted into `unnamed` instead (design.md Decision 3's
 * "partial scope" state), never silently dropped.
 *
 * Malformed entries (no tab, no three-token mode/type/oid header) are
 * skipped: `-z`-terminated ls-tree output is a well-formed grammar this
 * function trusts, and a fuzzed/garbage string must not throw.
 *
 * @param {string} text
 * @returns {{byId: Map<string,string>, byPath: Map<string,string>, unnamed: string[]}}
 */
export function parseLsTree(text) {
  const byId = new Map();
  const byPath = new Map();
  const unnamed = [];
  if (typeof text !== 'string' || text.length === 0) return { byId, byPath, unnamed };

  for (const entry of text.split('\0')) {
    if (entry.length === 0) continue;
    const tab = entry.indexOf('\t');
    if (tab === -1) continue; // malformed — not a `<meta>\t<path>` entry
    const meta = entry.slice(0, tab).split(' ');
    const path = entry.slice(tab + 1);
    if (meta.length !== 3 || !path) continue; // malformed — not `<mode> <type> <oid>`
    const oid = meta[2];
    const basename = path.slice(path.lastIndexOf('/') + 1);
    const m = RECORD_NAME_RE.exec(basename);
    if (m) {
      byId.set(m[1], oid);
      byPath.set(path, oid);
    } else {
      unnamed.push(path);
    }
  }
  return { byId, byPath, unnamed };
}

/**
 * upstreamRecordEntries() — the discriminated result (design.md Decision 3).
 * `ok: false` covers EVERY way the lookup can fail to happen — no git binary,
 * not a git directory, no remote, an unfetched fresh clone, `ls-tree`
 * non-zero — and callers MUST treat it as "could not look", never as "found
 * nothing" (`evidence-reader-empty-on-failure`). The caller's degradation
 * (write everything) is the SAME on `ok:false` and on `ok:true` with an empty
 * `byId` — the distinction exists for the REPORT, not the behaviour.
 *
 * @param {object} args
 * @param {string} args.root
 * @param {object} [args.env]
 * @param {object} [args.config]  Parsed `brain.config.json`. **Deliberately undefaulted**:
 *   omitted → `resolveUpstreamRef` reads it from `root`, and a `= {}` here would be
 *   non-nullish, defeating that read and leaving `memory.upstreamRef` dead in production.
 * @param {typeof spawnSync} [args._spawn]
 * @param {(root: string) => object} [args._loadConfig]  Forwarded to `resolveUpstreamRef`
 *   so the config read is injectable at the layer production actually calls.
 * @returns {{ok:true, ref:string, stated:boolean, byId:Map<string,string>, byPath:Map<string,string>, unnamed:string[]}
 *          |{ok:false, ref:string, stated:boolean, reason:string}}
 */
export function upstreamRecordEntries({
  root,
  env = process.env,
  config,
  _spawn = spawnSync,
  _loadConfig = loadBrainConfigAt,
} = {}) {
  const { ref, stated, resolved } = resolveUpstreamRef({ root, env, config, _spawn, _loadConfig });
  if (!resolved) {
    const reason = stated
      ? `the stated upstream ref '${ref}' does not resolve (BRAIN_MEMORY_UPSTREAM_REF / memory.upstreamRef) — writing every candidate this run (pre-#701 behaviour)`
      : `no upstream ref resolved (tried origin/HEAD, origin/main) — writing every candidate this run (pre-#701 behaviour)`;
    return { ok: false, ref, stated, reason };
  }

  let result;
  try {
    result = _spawn('git', ['ls-tree', '-r', '-z', '--full-tree', ref, '--', '.memory/records'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1e9,
    });
  } catch (err) {
    return { ok: false, ref, stated, reason: `git ls-tree threw — ${err.message}` };
  }
  if (result?.error) {
    return { ok: false, ref, stated, reason: `git ls-tree could not run — ${result.error.message}` };
  }
  if (typeof result?.status !== 'number' || result.status !== 0) {
    const detail = result?.stderr ? ` — ${String(result.stderr).trim()}` : '';
    return { ok: false, ref, stated, reason: `git ls-tree exited ${result?.status ?? 'with no status'}${detail}` };
  }

  const { byId, byPath, unnamed } = parseLsTree(result.stdout ?? '');
  return { ok: true, ref, stated, byId, byPath, unnamed };
}
