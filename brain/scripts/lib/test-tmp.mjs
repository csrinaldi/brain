// Fixture hygiene (#842). Two leak classes were measured before this existed:
// helpers that never clean (one GREEN suite run left 2180 pm-iso-* dirs), and
// per-test after() hooks that die with a killed run. 6686 orphans (11G) later,
// /tmp was the test failure: ENOSPC with a diff that explained nothing.
//
// The mechanism refuses to depend on polite deaths:
//   · every fixture dir lands under ONE per-run root, brain-test-<pid>-*,
//     removed by a single process-exit hook — leaky callers are contained
//     by construction, not by discipline;
//   · pretest sweeps roots whose pid is dead — the only defense against
//     SIGKILL, which no in-process hook survives.
// The sweeper owns exactly one namespace (brain-test-<pid>-*) and never
// touches anything else in the tmp dir.
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT_RE = /^brain-test-(\d+)-/;

let runRoot = null;

export function createRunRoot({
  base = tmpdir(),
  pid = process.pid,
  _mkdtemp = mkdtempSync,
  _register = (fn) => process.on('exit', fn),
  _rm = rmSync,
} = {}) {
  const root = _mkdtemp(join(base, `brain-test-${pid}-`));
  // Teardown must never mask the exit it rides on.
  _register(() => { try { _rm(root, { recursive: true, force: true }); } catch { /* best effort */ } });
  return root;
}

export function testTmp(prefix) {
  if (runRoot === null) runRoot = createRunRoot();
  return mkdtempSync(join(runRoot, prefix));
}

function pidIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM is an ALIVE pid we may not signal; only ESRCH means dead.
    return error?.code === 'EPERM';
  }
}

export function sweepStaleRuns({
  base = tmpdir(),
  _readdir = readdirSync,
  _rm = rmSync,
  _isAlive = pidIsAlive,
} = {}) {
  const swept = [];
  const kept = [];
  let names;
  try {
    names = _readdir(base);
  } catch {
    // An unreadable base is a no-op, never a crash: the sweep is hygiene, not a gate.
    return { swept, kept };
  }
  for (const name of names) {
    const m = ROOT_RE.exec(name);
    if (!m) continue;
    const pid = Number(m[1]);
    if (pid === process.pid || _isAlive(pid)) {
      kept.push(name);
      continue;
    }
    try {
      _rm(join(base, name), { recursive: true, force: true });
      swept.push(name);
    } catch {
      kept.push(name);
    }
  }
  return { swept, kept };
}
