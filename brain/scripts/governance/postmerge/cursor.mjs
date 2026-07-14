#!/usr/bin/env node
// postmerge/cursor.mjs — remote-authoritative, tri-state cursor + atomic CAS
// advance (design §2). `actions/checkout` never fetches `refs/governance/*`,
// so a never-fetched ref and a genuinely absent ref are indistinguishable to
// a plain `rev-parse` (the F2 bug). State is read via an explicit fetch plus
// a remote `ls-remote --exit-code` oracle instead.

import { fileURLToPath } from 'node:url';
import { gitTry, gitOrThrow } from './git-seam.mjs';

export const CURSOR_REF = 'refs/governance/audit-cursor';
const REMOTE = 'origin';
const GOVERNANCE_REFSPEC = '+refs/governance/*:refs/governance/*';
const HEX40 = /^[0-9a-f]{40}$/;

/** Explicitly fetch the governance namespace — checkout never does this. */
export function syncCursor({ git }) {
  return git.try(['fetch', '--prune', REMOTE, GOVERNANCE_REFSPEC]);
}

/**
 * Tri-state cursor read. The REMOTE is the authority: `ls-remote
 * --exit-code` status 2 is git's own documented proof of absence; any other
 * non-zero status (network/auth/unreachable) is 'unknown', never 'absent'.
 */
export function readCursor({ git }) {
  syncCursor({ git });

  const lsRemote = git.try(['ls-remote', '--exit-code', REMOTE, CURSOR_REF]);
  if (lsRemote.status === 2) return { state: 'absent' };
  if (lsRemote.status !== 0) return { state: 'unknown' };

  // ls-remote proves origin has it; confirm the just-fetched local ref
  // actually resolves. A mismatch is a fetch/read inconsistency — 'unknown',
  // never silently downgraded to 'absent'.
  const local = git.try(['rev-parse', '--verify', `${CURSOR_REF}^{commit}`]);
  if (local.status !== 0) return { state: 'unknown' };

  return { state: 'present', sha: local.stdout.trim() };
}

/**
 * The window is ALWAYS cursor..HEAD — no eventName/before branching. The
 * audited interval and the advanced interval are the same interval by
 * construction (design §2.2 — the skip-over fix).
 */
export function resolveWindow({ git, head }) {
  const cursor = readCursor({ git });
  if (cursor.state !== 'present') return { state: cursor.state };

  const ancestor = git.try(['merge-base', '--is-ancestor', cursor.sha, head]);
  if (ancestor.status !== 0) {
    return { state: 'unknown', reason: 'cursor is not an ancestor of HEAD' };
  }
  return {
    state: 'present', base: cursor.sha, range: `${cursor.sha}..${head}`, head,
  };
}

/**
 * Atomic compare-and-swap advance. `from` is REQUIRED and 40-hex, so this
 * function structurally cannot create the ref (an absent ref's null OID can
 * never equal a 40-hex `from`) — "never auto-create" is git's own CAS, not a
 * caller-side check (design §2.3).
 */
export function advanceCursor({ git, from, to }) {
  if (typeof from !== 'string' || !HEX40.test(from)) {
    throw new Error('advanceCursor: from must be a 40-hex sha');
  }
  const ancestor = git.try(['merge-base', '--is-ancestor', from, to]);
  if (ancestor.status !== 0) {
    throw new Error(`advanceCursor: from (${from}) is not an ancestor of to (${to})`);
  }
  // Local CAS — fails unless the ref's CURRENT value is exactly `from`.
  git.orThrow(['update-ref', CURSOR_REF, to, from]);
  // Remote CAS — the server verifies the lease's old value before accepting.
  git.orThrow(['push', `--force-with-lease=${CURSOR_REF}:${from}`, REMOTE, `${to}:${CURSOR_REF}`]);
  return { from, to };
}

/**
 * The ONLY non-tree resolution path (design §2.4). `from` is READ from the
 * live cursor, never caller-supplied, so a stale value can never be used.
 */
export function acceptManually({ git, to, reason }) {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('acceptManually: --reason is required and must be non-empty');
  }
  const cursor = readCursor({ git });
  if (cursor.state !== 'present') {
    throw new Error(`acceptManually: cursor state is '${cursor.state}', nothing to accept from`);
  }
  process.stdout.write(`accept: ${reason}\n`);
  return advanceCursor({ git, from: cursor.sha, to });
}

// ── CLI ────────────────────────────────────────────────────────────────────

function makeRealGit(cwd) {
  return { try: (argv) => gitTry(argv, { cwd }), orThrow: (argv) => gitOrThrow(argv, { cwd }) };
}

function usage() {
  process.stderr.write('Usage: cursor.mjs window | cursor.mjs accept <sha> --reason "<text>"\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const git = makeRealGit(process.cwd());
  const [, , cmd, ...rest] = process.argv;

  if (cmd === 'window') {
    const head = git.orThrow(['rev-parse', 'HEAD']).trim();
    const result = resolveWindow({ git, head });
    if (result.state === 'present') {
      console.log(`PRESENT ${result.base} ${result.head}`);
      process.exit(0);
    } else if (result.state === 'absent') {
      console.log('ABSENT');
      process.exit(2);
    } else {
      console.log(`UNKNOWN ${result.reason ?? ''}`.trimEnd());
      process.exit(2);
    }
  } else if (cmd === 'accept') {
    const to = rest[0];
    const reasonIdx = rest.indexOf('--reason');
    const reason = reasonIdx !== -1 ? rest[reasonIdx + 1] : undefined;
    if (!to || !reason) {
      usage();
      process.exit(1);
    } else {
      try {
        acceptManually({ git, to, reason });
        process.exit(0);
      } catch (err) {
        process.stderr.write(`cursor.mjs accept: ${err.message}\n`);
        process.exit(1);
      }
    }
  } else {
    usage();
    process.exit(1);
  }
}
