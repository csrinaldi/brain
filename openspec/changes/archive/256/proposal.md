# Proposal — The Antigravity Harness Adapter + The Baptism (Track B / slice B2)

> **Status:** planned · **Issue:** #256 (APPROVED with 3 owner pins)
> **Depends on:** #253 / B1 — the gates read `sdd-layout.mjs` (single-source layout); #250 / B0 — the
> four-surface port contract (ADR-0019) + `plain.mjs` proving the port at n=2 on `init`. B2 takes the port
> to a REAL second AI inhabitant.
> **Measurements (LOAD-BEARING — dated + versioned, cite them):** [[sdd/issue-256-b2/measurements]]
> (engram #604). **Signature: Antigravity CLI 1.1.1 · Gemini 3.5 Flash (Medium) · 2026-07-12 · host
> `gandalf`.** **CAVEAT: engram MCP is pre-configured on THIS host (`~/.gemini/antigravity-cli/mcp/engram`),
> NOT factory Antigravity.**
> **Exploration:** [[sdd/issue-256-b2/explore]] (#602, the code map). Owner pins + batch hygiene
> [[sdd/issue-256-b2/constraints]] (#601). Binding contract: ADR-0019 (`brain/project/decisions/adr-0019-harness-port.md`).
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context

Track B proves brain's `SDD_HARNESS` port is a real, swappable boundary — validated by a second
*inhabitant*, not asserted. B0 wrote the four-surface contract down and reached n=2 on the dispatcher's
own `init` op with `plain.mjs`. B1 wired the gates onto the single-source layout. **B2 is the real
baptism: a competing AI harness (Antigravity) becomes the second inhabitant of the port and completes a
real governed micro-slice (#247) under intact governance, human as operator.**

The load-bearing input is not the plan — it is the **measurement**. A human ran the empirical batch
against real Antigravity (CLI 1.1.1 · Gemini 3.5 Flash (Medium) · 2026-07-12 · host `gandalf`), one fresh
scratch per experiment, Exp-1-first respected (#601). Every bar the port needed cleared is measured, not
assumed:

- **Emitter target = `AGENTS.md`, MEASURED (Exp 1).** Antigravity reads `AGENTS.md` ONLY; `CLAUDE.md`
  present and IGNORED (verbatim echo of `SENTINEL-AGENTS-7f3a`, `CLAUDE.md` never named). This is the
  measured answer — NOT the plan's assumption. It coexists with Claude Code *by construction*: different
  files, zero precedence logic to design.
- **Real shell (Exp 2).** Antigravity executes real commands (Bash tool-call visible). `git status` and
  `gh --version` (gh 2.46.0 on PATH) run with no prompt; `npm test` asked once and, approved, produced
  the literal `RAN-NPM-TEST-OK` — verified real, not simulated. Per-command permission model: read-only
  free, mutating asks, persistable to `settings.json`.
- **Memory (Exp 3).** engram MCP auto-discovered + preferred (`mem_save` → #603); cross-session recall
  verified (`mem_context` recovered `MEMORY-PROBE-4d8f`); flat `.memory/records/*.jsonl` readable. NO
  native memory appeared. The plainfiles door-typed `agent` (`PLAINFILES_ACTOR_KIND = "agent"`,
  `plainfiles.mjs:31`) already stamps the baptism trail with no extra plumbing. **Host-caveat:** engram
  auto-discovery is a property of THIS pre-configured host, not factory Antigravity.
- **`AGENTS.md` GOVERNS (Exp 4).** Antigravity RE-READ `AGENTS.md` at decision time (Read tool-call
  visible), REFUSED a Tier-3 violation citing file + tier verbatim ("…strictly PROHIBITED (Tier 3)"),
  and the refusal was artifact-verified (`git log` → zero commits). **BONUS:** it referenced "our global
  rules" — Antigravity loads HOST GLOBAL rules that COMPOSE with the repo's `AGENTS.md`. The emitter
  emits the **repo layer**, not the sole authority.

**Aggregate:** Antigravity reads the right file, runs the full circuit, uses project memory unprompted,
and obeys repo rules against the operator's direct prompt — artifact-verified. **The baptism is
evidenced, not speculative.** B2 ships the adapter that emits what the measurement proved Antigravity
reads, then runs #247 through it.

## What this slice ships (2 halves)

### Half 1 — the adapter (`antigravity.mjs#init()`)

1. **NEW `brain/scripts/harness/backends/antigravity.mjs`** exporting async `init(opts)` alongside
   `gentle-ai.mjs` and `plain.mjs`. **No `cli.mjs` change** — the dispatcher is already backend-agnostic
   (`SDD_HARNESS=antigravity` resolves `./backends/antigravity.mjs`, kebab→camelCase `init`→`init`);
   `plain.mjs` is the precedent that this needs zero dispatcher edit.
2. **`init()` GENERATES `AGENTS.md` FROM brain/'s canonical docs (Pin 1) — NEVER hand-authored.** The
   emitted file is compiled from the canonical source list:
   - `brain/HOME.md` (nav);
   - `brain/core/methodology/agent-authorities.md` — the Tier-1/2/3 table **VERBATIM** (the exact prose
     Exp 4 proved Antigravity obeys);
   - `brain/core/methodology/harness-contract.md` — the verb table + artifact contract;
   - `brain/core/methodology/sdd-layout.md` — the canonical SDD layout;
   - the governance gate list with skip labels (SOURCE doc confirmed in design — see Fork B).
3. **Provenance declared IN the emitted file (Pin 1).** `AGENTS.md` carries a `generated from <paths> —
   do not edit` banner naming its sources, so drift back to hand-editing is visible and refused by review.
4. **The emitted `AGENTS.md` is the REPO layer that COMPOSES with Antigravity's host globals (Exp 4
   finding).** The emitter design does NOT assume `AGENTS.md` governs alone; it emits the repo-scoped
   authority that layers under the host's conventional-commit-style globals.
5. **`managed-paths.mjs` gets the emitted `AGENTS.md` (+ the memory backend path) as EXACT LITERALS**
   (PLAN §1 rule 6 — never a glob). Whatever B2 emits is a managed path, tracked literally.
6. **TDD over injectable seams**, matching the `gentle-ai.mjs` / `plain.mjs` convention: `init()`'s
   doc-reads and file-emission are `_`-prefixed seams with `_default*` implementations; the unit test
   asserts the compiled `AGENTS.md` contains the verbatim tier table + the provenance banner, from the
   named sources, without touching the real repo.

**Scope CONFIRMED minimal (Pin 1):** B2 ships a MINIMAL, Antigravity-scoped emitter. F2 (the general
cross-agent `AGENTS.md` compiler, `brain:context:build`) is 100% UNBUILT (repo-wide grep confirms, #602)
— so B2 CANNOT depend on it. The two are **SIBLINGS, not a dependency**: B2's narrow emitter lands first;
F2 later generalizes/absorbs it consuming the same source list. No false dependency, no block.

### Half 2 — the baptism (#247)

7. **#247 is completed through Antigravity ALONE, human as operator (Pin 2).** Antigravity does the real
   governed micro-slice; Claude Code observes/supports but NEVER co-implements. Memory of the run goes via
   **plainfiles** — the door-typed `agent` records tell the truth about which agent wrote the trail, no
   extra plumbing (Exp 3 + explore's structural fact).
8. **Acceptance = #247 MERGED with ZERO gate modifications.** The proof is that a second AI clears the
   *unchanged* governance bar. Changing any gate to accommodate Antigravity INVERTS the proof — it is a
   STOP-finding, not an allowed adjustment (see Non-goals).

## Non-goals (explicit)

- **B3** — deferred. No speculative third adapter until an inhabitant with real need exists.
- **Changing ANY governance gate for Antigravity.** If a gate blocks Antigravity, that is a
  STOP-and-report finding — the baptism must clear the gates AS THEY ARE. Weakening a gate to pass the
  baptism inverts the entire proof.
- **CLAUDE.md unification** — an F2 follow-up. B2 emits `AGENTS.md` only (the measured target); it does
  not unify or generate `CLAUDE.md`. (Explore confirms no `CLAUDE.md` at repo root today — the follow-up
  is unblocked but out of B2.)
- **F2's general cross-agent generator** (`brain:context:build`). B2's emitter is Antigravity-scoped and
  minimal by construction (Pin 1); generalization is F2's job, later, as a sibling.
- **`VALID_OPS` expansion.** The dispatcher stays single-op (`init`); artifact work is harness-neutral by
  ADR-0019. B2 adds a backend, not an op.

## Two design forks for the owner/reviewer (recommend, don't decide)

- **Fork A — baptism-runbook permissions (RECOMMEND: pre-declare the circuit set).** Exp 2 measured a
  per-command permission model with a persistable allowlist (`settings.json`). For a clean #247 run, the
  runbook can either **(a) pre-declare the circuit set** via Antigravity `settings.json` —
  enumerated: **`npm test`, `git commit`, `git push`, `gh pr create`** — or **(b) document per-command
  initial approval** at run time. **Recommendation: pre-declare the enumerated set** for a clean,
  uninterrupted governed run; per-command approval is the fallback if the operator prefers to watch each
  gate live. Design confirms the exact `settings.json` shape.
- **Fork B — the governance-gate-list SOURCE doc for the emitter (RECOMMEND: `workflow-governance.md` +
  `GOVERNANCE_JOBS`).** Explore did NOT conclusively pin the single source of the governance gate list
  with skip labels (#602 open question 3). Most likely it is `workflow-governance.md` +
  `governance.yml`/`GOVERNANCE_JOBS`. **Recommendation: confirm and pin these in design** before the
  emitter's source list is frozen — one more read closes it. Not a proposal-level decision.

## Acceptance criteria (CP-B2 — hard stop, PR-as-review, Part of #256)

- [ ] **Half 1 (adapter):** `brain/scripts/harness/backends/antigravity.mjs` exists, exports async
      `init(opts)`, is dispatchable (`SDD_HARNESS=antigravity` runs `init`), with **no `cli.mjs` change**.
- [ ] **Pin 1 (generated, not hand-authored):** `init()` compiles `AGENTS.md` FROM the canonical source
      list (HOME.md, `agent-authorities.md` VERBATIM tier table, harness-contract verb table,
      `sdd-layout.md`, the confirmed governance gate list) and emits a `generated from <paths> — do not
      edit` provenance banner.
- [ ] **Composition (Exp 4):** the emitted `AGENTS.md` is the repo layer; the emitter does not assume it
      governs alone (documented to compose with Antigravity's host globals).
- [ ] **`managed-paths.mjs`:** the emitted `AGENTS.md` (+ the memory backend path) added as EXACT
      LITERALS (PLAN §1 rule 6).
- [ ] **TDD:** unit tests over injectable seams assert the compiled `AGENTS.md` content (verbatim tier
      table + provenance banner + named sources) written FIRST (RED→GREEN); `npm test`,
      `brain:repo:check`, `brain:change:verify` green.
- [ ] **Half 2 (baptism):** #247 completed through Antigravity ALONE (human operator; Claude Code
      observes, never co-implements; memory via plainfiles) and **MERGED with ZERO gate modifications**.
- [ ] **Measurements recorded (Pin 3):** the dated + versioned signature (Antigravity CLI 1.1.1 · Gemini
      3.5 Flash (Medium) · 2026-07-12 · host `gandalf`) + the host-caveat carried into design.
- [ ] **Forks A + B surfaced** for owner decision (recommendations stated), NOT silently resolved.
- [ ] Guardrails: docs English (ADR-0009); **≤400 changed lines** — split if the adapter + baptism cannot
      honestly be one slice (design gives an honest forecast); no gate weakened for Antigravity.
      **STOP at CP-B2.**

## Addendum — closing measurements + a new fork (post-proposal review; binding for design)

The proposal review approved this doc with pins and added closing measurements (same signature: **Antigravity CLI 1.1.1 · Gemini 3.5 Flash (Medium) · 2026-07-12 · host `gandalf`**):

- **Load list refined:** Antigravity loads **`AGENTS.md` + `GEMINI.md`** (both, each named with its file); `CLAUDE.md` ignored; no local `fileName` override → CLI default. `AGENTS.md` remains the emitter target; a Gemini-specific `GEMINI.md` layer + host globals **compose** with it.
- **No `/memory show|reload`** in Antigravity CLI 1.1.1 (partial Gemini-CLI inheritance) → the runbook's only context-inspection instrument is the sentinel-prompt-in-a-fresh-session.
- **UX hazard:** slash-commands share a namespace with plugins + lax matching (`/memory show` auto-resolved to a chrome-devtools plugin skill and contaminated a session). Runbook rule: **verify commands with `/help`, never assume.**
- **Exp 4 "global rules" origin verified:** the host's `~/.gemini/GEMINI.md` first rule is verbatim "Never add Co-Authored-By or AI attribution to commits" — the model cited BOTH layers. **Host caveat COMPLETE:** engram MCP + chrome-devtools plugin + global `GEMINI.md` (rules + persona) all compose with the emitted `AGENTS.md`. Design lists this composition as fact; the runbook checks it consciously once.
- **Fork A pin:** the `settings.json` permission shape is verified against **REAL Antigravity**, not Gemini-CLI docs (inheritance is partial); the runbook documents the `settings.json` write **with its rollback** (what was added, how to remove).

### Fork 5 (NEW — design decides) — compile vs import the emitted `AGENTS.md`
Inherited docs describe `@path` (memport) imports inside context files. **Unverified in Antigravity** (Exp 5 pending, ~2 min — cheap). IF it works, a thin `AGENTS.md` of `@path` imports = zero drift via a native mechanism. **BUT portability weighs against:** `AGENTS.md` is the multi-harness standard; Codex (the free secondary smoke) would not process memport → sees a literal `@path`; a self-contained **compiled** `AGENTS.md` serves every standard reader. **Reviewer lean: COMPILE, for portability** — the design weighs it and decides; Exp 5 runs anyway (cheap knowledge that may serve the Gemini-specific layer).
