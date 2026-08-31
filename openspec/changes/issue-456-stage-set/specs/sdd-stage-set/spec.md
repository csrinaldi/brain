# SDD Stage Set Specification

## Purpose

The SDD lifecycle stage set (`proposal`, `spec`, `design`, `tasks`) becomes
configuration (`sdd.stages`) instead of a literal frozen twice. This spec
covers resolution, declaration, validation, and single-source-of-truth for
that set. It does not change what any gate demands, and does not lift
`assertRoutableStage`'s refusal of the four (ADR-0019 Amendment 1). **Ruling
(maintainer, 2026-08-29): `sdd.stages` is additive-only** — a consumer may add
stages beyond the four; it may never omit one.

## Requirements

### Requirement: Zero-config identity

When `brain.config.json` carries no `sdd.stages` key, the resolved stage set
MUST be byte-identical to the four lifecycle stages, in canonical order
(`proposal`, `spec`, `design`, `tasks`), mapping to the same files as today,
producing the same gate outcomes as before this change.

#### Scenario: No `sdd.stages` key present

- GIVEN a `brain.config.json` with no `sdd.stages` key
- WHEN the stage set is resolved
- THEN the result equals `['proposal', 'spec', 'design', 'tasks']` in that order
- AND every consumer (scaffold, gate, phase-order, archive) observes the same
  outcome it observed before this change

### Requirement: Additive declaration

A declared `sdd.stages` set MAY add stages beyond the four lifecycle stages.

#### Scenario: Declaring an additional custom stage

- GIVEN `sdd.stages` declares the four plus `threat-model`
- WHEN the stage set is resolved
- THEN resolution succeeds and includes all five stages

### Requirement: Missing lifecycle stage refusal

A declared `sdd.stages` set omitting any of the four MUST be refused, naming
the missing stage(s).

The four MUST also be declared in canonical order (`proposal`, `spec`,
`design`, `tasks`). A set carrying all four in a different order is REFUSED,
not normalised.

> **Amended after design (D5a).** This requirement first said order was not
> significant and that the resolver would normalise, on the stated assumption
> that nothing ties behaviour to declaration position. **Measured, that
> assumption is false.** `phase-order-check.mjs`'s `messageForArtefacts` does a
> positional comparison — `artefacts.every((a, i) => a === STANDARD_ARTEFACTS[i])`
> — to decide whether to emit the exact legacy literal `'spec.md/design.md'`,
> and that literal is regression-pinned by that file's own tests. The gate's
> VERDICT is order-independent; the gate's MESSAGE is not.
>
> Refusal is chosen over normalisation for three reasons, and the third is the
> one that decides it: normalisation has no defined answer once custom stages
> interleave with the four; silently reordering an operator's declaration
> rewrites intent, against the fail-closed posture `resolveTier` already sets;
> and the positional sentinel compares against the non-resolvable canonical
> constant anyway, so normalising would only hide a declaration the repo cannot
> honour rather than reporting it.
>
> The cost, stated rather than left implicit: a consumer who lists the four in
> a different order gets an error for something that reads cosmetic. That is
> the trade — a refusal a reader can act on, over a silent rewrite that changes
> a pinned gate message.

> **Notation corrected after apply.** Every scenario below first wrote
> `sdd.stages` as a bare ARRAY of names. The declared shape is an **object keyed
> by stage name**, symmetric with `sdd.map` — design D3:
> `{ "threat-model": { "artefact": "threat-model.md" } }`, where `artefact` is
> optional and absent means "look it up in `ARTEFACT_FILE`", which is what the
> four do. Order is the key insertion order. The array notation was illustrative
> shorthand that read as literal; it is corrected here so the scenarios describe
> the shape the resolver actually reads (`Object.keys(declared)`), not a second
> shape nobody implements.

#### Scenario: Declaration omits one lifecycle stage

- GIVEN `sdd.stages` is `{ "proposal": {}, "design": {}, "tasks": {} }` (missing `spec`)
- WHEN the stage set is resolved
- THEN resolution throws, naming `spec` as missing

#### Scenario: Declaration is an empty object

- GIVEN `sdd.stages` is `{}`
- WHEN resolved
- THEN the resolved set is the four lifecycle stages in canonical order
- AND this is the migration default, so it MUST be indistinguishable from the
  key being absent entirely — an empty declaration is "I declared nothing
  extra", never "I declared nothing"

#### Scenario: Declaration contains exactly the four, in non-canonical key order

- GIVEN `sdd.stages` is `{ "tasks": {}, "proposal": {}, "design": {}, "spec": {} }`
- WHEN resolved
- THEN resolution throws, naming canonical order as the requirement
- AND the message states the expected order, so the fix is readable from the error

#### Scenario: Declaration is the four in canonical order plus a custom stage

- GIVEN `sdd.stages` is
  `{ "proposal": {}, "spec": {}, "design": {}, "tasks": {}, "threat-model": { "artefact": "threat-model.md" } }`
- WHEN resolved
- THEN resolution succeeds with all five stages
- AND the resolved file map is `{ ...ARTEFACT_FILE, ...declared }`, built per call
  so the frozen constant stays frozen for every other caller

> **What this does to the legacy gate message, said rather than discovered
> later.** `messageForArtefacts`'s sentinel tests LENGTH before position, so a
> five-stage set leaves the legacy branch regardless of the four keeping their
> canonical positions — the message becomes the computed form naming the
> artefacts actually missing. That is the existing code's intended behaviour,
> not a regression: the comment above it says the exact literal is preserved
> only "when the artefact set is the historical standard-tier four", and a set
> with a custom stage is by definition not that. Canonical order is required so
> that a set of exactly the four still reaches the branch its tests pin; it is
> not a claim that the branch survives additions.

### Requirement: Declared artefact collision refusal

A declared stage's `artefact` MUST NOT be a file already owned by another entry
in `ARTEFACT_FILE`. A custom stage may not impersonate a gate artefact.

> **Added after verify (WARNING-1).** This refusal was implemented from design
> D5 and covered by a test, but had no scenario here — a spec-only reader would
> not have known it exists. The gap is closed rather than argued away: a
> refusal nobody can find in the contract is a refusal the next author deletes.
>
> Why it must refuse rather than merge: the file map is
> `{ ...ARTEFACT_FILE, ...declared }`, so an entry declaring `spec.md` for a
> custom stage would SHADOW the lifecycle stage that owns it. The gates would
> then probe a path a different stage claims — which changes what the gates
> demand, and ADR-0019 Amendment 1 withholds exactly that.
>
> It is also checked BEFORE the unknown-name refusal below, so when both could
> apply the specific "impersonation" message wins over the generic "no file
> declared" one. An operator who typed a colliding filename should be told that,
> not sent looking for a missing declaration.

#### Scenario: Custom stage declares a file already owned by a lifecycle stage

- GIVEN `sdd.stages` declares the four plus `threat-model` with
  `{ "artefact": "spec.md" }`
- WHEN resolved
- THEN resolution throws, naming both the colliding file and the lifecycle stage
  that already owns it
- AND the message cites that this would change what the gates demand

#### Scenario: A stage declaring its own canonical file is not a collision

- GIVEN `sdd.stages` declares `spec` with `{ "artefact": "spec.md" }` — the file
  `spec` already owns
- WHEN resolved
- THEN resolution succeeds; a stage restating its own file is a redundancy, not
  an impersonation

### Requirement: Unknown stage name refusal

A declared stage with no file behind it MUST be refused rather than having
`.md` appended. A custom stage name MUST supply its own file as part of the
declaration; a name that is neither one of the four nor paired with a file
MUST be refused.

#### Scenario: Custom stage declares its file

- GIVEN `sdd.stages` declares a custom stage with an explicit file
- WHEN resolved
- THEN that stage resolves to the declared file

#### Scenario: Custom stage declared without a file

- GIVEN `sdd.stages` declares an unknown name with no file
- WHEN resolved
- THEN resolution throws, naming the stage and the missing file

### Requirement: Single source of truth

Exactly one declaration of the stage set MUST exist in `brain/scripts/**`.
`stage-engine.mjs` MUST consume the resolved set from the shared resolver
instead of re-declaring its own literal.

#### Scenario: Stage-engine has no private literal

- GIVEN the resolver exports the resolved stage set
- WHEN `brain/scripts/**` is scanned for a rival full-set declaration
- THEN none is found outside the resolver

### Requirement: Drift guard sees bare-name notation

The drift guard MUST catch a rival stage-set declaration written either with
`.md`-suffixed names or bare lifecycle names, closing the notation blind spot
that let two declarations coexist undetected.

#### Scenario: Rival bare-name array is caught

- GIVEN a file declares `['proposal', 'spec', 'design', 'tasks']` (no `.md`)
  outside the resolver
- WHEN the drift guard scans `brain/scripts/**`
- THEN it reports that file as an offender

### Requirement: SCAFFOLD, GATE, and routable stages stay separate

Configurable stages MUST NOT collapse SCAFFOLD (`REQUIRED_ARTIFACTS`), GATE
(`requiredArtifactsFor`, tier-scoped), and routable stages into one set.

#### Scenario: Tier scoping does not affect the scaffold

- GIVEN a `lite`-tier repo with `sdd.stages` at default
- WHEN a new change is scaffolded
- THEN all four lifecycle artefacts are written, unaffected by the tier's gate-scoped set

### Requirement: Routing refusal is unmodified

`assertRoutableStage` MUST continue refusing all four lifecycle stages,
unaffected by `sdd.stages` declarations. Its existing tests MUST remain green
and unmodified.

#### Scenario: A declared custom stage does not relax routing

- GIVEN `sdd.stages` declares the four plus `threat-model`
- WHEN `assertRoutableStage('spec')` is called
- THEN it still throws, exactly as before this change
