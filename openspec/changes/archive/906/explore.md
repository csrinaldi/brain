---
status: draft
issue: 906
---

# Explore — #906 the lane's triggers: `SessionEnd` hook + `day:start` sweep, behind `memory.lane.enabled`

Parent: #864 (memory 2.0), task 3.1b/3.1c. Twice deferred, same reasoning both times:
- **#888 D4** — a lane PR was un-mergeable until #889's gates landed
  (`openspec/changes/archive/888/proposal.md:137-158`).
- **#889 D6** — that reason dissolved, but blast radius didn't: a hook added to the shared settings
  compiler "emits it into Gemini's settings too — an unmeasured two-platform claim"
  (`openspec/changes/issue-889-lane-governance/proposal.md:135-146`). Filed as this sub-ticket,
  gated on the first real lane PR merging.

`origin/main` here is `ec117141` — `mrAutoMerge` (#886), `collect` (#887), `memory:ship` (#888), the
gates (#889) are all landed; `brain:audit` prints `[LANE]`. Whether a live lane PR has actually
merged yet is a fact for `sdd-propose` to confirm, not this explore.

## Current state, measured

### 1. The settings-hooks compiler emits two hook events, not three — `SessionEnd` is unprecedented

`compileSettingsHooksJson()` (`brain/scripts/harness/backends/settings-hooks.mjs:42-69`) is pure,
fs-free, argument-free. Today: `PreToolUse` (`:45-55`, the `--no-verify` guard) and `SessionStart`
(`:56-65`, `npm run brain:session:start`). **`rg -i SessionEnd` across the whole repo returns zero
hits.** Whether Claude Code's hook schema has a `SessionEnd` event, its payload, and whether it can
background a child without blocking the CLI's exit is **unmeasured — a live check for `sdd-design`**,
not an assumption to carry forward.

Both backends call the same compiler: `claude.mjs:58-70` writes `.claude/settings.json` (`:21`);
`antigravity.mjs:217-251` writes `.gemini/settings.json` (`:48`, written at `:245-250`). Its own
comment: "byte-identical to claude's copy" (`antigravity.mjs:65-68`).

**The drift guard is byte-equality against committed HEAD**: `antigravity.drift.test.mjs:111-124`
reads `.gemini/settings.json` via `git show HEAD:...` and asserts it equals
`compileSettingsHooksJson()` exactly. A `SessionEnd` key added to the shared compiler fails this
test until `.gemini/settings.json` is regenerated and committed too — Claude-only is not free: it
needs either a platform branch inside the one shared compiler (the duplication #315 exists to
prevent, `settings-hooks.mjs:1-23`) or the hook is genuinely emitted on both platforms.

### 2. Credential scoping is already done — #888 landed it

`credential-env.mjs:118` exports `MEMORY_TOKEN_ENV = 'BRAIN_MEMORY_TOKEN'`, already a **default**
member of `credentialEnvNames()` (`:146-149`), stripped case-insensitively by `withoutCredentials()`
(`:169-178`) with no `extra:[...]` needed. **This slice does not touch `credential-env.mjs`.**
`memory/cli.mjs:446-533`'s `ship` op reads the token once (`:464`), refuses set-but-blank (`:474-476`),
falls through to ambient `gh`/`glab` when unset (`:477-482`) — the `lite`-tier, developer-machine
path ADR-0034 L5 already describes. The hook only needs to spawn `npm run memory:ship`; credential
handling already exists.

### 3. `memory:ship`'s exit contract

Measured from `memory/cli.mjs:446-533`: **exit 0** on every non-fatal outcome — "nothing to ship",
a refused re-arm (`autoMerge.reason` reported, never fatal), ambient identity. **Exit 1** only on
`raced`/`badHost`/`diverged`/`pushFailed`/`prLookupFailed`/`prCreateFailed`/`failed` (`:523-529`).
`--json` → stdout only; evidence → stderr (`:494-516`), same discipline `pre-push` documents
(`hooks/pre-push:17-36`). A transport failure surfaces as `pushFailed` → exit 1 — non-blocking only
if the hook itself never propagates that code into the CLI's own exit.

### 4. `pre-push` never calls `ship` — L5's boundary holds

`hooks/pre-push:70` calls `memory/cli.mjs share`, not `ship`. No file under `hooks/` references
`ship`/`lane`. Already satisfies ADR-0034 L5's "never by a feature branch's `pre-push`"
(`adr-0034...md:138-139`) — a regression test should pin it, not reinvent it.

### 5. `day:start` is a fixed 6-step sequence pinned by a smoke test

`day-start.mjs:25` — `const TOTAL = 6`; `sep()` (`:55-60`) prints `step/TOTAL`. The AI-runtime block
(`:304-333`) is deliberately **not its own `sep()`** — its comment: `bootstrap-smoke/smoke.mjs`
asserts the literal `6/6`, "a seventh step turns that smoke test red (measured on PR #594)". A
sweep step must follow the same shape — a sub-step inside an existing section (step 5, "Team
memory", `:335-382`, already runs `memory/cli.mjs import`) — unless the smoke test's literal moves
in the same PR. No existing "session ended badly" signal was found; needs a design decision (see
Open Questions).

### 6. The config flag: no `memory` key exists; the migration pattern is uniform

This repo's `brain.config.json` has no `memory` key (top-level: `project`, `docs`, `vcs`,
`governance`, `reviewer`, `schemaVersion`, `sdd`). `config-migrations.mjs` is append-only and
additive (`:18-164`); the newest entries (`1.2.0`–`1.4.0`) show the shape:
`{ version, description, defaults: { <ns>: { <key>: <default> } } }`, never overwriting a
consumer's value. Adding `memory.lane.enabled: false` is one entry, version-bumped past the current
package version (`config/cli.mjs:54` reads it from `package.json`, never a literal).
`brain:config` (`config/cli.mjs:1-73`, #823) is the only writer — `get`/`set`, migration-aware — so
`npm run brain:config -- get memory.lane.enabled` is the maintainer's report surface for free; no
new reporting code owed. Curiosity for `sdd-design`, not blocking: this repo's own committed
`schemaVersion` is `"0.3.0"` while migrations run through `1.4.0` — worth one check that `set` walks
pending migrations correctly here.

### 7. Consumers regenerate settings the same way

`brain-upgrade.mjs:257-265` routes both `.claude/settings.json` and `.gemini/settings.json` through
the same `mergeClaudeSettings` (comment: "#397, REQ-397-3"). A hook added to the shared compiler
reaches every adopter's settings on both platforms the next `brain:upgrade`/`env:init` — no
adopter-specific code path to also change. The drift guard is the only thing standing between
"compiler changed" and "every consumer's committed settings file is stale" — exactly what #889 D6
named as the reason to defer.

## Approaches, with tradeoffs

### A — Emit-always-with-runtime-guard vs. emit-only-when-flag-enabled

| | emit always, guard at runtime | emit only when flag true |
|---|---|---|
| settings-file stability | stable across the flag; toggling never touches the files | flipping the flag changes compiler OUTPUT — every adopter must re-run + commit to arm/disarm |
| compiler purity | `compileSettingsHooksJson()` stays argument-free (`settings-hooks.mjs:16-19`'s own constraint) | breaks "takes no arguments" — must read config, becomes impure/repo-relative |
| cost when disabled | one process spawn per session end, exits fast | zero — line absent |
| blast radius (#889 D6) | string reaches every settings file immediately, armed or not | narrower until opted in, but reopens the impurity problem |

**Leaning**: emit-always matches the ticket's own words ("inert until the maintainer turns it on")
and keeps the no-argument contract — but it is the more radius-widening option by definition; the
proposal should weigh this against D6 explicitly rather than default to it.

### B — Detached spawn vs. synchronous with timeout

Nothing in this repo currently fire-and-forgets a child. `defaultRun` (`claude.mjs:153-243`) waits
for a result with a timeout — built for a foreground subagent, not a hook that must return control
to session teardown immediately. A synchronous spawn with any timeout still blocks teardown for that
long. Genuine backgrounding (`detached: true` + `unref()`, or a shell-level `&`) is new plumbing,
not reuse.

### C — Claude-only hook vs. two-platform parity

Given §1, Claude-only is not free: either the drift test gets a named, evidenced platform exemption
(suspicious by this file's own doctrine — "a copy of two drifts; a function cannot",
`settings-hooks.mjs:19`) or Gemini gets the same hook. Whether Antigravity/Gemini has a
`SessionEnd`-equivalent is unmeasured — `AGENT_RUNTIME = null` for antigravity (`:61`, "this repo
installs no antigravity CLI") suggests nobody has driven a real session to find out.

## Open questions for the proposal

1. Does Claude Code's hook schema define `SessionEnd` (payload, exit semantics)? Live check needed.
2. Does Gemini/Antigravity have an equivalent event, or does the parity test need a named exemption
   — and is that exemption in scope for #906 or its own prerequisite?
3. What "ended badly" signal does the sweep read? No existing marker found. Candidates: a file
   written at session-start and cleared on graceful end; scanning `.memory/records` age; or simply
   running `memory:ship --dry-run` unconditionally as its own detector. Must respect §5's no-8th-step
   constraint.
4. Emit-always vs. emit-only-when-enabled (Approach A) — the proposal's D-decision.
5. Where does the spawn plumbing live — a new seam beside `defaultRun`, or a standalone script under
   `hooks/` (mirroring `pre-push`/`post-merge`)?
6. Logging: a detached child's stderr is lost once the parent exits. Does #906 need a `.brain/` log,
   or is "silent unless the sweep later reports a lag" accepted?

## Files likely to need tests first (STRICT TDD)

- `settings-hooks.test.mjs` — extend: `SessionEnd` block shape; determinism/no-argument property
  under Approach A, or both flag states under emit-only.
- `antigravity.drift.test.mjs` — fails on `SessionEnd` addition by design until
  `.gemini/settings.json` is regenerated and committed (or Q2's exemption is coded and tested).
- A new hook-guard script's own test, mirroring `settings-hooks.test.mjs:56-81`'s `runGuard` —
  spawn the command with a fake `memory.lane.enabled` state, assert exit 0 / no invocation when off.
- A new pure `detect`/`plan` module for the sweep (mirrors `lane/plan.mjs`'s seam shape), keeping
  `day-start.mjs` thin I/O per this repo's convention — `day-start.mjs` itself has no `.test.mjs`.
- `config-migrations.test.mjs` / `brain-config.test.mjs` — the new migration entry, additive-only.
- `credential-env.test.mjs` — **no change needed** (§2: already scoped by #888).
- A `pre-push` regression asserting it still never invokes `ship`, mirroring the "no backend
  re-declares the guard" pattern.

## Risks, named

- Blast radius is measured, not assumed (§7): every adopter that upgrades gets the hook in both
  settings files. Emit-always makes this immediate; emit-only-when-enabled defers it but then
  requires a regenerate-and-commit to arm.
- A detached spawn is new plumbing (Approach B) with no existing seam to reuse.
- The `SessionEnd` event's existence/semantics are unverified — the single biggest unknown, named
  per §1 and Q1 rather than assumed.
- Two-platform parity may be unachievable if Gemini/Antigravity has no equivalent event; the
  proposal must decide, with evidence, whether that becomes a documented exemption or a blocker.
