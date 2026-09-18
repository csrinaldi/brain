# Design: Lane-Ship Invoker Guard (#1012)

## Technical Approach

A pure decision function, `decideShipInvoker`, is added in `brain/scripts/memory/lib/ship-invoker.mjs`. It follows the precedent of `lib/backend-selection.mjs`, a pure decision module that `cli.mjs` consumes. `cli.mjs`'s `ship` block calls it once. The call goes after argv parsing (`cli.mjs:473-475`) and before the `try` (`:477`), so it runs before the blank-seam check (`:481`), `loadBrainConfig` (`:484`), the single token read (`:485`) and both port branches (`:501-503`). Each caller declares itself on argv. A new meta-test takes an inventory of every test that spawns a runtime, and each allowlist entry must carry a reason from a closed list. The anti-pattern is drafted under `brain-drafts/`.

## Architecture Decisions

| Decision | Alternatives rejected | Rationale |
|---|---|---|
| The decision logic lives in the pure `lib/ship-invoker.mjs` and `cli.mjs` only calls it | Inline the logic in `cli.mjs` | `cli.mjs` runs at import time and cannot be imported by a test. The pure function makes the full matrix cheap to test in process. The CLI tests then only prove where the call sits. |
| Check order: (1) argv syntax, (2) bypass, (3) `NODE_TEST_CONTEXT`, (4) presence of `--invoker` | Put the bypass first | A malformed marker is a bug in production caller code. Refusing it even under the bypass means the seam-level and e2e tests, which all run under the bypass, still catch a mangled marker. |
| Bypass = `env.BRAIN_VCS_TEST_MODULE !== undefined` (presence) or `--dry-run` | A truthy seam value | With the presence test, the blank-seam refusal (`cli.mjs:481`) and the `FIXTURE_ROOT` containment check (`:461`) stay reachable, and `cli.ship.test.mjs:256,541` keep passing. Any value that passes those checks is structurally unable to bind `getVcs`. |
| `--invoker <v>`: accepted values are `hook`, `sweep`, `manual`. `--invoker=` forms, a repeated flag, a missing value or a value starting with `--` are refused as `invokerInvalid` | Last value wins; accept the `=` form | This matches the `save` parser's `--supersedes` rule (`cli.mjs:822-846`) and the missing-value rule of `audit --since` (`:193-198`). It fails closed. |
| On refusal: exit 1, one `memory/cli: <t(key)>` line on stderr, and **empty stdout even with `--json`** | Print a JSON refusal object | This is how `ship` already refuses: a blank token or a bad seam leaves stdout empty (`cli.ship.test.mjs:269,323`). The sweep maps exit 1 with empty stdout to `warn` (`day-start-sweep.mjs:49-50`, `:87-95`), so a refused sweep is visible. The hook's tmp log gets the stderr line. |
| `--json` output gains `invoker: <value>\|null` | No observable field | The e2e runs pass **through the bypass**: `NODE_TEST_CONTEXT` reaches the child, and `BRAIN_VCS_TEST_MODULE` is what lets it through. If a caller dropped its marker, those runs would still go green. Only the echoed field proves the marker survived the chain. The field is additive, and `laneSweepLine` reads named fields only. |
| CLI-level refusal tests go in the new `memory/cli.ship-invoker.test.mjs` | Put them in `cli.ship.test.mjs` | Every spawn in `cli.ship.test.mjs` carries the seam (C1, `:243-254`). These tests must run **without** it, so they get their own file and their own allowlist reason. |
| Meta-test: an allowlist inventory (fails closed) | A deny-list of dangerous entrypoints | With a deny-list, the next unlisted entrypoint passes by default (fails open). |
| No config migration and no `brain/core/**` change | A package.json migration | `mergePackageJsonScripts` only adds keys (`lib/installer.mjs:1358-1361`). `MANAGED_SCRIPT_KEYS` (`managed-paths.mjs:63`) lists key names, not script bodies. `brain:memory:ship` has not been released yet (`CHANGELOG.md:18-25`, "Consumers never had these scripts"), so the first injection already carries `--invoker manual`. `cli.mjs`, `session-end-ship.mjs` and `day-start-sweep.mjs` reach consumers together through the `brain/scripts/**` COPY glob. |

## Data Flow

```
SessionEnd → npm run brain:memory:session-end → session-end-ship.mjs:178 [ship --json --invoker hook] ─┐
npm run day:start → runLaneSweep day-start-sweep.mjs:42          [ship --json --invoker sweep] ───────┤
npm run brain:memory:ship  (package.json:89, alias :77)          [ship --invoker manual ...]  ───────┤
                                                                                                      ▼
cli.mjs ship: decideShipInvoker → refuse (stderr, exit 1) | proceed → token read → port → shipLane
```

A2 is unchanged: `session-end-ship.mjs:183` still passes `env: process.env`, and `day-start-sweep.mjs:43` still passes no `env` key, so the child inherits the parent's environment. Only the argv arrays at `:178` and `:42` change.

## File Changes

| File | Action | Governed lines (est.) |
|---|---|---|
| `brain/scripts/memory/lib/ship-invoker.mjs` | Create: `INVOKERS`, `REFUSAL`, `decideShipInvoker({args, env})` | ~45 |
| `brain/scripts/memory/cli.mjs` | Modify: the guard call plus refusal print between `:475` and `:477`; `invoker` spread into the `--json` output (`:516`); header comment | ~20 |
| `session-end-ship.mjs:29,178`, `day-start-sweep.mjs:23,42` | Modify: add the argv item; update the doc line | ~4 |
| `package.json:77,89` | Modify: `... cli.mjs ship --invoker manual` | 4 |
| `i18n/en.mjs`, `i18n/es.mjs` (after `memory.ship.badHost`) | Add `memory.ship.invokerMissing`, `.invokerUnderTest`, `.invokerInvalid` | 6 |
| `CHANGELOG.md` Unreleased | Add a one-paragraph note | ~4 |
| Tests (listed below) and `brain-drafts/**` | Create or modify | not governed |

## Interfaces / Contracts

```js
decideShipInvoker({ args, env }) // args = process.argv.slice(3)
  → { allowed: true, invoker: 'hook'|'sweep'|'manual'|null, bypass: 'vcs-test-module'|'dry-run'|null }
  | { allowed: false, key: 'invokerInvalid'|'invokerUnderTest'|'invokerMissing', params }
```

Messages (English catalog):

- `invokerMissing`: names the accepted values and tells the reader to run it by hand as `npm run brain:memory:ship`.
- `invokerUnderTest`: names `NODE_TEST_CONTEXT` and the two seams a test may use.
- `invokerInvalid`: echoes the rejected token.

Neither the guard call nor its comments may contain the literal strings `.getVcs(` or `process.env[MEMORY_TOKEN_ENV]`. The source guards at `cli.ship.test.mjs:236-241` and `:481-494` count those strings.

## Testing Strategy (STRICT TDD: each row is written RED first)

| RED test | What it proves |
|---|---|
| `memory/lib/ship-invoker.test.mjs` (new; RED because the module is missing) | The full matrix: the three valid values; `--invoker`, `--invoker --json`, `--invoker=hook`, `--invoker ci` and a repeated flag are refused as `invokerInvalid`, **including when the seam is set**; seam or `--dry-run` without a marker is allowed; a blank seam is allowed here and refused downstream; `NODE_TEST_CONTEXT` with a valid marker is refused as `invokerUnderTest`; the variable absent and no marker is refused as `invokerMissing`. |
| `memory/cli.ship-invoker.test.mjs` (new, spawns with a defanged env) | The defanged env removes the seam, `BRAIN_MEMORY_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN` and `GITLAB_TOKEN`, and sets `GH_CONFIG_DIR` and `BRAIN_MEMORY_TEST_ROOT` to an empty directory that is not a git repo. Cases: (a) `NODE_TEST_CONTEXT` deleted, no marker, `BRAIN_MEMORY_TOKEN=''`, `--json` → exit 1, stderr matches `invokerMissing` and **not** the blank-token error (proves the guard runs before `:485`), and stdout is `''`; (b) `NODE_TEST_CONTEXT` present with `--invoker manual` → `invokerUnderTest`; (c) `--dry-run --json` against a local git fixture, no seam → exit 0 with `dryRun:true`. The RED fails safely: without the guard the child dies at `collect` on the non-git root (`lane/ship.mjs:254`) before any port verb runs. |
| `cli.ship.test.mjs` | `--json` has `invoker:null` without a marker and `'manual'` with one; a source-order check that the guard call comes before `process.env[MEMORY_TOKEN_ENV]` and `.getVcs(`; `:603` is updated to the new body. |
| `session-end-ship.test.mjs:101-149` | `argv.slice(1)` deep-equals `['ship','--json','--invoker','hook']`; `opts.env === process.env` (strict identity, A2). |
| `day-start-sweep.test.mjs:39-53` | `argv.slice(1)` deep-equals `[..., '--invoker','sweep']`; `'env' in opts === false`. |
| `package-scripts.test.mjs:53` | The expected body for `ship` ends with `--invoker manual`, for both the canonical script and the alias. |
| `test/lane-ship-invoker.e2e.test.mjs` (new) | (1) Real `npm run brain:memory:session-end` with `BRAIN_MEMORY_TEST_ROOT` pointing at a git fixture that has a candidate, the fake port, a script that sets `mrCreate` to 999, and `TMPDIR`/`TEMP` set to `testTmp`. The test asserts the tracked `memory.lane.enabled` precondition (`brain.config.json:15-19`), polls the log for up to 30 s, and asserts `invoker:'hook'`, `pr.number:999` and the lane ref on the local origin. (2) The same chain **without the fake port** and with a non-git root: the log contains `invokerUnderTest`. (3) The sweep chain: a `node -e` child imports `runLaneSweep` with an `_spawnSync` wrapper that calls the real `spawnSync` with unchanged arguments and records stderr; it asserts `invoker:'sweep'`, and in the no-port variant asserts exit 1 plus `invokerUnderTest`. (4) `npm run brain:memory:ship -- --json` returns `invoker:'manual'`, and `-- --dry-run --json` works with no seam. The hook chain is skipped on win32 because the log check depends on POSIX mode bits (`session-end-ship.test.mjs:165`). npm is spawned the way `test/publish-allowlist.e2e.test.mjs:84` does it. |
| `brain/scripts/test-spawn-hygiene.test.mjs` (new) | See the next section. |

### Meta-test

**What it scans.** The same globs as `test-hygiene.test.mjs:38` (`brain/scripts/**/*.test.mjs`, `test/**/*.test.mjs`, which covers `*.e2e`). It looks for `spawn`, `spawnSync`, `execFile`, `execFileSync` or `fork` calls, reusing `callArgsText` (`test-hygiene.test.mjs:63-81`). A call is a **hit** when:

- its first argument is a runtime (`process.execPath`, `'node'`, `'npm'`, `'bash'` or `'sh'`), or
- its first argument resolves under `brain/scripts/`, or
- the callee is `fork`.

A pure `-e`, `-p` or `--input-type` eval is excluded unless the eval text contains `brain/scripts/`.

**How it resolves the entrypoint.** It takes the first element of the argv array. If that is an identifier, it uses the identifier's same-file `const|let|var` initializer. Then:

- a literal containing `brain/scripts/` is used as the path;
- otherwise a trailing file literal is resolved against the test file's own directory;
- `npm run X` becomes `npm:X`;
- anything that cannot be resolved becomes `<unresolved>`, which still counts as a hit (fail closed).

**The allowlist.** `ALLOWLIST = [{ file, entrypoint, line?, reason }]`. An entry that pins a line is matched first. A (file, entrypoint) pair keeps a new entrypoint in an already-allowlisted file from passing silently. `<unresolved>` entries must pin a line. The test asserts two things: no hit is left uncovered, and no entry is stale.

**Closed reasons.** `REASONS = ['no-vcs-capability', 'fixture-root-local-git', 'vcs-port-substituted', 'refusal-asserted']`. `validateAllowlist` rejects any other reason and names the allowed list in its error.

**Classification.**

| Test | Reason |
|---|---|
| `cli.ship.test.mjs` | `vcs-port-substituted` |
| `cli.ship-invoker.test.mjs` | `refusal-asserted`, plus a line pin for the dry-run case |
| The explorer's seven: `harness/engines-cli`, `config/cli`, `status/snapshot-cli` | `no-vcs-capability` |
| The explorer's seven: `brain-promote.locks` and `brain-promote.amendment` | `fixture-root-local-git` |
| The explorer's seven: `approve/locks` and `harness/run-stage` | `refusal-asserted` |
| The e2e file | `vcs-port-substituted` |

**The inventory is much larger than the explorer's seven.** Measured on 62100b6a: 141 runtime spawns across 38 files, plus 21 `bash`/`sh`/identifier-binary spawns across 13 files. Expect roughly 45-55 entries. The spawn in `hydration-guard.processes.integration.test.mjs:40` and the one in `brain-audit.test.mjs:1859` are `<unresolved>` and need line pins.

**Self-proving tests.** Callee names in these tests are built by concatenation, as in `test-hygiene.test.mjs:132`.

1. A planted fixture test file contains a runtime spawn of `cli.mjs ship`, an `npm run` spawn and a pure eval. The scanner returns exactly the two hits with their resolved entrypoints, and both come back uncovered against an empty allowlist.
2. `validateAllowlist` rejects `reason: 'looks-safe'`, and a line-pinned entry that matches nothing is reported as stale.

## Anti-pattern draft (Tier 2)

The maintainer moves both files.

- `brain-drafts/anti-patterns/test-spawns-a-live-entrypoint.md`: Discovered in / Applies to / Symptom (#1007: `npm test` pushed a lane and opened a PR) / Cause (test safety depended on configuration: the lane flag and an authenticated `gh`) / Solution (the caller declares itself, an independent test-runner signal, and seams that make the real port structurally unreachable) / Detection (`test-spawn-hygiene.test.mjs`).
- `brain-drafts/anti-patterns/README-index-line.md`: the index line `- [A test spawns a live entrypoint and trusts configuration to keep it harmless](test-spawns-a-live-entrypoint.md)`, to go after `README.md:58`.

## Review Workload Forecast

`brain.config.json:23-34` excludes `**/*.test.mjs`, `openspec/changes/**` and `.memory/**` from governance. The governed diff is about 85 lines against the `lite` budget of 1000, and is also under the default budget of 400. Single PR.

## Migration / Rollout

No migration. There is one ordering condition: this PR must merge before the first release that injects `brain:memory:ship`. After that release, the add-only merge would never rewrite an already-injected body, and a migration would be needed.

## Open Questions

- [ ] `collect` still runs under `--dry-run` (`lane/ship.mjs:254,276`). A dry-run spawn without `BRAIN_MEMORY_TEST_ROOT` therefore writes a local commit on a `refs/heads/memory/*` ref in the real repository. This is out of scope for #1012, and the meta-test's `vcs-port-substituted` review is the only control.
