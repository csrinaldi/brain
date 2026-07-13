# Spec Delta — The Antigravity Harness Adapter + The Baptism (slice B2)

> B2 takes the `SDD_HARNESS` port to a REAL second AI inhabitant. Ships `antigravity.mjs#init()` — a
> minimal, Antigravity-scoped backend that GENERATES `AGENTS.md` from brain's canonical docs (never
> hand-authored) — then runs #247 through Antigravity ALONE as the baptism. Every bar below is bound to
> MEASURED facts, not assumption: [[sdd/issue-256-b2/measurements]] (#604, signature: Antigravity CLI
> 1.1.1 · Gemini 3.5 Flash (Medium) · 2026-07-12 · host `gandalf`) and
> [[sdd/issue-256-b2/constraints]] (#601, approval pins + closing addendum + Fork 5). See
> [proposal.md](proposal.md) / [design.md](design.md).

## REQ-B2-1: `antigravity.mjs` is a real, dispatchable `SDD_HARNESS` backend

`brain/scripts/harness/backends/antigravity.mjs` MUST exist and export async `init(opts)`, dispatchable via
`SDD_HARNESS=antigravity` through the UNMODIFIED `harness/cli.mjs` dispatcher — `plain.mjs` is the
precedent that this requires zero dispatcher edit (the dispatcher is already backend-agnostic, kebab→
camelCase `init`→`init`).

#### Scenario: `SDD_HARNESS=antigravity init` runs and emits `AGENTS.md`

- GIVEN `SDD_HARNESS=antigravity` set in the environment
- WHEN the harness dispatcher's `init` op is invoked
- THEN `antigravity.mjs#init()` runs and emits `AGENTS.md`, with `harness/cli.mjs` unchanged

#### Scenario: dispatch shape matches the `plain.mjs` / `gentle-ai.mjs` precedent

- GIVEN `SDD_HARNESS=antigravity`, `SDD_HARNESS=plain`, and `SDD_HARNESS=gentle-ai` in turn
- WHEN `init` is dispatched under each
- THEN all three resolve through the same `cli.mjs` dispatch path to a backend-specific `init()` export —
  n=3 on the port, no dispatcher branch added for Antigravity

## REQ-B2-2: `AGENTS.md` is GENERATED from canonical sources, provenance-declared, never hand-authored

`init()` MUST compile the emitted `AGENTS.md` from a fixed canonical source list: `HOME.md` (nav),
`agent-authorities.md`'s Tier-1/2/3 table VERBATIM (the exact prose Exp 4 proved Antigravity obeys),
`harness-contract.md`'s verb table + artifact contract, `sdd-layout.md`, and the governance gate list with
skip labels (source doc pinned in design — Fork B). The emitted file MUST carry a `generated from <paths>
— do not edit` provenance banner naming its sources. A staleness/drift-guard test MUST fail if `AGENTS.md`
diverges from its named source docs, catching hand-edits (the F2 drift-guard pattern). Whether the compiled
body is self-contained prose or thin `@path` imports (Fork 5) is a DESIGN decision — this requirement binds
the OUTCOME (a generated, provenance-declared `AGENTS.md`), not the compilation mechanism.

#### Scenario: emitted `AGENTS.md` carries provenance and the verbatim tier table

- GIVEN `SDD_HARNESS=antigravity init` has run
- WHEN `AGENTS.md` is inspected
- THEN it contains a `generated from <paths> — do not edit` banner naming its canonical sources, and the
  Tier-1/2/3 table text matches `agent-authorities.md` verbatim

#### Scenario: hand-editing `AGENTS.md` is caught by the staleness guard

- GIVEN an `AGENTS.md` previously generated and then hand-edited, diverging from its canonical sources
  without regeneration
- WHEN the staleness/drift-guard test runs
- THEN it fails, naming the drifted content — hand-editing is not a silent path

## REQ-B2-3: the emitted `AGENTS.md` is the REPO layer, composing — never the sole authority

The runbook/design MUST document, as measured fact (Exp 4 + addendum, #604/#601), that Antigravity loads
`AGENTS.md` + `GEMINI.md` and composes them with host-level globals — on THIS host: engram MCP, the
chrome-devtools plugin, and `~/.gemini/GEMINI.md`. This composition is a property of the measurement host
(`gandalf`), not a guarantee of factory Antigravity, and MUST be stated as host-scoped, honestly. The
emitter MUST NOT assume `AGENTS.md` governs alone; it emits only the repo-scoped layer.

#### Scenario: runbook states the composition and the host-caveat before the baptism run

- GIVEN the B2 runbook prepared for the #247 baptism
- WHEN it documents Antigravity's context-loading behavior
- THEN it states that `AGENTS.md` composes with a Gemini-specific `GEMINI.md` layer (if present) plus host
  globals, and explicitly notes this composition was measured on the pre-configured host — never presented
  as a factory-default guarantee

## REQ-B2-4: `managed-paths.mjs` tracks the emitted `AGENTS.md` and the backend file as exact literals

`managed-paths.mjs` MUST add the emitted `AGENTS.md` path and the memory/backend path as EXACT string
literals (PLAN §1 rule 6) — never a glob pattern.

#### Scenario: `managed-paths` lists the literal paths, no glob

- GIVEN `managed-paths.mjs` after B2
- WHEN it is inspected for the `AGENTS.md` and backend entries
- THEN both appear as exact string literals, and no glob pattern matches them

## REQ-B2-5: the baptism (#247) completes through Antigravity alone, zero gate modifications

#247 MUST be completed through Antigravity ALONE, human as operator; Claude Code MAY observe/support but
MUST NEVER co-implement. Acceptance is #247 MERGED with ZERO changes to any governance gate. If a gate must
change for Antigravity to pass, that MUST be reported as a STOP-finding, never resolved by weakening the
gate.

#### Scenario: #247 merges with a clean gate diff

- GIVEN #247 completed end-to-end through Antigravity, human operator, Claude Code non-implementing
- WHEN #247 is merged
- THEN `git diff` over the governance-gate files (the confirmed gate-list source, Fork B) shows ZERO changes
  attributable to the baptism

#### Scenario: a gate blocking Antigravity is a STOP-finding, not a fix

- GIVEN a governance gate that fails when Antigravity runs #247
- WHEN this is discovered during the baptism
- THEN it is reported as a STOP-finding and the gate is left unmodified — no change under this slice
  weakens or bypasses the gate to make the baptism pass

## REQ-B2-6: the runbook pre-declares the circuit permission set with rollback, verifies commands, inspects context via sentinel

The runbook MUST pre-declare the baptism's circuit permission set (`npm test`, `git commit`, `git push`,
`gh pr create`) via Antigravity `settings.json`, with its shape verified against REAL Antigravity (not
Gemini-CLI docs, whose inheritance is partial) and its rollback documented (what was added, how to remove).
The runbook MUST require verifying slash-commands with `/help` before use (namespace hazard — lax matching
against installed plugins, measured: `/memory show` auto-resolved to a chrome-devtools plugin skill) and
MUST use a sentinel-prompt-in-a-fresh-session as the context-inspection instrument, since Antigravity CLI
1.1.1 has no native `/memory show|reload`.

#### Scenario: runbook enumerates the permission set and its rollback

- GIVEN the runbook prepared before the #247 baptism run
- WHEN it documents the `settings.json` permission pre-declaration
- THEN it lists exactly the circuit set (`npm test`, `git commit`, `git push`, `gh pr create`) and documents
  the rollback steps to remove them after the baptism

#### Scenario: a slash-command is verified with `/help` before use

- GIVEN the operator about to invoke a memory-inspection or other slash-command during the baptism
- WHEN the runbook is followed
- THEN `/help` is run first to confirm the command resolves to the intended built-in — not a lax-matched
  plugin skill — before it is invoked

## Out of scope (non-goals)

- **B3** — deferred. No speculative third adapter until an inhabitant with real need exists.
- **Changing ANY governance gate for Antigravity.** A gate blocking Antigravity is a STOP-and-report
  finding, never a workaround (REQ-B2-5).
- **`CLAUDE.md` unification** — an F2 follow-up. B2 emits `AGENTS.md` only.
- **F2's general cross-agent generator** (`brain:context:build`). B2's emitter is Antigravity-scoped and
  minimal by construction; generalization is F2's job, later, as a sibling.
- **`VALID_OPS` expansion.** The dispatcher stays single-op (`init`); B2 adds a backend, not an op.

## Gate

`npm test`, `brain:repo:check`, `brain:nav`, and `brain:change:verify` MUST stay green with no new
`brain:audit` failure. Docs MUST be in English (ADR-0009). TDD: unit tests over `init()`'s injectable
doc-read/emission seams (asserting compiled `AGENTS.md` content — verbatim tier table, provenance banner,
named sources) are written FIRST (RED→GREEN), matching the `gentle-ai.mjs` / `plain.mjs` convention.
Changed lines MUST stay ≤400 — design gives an honest split forecast if the adapter (Half 1) and the
baptism (Half 2) cannot honestly land as one slice.
