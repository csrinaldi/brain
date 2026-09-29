// reconcile-pull.mjs — issue #1118: `git pull` refuses to fast-forward over an
// untracked `.memory/records/*.jsonl` that the pull itself would create, even
// when the file is byte-identical to the incoming copy. That is exactly the
// state of the checkout that captured a record after its own lane PR merges.
//
// The rule: a byte-identical untracked record whose blob is reachable from
// `@{u}` is already durable in git's object store, so it can be deleted before
// the pull and rewritten from that blob if the pull does not verifiably
// recreate it. The oid is the backup — no copy lives anywhere else.
//
// Shared by `plainfiles.mjs#pull` and `engram.mjs#pullMemory`.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { upstreamRecordEntries } from './upstream-records.mjs';

function run(root, args, { input } = {}) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', input, maxBuffer: 1e9 });
}

const ok = (r) => !r.error && r.status === 0;

/** `git hash-object` of the file on disk, or null when it cannot be read. */
function hashOnDisk(root, path) {
  const r = run(root, ['hash-object', '--', path]);
  return ok(r) ? r.stdout.trim() : null;
}

const isTrackedAtHead = (root, path) => ok(run(root, ['cat-file', '-e', `HEAD:${path}`]));

/** `@{u}` as a short ref, or null when the branch has no upstream. */
function resolveUpstream(root) {
  const r = run(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  return ok(r) && r.stdout.trim() ? r.stdout.trim() : null;
}

/**
 * Deletes every untracked, byte-identical record that `@{u}` also carries and
 * returns `[{path, oid}]` to verify after the pull. A record whose bytes differ
 * from the incoming copy is never touched: the whole call refuses instead.
 */
export function reconcileUntrackedRecords({ root }) {
  const target = resolveUpstream(root);
  if (!target) return [];
  const upstream = upstreamRecordEntries({ root, ref: target });
  if (!upstream.ok) return [];

  const candidates = [];
  const divergent = [];
  for (const [path, upstreamOid] of upstream.byPath) {
    if (!existsSync(join(root, path)) || isTrackedAtHead(root, path)) continue;
    const localOid = hashOnDisk(root, path);
    if (localOid === upstreamOid) candidates.push({ path, oid: upstreamOid });
    else divergent.push(`  ${path} (local ${localOid ?? 'unreadable'} vs incoming ${upstreamOid})`);
  }
  if (divergent.length > 0) {
    throw new Error(
      `brain:memory:pull refused: ${divergent.length} untracked .memory/records/ file(s) differ from the version ` +
      `about to arrive from ${target} and were left untouched — inspect, then remove or keep each deliberately ` +
      `before pulling again:\n${divergent.join('\n')}`,
    );
  }

  for (const c of candidates) unlinkSync(join(root, c.path));
  return candidates;
}

/**
 * Checks each reconciled path after the pull. A path that is present, tracked
 * at HEAD and hashes to its oid is verified; anything else is rewritten from
 * git's own object store. A path that exists with different bytes is never
 * overwritten. Returns `{restored, problems}`: paths rewritten from the blob
 * (the pull did not recreate them) and paths that could not be brought back.
 */
export function verifyOrRestore({ root, reconciled, _log = console.log }) {
  const restored = [];
  const problems = [];
  for (const { path, oid } of reconciled) {
    const abs = join(root, path);
    if (existsSync(abs)) {
      const now = hashOnDisk(root, path);
      if (now === oid && isTrackedAtHead(root, path)) {
        _log(`brain:memory:pull: verified ${path} — present, tracked at HEAD, blob ${oid}`);
        continue;
      }
      if (now === oid) {
        // Present with the same bytes but never committed: nothing to rewrite.
        _log(`brain:memory:pull: ${path} is present with blob ${oid} but is not tracked at HEAD (the pull did not recreate it)`);
        problems.push(`${path} — present with the original bytes but not tracked at HEAD`);
        continue;
      }
      problems.push(`${path} — exists with different content (blob ${now ?? 'unreadable'}, expected ${oid}); not overwritten`);
      continue;
    }
    const blob = run(root, ['cat-file', 'blob', oid]);
    if (!ok(blob)) {
      problems.push(`${path} — could not be restored: blob ${oid} is no longer readable (${String(blob.stderr ?? '').trim()})`);
      continue;
    }
    try {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, blob.stdout, 'utf8');
    } catch (err) {
      problems.push(`${path} — could not be restored from blob ${oid}: ${err.message}`);
      continue;
    }
    if (hashOnDisk(root, path) !== oid) {
      problems.push(`${path} — rewritten from blob ${oid} but the bytes read back differ`);
      continue;
    }
    _log(`brain:memory:pull: restored ${path} from blob ${oid} (the pull did not recreate it; it is untracked again)`);
    restored.push(path);
  }
  return { restored, problems };
}

/**
 * The shared `_gitPull` default: fetch, reconcile, the literal `git pull`
 * (user's pull config intact), then verify what was reconciled.
 * `_afterReconcile` is a test-only seam for the fetch-to-pull race window.
 */
export function defaultGitPull(root, { _log = console.log, _afterReconcile } = {}) {
  execFileSync('git', ['fetch'], { stdio: 'inherit', cwd: root });
  const reconciled = reconcileUntrackedRecords({ root, _log });
  if (typeof _afterReconcile === 'function') _afterReconcile();

  let pullError = null;
  try {
    execFileSync('git', ['pull'], { stdio: 'inherit', cwd: root });
  } catch (err) {
    pullError = err;
  }

  const { restored, problems } = verifyOrRestore({ root, reconciled, _log });
  if (pullError) {
    if (problems.length > 0) pullError.message += `\n\nreconciled record(s) that could not be put back:\n  ${problems.join('\n  ')}`;
    throw pullError;
  }
  const unrecreated = [...restored.map((p) => `${p} — restored from its blob`), ...problems];
  if (unrecreated.length > 0) {
    throw new Error(
      `brain:memory:pull: git pull exited 0 but ${unrecreated.length} reconciled record(s) were not recreated by it:\n  ${unrecreated.join('\n  ')}`,
    );
  }
}
