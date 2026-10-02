// recording-git.mjs — wraps an injected git runner (sync or async), records
// every argv, and THROWS on any verb that writes outside the object store or
// moves the user's checkout (#1201 AC4). `fetch` is not in the forbidden list:
// it is the one allowed writer, and tests assert on it explicitly.

const FORBIDDEN = new Set(['checkout', 'switch', 'reset', 'merge', 'pull', 'push', 'update-ref', 'rebase', 'stash', 'restore', 'clean']);

// git's global options that consume the NEXT argument: skipped with their value
// before the verb is identified, so `git -C <path> checkout x` is still a checkout.
const VALUE_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);

function subcommand(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (VALUE_OPTIONS.has(args[i])) { i += 1; continue; }
    if (args[i].startsWith('-')) continue;
    return args[i];
  }
  return undefined;
}

function refuse(args) {
  const sub = subcommand(args);
  const bare = sub === 'branch' && !args.includes('--list') && !args.includes('--show-current');
  const worktreeAdd = sub === 'worktree' && args.includes('add');
  if (FORBIDDEN.has(sub) || bare || worktreeAdd) throw new Error(`recording-git: forbidden command git ${args.join(' ')}`);
}

/** `recordingGit(run)` -> a runner with `.calls` (argv arrays), `.envs` and `.spawns`. Works for sync and async runners alike. */
export function recordingGit(run) {
  const calls = [];
  const envs = [];
  function wrapped(file, args, opts) {
    calls.push(args);
    envs.push(opts?.env ?? null);
    refuse(args);
    return run(file, args, opts);
  }
  Object.defineProperty(wrapped, 'spawns', { get: () => calls.length });
  wrapped.calls = calls;
  wrapped.envs = envs;
  return wrapped;
}
