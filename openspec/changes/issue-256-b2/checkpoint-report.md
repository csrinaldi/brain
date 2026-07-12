# Checkpoint Report — CP-B2 (Slice B2, issue #256) — Half 1

> **The second real inhabitant's adapter.** Half 1 ships the Antigravity harness backend + the runbook.
> **Half 2 — the baptism (#247 run through Antigravity ALONE, human as operator) — is downstream:** this PR
> delivers the runbook that makes it runnable; it is NOT executed here. **Hand this report to the external
> reviewer**, and per pin 4, **read the inaugural `AGENTS.md` once** (below).

## What Half 1 delivered
- **`brain/scripts/harness/backends/antigravity.mjs`** — a real `SDD_HARNESS=antigravity` backend (n=3 with
  gentle-ai + plain, via the UNMODIFIED `cli.mjs`). `init()` (seam-injected, never-throws) COMPILES a
  self-contained **`AGENTS.md`** from the 5 canonical docs (`agent-authorities.md` tiers VERBATIM,
  `harness-contract.md` verb table, `sdd-layout.md`, `workflow-governance.md` gate list, `HOME.md` nav) with a
  `generated from <paths> — do not edit` provenance banner. **Generated, never hand-authored** (Pin 1).
- **The drift-guard `antigravity.drift.test.mjs`** — the CHAIN-GUARD: reads the 5 real sources, compiles, and
  asserts byte-equality vs the committed `AGENTS.md`. Catches a hand-edit OR a source-change-without-regen.
- **`AGENTS.md` classified in `governance.ignoreList`** — the scoped literal `AGENTS.md`, by the B1 principle,
  decided ON PRINCIPLE not on B2's budget. The doctrine line (in `diff-size-count.mjs`, beside B1's) is
  EXTENDED: *"a generated operational artifact whose DERIVATION CHAIN is guarded (reviewed generator +
  reviewed/promoted sources + drift-guard byte-equality) = the review surface is the CHAIN, not the emitted
  file."* Config change ships VISIBLE with rationale (governed act).
- **`managed-paths.mjs`** — the literal `'AGENTS.md'` (travels with brain on upgrade); the backend is already
  covered by `brain/scripts/**`.
- **`runbook-baptism.md`** — the Half-2 operating doc: the permission set to pre-declare, its rollback, the
  hygiene rules, and the composition/host caveat (below).

## The empirical grounding (measured, not assumed)
The design is built on REAL measurements — **Antigravity CLI 1.1.1 · Gemini 3.5 Flash (Medium) · 2026-07-12 ·
host `gandalf`**: Antigravity reads `AGENTS.md` (CLAUDE.md ignored), executes real shell, uses the project
memory, and — the load-bearing evidence — **re-read `AGENTS.md` at decision time and REFUSED a Tier-3-prohibited
commit citing the file + tier, artifact-verified (zero commits)**. So the baptism is evidenced, not a bet.

## CP-B2 evidence
- **Drift-guard has REAL teeth** (fresh review verified by DOING it): a real hand-edit of the committed
  `AGENTS.md` fails the guard (both directions). And the guard's teeth do NOT depend on test ordering — the
  end-to-end dispatch test was made **hermetic** (writes to an injected in-memory writer, never the tracked
  file; `npm test` leaves `git status` clean for `AGENTS.md`; a hand-edit still fails the full suite with no
  test healing it mid-run). The classification is robust, not fragile.
- **Classification ordering:** the drift-guard is committed + green BEFORE the ignoreList classification commit
  (Pin 2 — the chain justifies the classification, so the chain comes first).
- **`npm test` 1441/1441** · `brain:repo:check` · `brain:nav` · `brain:change:verify` green. Counted diff
  **146/400** (`AGENTS.md` excluded post-classification; tests + openspec budget-free). No `size:exception`.

## Pin 4 — read the inaugural `AGENTS.md` once
`AGENTS.md` is a 473-line GENERATED file (the drift-guard covers every future regeneration). The debut file
gets ONE full human/reviewer read to confirm the compilation is faithful — then the guard owns it. Read it in
this PR's diff at repo root.

## Half 2 — the baptism (ready, NOT executed)
`#247` (the chunk→records migration) is completed **through Antigravity ALONE, human as operator** — Claude
Code observes/supports, never co-implements (a four-handed slice contaminates the n=2). **Acceptance:** #247
merged with **ZERO modifications to any governance gate** (a gate that must change is a STOP-finding, not a
workaround). #247 needs its own `status:approved` (scope-check first — verify the 3 chunk-consumer sites are
still the 3). The baptism's memory goes via `plainfiles` (door-typed `agent` — the door telling the truth
about a different agent).

## Honest disclosures
- **Host caveat (load-bearing):** the memory-surface + composition facts are measured on THIS host (engram MCP
  pre-configured; `~/.gemini/GEMINI.md` globals compose with the emitted `AGENTS.md`), NOT factory Antigravity.
  The port proof is stated as host-scoped.
- `brain:audit`: same **2 PRE-EXISTING** `adrPresence` FAILs (`04ae992`/`8d60661`), none new.
- The apply committed as work-units (5 commits); the `memory:share` `.memory/` export was left UNCOMMITTED
  (unrelated bulk history) — excluded from this PR.

## Next
After merge + the inaugural read: **the baptism** — the human runs #247 through Antigravity, and the port's
n=2 becomes a second real inhabitant doing governed work with the gates unchanged. Then **Track B is proven**.
