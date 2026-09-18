# Exploration: issue-1012 — lane-ship invoker guard

> Produced by the sdd-explore sub-agent (read-only, on `main` at 62100b6a) and persisted by the
> orchestrator, which also ran the two empirical checks the explorer could not
> (see "Orchestrator verification").

## Summary

PR #1013 fixed the incident instance: `session-end-ship.test.mjs` now seams `_spawn`, `_tmpdir`
and `_loadConfig`, so it never creates a real subprocess. #1012 still owns three structural asks:

1. a fail-closed invoker guard on `cli.mjs ship`, which `session-end-ship.mjs` spawns;
2. a sweep and a meta-test over tests that spawn real entrypoints;
3. an anti-pattern draft for human promotion.

PR #1022 (62100b6a) added `brain/scripts/test-hygiene.test.mjs`, which closes a sibling class: a
test writing into the real repository root through `mkdirSync`/`writeFileSync`/`symlinkSync`/
`cpSync` with a `process.cwd()`-derived path. It does not cover "a test spawns a real entrypoint
that can reach git or the network". The two guards are complementary. They should share the
design pattern (source-level scan plus a reviewed `ALLOWLIST`), not the code.

Only `cli.mjs`'s `ship` op, and `session-end-ship.mjs`'s spawn of it, hold `BRAIN_MEMORY_TOKEN` and
can push, open a PR and arm auto-merge. The invoker guard belongs there, not on every CLI spawn.

## Current state — entrypoints to the ship path

- **SessionEnd hook.** `settings-hooks.mjs` `SESSION_END_COMMAND` = `npm run brain:memory:session-end`
  → `session-end-ship.mjs` `shipOnSessionEnd()`. It reads `memory.lane.enabled` first; if true it
  spawns `node cli.mjs ship --json` detached, `stdio: ['ignore', fd, fd]`, with `env: process.env`
  unchanged by design (A2: `GH_TOKEN`/`BRAIN_MEMORY_TOKEN` must survive).
- **Day-start sweep.** `day-start-sweep.mjs` reaches the same ship path behind the same flag.
- **Manual.** `npm run brain:memory:ship` (`package.json:89`) → the same `cli.mjs ship` dispatch.
  Today `cli.mjs` cannot tell the hook, the sweep and a human apart.
- **`cli.mjs` ship op** (`memory/cli.mjs:467-568`): reads `BRAIN_MEMORY_TOKEN` in one place (A5),
  honours `BRAIN_VCS_TEST_MODULE` (fixture port, path contained in `FIXTURE_ROOT`) and `--dry-run`
  (no VCS, A7), then `shipLane()` (`lane/ship.mjs`): collect → survey → push → find/create PR →
  arm auto-merge.
- **Tests.** `cli.ship.test.mjs` spawns the real `ship` op about fifteen times, every call through
  `runCli()` with `BRAIN_VCS_TEST_MODULE`, and carries its own "C1 cold review guard" asserting that.

## Design options for the invoker guard

Every option must be additive (set a marker), never a scrub, because A2 deliberately passes the
environment through.

| Option | Fail-closed | Careless test can trip it by accident | Breaks manual ship | Seams | Cost |
|---|---|---|---|---|---|
| (a) npm-script env marker: `BRAIN_SHIP_INVOKER=hook\|manual` set inline in the two `package.json` scripts; `ship` refuses without it unless `BRAIN_VCS_TEST_MODULE` or `--dry-run` is present | yes | no, needs a deliberate override | no | the fifteen `cli.ship.test.mjs` calls need no change | ~2 `package.json` lines + ~10 in `cli.mjs`; `session-end-ship.mjs` and `settings-hooks.mjs` untouched because the marker rides `env: process.env` |
| (b) refuse when `NODE_TEST_CONTEXT` is set | yes, for anything under `node --test` | no | no | must be bypassed when a test seam is present | free; relies on a Node test-runner variable that is not a documented public contract |
| (c) `--from <hook\|sweep\|manual>` argv | yes | no | needs script edit | composes with `--dry-run` | like (a), but `session-end-ship.mjs` builds its own argv and would need editing |
| (d) TTY/stdin gate (the `approve`/`brain-promote` precedent) | yes | n/a | **breaks the hook**, which is detached and non-interactive by construction | — | not viable for `ship` |

**Explorer's recommendation: (a), scoped to `cli.mjs`'s `ship` op.** Threat model is accidental
invocation, not an actor with commit access; the same property `BRAIN_VCS_TEST_MODULE` relies on.

## Item 2 — the seven named tests, re-verified on main

| File:line | Entrypoint | Why it cannot reach git or the network today |
|---|---|---|
| `harness/engines-cli.test.mjs:28` | `harness/cli.mjs` engines | fixture cwd; the module has no VCS capability |
| `config/cli.test.mjs:23` | `config/cli.mjs` | fixture cwd; local `brain.config.json` get/set only |
| `brain-promote.locks.test.mjs:119,134` | `brain-promote.mjs` | `process.env` read zero times (asserted); git calls gated by `ALLOWED_GIT_SUBCOMMANDS`, no push/commit/tag/reset |
| `approve/locks.test.mjs:68` | `approve/cli.mjs` (real repo cwd) | refuses on non-TTY before any VCS call, proven by the test itself; `process.env` read zero times |
| `brain-promote.amendment.test.mjs:226` | `brain-promote.mjs` | same as the locks test |
| `status/snapshot-cli.test.mjs:18,26` | `status/snapshot-cli.mjs` | read-only report, `--root <fixture>`, asserts empty stderr |
| `harness/run-stage.test.mjs:271-283` | `harness/cli.mjs run-stage` | the spawn exists to prove the op is refused at the CLI surface |

None is safe because a seam variable is set. A meta-test that only checks for seam variables would
flag all seven, and "fixing" that with inert seam variables would be the anti-pattern itself.

## Item 2 — meta-test design

New sibling file (for example `brain/scripts/test-spawn-hygiene.test.mjs`), same family as
`test-hygiene.test.mjs`: source-level scan of `brain/scripts/**/*.test.mjs` and
`test/**/*.e2e.test.mjs` for `spawn(`/`spawnSync(` on `process.execPath` whose script argument
lands under `brain/scripts/**`. Every current hit gets a reviewed `ALLOWLIST` entry with a reason
(`fixture-cwd-no-vcs`, `structural-refusal-proven`, `recognized-seam-present`). A new hit that is
neither allowlisted nor carrying a recognized seam fails, forcing a reviewer decision. Two
self-proving fixture tests, as `test-hygiene.test.mjs` has.

## Item 3 — anti-pattern draft path

`brain/core/anti-patterns/` is Tier 2 for the agent (draft only). `brain:promote` handles a new ADR
(`adr-NNNN-slug.md`) or an amendment to an existing `brain/**.md`; a brand-new anti-pattern file
fits neither. Path: a draft under this change's `brain-drafts/` in the shape of the existing files
(Problem / Why / Rule / Detection), plus the one-line `## Registered` index entry for
`brain/core/anti-patterns/README.md`; the maintainer moves both.

## Orchestrator verification (2026-09-18)

1. **`NODE_TEST_CONTEXT` is set under this repo's `node --test` CLI form and propagates to
   children through `env: process.env`.** Probe: a `node --test` file that spawns
   `node -e 'console.log(process.env.NODE_TEST_CONTEXT)'` printed `PARENT="child-v8"
   CHILD="child-v8"`. Consequence: option (b) would have refused the #1007 run by itself, with no
   configuration. It is still an undocumented runtime detail, so it fits as a second, independent
   signal next to (a), not as the only guard.
2. **The "#850 orphan-test guard" does not exist as a file.** Issue #850 is the m4-danger-paths
   timeout; `config-migrations.test.mjs:11` mentions "test-hygiene's #850 guard" about which globs
   `npm test` reaches, and `brain/scripts/test-hygiene.mjs` is the #842 stale-fixture sweep. The
   #1012 comment that cited "the #850 orphan-test guard" repeated an unverified sub-agent claim;
   the real precedent is `test-hygiene.test.mjs` (#1022).

## Risks

- **The guard silently stops the legitimate hook.** `shipOnSessionEnd` exits 0 and logs to a tmp
  file nobody watches, so a lost marker is invisible. Apply must prove the marker survives the real
  chain `npm run brain:memory:session-end` → `session-end-ship.mjs` → `cli.mjs ship`, against a
  fixture root and the fake VCS port.
- **Auto-merge is disabled on the repository** (`allow_auto_merge: false`, origin unknown). It is
  a second, independent layer today; the proposal must name each layer rather than present the
  invoker guard as the only control.
- **Allowlist discipline.** Too loose is decorative; too strict forces cosmetic seams on harmless
  tests. Needs an explicit human rule.

## Open questions for the proposal

1. Scope: guard only `ship`, or also `collect` and the day-start sweep entry, as defense in depth?
2. Allowlist governance: is code review enough, or must each entry carry a reason tag the scanner
   enforces?
3. Anti-pattern breadth: only "test safety must not depend on a configuration value", or also
   "a seam-presence check must not stand in for the mechanism"?
4. Manual ship semantics: any non-interactive caller of `brain:memory:ship` (a future scheduled CI
   job) stays legitimate, or only a human at a terminal?
5. Delivery: one PR, or chained slices?

## Suggested slices

1. Invoker guard: `package.json` + `cli.mjs` guard + `cli.ship.test.mjs` refusal/success cases +
   one end-to-end marker-survival test (~40-60 lines).
2. Meta-test: new sibling scan file with allowlist and self-tests (~120-180 lines, all tests, so
   outside the governed diff).
3. Anti-pattern draft: prose only, under `brain-drafts/` (~40 lines).
