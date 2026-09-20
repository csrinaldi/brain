---
status: proposed
issue: 906
---

# Delta for Lane Governance (#906 — the triggers)

Implements ADR-0034 L5's first two callers ("the ship trigger and credential are separated",
`archive/862/spec.md:76-89`) and #864 task 3.1b/3.1c. No MODIFIED requirements against
`archive/862/spec.md` or `issue-889-lane-governance/spec.md` — this slice ADDS the callers L5
already ratifies, and re-pins `pre-push`'s non-invocation with a new test.

## ADDED Requirements

### Requirement: the compiled `SessionEnd` hook is byte-identical on both platforms

`compileSettingsHooksJson()` MUST emit a `SessionEnd` block whose sole hook `command` is
`npm run brain:memory:session-end`, with no `matcher`, `timeout`, or `async` key. Both
`.claude/settings.json` and `.gemini/settings.json` MUST be regenerated and committed in the
same commit, byte-equal to the compiler's output.

#### Scenario: shape and drift
- GIVEN `compileSettingsHooksJson()`
- WHEN called, THEN `hooks.SessionEnd[0].hooks[0].command` is the exact string above, with no
  `matcher`/`timeout`/`async`, deterministically, argument-free
- AND WHEN both committed settings files are compared to the compiler's output, THEN both are
  byte-equal

Test: `harness/backends/settings-hooks.test.mjs` (extend) — "SessionEnd command, no matcher/
timeout/async"; "stays deterministic and argument-free with three events"; `:174` unchanged.
`harness/backends/antigravity.drift.test.mjs` — unchanged, must go green post-regeneration.

### Requirement: the launcher is silent and inert when the flag is off

`brain/scripts/memory/session-end-ship.mjs` MUST read `memory.lane.enabled` via
`loadBrainConfig()`. False or absent MUST exit 0, spawn nothing, print nothing.

#### Scenario: disabled, absent, and real-run
- GIVEN an injected config `{enabled:false}` or no `memory` key at all
- WHEN the launcher runs, THEN the spawn seam is never called, exit is 0, no stdout/stderr
- AND WHEN the real entrypoint runs once against this repo's own config (flag false)
- THEN it exits 0, prints nothing, writes no file

Test: `brain/scripts/memory/session-end-ship.test.mjs` (new, injected seams) — "flag false:
spawn seam never called, exit 0, silent"; "missing memory.lane key treated as false";
"real entrypoint against real config exits 0, prints nothing, writes no file".

### Requirement: the launcher fully detaches the ship when the flag is on

When `memory.lane.enabled` is `true`, the launcher MUST spawn `memory/cli.mjs ship` with
`detached: true`, redirect its output (append) to
`${tmpdir()}/brain-lane-ship-<host>-<date>.log`, and call `.unref()`. It MUST inherit the
parent environment unchanged (no scrubbing) and MUST NOT log any credential value. It MUST
exit 0 within the shared 1.5 s budget without reading or propagating the child's exit code. A
spawn failure MUST print exactly one stderr line and still exit 0.

#### Scenario: enabled, detached, env-inherited, failure-safe
- GIVEN an injected config `{enabled:true}` and a parent env carrying `GH_TOKEN` and
  `BRAIN_MEMORY_TOKEN`
- WHEN the launcher runs, THEN the spawn seam is called once with `detached:true`, `.unref()`
  is invoked, output is redirected to the tmpdir log, and `env` carries both tokens unchanged
  with neither value ever printed
- AND WHEN the seam throws, THEN one stderr line reports it and the launcher still exits 0,
  never waiting for or reading the child's own exit code

Test: `brain/scripts/memory/session-end-ship.test.mjs` (new) — "flag true: seam called once,
detached/unref/tmpdir-log, env carries both tokens unchanged"; "exit 0 regardless of child
outcome, code never read"; "throwing seam: one stderr line, exit 0".

### Requirement: the `day:start` sweep ships synchronously inside step 5

Step 5 ("Team memory") MUST run a synchronous `memory/cli.mjs ship --json` sub-step when
`memory.lane.enabled` is `true`, printing one parsed outcome line, and MUST skip it silently
when `false`. A non-zero `ship` exit MUST warn without failing `day:start`. `TOTAL` MUST stay
6 — no seventh `sep()`.

#### Scenario: gated, non-fatal, step count preserved
- GIVEN the flag is true and an injected `ship` seam returns non-zero
- WHEN `day:start` runs, THEN step 5 invokes the seam once, prints one outcome line, warns
  without failing, and `day:start` still reports `6/6`
- AND WHEN the flag is false, THEN the seam is never invoked and no sweep line prints

Test: `day-start` coverage (new file — none exists) over an extracted pure step — "flag on:
one invocation, non-zero warns without failing, TOTAL stays 6"; "flag off: no invocation".

### Requirement: `memory.lane.enabled` is a migration-managed flag, default false

`config-migrations.mjs` MUST carry one append-only `1.6.0` entry defaulting
`memory.lane.enabled` to `false`, never overwriting an existing value. `brain:config get/set`
MUST read/write it via the existing migration-aware reader/writer, with no new reporting code.

#### Scenario: additive migration, round-trip
- GIVEN a config with no `memory` key, WHEN migrations run through `1.6.0`, THEN the flag is
  `false`; GIVEN it is already `true`, THEN it stays `true` after the same migration
- AND WHEN `brain:config -- set memory.lane.enabled true` runs then `get` runs, THEN it
  reports `true`

Test: `core/config-migrations.test.mjs` (extend) — "1.6.0 entry is additive, never overwrites
a set value". `brain-config.test.mjs` (extend) — "get/set round-trips through migration-aware
reader/writer".

### Requirement: `pre-push` never invokes `ship` (re-pinned, `archive/862/spec.md:76-89`)

`hooks/pre-push` MUST NOT invoke `brain:memory:ship` under any path this slice adds; it stays
on `share`. This is now a behavioral regression, not an inspection.

#### Scenario: pre-push stays on `share`
- GIVEN a feature-branch push through `hooks/pre-push`
- WHEN the hook runs, THEN `ship` is never invoked, only `share`

Test: `hooks/pre-push.test.mjs` (extend) — "pre-push still never invokes ship, via a spawn/
exec seam, not a grep".

## Non-goals

No change to `ship`/`collect`/`plan`/`mrCreate`/`mrAutoMerge`/`credential-env.mjs`/
`memory-gate`/record format. `memory.lane.enabled` MUST NOT default `true` on any tier, ever.
No ADR amendment — L5 already ratifies both triggers.

## Acceptance beyond tests

- [ ] After #889 D7.2's manual lane PR merges, the maintainer flips
      `memory.lane.enabled`. The first **automatic** lane PR is recorded with its number and
      the `memory:audit` p50/p90 latency measured after merge — a maintainer act, not a test,
      and not a gate on landing this slice.
