---
status: draft
issue: 138
---

# Design — session:start (issue 138)

> Universal, read-only, LOCAL-ONLY session context loader. Agent-agnostic core
> (`session-start.mjs`) plus a thin Claude Code `SessionStart` adapter. Honors
> ADR-0002 (harness-neutral): the core never imports anything Claude-specific.

## 1. Decisions

### 1.1 `session-start.mjs` structure (import-time pure, step functions)

Mirror `brain-start.mjs:10-11,94`: the module performs **NO action on import**; all
side effects are guarded by the
`if (process.argv[1] === fileURLToPath(import.meta.url))` block at the bottom. Each
ordered step is a small exported function that takes `cwd` plus an injectable
dependency seam, so it is unit-testable without subprocesses.

Ordered steps (the loader runs them in this exact order):

| # | Step function | Source of truth | Net? |
|---|---------------|-----------------|------|
| 1 | `restoreManifestChurn(cwd, deps)` | `lib/memory-manifest.mjs` | local |
| 2 | `hydrateEngram(cwd, deps)` | `memory/cli.mjs import` (engram sync --import) | local |
| 3 | `resolveBranchChange(cwd, deps)` | `lib/git-branch.mjs` + `deriveChangeFromBranch` | local |
| 4 | `loadTicketMemory(cwd, deps)` | EXISTING `tryFeatureResume` (auto-resume.mjs) | local |
| 5 | `renderContextBlock(model)` | pure string builder | none |

Top-level orchestrator:

```js
export async function runSessionStart(cwd, deps = {}) {
  const manifest = step1RestoreManifest(cwd, deps);     // {restored: bool}
  const engram   = step2HydrateEngram(cwd, deps);       // {ok: bool}
  const change   = step3ResolveChange(cwd, deps);       // {branch, token, matches[]}
  const ticket   = step4LoadTicketMemory(cwd, deps);    // string|null
  const output   = renderContextBlock({ manifest, engram, change, ticket });
  return { exitCode: 0, output };
}
```

`runSessionStart` ALWAYS resolves with `exitCode: 0`. session:start is a
best-effort context loader: a missing engram, a non-git dir, or an ambiguous
branch must degrade to a printed note, never a non-zero exit (an agent's session
must not be blocked by a context-load failure). Every step is independently
try/caught and folds failure into its return shape.

The `deps` object is the single seam for tests:
`{ _spawn, _run, _branch, _changes, _resume }` — each defaults to the real local
implementation. Tests pass spies; production passes nothing.

### 1.2 `lib/git-branch.mjs` — de-duplicate current-branch detection

Today two implementations exist and disagree:
- `day-start.mjs:150` → `git branch --show-current` (empty string on detached HEAD).
- `engram.mjs:296-306` `_getGitBranch` → `git rev-parse --abbrev-ref HEAD`
  (returns the literal `"HEAD"` on detached HEAD).

Extract ONE source of truth:

```js
// lib/git-branch.mjs
export function currentBranch(cwd, { _spawn = spawnSync } = {}) {
  try {
    const r = _spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'],
      { cwd, encoding: 'utf8' });
    const name = r.status === 0 ? (r.stdout || '').trim() : '';
    if (!name || name === 'HEAD') return null;  // detached HEAD or no output
    return name;
  } catch {
    return null;  // git absent / non-git dir
  }
}
```

**Contract:**
- `spawnSync` with `{ cwd, encoding: 'utf8' }`, no `stdio: inherit` (we read stdout).
- Returns the branch name string when on a named branch.
- Returns `null` on detached HEAD (`"HEAD"` sentinel) AND on non-git / git-absent.
  `null` is the single "no branch" signal; callers handle one case.
- NEVER throws.

**Consumers (de-dup):**
- `engram.mjs:296` `_getGitBranch` becomes a thin wrapper:
  `currentBranch(root) ?? 'unknown'` (preserves its existing `'unknown'` contract).
- `day-start.mjs:150` replaces `capture('git', ['branch','--show-current'])` with
  `currentBranch(ROOT)`; the `currentBranch === 'main'` check below it keeps working
  (named branch returns the name; `null` is treated as "not main" → remote-updated
  message, which is the safe degradation).

> Note: chose `rev-parse --abbrev-ref HEAD` over `--show-current` because
> `engram.mjs` already depends on the `"HEAD"`-on-detached behavior; normalizing
> both to `null` is a strict superset that loses no information either consumer used.

### 1.3 `lib/memory-manifest.mjs` — extract the manifest-restore block

Extract `day-start.mjs:117-129` verbatim in behavior:

```js
// lib/memory-manifest.mjs
const MANIFEST = '.memory/manifest.json';
export function restoreManifestChurn(cwd, { _spawn = spawnSync } = {}) {
  try {
    const status = _spawn('git', ['status', '--porcelain', '--', MANIFEST],
      { cwd, encoding: 'utf8' });
    if (status.stdout?.trim()) {
      _spawn('git', ['restore', '--', MANIFEST], { cwd, encoding: 'utf8' });
      return { restored: true };
    }
    return { restored: false };
  } catch {
    return { restored: false };
  }
}
```

**Contract:** discards uncommitted churn in the derived `manifest.json` index only.
Returns `{ restored: bool }`. NEVER throws. NEVER touches any other path.

**Consumer:** `day-start.mjs:122-129` becomes
`const { restored } = restoreManifestChurn(ROOT); if (restored) info(...)`.
Both `day:start` and `session:start` now share one source of truth.

### 1.4 `deriveChangeFromBranch(branchName, changesDir)` — new resolver

This is the missing branch→openspec mapping (distinct from `resolveFeature`, which
is FS-only and intentionally branch-blind per feature-resolution.mjs:19-20).

```js
// in session-start.mjs (or lib/derive-change.mjs)
export function deriveChangeFromBranch(branchName, changesDir,
  { _readdir = readdirSync } = {}) {
  const out = { token: null, matches: [] };
  try {
    if (!branchName) return out;                       // null branch → no matches
    const m = branchName.match(/issue-(\d+)/i);        // extract issue-<N>
    if (!m) return out;
    out.token = `issue-${m[1]}`;                        // canonical, lowercased N intact
    let entries = [];
    try { entries = _readdir(changesDir, { withFileTypes: true }); } catch { return out; }
    out.matches = entries
      .filter(e => e.isDirectory() && e.name !== 'archive')
      .map(e => e.name)
      // Delimiter-anchored, NOT substring `.includes` — see rationale below.
      .filter(name => name === out.token || name.startsWith(`${out.token}-`))
      .sort();                                          // deterministic ordering
    return out;
  } catch {
    return out;                                         // NEVER throws
  }
}
```

**Algorithm:** extract `issue-<N>` via `/issue-(\d+)/i`; enumerate
`openspec/changes/*` directories (excluding `archive`); keep those whose folder name
is **delimiter-anchored equal to the token** — `name === token` (bare
`issue-<N>`) **or** `name.startsWith(token + '-')` (the usual
`issue-<N>-<slug>` shape) — NOT a plain substring `.includes(token)` match.
A plain `.includes` check lets a short issue number falsely match a longer
one sharing the same prefix digits, e.g.
`'issue-138-session-start'.includes('issue-13')` === `true` — branch
`issue-13` would wrongly resolve to change `issue-138-session-start`, a
confident WRONG answer with no error signal. Return `{ token, matches: [] }`
sorted.

**0 / 1 / N handling** (resolved by the caller `step3ResolveChange`, never thrown):
- `0` matches → context block prints "no change folder for branch <branch>"; loader
  continues. (Covers: no branch, branch without an `issue-N` token, token with no dir.)
- `1` match → the resolved change; surfaced prominently in the block.
- `N` matches → list ALL of them in the block as "ambiguous (N): a, b"; do NOT pick
  one. Disambiguation is the human/agent's job; we never guess.

NEVER throws under any input (null branch, weird names, missing dir).

### 1.5 No-network enforcement (the hot-path guarantee)

Three independent, testable layers — defense in depth:

**(a) Dependency boundary.** `session-start.mjs` imports ONLY: `node:*` builtins,
`lib/git-branch.mjs`, `lib/memory-manifest.mjs`, `memory/lib/auto-resume.mjs`,
`i18n/t.mjs`. It MUST NOT import `day-start.mjs`, `vcs/*`, `lib/installer.mjs`, or
`memory/cli.mjs`'s `pull` path. A static test asserts the import graph stays within
the allowlist.

**(b) Runtime argv allowlist.** Every subprocess in the loader goes through ONE
gated runner, `assertLocalArgv(cmd, args)`, which throws if the call is not on the
local allowlist:
- `git status|restore|rev-parse` (read/local index only — never `fetch`, `merge`,
  `pull`, `clone`, `ls-remote`, `push`).
- `node brain/scripts/memory/cli.mjs import` (engram sync --import; verified local
  per memory/cli.mjs:9 — "no git pull").
- `node brain/scripts/memory/cli.mjs feature-resume` (via `tryFeatureResume`; local
  engram read only).

Any other argv (notably the `pull` verb, `git fetch`, `gentle-ai update`, `engram
sync --export`) throws synchronously, failing the test and never reaching the
network. The allowlist is data, so the test can import and assert it.

**(c) No-network behavioral test.** A unit test injects a `_spawn` spy into
`runSessionStart`, runs the full loader against a fixture repo, and asserts:
(1) every captured argv matches the allowlist; (2) NO argv contains
`pull|fetch|merge|clone|ls-remote|push|--export`; (3) the loader never imports the
`pull` codepath. This is the executable proof of Success Criterion #1.

> Rationale: brain already separates `import` (local) from `pull` (network) at
> memory/cli.mjs:7-10. session:start reuses that existing seam instead of inventing
> a new "offline" flag — the local op already exists and is verified.

### 1.6 Claude Code adapter — `SessionStart` hook MERGED into `.claude/settings.json`

The existing file (`.claude/settings.json`) already has a `PreToolUse` hook
(the `--no-verify` blocker). The adapter MUST **merge a sibling key**, not clobber:

```json
{
  "hooks": {
    "PreToolUse": [ /* ...existing --no-verify blocker, unchanged... */ ],
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "npm run session:start" }
        ]
      }
    ]
  }
}
```

**Rules:**
- The hook command is `npm run session:start` and NOTHING else — zero logic in
  settings.json. All behavior lives in the agent-agnostic core (ADR-0002).
- `.claude/settings.json` is a brain managed-path, so the merged file IS what ships;
  the change adds the `SessionStart` array beside the untouched `PreToolUse` array.
- **stdout → agent context:** Claude Code injects a `SessionStart` hook's stdout
  into the resuming session's context. Therefore the loader prints the context block
  to **stdout** (not stderr) and exits 0; stderr is reserved for diagnostics that
  should NOT pollute context. This is why `renderContextBlock` returns a string the
  CLI writes via `console.log`, and why `runSessionStart` never `process.exit(1)`.
- Adapter seam for Cursor/Cline/Codex is documented only (YAGNI per proposal);
  each would be the same one-line "run `npm run session:start`" wiring.

### 1.7 Output / context-block format (deterministic — no timestamps/random)

`renderContextBlock(model)` is a PURE function (string in, string out) so it is
snapshot-testable. Fixed section order, no clocks, no randomness, no ANSI color
(plain text survives context injection cleanly):

```
brain · session context
========================
branch:   feature/138-session-start
change:   issue-138-session-start          # or "(none for branch)" / "ambiguous (2): a, b"
memory:   engram hydrated                  # or "engram unavailable (skipped)"
manifest: churn restored                   # omitted when nothing to restore
------------------------------------------
ticket:
<verbatim tryFeatureResume() stdout, or "(no active ticket memory)">
========================
```

Determinism rules: sections always in this order; lines are present/absent based
only on inputs (no time); the `ticket:` body is the EXACT `tryFeatureResume` stdout
(already deterministic). Tests assert exact string output for fixed inputs.

### 1.8 i18n — `session.*` key namespace

Follow the dotted `<script>.<section>.<name>` convention (en.mjs:7). Canonical keys
in `en.mjs`, mirrored in `es.mjs` (per-key English fallback handles gaps).
Planned keys:

```
session.header              'brain · session context'
session.branch              'branch:   {branch}'
session.change.one          'change:   {change}'
session.change.none         'change:   (no change folder for branch)'
session.change.ambiguous    'change:   ambiguous ({count}): {list}'
session.memory.ok           'memory:   engram hydrated'
session.memory.skip         'memory:   engram unavailable (skipped)'
session.manifest.restored   'manifest: churn restored (safe)'
session.ticket.label        'ticket:'
session.ticket.none         '(no active ticket memory)'
```

`t()` is async (t.mjs:59); `renderContextBlock` either awaits keys or receives
pre-resolved strings. Decision: resolve all `session.*` strings ONCE in the CLI
entry, pass the resolved map into the pure `renderContextBlock` so the renderer
stays sync and trivially snapshot-testable.

## 2. Contract / API impact

No public/runtime contract is mutated. New internal module APIs introduced:
- `currentBranch(cwd, {_spawn}) -> string|null`
- `restoreManifestChurn(cwd, {_spawn}) -> {restored: bool}`
- `deriveChangeFromBranch(branch, changesDir, {_readdir}) -> {token, matches[]}`
- `runSessionStart(cwd, deps) -> {exitCode, output}` and its 5 step functions.

`day-start.mjs` and `engram.mjs` change from inline logic to consumers of the two
new libs — behavior-preserving refactor, no observable change to `day:start`.
`package.json` gains `"session:start": "node ./brain/scripts/session-start.mjs"`.
No spec/contract regeneration needed (no capability contract files affected;
`session-start` is a new local script capability).

## 3. Testing strategy (strict TDD, node:test, zero deps)

Test-first, colocated `*.test.mjs`. Units and their tests:

| Unit | Tests |
|------|-------|
| `lib/git-branch.mjs` | named branch; detached HEAD (`"HEAD"` → null); non-zero status → null; git absent (spy throws) → null. De-dup proof: `engram.mjs` wrapper still returns `'unknown'`. |
| `lib/memory-manifest.mjs` | churn present → restore called, `{restored:true}`; clean → no restore, `{restored:false}`; spy throws → `{restored:false}`. |
| `deriveChangeFromBranch` | token + 1 dir → 1 match; token + 2 dirs → 2 matches sorted; no token → `[]`; null branch → `[]`; missing changesDir → `[]`; `archive` excluded; never throws (fuzz a few odd names). |
| `renderContextBlock` | exact-string snapshots for: resolved change, no change, ambiguous N, engram-skipped, no-ticket. Determinism (same input → same output, no time). |
| `runSessionStart` | full loop with spy deps: returns `exitCode:0` even when every step fails; step order; output composition. |
| **No-network** | spy `_spawn` records argv; assert all match allowlist; assert NONE contain `pull/fetch/merge/clone/ls-remote/push/--export`; assert import graph excludes `vcs/*`, `day-start.mjs`, `installer.mjs`. |
| **branch→change fixtures** | temp `openspec/changes/{issue-138-session-start, issue-99-other}` dirs; assert resolution from `feature/138-...` and ambiguity from two `issue-138-*` dirs. |
| **day-start non-regression** | unit-test the extracted libs in isolation; assert `day-start.mjs` references the new imports (the two blocks no longer inline `git status --porcelain` / `branch --show-current`). Behavior of the libs is identical to the original inline code. |

"No network" is tested structurally (allowlist + import-graph) AND behaviorally
(spy spawn over the full loader) — both must pass.

## 4. Alternatives rejected

- **Logic inside `.claude/settings.json` hook.** Rejected: violates ADR-0002
  (harness-neutral) — would couple behavior to Claude Code and duplicate it for every
  future adapter. The hook stays a zero-logic `npm run session:start`.
- **Reuse `day:start` as-is for resume.** Rejected: `day:start` is heavy, networked
  (git fetch/merge, gentle-ai update, ls-remote, engram export) and meant to run once
  daily; it is exactly what must NOT run on the hot compaction-resume path.
- **Reuse `resolveFeature()` for branch→change.** Rejected: it is deliberately
  branch-blind and THROWS on ambiguity (feature-resolution.mjs:19-20,89-101).
  session:start needs branch-derived, non-throwing, multi-match resolution — hence
  the new `deriveChangeFromBranch`.
- **`git branch --show-current` as the shared primitive.** Rejected: it returns empty
  on detached HEAD, losing the signal `engram.mjs` relies on; standardized on
  `rev-parse --abbrev-ref HEAD` normalized to `null`.
- **An "offline/--no-network" flag on `memory/cli.mjs pull`.** Rejected: the local
  `import` verb already exists and is verified local (cli.mjs:7-10). Reuse beats a new
  flag.
- **`renderContextBlock` doing its own `await t(...)`.** Rejected: keeping the renderer
  pure/sync (strings injected) makes it trivially snapshot-testable and deterministic.
- **Adding a dependency (e.g. a glob lib) for `openspec/changes/*`.** Rejected: brain
  has ZERO deps; `readdirSync(..., {withFileTypes:true})` is sufficient.
