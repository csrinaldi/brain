# Design — The Harness Port Contract, Written Down (slice B0)

> **Reads:** [proposal.md](proposal.md) · [spec.md](spec.md) · constraints [[sdd/issue-250-b0/constraints]] (#587) ·
> contract inventory [[sdd/track-b/contract-inventory]] (#584).
> **Reframe honored:** the port is thin BY DESIGN — the harness is a thin wrapper, the SDD artifacts + gates
> are the pure neutral core (Track A's pattern applied to the executor). **Pin honored:** surfaces-are-the-norm,
> op-count-is-state. English (ADR-0009). TDD: the drift-guard and the `plain` dispatch test are RED first.

This design is the HOW at architectural level for the four B0 deliverables. It decides four things the spec
left to design: (1) the exact `sdd-layout.mjs` surface, (2) the drift-guard mechanism, (3) how `plain.mjs`
dispatches and mirrors gentle-ai's seam-injected shape, and (4) the **measured** archive-path value. Task
breakdown is tasks.md.

---

## 1. Architecture approach — one accessor module, thin backend, neutral core untouched

The contract inventory (#584) proved the shape B0 must respect: `harness/cli.mjs` dispatches exactly one op
(`VALID_OPS = ['init']`); `gentle-ai.mjs` exports `_toEngramProject()` + `init()`; ALL artifact work
(scaffold, phase-order, verify, memory) is a single **harness-neutral** implementation NOT routed through the
dispatcher. The owner ruled this is design truth (#585).

B0 therefore adds NO routing, expands NO op surface, and refactors NO neutral gate. It adds:

- **One library module** (`brain/scripts/lib/sdd-layout.mjs`) — the single source of truth for the canonical
  layout constants + path/parse helpers. Pure functions, fs-injectable (mirrors `phase-order-check.mjs`'s DI
  discipline: every I/O op takes/returns POSIX-relative paths, real fs only as the default).
- **One thin backend** (`brain/scripts/harness/backends/plain.mjs`) — a second inhabitant of the existing
  `init` op. It reuses the dispatcher as-is; no `cli.mjs` change is needed.
- **One normative doc** (`brain/core/methodology/sdd-layout.md`) + **one ADR draft** (under the change dir).

Component / data-flow map (B0 slice only — B1 wires the six consumers):

```
                       ┌─────────────────────────────────────────┐
                       │  brain/scripts/lib/sdd-layout.mjs (NEW)  │   ← single source of truth
                       │  REQUIRED_ARTIFACTS · OPERATIONAL_...     │
                       │  LEGACY_GRANDFATHERED (sealed 12)         │
                       │  changeDir · artifactPaths · archivePath  │
                       │  parseChangeId · hasSpec · missing...     │
                       └───────────────┬───────────────┬──────────┘
        imports (B0)                   │               │  imports (B1 — worklist, NOT B0)
        ┌──────────────────────────────┘               └──────────────┐
  sdd-layout.test.mjs (NEW, drift-guard)        phase-order-check.mjs / check-refs.mjs /
        asserts: single source · sealed 12       session-start.mjs / new-change.mjs /
                                                  engram.mjs / feature-resolution.mjs

  SDD_HARNESS=plain ── harness/cli.mjs (UNCHANGED) ── dispatch('plain','init') ── plain.mjs#init()
                       resolveHarness → 'plain'        VALID_OPS unchanged           emits §B manifest
```

---

## 2. `sdd-layout.mjs` — the accessor (D2)

Location `brain/scripts/lib/sdd-layout.mjs`. Pure ESM, no side effects at import, fs-injectable so tests use
plain-data fakes (same discipline as `phase-order-check.mjs:246-282`). Exact export surface:

```js
/** The four artifacts a NEW change dir carries at its root (flat). Source of truth. */
export const REQUIRED_ARTIFACTS = Object.freeze(['proposal.md', 'spec.md', 'design.md', 'tasks.md']);

/** Machine-written, never required, staleness expected & discardable. NEVER a gate condition. */
export const OPERATIONAL_ARTIFACTS = Object.freeze(['resume.md']);

/** Root under which all in-flight change dirs live (POSIX-relative). */
export const CHANGES_ROOT = 'openspec/changes';

// Grandfather = past only. This list is sealed at B0; adding an entry requires
// ADR-level justification — a NEW change dir must never appear here.
/** EXACTLY the 12 legacy dirs measured at B0 (#584) that lack a flat spec.md. CLOSED AND FROZEN. */
export const LEGACY_GRANDFATHERED = Object.freeze([
  'installer-versionado', 'vcs-adapter', 'cli-i18n',        // no spec artifact at all (= today's BASELINE_EXEMPT_DIRS)
  'feature-working-memory', 'auto-adrs', 'governance',       // nested specs/*/spec.md only
  'managed-paths-namespace', 'issue-138-session-start',
  'issue-144-governance-v3', 'install-home-scaffold',
  'issue-193-ci-context-design', 'issue-196-ci-context-impl',
]);
```

Helpers (signature → return):

| Export | Signature | Returns |
|---|---|---|
| `changeDir` | `changeDir(changeId: string)` | `string` — `openspec/changes/<changeId>` (POSIX-relative) |
| `artifactPaths` | `artifactPaths(changeId: string)` | `{ proposal, spec, design, tasks }` — each a relative path under the change dir |
| `archivePath` | `archivePath(iid: string)` | `string` — `openspec/changes/archive/<iid>` (see §5; accessor OWNS this) |
| `parseChangeId` | `parseChangeId(name: string)` | `{ iid, slug } \| null` — parses `issue-<N>-<slug>`; `slug: null` when absent (a violation for new dirs) |
| `isGrandfathered` | `isGrandfathered(changeId: string)` | `boolean` — `LEGACY_GRANDFATHERED.includes(changeId)` |
| `hasSpec` | `hasSpec(changeId, { exists, listDir })` | `boolean` — flat `spec.md` **OR** nested `specs/*/spec.md` (legacy-tolerant reader; scaffold never produces nested) |
| `missingRequiredArtifacts` | `missingRequiredArtifacts(changeId, { exists, listDir })` | `string[]` — the missing REQUIRED_ARTIFACTS; **`[]` for grandfathered dirs (short-circuit, no history rewrite)**; uses `hasSpec` for the spec slot so a grandfathered nested spec still counts |

Design decisions:

- **Legacy-tolerance lives in `hasSpec`, not in the caller.** The reader accepts nested `specs/*/spec.md`;
  `missingRequiredArtifacts` delegates the spec slot to `hasSpec`. This is the ONE place the nested variant is
  tolerated, matching Pin 1: readers tolerate, the scaffold never produces.
- **Grandfather short-circuit is inside `missingRequiredArtifacts`.** A NEW dir (not in the sealed list) missing
  any artifact returns the missing names; a listed dir returns `[]`. "The past is recorded, not edited."
- **`Object.freeze` on every constant** so a consumer cannot mutate the shared source of truth at runtime.
- **`archivePath` is a builder, not a literal spread across gates** — the accessor is the single owner (§5).

---

## 3. The drift-guard — a TEST, not a lint rule (D2)

**Decision: a Node test file `brain/scripts/lib/sdd-layout.test.mjs`, run under `npm test`. Rejected: a custom
ESLint rule.**

Justification (test-asserts-imports wins here):

1. **House pattern.** brain's existing drift guards ARE tests — `phase-order-check.test.mjs`, the
   `plainfiles-actorkind-doc-tripwire.test.mjs` tripwire. A lint rule would be a novel, heavier mechanism for
   the same job. Consistency and zero new infra.
2. **The assertions a lint rule cannot cleanly express.** The seal is "`LEGACY_GRANDFATHERED` equals EXACTLY
   these 12 dir names" — a set-equality assertion. `assert.deepEqual` states it in one line; an ESLint rule
   cannot assert value-equality against a frozen expectation without becoming a bespoke plugin.
3. **Budget + TDD.** A test costs nothing toward the ≤400 counted budget (`**/*.test.mjs` is in
   `governance.ignoreList`), and it is written RED first (import fails because the module does not exist yet).

The guard has three assertions, staged to honor the B0/B1 boundary:

- **A1 — single source (blocking, B0).** Scan `brain/scripts/**/*.mjs` (excluding `sdd-layout.mjs` itself and
  `*.test.mjs`) for a rival literal array of the artifact names (regex over source text for an array literal
  containing `'proposal.md'` alongside `'tasks.md'`). Any match FAILS, naming the offending file — proving
  `sdd-layout.mjs` is the only definition. (Spec REQ-B0-2 scenario 1.)
- **A2 — sealed set (blocking, B0).** The test hardcodes the 12 measured-at-B0 dir names as the frozen
  expectation and asserts `deepEqual([...LEGACY_GRANDFATHERED].sort(), THE_12.sort())`. A 13th entry, a removal,
  or a typo FAILS. This test IS the lock's teeth: a NEW dir added to the allowlist is rejected here.
  (Spec REQ-B0-3 scenario 3.)
- **A3 — consumers reference the module (documented, enforced in B1).** The scattered exempt-lists
  (`phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS`, the tripwire's `EXEMPT_PATH_RE` where applicable) do NOT
  migrate in B0 — that is the B1 worklist. B0's guard asserts the module EXPORTS `LEGACY_GRANDFATHERED` and that
  no NEW rival exempt-list literal is introduced; the "every consumer imports it" grep lands with the B1
  migration. Recorded as a B1 worklist item, not a B0 blocker.

**Consolidation note (for B1, decided now).** `phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS` (3 dirs:
`installer-versionado`, `vcs-adapter`, `cli-i18n`) is a strict SUBSET of the sealed 12 — those three are the
only ones with NO spec at all, so they are the only ones that fail phase-order's spec-presence gate (the other
nine have nested specs phase-order already tolerates). B1 can therefore replace `BASELINE_EXEMPT_DIRS` with an
import of `LEGACY_GRANDFATHERED` with NO behavior change: the nine extra entries simply never trigger a
downgrade in phase-order because they never produce a `fail` there. One greppable place, semantics preserved.

---

## 4. `plain.mjs` — a real dispatchable backend (D4)

Location `brain/scripts/harness/backends/plain.mjs`. **No `cli.mjs` change is required** — the dispatcher is
already backend-agnostic:

```
SDD_HARNESS=plain node brain/scripts/harness/cli.mjs init
  → resolveHarness({env}) returns 'plain'                       (cli.mjs:45-47, unchanged)
  → defaultBackendLoader('plain') imports ./backends/plain.mjs  (cli.mjs:61-70, unchanged)
  → dispatch checks VALID_OPS.includes('init') → true           (cli.mjs:52,86, unchanged)
  → kebabToCamel('init') === 'init' → calls backend.init()      (cli.mjs:92-101, unchanged)
```

`init()` mirrors gentle-ai's **seam-injected shape** (`gentle-ai.mjs:221` takes an opts object of injectable
default functions) so the dispatch test is hermetic — it injects a capturing fake instead of touching real
stdout/fs:

```js
/** The nine docs/workflow-guide.md §B manual-flow steps (#584 §5) — the manifest. */
const MANUAL_FLOW_STEPS = [ /* 1..9, verbatim from §B */ ];

/**
 * plain backend init: emit/install the manual-flow manifest. Zero AI provider,
 * zero network, zero tool beyond the repo's own npm verbs.
 * @param {{ _emit?: (line: string) => void }} [opts] Injectable sink (default console.log).
 */
export async function init({ _emit = console.log } = {}) {
  _emit('SDD_HARNESS=plain — manual flow (no AI). Run these npm verbs in sequence:');
  MANUAL_FLOW_STEPS.forEach((step, i) => _emit(`  ${i + 1}. ${step}`));
}
```

The nine steps (source: `docs/workflow-guide.md` §B `:46-99`, cross-checked #584 §5):

1. `npm run brain:env:init` — one-time bootstrap.
2. `npm run brain:session:start` — open the session (read-only, local).
3. `npm run brain:ticket:start -- <id>` — take the issue, create the branch.
4. `npm run brain:project:feature -- --issue <id>` — scaffold the change dir.
5. Edit the four artifacts by hand, in order: `proposal.md` → `spec.md` → `design.md` → `tasks.md`.
6. Implement the code, checking off `tasks.md` items as you go.
7. `npm run brain:repo:check` + `npm test` + `npm run brain:change:verify` — the gates.
8. `npm run memory:share` — persist team memory before pushing.
9. Commit + open the PR with `Closes #<id>`.

Design decisions:

- **`emit`, not `install`, for B0.** The spec allows "emit OR install". Emitting to stdout is the smallest real
  proof of dispatch, needs no target-path decision, and keeps `plain.mjs` free of fs writes (lower budget,
  fewer edge cases). A future `install` (writing a manifest file) is a legitimate extension — it would serve the
  **instructions** surface, so it stays inside the port contract (ADR §4).
- **Seam parity with gentle-ai** — `init({ _emit } = {})` matches gentle-ai's injectable-opts convention exactly,
  so the two backends present the same testing seam. The dispatch test asserts (a) end-to-end via the real
  `dispatch('plain', 'init', [])` path proving the wiring, and (b) unit-level with an injected `_emit` fake
  asserting all nine steps are emitted — written RED first.
- **No `VALID_OPS` expansion** — the reframe (proposal §"dissolves an apparent scope-gap"): `init` is the only op
  the port needs; n=2 is proven on `init` itself.

---

## 5. Archive-path VALUE — MEASURED, not guessed (owner pin, extra #1)

The accessor OWNS the location; the value is decided here from measurement so E1 (unbuilt, `brain:change:archive`)
consumes it rather than inventing a second source.

**Command evidence (run 2026-07-12, branch `feat/issue-250-b0`):**

- `Glob openspec/changes/archive/**` → **No files found** — no archive directory exists today.
- `Glob openspec/changes/*` → only `.gitkeep` (as a file) plus the 28 top-level change dirs; **zero** live under
  an `archive/` subtree.
- `grep -i archive docs/inbox/PLAN-adapters-v3.md` → **§E1 line 361 (verbatim):** *"Moves a completed change to
  `openspec/changes/archive/<iid>/` and merges its delta specs into `openspec/specs/<capability>/spec.md`…"*
  (E1 depends on B1, reads the layout through `sdd-layout.mjs`; §E1 line 360.)

**Decision:** `archivePath(iid)` returns **`openspec/changes/archive/<iid>`**. It matches §E1's stated
destination and there is no conflicting on-disk reality to reconcile (nothing archived yet). The accessor is the
single owner; E1 imports `archivePath`, never re-declaring the literal.

**Scope boundary (open item for tasks/B1, recorded):** §E1 also names a spec-promotion target
`openspec/specs/<capability>/spec.md` (create-or-append with provenance). That is a SEPARATE concern from the
archive DIR path and is NOT pinned for B0. B0's accessor owns `archivePath` only; a future `promotedSpecPath`
export can be added when E1 is built. Flagged so E1 does not invent it independently.

---

## 6. `resume.md` — operational, outside `REQUIRED_ARTIFACTS` (extra #2)

`resume.md` is represented by the separate `OPERATIONAL_ARTIFACTS = ['resume.md']` const (§2), never inside
`REQUIRED_ARTIFACTS`, and never consulted by `missingRequiredArtifacts`. `sdd-layout.md` (D1) documents it in a
distinct "Operational / ephemeral" subsection: machine-written by memory checkpoint/resume
(`engram.mjs:805/:926`), used as a disambiguation signal when >1 active change exists
(`feature-resolution.mjs:81`), staleness expected and discardable, NEVER a gate condition. Keeping it a named
export (not just prose) means a future gate that needs to recognize-but-ignore `resume.md` reads it from the one
source too — no fourth scattered literal.

---

## 7. The ADR draft (D3) — outline + location

**Location:** `openspec/changes/issue-250-b0/brain-drafts/adr-draft-harness-port.md`. It is a DRAFT under the
change dir (so excluded from the ≤400 budget — `openspec/changes/**` is in `governance.ignoreList`). Promotion to
`brain/project/decisions/adr-0019-harness-port.md` happens at B1/archive; the next free number is **ADR-0019**,
VERIFIED against both `brain/project/decisions/` (promoted) and `openspec/**/brain-drafts/` (claimed): 0017 =
memory-format (Accepted), 0018 = gitlab-governance-pipeline (A2 draft), 0019 = free. Monotonic forever — numbers
are never reused. Finalized at promotion.

**Outline:**

1. **Title / Status** — "ADR-0019 (draft) — The `SDD_HARNESS` port: four environment surfaces, artifacts neutral
   by design." Status: Draft (proposed in #250 / B0).
2. **Context** — the measured finding (#584): `VALID_OPS = ['init']`; `gentle-ai` exports only
   `_toEngramProject()` + `init()`; scaffold / phase-order / verify / memory are a single harness-neutral
   implementation NOT routed through the dispatcher. The thinness looked like an accident and invites "fixing".
3. **Decision** — the SIGNED wording verbatim (spec REQ-B0-4 / Fork A / #587):
   > The `SDD_HARNESS` port is the boundary through which a backend owns exactly four surfaces of the development
   > environment — and NOTHING in the SDD artifact lifecycle: (1) Instructions … (4) Capabilities … Today that
   > boundary is carried by a single operation (`init`); new operations may be added only when they serve one of
   > the four surfaces. Everything downstream — scaffold, phase-order, verify, archive — is harness-neutral and
   > runs identically regardless of `SDD_HARNESS`. The canonical `openspec/` layout is the fixed evidence
   > contract; harnesses normalize INTO it, they never reshape it.
4. **The four surfaces** — Instructions, Bootstrap, Memory, Capabilities — stated as the NORM (the invariant a
   backend is judged against). The single-`init`-op is current STATE, not a ceiling.
5. **Rationale — the REQUIRED analogy (Pin 3):** this is Track A's split (pure evaluators + thin provider
   wrappers) applied to the EXECUTOR — the harness is the thin wrapper, the SDD artifacts + gates are the pure
   neutral core. The thin port is INTENTIONAL, not accidental.
6. **Consequences** — new ops allowed ONLY to serve a surface; the neutral core runs identically under any
   backend; the canonical `openspec/` layout is the fixed evidence contract harnesses normalize into; `plain` +
   `gentle-ai` prove n=2 on `init`.
7. **Rejected alternatives** — (a) expand `VALID_OPS` to route scaffold/verify per-backend (rejected: inflates
   the port, contradicts neutral-by-design, #585); (b) treat single-`init`-op as the normative ceiling (rejected:
   a legit future surface op — e.g. doctor, memory-wire — would need an ADR amendment for something the four
   surfaces already permit, #587).
8. **Evidence** — links to #584, #585, #587; `harness/cli.mjs:52`, `gentle-ai.mjs:74,221`.

---

## 8. Budget estimate (extra #7) — TIGHT, flagged

`governance.ignoreList` (brain.config.json) excludes from the diff-size gate: `**/*.test.mjs`,
`openspec/changes/**`, `.memory/**`, lockfiles. Therefore:

| Artifact | Path | Counts? |
|---|---|---|
| accessor | `brain/scripts/lib/sdd-layout.mjs` | **YES** |
| plain backend | `brain/scripts/harness/backends/plain.mjs` | **YES** |
| normative doc | `brain/core/methodology/sdd-layout.md` | **YES** (`core/methodology` not in ignoreList) |
| drift-guard test | `brain/scripts/lib/sdd-layout.test.mjs` | no (`*.test.mjs`) |
| plain dispatch test | `brain/scripts/harness/backends/plain.test.mjs` | no (`*.test.mjs`) |
| ADR draft | `openspec/changes/issue-250-b0/brain-drafts/…` | no (`openspec/changes/**`) |
| design/spec/proposal/tasks | `openspec/changes/issue-250-b0/…` | no (`openspec/changes/**`) |

Counted-line estimate: `sdd-layout.mjs` ~130–150 · `plain.mjs` ~50–70 · `sdd-layout.md` ~90–120 → **~270–340**.
Fits under 400 with headroom, **but the doc is the swing factor**: if `sdd-layout.md` runs verbose it can push
the total toward the ceiling. **Mitigation (binding for apply):** keep `sdd-layout.md` ≤ ~110 lines and JSDoc
lean; the biggest prose (the ADR) is already budget-free under `openspec/changes/**`. If the running total
crosses ~380, split narrative prose from `sdd-layout.md` into the ADR draft (free) rather than take a
`size:exception`. No `size:exception` is expected.

---

## 9. Open items for tasks.md

- **RED-first order** — write `sdd-layout.test.mjs` (A1 single-source + A2 sealed-12) and `plain.test.mjs`
  (dispatch + nine-step emit) BEFORE their modules exist; confirm they fail for the right reason.
- **B1 worklist to hand off** (do NOT implement in B0): migrate the six measured sites onto the accessor +
  replace `BASELINE_EXEMPT_DIRS` with `import { LEGACY_GRANDFATHERED }`; add A3 (consumers-reference-the-module)
  grep to the drift-guard; fix `new-change.mjs` to (a) write `spec.md` and (b) mandate the slug.
- **`promotedSpecPath`** — decide at E1 whether the accessor also owns `openspec/specs/<capability>/spec.md`
  (recorded §5); NOT B0.
- **ADR number** — reserve ADR-0019 at promotion (B1/archive; 0017/0018 already taken — verified). Not baked
  into the B0 draft filename beyond a tentative label.
- **Budget watch** — track running counted lines during apply; hold `sdd-layout.md` ≤ ~110 lines (§8).
