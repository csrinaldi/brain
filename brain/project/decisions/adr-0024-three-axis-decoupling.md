# ADR-0024 — Three-axis decoupling: AGENT_PLATFORM · SDD_ENGINE · MEMORY_BACKEND

**Status**: Accepted · **amended 28/08/2026** (Amendment 1 — see below)
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
- Default `AGENT_PLATFORM` is `antigravity`. This is a deliberate default, not neutrality — a
  consumer sets `AGENT_PLATFORM=claude` (or `plain`) explicitly. The README adapters table must be
  reconciled to name all three axes (follow-up, tracked in #305).

## Known state at acceptance (honest scope)

- The axes are resolved in `harness/cli.mjs`, but the daily entrypoint `day-start.mjs` still
  hardcodes `gentle-ai` and a fixed upgrade remote — the decoupling does not yet reach that path.
  Tracked as #123 (milestone M2, line 1.1). This ADR documents the axis contract, not full reach.
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
