# ADR-0024 — Three-axis decoupling: AGENT_PLATFORM · SDD_ENGINE · MEMORY_BACKEND

**Status**: Accepted · **amended 25/09/2026** (Amendments 1-2 — see below)
**Date**: 2026-07-24 — Cristian Rinaldi (implements #305; documents the split shipped via PR #307)
**Extends**: [ADR-0005](adr-0005-adapter-harness-sdd-harness.md) (the `SDD_HARNESS` selector) and
[ADR-0019](adr-0019-harness-port.md) (the harness port). Does NOT supersede ADR-0019's
neutral-lifecycle decision.

## Context

`SDD_HARNESS` overloaded two distinct concerns into one selector:
1. the **agent platform / LLM runtime** (`antigravity`, `claude`, `plain`), which emits
   instructions (`AGENTS.md`/`CLAUDE.md`) and native workspace hooks
   (`.gemini/settings.json`, `.claude/settings.json`); and
2. the **SDD engine** (`gentle-ai`, `plain`), which drives ecosystem bootstrap/skill-registry.

Memory backend selection already lived on its own (`MEMORY_BACKEND`, ADR-0004) but was resolved
inconsistently. Relying on textual prompt interpretation alone to trigger `brain:session:start` is
probabilistic; deterministic execution across any agent environment requires the concerns to be
separated and native infrastructure-level hooks emitted per platform.

## Decision

> The harness selection is split into **three orthogonal axes**, each resolved independently from
> `.env` / `brain.config.json`:
> - **`AGENT_PLATFORM`** (`antigravity | claude | plain`) — emits platform instructions and native
>   deterministic hooks (`SessionStart` → `brain:session:start`; `PreToolUse` → block
>   `--no-verify` / `git commit -n`).
> - **`SDD_ENGINE`** (`gentle-ai | plain`) — drives ecosystem bootstrap and skill-registry refresh
>   at `init` (the artifact lifecycle stays neutral per ADR-0019).
> - **`MEMORY_BACKEND`** (`engram | plainfiles`) — session capture, semantic search, durable
>   record serialization to `.memory/records/`.
>
> `SDD_HARNESS` is retained only as a **legacy fallback** for `AGENT_PLATFORM`/`SDD_ENGINE` when the
> new variables are absent.

## Consequences

- The platform allow-list is **trimmed to implemented backends** (`antigravity`, `claude`, `plain`).
  The previously-advertised `openai`/`opencode`/`pi` values are removed — they had no backend and
  hard-failed at dispatch (this ADR's companion code change, closes the G4 gate).
- The three axes are decoupled at config resolution; the SDD **artifact lifecycle** remains a single
  neutral implementation (ADR-0019 unchanged — engines normalize into the fixed `openspec/` layout).
- **[Amended by Amendment 2 (#1125): the default is now `claude`, and `antigravity` is the second supported platform. The sentence below is what this ADR decided on 2026-07-24, kept as the record.]**
  Default `AGENT_PLATFORM` is `antigravity`. This is a deliberate default, not neutrality — a
  consumer sets `AGENT_PLATFORM=claude` (or `plain`) explicitly. The README adapters table must be
  reconciled to name all three axes (follow-up, tracked in #305).

## Known state at acceptance (honest scope)

- The axes are resolved in `harness/cli.mjs`, but the daily entrypoint `day-start.mjs` still
  hardcodes `gentle-ai` and a fixed upgrade remote — the decoupling does not yet reach that path.
  Tracked as #123 (milestone M2, line 1.1). This ADR documents the axis contract, not full reach.
  **[Amended by Amendment 2 (#1125): #123 closed on 2026-08-13 without clearing this gap. It
  moved day-start's agent-runtime check onto `resolvePlatform`, and ADR-0030 (#627) moved the
  upgrade check off the fixed remote. Section 3 of `day-start.mjs` still calls `gentle-ai`
  directly, whatever `SDD_ENGINE` says. The gap now belongs to #1114, the cross-axis port
  invariant with a guard.]**
- Per-stage engine composition (a `stage → engine` map) is explicitly future work (see the
  role-as-port draft and the 1.1 epic, milestone M8). **[Amended by Amendment 1 (#323) — this
  line predicted "its own ADR superseding ADR-0019's single-lifecycle decision". That is not
  what happened: ADR-0019 Amendment 1 rules that routing the PRODUCER does not fork the
  evidence contract, and the router lands as an amendment under four stated conditions. The
  prediction is corrected here rather than left standing.]**

## Rejected alternatives

- **Keep `SDD_HARNESS` as a single overloaded selector.** Rejected: it conflates platform and
  engine, forcing a consumer who wants Claude-runtime + gentle-ai-engine to pick one string that
  cannot express both.
- **Add the missing platform backends (`openai`/`opencode`/`pi`) now to match the old allow-list.**
  Rejected: no consumer needs them yet (no n=1); advertising unimplemented backends is the integrity
  gap this ADR closes, not a feature to build speculatively.

## Evidence

- #305 (the three-axis decoupling issue), PR #307 (implementation).
- `brain/scripts/harness/cli.mjs` — `resolvePlatform`/`resolveEngine`/`resolveMemory`.
- Audit: `docs/inbox/brain-v2-merge-audit.md` (§1 architecture, gate G3/G4).

## Amendment 1 — the predicted supersede did not happen (issue #323)

**Signed**: 28/08/2026 — Cristian Rinaldi

### What changed

One prediction, corrected. This ADR's Consequences section said per-stage engine composition
*"would require its own ADR superseding ADR-0019's single-lifecycle decision."* It does not,
and ADR-0019 Amendment 1 (#323) is where that was ruled.

The decision this ADR actually makes — three axes, `AGENT_PLATFORM · SDD_ENGINE ·
MEMORY_BACKEND` — is untouched. What is corrected is a forecast it made about a neighbouring
document.

### Why a forecast is worth amending at all

Because it was already being read as doctrine. `ROADMAP-M5-M8.md` §3 carries the question as
**Compuerta 1** and states the tension in these terms: ADR-0024 says supersede, #323 argues
amendment, and the two cannot both stand. A signed document predicting a supersede is a
signed document that has to be either fulfilled or corrected — leaving it is how a plan of
record acquires a claim nobody checked.

The correction is small and the alternative was not: a new ADR superseding ADR-0019 would
have retired a decision whose norm — *four surfaces, artefacts neutral by design* — is
unchanged and still load-bearing. Superseding a decision to add a permission it already
allowed is the more expensive and the less honest of the two.

### What actually landed instead

**ADR-0019 Amendment 1**, which annotates the first rejected alternative to say what it was
rejecting — a **forked layout**, not a routed producer — and permits routing a lifecycle stage
under four conditions:

1. one layout, and it stays `sdd-layout.mjs`;
2. verification stays neutral and engine-blind;
3. a routed stage is indistinguishable at the boundary — same change dir, two engines, same
   gates;
4. `assertRoutableStage`'s refusal is **replaced, not removed** — the conditions go somewhere a
   reader enforces them.

The precedent it rests on is already in `main` and predates this ruling: **ADR-0033 grew
`VALID_OPS` from `['init']` to `['init', 'run-stage']` with no supersede**, on ADR-0019's own
second rejected alternative — *"the four surfaces are the invariant, the op count is just
today's state."*

### What this does not change

The three axes, their names, their precedence and their reach. `SDD_ENGINE` still selects the
engine; what #323 adds is that the selection may vary **per stage** rather than per repo. That
is a widening of one axis's granularity, not a fourth axis and not a change to the contract
between them.

And the axis separation this ADR drew stays load-bearing elsewhere: `producer-forge-reach.mjs`
cites it to explain why naming `gh` and `glab` is legitimate while naming an engine vendor is
not, and ADR-0033 Amendment 2 rests on the same line. Nothing here touches that.

## Amendment 2 — `claude` is the default, `antigravity` is the second platform, and the day-start gap moves to #1114 (issue #1125)

**Signed**: 25/09/2026 — Cristian Rinaldi

### What changed

**The default `AGENT_PLATFORM` is `claude`.** A repo that states no platform gets `claude`
from every resolver: `harness/platform.mjs#resolvePlatform` and `bootstrap.sh` §6.
`bootstrap.sh` writes `AGENT_PLATFORM=claude` to `.env`, so the default is stated in the repo
and not left implicit.

**`antigravity` is the second supported platform.** It is the other platform available for
testing, and it resolves whenever it is stated. The six inputs that count as stating it are
process-env or `.env` `AGENT_PLATFORM`, `brain.config.json`'s `harness.platform`, and the legacy
`SDD_HARNESS` in any of those three places.

This is the 2026-09-24 ruling on #1121 (the brain 2.0 epic, ruling 3): the MVP support matrix
names `claude` (default) and `antigravity`. `plain` stays a member of the axis and emits no
harness files.

### Why this ADR called `antigravity` deliberate, and what moved

It was deliberate when written, and it named one of two backends that were equal in weight.
The 2.0 epic changes what the default is for: it is the platform a new consumer lands on
without choosing, and the MVP matrix names `claude` as that platform, with `antigravity` beside
it for testing. Under ADR-0036 a default is a promise about a fresh install. The default should
therefore be the platform the product commits to first, and the publish gate (#1136) is where
that promise is checked.

### What this does not change

- **The three axes, their names and their precedence:** process env > `.env` >
  `brain.config.json`, then the legacy `SDD_HARNESS`.
- **Existing consumers.** Before this amendment, `bootstrap.sh` wrote the default into `.env`,
  so every consumer that ran `brain:env:init` states `AGENT_PLATFORM=antigravity` and keeps it.
  Nothing migrates them. A consumer that wants `claude` changes one line.
- **`AGENTS.md`.** It is still compiled by the `antigravity` backend, and `brain:upgrade` still
  regenerates it on every upgrade. What changes is that `brain:env:init` on a `claude` repo does
  not emit it.

### The "Known state" pointer, corrected

This ADR's "Known state at acceptance" handed the `day-start.mjs` hardcoding to #123. #123
closed on 2026-08-13. It delivered the configured agent-runtime check (day-start now resolves
the platform through `resolvePlatform`). ADR-0030 separately moved the upgrade check off the
fixed remote. The `gentle-ai` half never moved: `day-start.mjs` section 3 runs
`gentle-ai --version`, `update`, `upgrade` and `skill-registry refresh` whatever `SDD_ENGINE`
says.

A signed ADR that sends a reader to a closed ticket for an open gap tells them the gap is
handled. It is not, so the pointer moves to **#1114**: every axis is selected by configuration
behind a stable port, and a guard keeps it that way. #1114 is also where the platform's second
resolver retires (see below).

### Known state at this amendment (honest scope)

- **There are still two resolvers.** `bootstrap.sh` §6 resolves the platform in shell before
  `harness/cli.mjs` runs. It now has `resolvePlatform`'s precedence and default, and
  `bootstrap.default-platform.test.mjs` compares the two over a 90-case parity table. That
  parity is enforced by a test, but it is still two implementations. #1114 leaves one.
- **The `env:init` path does not read `brain.config.json`'s `harness` section.** Neither
  `bootstrap.sh` nor `harness/cli.mjs` passes config to the resolver, and a `.env` value outranks
  config wherever config is read. A platform stated ONLY in `brain.config.json` is therefore
  shadowed by the `.env` value `brain:env:init` writes. That was true before this amendment for
  `claude` and is true after it for `antigravity`. #1114 owns declaring the selectors in the
  schema.
- **The `claude` harness init overwrote `.claude/settings.json`, and this default waited for
  the fix.** `brain:upgrade` merged that file, but `brain:env:init` on `claude` then wrote brain's
  hooks over the result, so a consumer's own entries were lost. `antigravity` did the same to
  `.gemini/settings.json`. It predates this amendment, but the new default would have put every
  fresh consumer on that path. It was measured on a packed-tarball consumer during #1125 and
  fixed by #1139 before this default shipped: `init` now merges through the same `mergeSettings`
  core the upgrade uses.
