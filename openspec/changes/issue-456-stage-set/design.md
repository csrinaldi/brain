# Design: #456 slice A — the SDD stage set becomes data

> Citations name symbols, not line numbers (`reviewer-protocol.md` §2, #580). The
> line numbers carried in the issue thread and in ADR-0019 Amendment 1 are
> reproduced nowhere below, deliberately — see "Recorded, not resolved".

**Ruling this design is written to** (maintainer, 2026-08-29, engram
`sdd/issue-456-stage-set/ruling-additive-only`): `sdd.stages` is **additive-only**.
A consumer may declare stages beyond the four; it may never remove one. And the
constraint is **executable, not commented**, per ADR-0019 Amendment 1 condition 4 —
*"The refusal is replaced, not removed… everything above is doctrine until something
refuses on its behalf."*

---

## §1 — Two measurements that reshape the slice

### The set is declared THREE times, and the guard is blind to TWO of them

| # | Symbol | Notation | Seen by the drift guard? |
|---|---|---|---|
| 1 | `sdd-layout.mjs` → `REQUIRED_ARTIFACTS` | `.md` filenames | owning module — excluded by design |
| 2 | `stage-engine.mjs` → `SDD_LIFECYCLE_STAGES` | bare names | **No** |
| 3 | `phase-order-check.mjs` → `STANDARD_ARTEFACTS` | bare names | **No** |

The proposal found two and named the notation blind spot. It missed the third. The
guard's `ARTIFACT_NAMES` scan matches **with `.md`**, so *every* bare-name
declaration is invisible to it — and `sdd-layout.md` nonetheless claims the guard
*"fails if a second, independent definition of the required-artifact set appears
anywhere else in `brain/scripts/**`."* That claim was false by a factor of two.

**They are one value with three meanings**, and that distinction drives D2:

- (1) is the **SCAFFOLD** set — what `brain:project:feature` writes.
- (2) is **the four ADR-0019 protects** — `assertRoutableStage`'s refusal input.
- (3) does **two jobs at once**: the pre-tiering default for an injection seam, and a
  **positional sentinel** that preserves an exact legacy message literal.

### The eleven importers do not import the set

| What the eleven import | Files | Touches the set? |
|---|---|---|
| `CHANGES_ROOT`, `parseChangeId`, `changeDir`, `archivePath`, `isGrandfathered`, `OPERATIONAL_ARTIFACTS`, `artifactPaths` | `session-start`, `engram`, `feature-resolution`, `archive-sweep`, `archive-logic`, `new-change` | **No** |
| `missingRequiredArtifacts` + `requiredArtifactsFor(tier)` | `check-refs`, `review/evaluators/checkpoint` | No — that is the **GATE** set |
| `artefactFiles` over `tierParams(tier).artefacts` | `governance-tiers`, `phase-order-check` | No — **GATE** again |

**`REQUIRED_ARTIFACTS` has zero production importers.** It is imported by
`sdd-layout.test.mjs` and cited as a *string* by the checkpoint evaluator. The eleven
import the *layout*; they do not import the *set*.

So slice A's real surface is **three production files plus the migration**, and every
gate path is untouched — which is not a convenience, it is the constraint.
Amendment 1's *"What this amendment does NOT authorise"* says a stage that writes
into `openspec/changes/**` and expects the shared readers to find it *"changes what
the gates demand… not authorised here."* A slice A that moved a gate would be doing
the forbidden thing. **The set becomes data; what the gates demand does not move.**
SCAFFOLD · GATE · routable stay three sets (REQ-L4-2′).

---

## §2 — Architecture decisions

### D1 — The resolved set lives in `sdd-layout.mjs`, as a PURE function over a config passed in

**Choice**: `sdd-layout.mjs` gains `LIFECYCLE_STAGES` (bare names — the one
declaration) and `resolveStageSet(config)`, pure, config **received**, never read.
The edge loads `brain.config.json`; the accessor resolves.

**Rejected — `sdd-layout.mjs` reads config itself.** The module header promises
*"Pure ESM, no side effects at import"*, and `requiredArtifactsFor`'s own docstring
records what happened last time someone crossed that line: importing `brain-config`
drags in `repo.mjs` + `installer.mjs` + `config-migrations.mjs`, *"four modules into
one that promises none. The first attempt at #555 did exactly that and the fixture
caught it."* The tree has already paid this bill once.

**Rejected — a new resolver module beside the accessor.** `sdd-layout.md` names
`sdd-layout.mjs` as the ONE module exporting the set. A second accessor for the same
set is the rival definition the drift guard exists to catch, wearing a filename
instead of a literal.

**Cost, named**: config resolution moves to every caller that wants a non-default
set, and slice A ships exactly one such caller (the validation entry point). A caller
that forgets to pass config silently receives the default four. Tolerable only
because the default *is* the right answer for every consumer in the tree today; slice
B, which has a caller that genuinely differs, must revisit this.

**Hard constraint discovered**: `cites-resolve.test.mjs` asserts
`probe('sdd-layout.mjs', 'REQUIRED_ARTIFACTS') === true`, because the checkpoint
evaluator cites that symbol and *"a citation that does not resolve sends the reader to
the wrong place — worse than no citation at all"* (§6.1, #580). `REQUIRED_ARTIFACTS`
therefore **stays an `export const`**, re-derived as `artefactFiles(LIFECYCLE_STAGES)`.
It cannot become a function.

### D2 — A THREE-way collapse onto `LIFECYCLE_STAGES`, and the third one is not what it looks like

**Choice**: `sdd-layout.mjs` owns the declaration. The other two import it.

| Declaration | Becomes | Behavioural delta |
|---|---|---|
| `REQUIRED_ARTIFACTS` | `artefactFiles(LIFECYCLE_STAGES)` | none — same four files, symbol preserved |
| `SDD_LIFECYCLE_STAGES` | re-export of `LIFECYCLE_STAGES` | none — name survives, literal dies |
| `STANDARD_ARTEFACTS` | import of `LIFECYCLE_STAGES` | none — see below |

**Direction, and why not the reverse**: the set's meaning is *artefact contract*, and
`artefactFiles`'s refusal is what makes a name real. That lives in `sdd-layout.mjs`.
`stage-engine` is the router and `phase-order-check` is a gate; both consume the
contract, neither defines it.

**Cycle check**: `sdd-layout.mjs` imports only `node:fs`/`node:path`.
`stage-engine.mjs` imports nothing today; `phase-order-check.mjs` already imports
`sdd-layout.mjs` (`artefactFiles`, `archivePath`, `CHANGES_ROOT`,
`LEGACY_GRANDFATHERED`). Both edges point one way. **No cycle.**

**Cost, named**: `stage-engine.mjs` — today importing nothing at all — gains a
transitive `node:fs` edge. Module-graph weight, not behaviour: `sdd-layout` performs
no I/O at import (its `fs` use is default-parameter functions only). Paid knowingly,
because the alternative is a third module holding four strings, which is D1's
rejected option wearing a smaller hat. `phase-order-check` pays nothing — the import
already exists; only the named bindings grow.

**Why `assertRoutableStage` needs no change, and this is load-bearing.** It must
refuse *the four*, always — and additive-only guarantees the four are always present,
whatever a consumer declares. A consumer's **extra** stages are exactly the ones that
SHOULD be routable (`cold-review` is the standing precedent). So the refusal's input
is `LIFECYCLE_STAGES`, never the resolved set. Its tests stay green **unmodified**;
Amendment 1's condition 4 is not touched, let alone lifted.

**The subtlety in the third declaration.** `STANDARD_ARTEFACTS` serves two roles, and
only one of them is "the lifecycle set":

```js
// role (ii): a POSITIONAL sentinel, not a set
if (artefacts.length === STANDARD_ARTEFACTS.length && artefacts.every((a, i) => a === STANDARD_ARTEFACTS[i]))
  return 'spec.md/design.md';   // the exact pre-tiering literal, regression-pinned
```

Collapsing role (ii) onto a *resolvable* set would tie a regression-pinned string to
a value a consumer can change. It does not, and cannot, because **`LIFECYCLE_STAGES`
is not resolvable**: it is the four, in code, in canonical order, permanently. The
resolved set is `resolveStageSet(config).stages` — a different value from a different
function. Deriving the sentinel from `LIFECYCLE_STAGES` is therefore byte-identical
forever, and the three collapse to one *genuinely*, not by relabelling.

**Rejected — keeping `STANDARD_ARTEFACTS` as a frozen "historical fixture" with a
drift-guard allowlist entry.** Defensible (it really is a test oracle living in
production code) but it preserves a bare-name literal for a distinction that has no
consequence, and it spends an allowlist slot whose scarcity is the mechanism's value.

### D3 — A declared stage carries its own artefact file; `ARTEFACT_FILE` stays frozen

**Choice**: `sdd.stages` is an object keyed by stage name, symmetric with `sdd.map`:
`{ "threat-model": { "artefact": "threat-model.md" } }`. `artefactFiles` gains an
optional second parameter — `artefactFiles(names, fileMap = ARTEFACT_FILE)` — and
resolution builds `{ ...ARTEFACT_FILE, ...declared }` **per call**. `artefact` is
optional: absent means "look it up in `ARTEFACT_FILE`", which is what the four do.

**Rejected — seeding `ARTEFACT_FILE` from config.** It makes a frozen constant
config-dependent for *every* caller including the GATE path, and unfreezes the one
map #555 round 2 exists to hold still.

**The refusal is intact, and that was the requirement.** A name absent from the
merged map still throws *"unknown artefact name… Appending `.md` would invent a path
no gate probes"*. Amendment 1 calls that sentence *"the whole test"*. What changed is
**which** map is consulted; that map is always explicit, and the default one is
byte-identical to today's five entries.

**Cost, named**: slice A ships `artefact` **validated but unconsumed** — no gate,
scaffold or reader acts on it, because Amendment 1 does not authorise a new artefact
joining the contract. That is the shape `sdd.map` shipped in at `0.10.0`: the router
key landed before anything routed. A field nobody reads is a real smell; the defence
is that the alternative is slice B declaring the field *and* wiring it in one PR,
which is the collapse this slicing exists to prevent.

### D4 — Migration `1.2.0`, additive, default `{}`

> **Amended after the design was written.** This decision originally numbered the
> migration `0.11.0`, following the sequence counter every prior entry used. #806's
> ruling (signed 31/08/2026, candidate D) ends that counter: a migration is numbered
> with the release it ships in. The package is at `1.1.0`, so this key ships in `1.2.0`.
>
> The design was not merely inconsistent — it was wrong, and the investigation that
> produced #806 started from this very decision. `migrateConfig` seals `schemaVersion`
> with the installed package version and reads that same field as the migration window's
> lower bound. A migration numbered `0.11.0` is below the floor of any consumer sealed
> at `1.1.0` and would never run for them: the code would read `config.sdd.stages` while
> no schema-valid config for that population could carry it — #643's defect, arriving
> inside the change meant to avoid it. Nothing else in D4 changes.

Follows `config-migrations.mjs` `0.10.0` (`sdd.map`) exactly:

```js
{
  version: '0.11.0',
  description:
    'Add sdd.stages: the declared stage set (issue #456 slice A). Empty by ' +
    'default — the four lifecycle stages live in code (sdd-layout.mjs ' +
    'LIFECYCLE_STAGES), never in a consumer config, so an upgrade cannot ' +
    'introduce a fourth declaration of them in a file no test can guard. ' +
    'ADDITIVE-ONLY: a declared set omitting one of the four is REFUSED ' +
    '(maintainer ruling 2026-08-29; ADR-0019 Amendment 1 condition 4).',
  defaults: { sdd: { stages: {} } },
}
```

**Why `{}` and not the four written out.** Shipping the four into every consumer's
`brain.config.json` would create a fourth declaration of the set — in JSON, where the
drift guard (which scans `brain/scripts/**/*.mjs`) cannot see it. The default must be
the *absence* of a declaration. `0.11.0` is the next number; versions are
content-identifiers and are never reused (the `0.6.0` note in that file).

**This repo is the zero-config fixture**: `brain.config.json` carries no `sdd` key at
all (`schemaVersion: 0.3.0`, `governance.tier: lite`). Brain's own suite is the
identity test, and at `lite` it also exercises SCAFFOLD ≠ GATE live — four scaffolded,
`['spec.md']` demanded.

### D5 — The refusal lives in `resolveStageSet`, and names the missing stages

**Where**: inside `resolveStageSet(config)` — the only function that turns config
into a set. There is no second way to obtain one, which is what makes it
unbypassable; a consumer reading `config.sdd.stages` directly is caught by D6's scan
plus the existing A3 import-shape assertion.

**Semantics — FULL SET, not delta.** A declared `sdd.stages` enumerates the whole
set; omitting one of the four is refused. Delta semantics (only *extra* stages are
declared, so omission is structurally impossible — you cannot remove what you cannot
name) is arguably stronger and is **rejected** for two reasons: the maintainer ruled
for a refusal that must *name which of the four are missing*, which under delta
semantics could never fire; and M8 S2 must *"reject undeclared stages"*, which wants
one list to validate against rather than a union recomputed at each call site.

**Cost, named, and its mitigation**: full-set semantics means a consumer who wants
one extra stage must repeat the four in their config — the literal reappears in a
fourth place. The mitigation is structural, not procedural: the refusal compares
against `LIFECYCLE_STAGES`, the one declaration, so a config copy **cannot silently
diverge**. It either matches-and-extends or it is refused at resolution. Verbose,
undriftable.

Three refusals, each naming the offender:

| Refusal | Fires on | Protects |
|---|---|---|
| **omission** | declared set missing any of `proposal`/`spec`/`design`/`tasks` | the ruling; the message names each missing stage |
| **relative order** | the four present but not in lifecycle order | see D5a — a real positional dependency |
| **file collision** | a declared `artefact` equal to a lifecycle file | a custom stage impersonating a gate artefact *is* "changes what the gates demand" |

Message shape (omission):

```
sdd-layout: sdd.stages omits lifecycle stage(s) "design", "tasks" — the SDD stage
set is ADDITIVE-ONLY. A consumer may declare stages beyond the four; it may not
remove one. Removing a lifecycle stage changes what the gates demand, which
ADR-0019 Amendment 1 ("What this amendment does NOT authorise") withholds and
#456's ruling settled. Declare all four and add yours alongside them.
```

### D5a — Reorder is REFUSED, not normalized. This corrects the spec.

**The spec, already written, says reorder is accepted and normalized to canonical
order (membership-only check), on the assumption that nothing ties behaviour to
position. That assumption is wrong**, and §1 names the thing that ties:
`messageForArtefacts`'s positional sentinel. Its outcome is narrow — it selects
between the exact pre-tiering literal `'spec.md/design.md'` and the computed form —
but that literal is regression-pinned by `phase-order-check`'s own tests, which
*"assert that literal substring regardless of which of the four flags actually
failed."* A set arriving reordered falls out of the legacy branch silently and flips
a pinned string. The gate's **verdict** does not depend on order; the gate's
**message** does.

**Choice: refuse a declared set whose four are out of relative order.** Interleaving
a custom stage between them stays legal — `[proposal, threat-model, spec, design,
tasks]` is fine; `[tasks, design, spec, proposal]` is refused.

**Rejected — normalize to canonical order**, for three reasons in ascending weight:

1. **It is not well-defined once custom stages exist.** Given
   `[tasks, design, threat-model, spec, proposal]`, sorting the four into canonical
   order leaves no principled answer for where `threat-model` lands. Membership-only
   checks work for a set of exactly four; the entire point of `sdd.stages` is that it
   is not exactly four.
2. **It silently rewrites what the operator wrote.** This repo's standing posture is
   the opposite: `resolveTier` fails closed on a typo rather than defaulting, because
   *"a typo in `governance.tier` must never quietly downgrade a repo's doctrine."*
   Reordering a consumer's declaration behind their back is the same shape of harm
   one layer over.
3. **What normalization was protecting is already protected more cheaply.** Under D2
   the sentinel compares against `LIFECYCLE_STAGES`, which is canonical by
   construction and not resolvable — so in slice A the sentinel never receives a
   consumer-ordered array at all. Normalization would be defending a door that D2
   welds shut.

**Say plainly what the order refusal protects**: it guarantees that no array whose
order a consumer chose can ever reach a comparison whose output depends on position.
Today there is exactly one such comparison in the tree, it lives in a gate that runs
on every PR, and the spec did not know it was there. The refusal is cheap, its
failure mode is a loud error naming the expected order, and it costs a consumer only
the inconvenience of listing four names in the order the lifecycle already runs them.

> **`sdd-tasks` must carry this back**: the spec's normalization requirement needs
> amending to a refusal requirement. Design and spec disagree today, and the design
> is the measured side.

### D6 — The drift guard gains a SECOND scan, and an allowlist that states REQ-L4-2′

**Choice**: `scanForRivalStageArray`, a new scan beside A1, not a widened A1.
Following `__fixtures__/tmp-tree-adoption.test.mjs` (#802) as the in-tree precedent —
*"a bounded-window scan, not a parser"*, chosen there over a `[^)]*` character class
that breaks on nested parens:

1. Same `BRACKET_RE` array-literal window. Prose is excluded **by construction**: a
   comment reading "the four stages proposal, spec, design, tasks" is not inside
   `[...]`.
2. Tokens must be **quoted** (`'proposal'` / `"proposal"` / `` `proposal` ``). A
   comment that *does* sit inside a bracket still carries no quotes; a real rival
   literal always does. This is the specific defence against the false-positive
   machine the brief warned about.
3. Same 3-of-4 threshold, and the same documented split-literal limit A1 already
   accepts rather than chases — *"chasing the split-literal case risks new false
   positives (the guard's actual death mode)."*
4. **An allowlist with a written reason per entry**, exactly `tmp-tree-adoption`'s
   mechanism: repo-relative paths resolved at scan time, plus its proof test that an
   allowlisted file does not trip while a non-allowlisted twin does.

**The allowlist has exactly one entry, and it is the point.**
`governance-tiers.mjs`'s `TIER_PARAMS` declares `['proposal','spec','design','tasks']`
at `standard` and five at `regulated`. That is a **4-of-4 hit and it is legitimate**:
it is the GATE set, which REQ-L4-2′ deliberately separates from the SCAFFOLD set —
*"the tier scopes what the GATE demands, never what the SCAFFOLD produces."* #555's
first cut collapsed exactly these two. The allowlist entry's reason therefore becomes
the executable statement of that separation, pinned where the next author who tries
to "clean up the duplicate" will read it *before* doing so.

**Neither `stage-engine.mjs` nor `phase-order-check.mjs` is allowlisted** — both must
stop declaring. This scan is what proves D2 actually happened, which is why it lands
after both migrations, not before.

**Rejected — excluding `governance-tiers.mjs` wholesale**: blinds the scan to any
*future* rival in that file. An allowlist exempts a call site; an exclusion exempts a
file.

**Rejected — an AST-based structural guard**: a new dependency and a second shape for
a job the repo already has one shape for (`installed-package-root.test.mjs` mirrors
A1 *"rather than inventing a second shape for the same job (#340)"*).

### D7 — Order of work, and where the risk sits

Nine of the eleven importers are **not touched at all**, and proving that is itself a
step. The order below keeps `npm test` green after every one:

| # | Step | Green because |
|---|---|---|
| 0 | `sdd-layout.mjs`: `LIFECYCLE_STAGES`, `resolveStageSet`, `artefactFiles(names, fileMap)`; `REQUIRED_ARTIFACTS` re-derived | pure addition; value byte-identical, symbol preserved for `cites-resolve` |
| 1 | `stage-engine.mjs`: literal → re-export | `stage-engine.test.mjs` and `run-stage.test.mjs` import `SDD_LIFECYCLE_STAGES` unmodified; `assertRoutableStage` untouched |
| 2 | `phase-order-check.mjs`: `STANDARD_ARTEFACTS` → import | **the seam already exists** — see below |
| 3 | migration `0.11.0` + migration test | additive; brain's own config gains nothing it reads |
| 4 | drift guard: second scan + allowlist + traps | fails if step 1 **or** step 2 was skipped — that is its job |
| 5 | REQ-L4-2′ assertion in both directions (SCAFFOLD ≠ GATE at `lite`) | asserts existing behaviour |
| 6 | Prove the six set-blind importers need no change | assertion, not edit |

**Step 2 is one line, not a rewrite, and that is measured.** `evaluateRuleA(impl,
touchedDirs, artefacts = STANDARD_ARTEFACTS)` and `evaluatePhaseOrder({ …, artefacts =
STANDARD_ARTEFACTS })` **already accept the set as a parameter** — only the default is
hardcoded, and the production caller `runPhaseOrderCheck` already passes
`tierParams(tier).artefacts`. So the injection seam this slice would otherwise have to
build was built by #358 Q5. The migration is: delete the local `const`, add
`LIFECYCLE_STAGES` to the existing `sdd-layout.mjs` import, rename the two default
expressions. Every call site and test keeps working because the value is identical.

**Riskiest, in order.**

1. **The drift guard.** `local-checks` is `required` at every tier, so a false
   positive blocks *every* PR in the repo. Mitigated by writing the traps first,
   `tmp-tree-adoption`-style, before the real scan is trusted.
2. **`phase-order-check.mjs`.** `phase-order` is `required` at standard/regulated and
   `detection` at `lite`, and this file holds the tree's only positional dependency
   (D5a). A default swap that changed identity or order would flip a regression-pinned
   message literal — a failure that reads as a string diff, not as a logic error.
3. **`stage-engine.mjs`.** Four test files depend on `SDD_LIFECYCLE_STAGES` and one on
   `assertRoutableStage`'s refusal; a re-export that changed identity or froze
   differently would break the router's contract. `Object.isFrozen` and `deepEqual`
   both asserted.
4. **`REQUIRED_ARTIFACTS`'s declaration form.** Turning it into a function breaks a
   *citation* guard — a failure mode with no local symptom.

### D8 — Budget: one PR, no chain

`governance.tier` is `lite` → budget **1000**. `governance.ignoreList` excludes
`**/*.test.mjs` and `openspec/changes/**`, so the countable diff is production code
only:

| File | Countable | Note |
|---|---|---|
| `brain/scripts/lib/sdd-layout.mjs` | ~55 | resolver + three refusals + house-style rationale |
| `brain/scripts/lib/stage-engine.mjs` | ~+12 / −8 | literal → re-export |
| `brain/scripts/vcs/phase-order-check.mjs` | ~+4 / −3 | default swap (seam already present) |
| `brain/core/config-migrations.mjs` | ~14 | migration `0.11.0` |
| `brain/scripts/**/*.test.mjs` | ~160 | **not counted** (ignoreList) |
| `openspec/changes/issue-456-stage-set/**` | — | **not counted** (ignoreList) |

**Countable: ~90 lines. Budget: 1000.** `Chained PRs recommended: No.` The proposal
forecast this as Medium risk on the strength of "eleven importers"; §1's measurement
retires it. If `sdd-tasks` finds the estimate drifting past ~400 countable, the slice
boundary to take is **step 4 onward** (guard + REQ-L4-2′ assertions) as a second PR —
the guard is the only step with an independent verification story and a clean
rollback, and steps 0–3 are green without it.

---

## §3 — Data flow

```
brain.config.json ──(edge: loadBrainConfig)──→ resolveStageSet(config)
                                                   │  refuses: omission · order · collision
                                                   ▼
                                   LIFECYCLE_STAGES ⊕ declared   ← RESOLVED (config-dependent)
                                                   │
                                          artefactFiles(names, {...ARTEFACT_FILE, ...declared})

  LIFECYCLE_STAGES  ← THE ONE DECLARATION (never config-dependent)
        ├──→ REQUIRED_ARTIFACTS               (SCAFFOLD)
        ├──→ SDD_LIFECYCLE_STAGES  re-export  → assertRoutableStage   (UNTOUCHED)
        └──→ phase-order default + sentinel   (canonical order by construction — D5a)

  governance-tiers: tierParams(tier).artefacts → artefactFiles → requiredArtifactsFor
        └────────────── GATE — reached by no arrow above ──────────────┘
```

The GATE column takes no input from the resolver. That disconnection is the design.

## §4 — File changes

| File | Action | What |
|---|---|---|
| `brain/scripts/lib/sdd-layout.mjs` | Modify | `LIFECYCLE_STAGES`, `resolveStageSet`, `artefactFiles` fileMap param; `REQUIRED_ARTIFACTS` re-derived |
| `brain/scripts/lib/stage-engine.mjs` | Modify | `SDD_LIFECYCLE_STAGES` becomes a re-export |
| `brain/scripts/vcs/phase-order-check.mjs` | Modify | `STANDARD_ARTEFACTS` literal → `LIFECYCLE_STAGES` import (seam unchanged) |
| `brain/core/config-migrations.mjs` | Modify | migration `0.11.0` |
| `brain/scripts/lib/sdd-layout.test.mjs` | Modify | resolver + refusal tests, second drift scan, allowlist, traps, REQ-L4-2′ both directions |
| `openspec/changes/issue-456-stage-set/brain-drafts/` | Create | ADR-0019 Amendment 1 + `sdd-layout.md` correction drafts (human promotes) |
| the six set-blind importers | **None** | proven, not edited |
| `brain/scripts/lib/stage-engine.test.mjs` | **None** | must stay byte-identical — Amendment 1 condition 4 |

## §5 — Interfaces

```js
/** The four, declared ONCE. NOT config-dependent — additive-only guarantees they
 *  are always present, so nothing that needs "the four" needs the resolver. */
export const LIFECYCLE_STAGES = Object.freeze(['proposal', 'spec', 'design', 'tasks']);

/**
 * PURE — config is RECEIVED, never read (the module promises no side effects at
 * import; #555's first cut broke that and a fixture caught it).
 * @param {{sdd?: {stages?: Record<string, {artefact?: string}>}}} [config]
 * @returns {{stages: string[], files: Record<string,string>}}
 * @throws when a declared set omits one of the four, reorders them relative to
 *         each other (D5a), or collides a declared artefact with a lifecycle file
 */
export function resolveStageSet(config) { /* … */ }

/** fileMap defaults to the frozen ARTEFACT_FILE; the unknown-name refusal is intact. */
export function artefactFiles(names, fileMap = ARTEFACT_FILE) { /* … */ }
```

## §6 — Testing strategy (strict TDD — RED first, baseline 4497 pass / 0 fail)

| Layer | What | How |
|---|---|---|
| Identity | absent key → same four, same order, same files, same gate outcomes | `resolveStageSet(undefined)` and `resolveStageSet({})` deepEqual the four; `REQUIRED_ARTIFACTS` unchanged; `requiredArtifactsFor` unchanged at all three tiers |
| Refusal | omission names each missing stage; relative order; file collision | `assert.throws` with message assertions, not bare `/Error/` |
| **Positional** | the legacy `'spec.md/design.md'` literal still selected for the canonical four | drive `messageForArtefacts` through `evaluateRuleA`; assert the literal AND assert a deliberately reordered array is refused upstream so it can never arrive |
| Additive | four + `threat-model` resolves to five with merged files | and `artefactFiles(['threat-model'])` on the DEFAULT map still throws |
| Single source | second scan catches a bare-name rival; the allowlisted GATE table does not trip; a non-allowlisted twin does; real-tree scan returns zero | traps written **before** the real scan (A1's and #802's discipline) |
| Separation | REQ-L4-2′ both directions at `lite`: SCAFFOLD four, GATE `['spec.md']` | direct assertion — #555's collapse, re-armed |
| Untouched | `assertRoutableStage` refuses all four | `git diff --stat` on `stage-engine.test.mjs` must be **empty** |
| Migration | `0.11.0` additive and idempotent; a consumer-set value survives | existing migration test pattern |

## §7 — Migration / rollout

Additive only, no data migration. Rollback is a code revert: because the default is
the *absence* of a key and the resolved value is byte-identical to today's four, any
consumer on `main` is unaffected, and a `brain.config.json` carrying `sdd.stages` is
simply ignored by the reverted readers.

## §8 — Recorded, not resolved

- **Citation drift inside ADR-0019 Amendment 1.** It quotes `ARTEFACT_FILE` with
  **four** entries; the tree has **five** (`verification: 'verify-report.md'`). It
  says *"Twelve modules import that layout"*; measured, **eleven** production / sixteen
  with tests. And it cites by line number, which `reviewer-protocol.md` §2 warns
  against by name (#580). Correcting it is a `brain/project/**` write — Tier 3 — so
  it is a **draft candidate** under
  `openspec/changes/issue-456-stage-set/brain-drafts/`, promoted by the human. **Not
  acted on in this slice.**
- **`sdd-layout.md` overstates its own guard** — *"fails if a second, independent
  definition… appears anywhere else"* was false by notation for **two** declarations,
  not one. The doc needs a sentence saying the guard covers both notations.
  `brain/core/**` — Tier 3 — a second draft candidate, not an edit.
- **`artifactPaths` is a fourth spelling of the set**, inside the accessor itself
  (an object literal, so neither scan sees it, and `sdd-layout.mjs` is excluded from
  both anyway). Slice A leaves it alone: rebuilding its return shape touches
  `new-change.mjs`'s four `writeFileSync` calls and buys nothing until slice B needs
  to scaffold a fifth file. Recorded as a known residual, in A1's tradition of
  documenting a limit rather than chasing it.

## §9 — Open questions

- [ ] **Design/spec divergence on reorder (D5a).** The spec says normalize; this
      design says refuse, on measured evidence the spec did not have. `sdd-tasks`
      must reconcile — the spec requirement needs amending, not the design.
- [ ] Both of the proposal's original open questions are settled: question 1 by the
      maintainer's additive-only ruling, question 2 recorded in §8 as a Tier 3 draft
      candidate.
