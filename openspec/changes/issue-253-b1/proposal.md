# Proposal — Wire the Gates Onto the Contract (Track B / slice B1)

> **Status:** planned · **Issue:** #253 (APPROVED with 3 owner pins)
> **Depends on:** #250 / B0 — **MERGED (#252)**. The `sdd-layout.mjs` accessor, the sealed
> `LEGACY_GRANDFATHERED` (12 dirs), the drift-guard (A1+A2), the rehearsal-test suite, and the
> `sdd-layout.md` + ADR-0019 **drafts** (under `issue-250-b0/brain-drafts/`) already exist.
> **Exploration:** measured, not assumed — [[sdd/track-b/contract-inventory]] (engram #584, the 6 sites
> with file:line — this IS B1's exploration). Owner pins [[sdd/issue-253-b1/constraints]] (#595); B0
> ruling [[sdd/issue-250-b0/constraints]] (#587).
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context

B0 wrote the contract down and shipped the accessor — **deliberately unconsumed**. Every layout reader
still carries its own inline `openspec/changes/**` literals (six measured sites across five files, #584
§3); the accessor sits beside them, proven by rehearsal tests but wired to nothing. That was B0's design
("accessor nobody consumes" risk mitigated by construction — helpers are the shape of their future
consumers; precedent C1a shipped the format lib before C1b/C2 wired it, #587). **B1 is the wiring.**

The problem B1 closes is drift-by-omission: as long as the canonical layout lives in six hand-copied
literals, the next contributor edits one and forgets the others (exactly the class of bug B0's contract
exists to kill). B1 makes the gates *read* the single source, adds the last drift-guard rung (A3 —
consumers must reference the module), closes the `new-change.mjs` slug divergence (#584 §4 gap #2), and
promotes B0's two drafts into the doc zone via a human-only co-promotion — so the written contract
becomes the *published* contract.

**B1 is PURE WIRING (Pin A).** No new behavior. The instruction-emission adapter is **B2's** — designed
against the REAL consumer (Antigravity), never an imaginary one. There is no "B1b".

## What this slice ships (2 deliverables)

### Deliverable A — wire the six sites onto the accessor (4 items)

1. **Migrate the six measured sites** onto `sdd-layout.mjs`'s helpers (no inline layout literal left at
   any of them):
   - `check-refs.mjs:96-112` → `missingRequiredArtifacts` + `isGrandfathered` (replaces the ad-hoc
     `['proposal.md','tasks.md']` S-1 loop);
   - `session-start.mjs:38-69` → `parseChangeId` + `CHANGES_ROOT`;
   - `phase-order-check.mjs` → `isGrandfathered` / `LEGACY_GRANDFATHERED` (see item 2) + `CHANGES_ROOT`;
   - `new-change.mjs:48-110` → `changeDir` + `artifactPaths` (the flat `spec.md` emission already landed
     via **#251**; B1 wires the paths and closes the slug gap in item 4);
   - `engram.mjs:804-805 & 925-926` → `changeDir` + `OPERATIONAL_ARTIFACTS` (`resume.md`);
   - `feature-resolution.mjs:37-81` → `changeDir` / `CHANGES_ROOT` + `OPERATIONAL_ARTIFACTS`.
2. **Swap `phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS`** (the 3 dirs, a strict subset of the sealed
   12) for `import { LEGACY_GRANDFATHERED } from '../lib/sdd-layout.mjs'`. Behavior-preserving by
   construction — B0's rehearsal test already proved the 3 are a subset. Consolidate the tripwire's
   `EXEMPT_PATH_RE` here too where it maps.
3. **Add drift-guard A3** (staged from B0, design §3): a test that asserts every one of the six sites
   *references* `sdd-layout.mjs` rather than re-declaring path logic inline — the last rung that keeps
   the contract from re-fragmenting after B1.
4. **Slug fix in `new-change.mjs`:** mandate `issue-<N>-<slug>` at scaffold time (today it falls back to
   bare `issue-<N>` when `--title` is omitted, #584 §4 gap #2).

**Golden proof (Pin A — pinned mechanic).** Behavior preservation is proven over the **REAL CORPUS** —
every `openspec/changes/*` dir (the 12 sealed legacy + the nested-spec dirs + the rest, ~27) — not a
synthetic sample. Capture each gate's verdict per dir BEFORE the wiring and AFTER, and assert the diff is
**ZERO** (the rehearsal/cutover pattern). The B0 rehearsal tests remain the per-site call spec. Synthetic
edge-case fixtures are ADDED on top, never instead of, the corpus proof.

### Deliverable B — the complete-ready co-promotion branch (Pin B)

The agent prepares the **entire** doc-zone diff, ready to open and merge with **ZERO manual editing**
(the #216 errata were born from hand-editing; eliminate the hand-editing surface). The branch contains:

- **ADR-0019** promoted from `issue-250-b0/brain-drafts/adr-draft-harness-port.md` →
  `brain/project/decisions/adr-0019-harness-port.md` with `Status: Accepted`, the promotion banner, an
  ISO date, and the number **re-verified** against BOTH `brain/project/decisions/` (promoted) AND
  `openspec/**/brain-drafts/` (claimed-but-unpromoted) — the standing monotonic rule (#587 item 3).
- **`sdd-layout.md`** moved `issue-250-b0/brain-drafts/sdd-layout.md` → `brain/core/methodology/`.
- **HOME.md + HOME.template.md** nav entries for the promoted doc. These travel WITH the move atomically:
  `brain:nav` integrity fails if the doc exists in `brain/core/**` without its nav entry (B0 measured
  this — task 6.1), so the doc move and the two nav edits cannot be split.

The human's ONLY action is **OPEN + MERGE**. An agent MUST NOT open or merge this branch (CP-B0 doctrine,
[[workflow/doc-zone-promotion-doctrine]]). The agent pushes the branch and hands off the ready-to-open MR
description.

## Non-goals (explicit)

- **B2** — the instruction-emission adapter + the Antigravity baptism (real second-AI harness, #247
  candidate). The adapter is designed against the REAL Antigravity, out of B1 (Pin C, definitive).
- **B3** — deferred (no speculative third adapter).
- **Any change to the sealed set.** `LEGACY_GRANDFATHERED` is CLOSED AND FROZEN at B0; B1 only imports
  and references it — never edits, extends, or reorders it.
- **`VALID_OPS` expansion** — the dispatcher stays single-op (`init`); artifact work is harness-neutral
  by design (B0 reframe).
- **`promotedSpecPath`** (whether the accessor also owns `openspec/specs/<capability>/spec.md`) — an E1
  decision, not B1's.

## Acceptance criteria (CP-B1 — hard stop, PR-as-review, Part of #253)

- [ ] All six measured sites import from `sdd-layout.mjs`; zero inline `openspec/changes/**` layout
      literal remains at any of them.
- [ ] `phase-order-check.mjs` uses `import { LEGACY_GRANDFATHERED }`; `BASELINE_EXEMPT_DIRS` is gone; the
      tripwire's `EXEMPT_PATH_RE` is consolidated where it maps.
- [ ] Drift-guard **A3** is green — grep-asserts every one of the six sites references the module.
- [ ] `new-change.mjs` mandates `issue-<N>-<slug>` at scaffold time.
- [ ] **Golden proof:** gate output over the full real corpus is **byte-identical** before/after
      (diff = ZERO); synthetic edge-case fixtures also green.
- [ ] **Co-promotion branch** prepared complete-and-ready: ADR-0019 `Status: Accepted` + banner + ISO
      date + number re-verified against both registries; `sdd-layout.md` at `brain/core/methodology/`;
      HOME.md + HOME.template.md entries — pushed, NOT opened. Human opens + merges; the agent never
      opens or merges it.
- [ ] Guardrails: docs English (ADR-0009); TDD (the real-corpus golden capture is written/captured FIRST,
      then RED→GREEN per site); **≤400 changed lines, no `size:exception`** (pure wiring); `npm test`,
      `brain:repo:check`, `brain:nav`, `brain:change:verify` green. **STOP at CP-B1.**

## Forks for the owner (the pins nailed scope — these are the residual choices)

- **F1 — golden-capture mechanism (RECOMMENDED, confirm):** a small corpus-capture harness walks every
  `openspec/changes/*` dir and serializes each gate's verdict (check-refs S-1 missing-artifacts list,
  phase-order-check per-dir exempt/status evaluation, session-start `deriveChangeFromBranch` token,
  feature-resolution `resume.md` disambiguation) into a **deterministic, sorted JSON snapshot**. The
  BEFORE snapshot is captured from the pre-wiring tree and committed as a golden fixture; the post-wiring
  test regenerates and asserts `deepEqual`. This is the only way to prove diff=ZERO once the code under
  test is the thing being changed. **Fork:** confirm JSON-snapshot-committed-as-fixture vs. an
  in-test dual-run against a git-stashed baseline (rejected — can't hold both implementations live).
- **F2 — A3 grep shape:** B0 staged A3 but left the exact grep pattern to B1 (tasks "Open items"). Likely
  the B0-staged shape (assert each site file contains `from '../lib/sdd-layout.mjs'`) suffices;
  refinement only if the import path varies by directory depth. **Recommend:** ship the staged shape,
  tighten only if a site's relative path breaks the literal.
- **F3 — co-promotion delivery (RECOMMENDED):** a **dedicated branch off the same base as B1**
  (`feature/v2.0.0`, post-B0), containing ONLY the doc-zone promotion + nav edits, pushed but NOT opened
  by the agent. Beats a patch file (which forces `git apply` + commit — more than "open+merge") and beats
  folding doc-zone into B1's PR (violates the doctrine — doc-zone promotes only via a human MR, and the
  agent must never open/merge doc-zone). Off the base, not off B1, so the two merge in any order.
