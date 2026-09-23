# Proposal: #456 slice A — the SDD stage set becomes data

> Citations name symbols, not line numbers (`reviewer-protocol.md` §2, #580).

## Intent

The SDD stage set is a frozen constant, declared **twice**, in two notations, and the
drift guard that claims to prevent exactly this cannot see the second copy:

| Declaration | Symbol | Notation |
|---|---|---|
| scaffold set | `sdd-layout.mjs` → `REQUIRED_ARTIFACTS` | `'proposal.md'` … |
| lifecycle stages | `stage-engine.mjs` → `SDD_LIFECYCLE_STAGES` | `'proposal'` … |

`sdd-layout.md` claims `sdd-layout.test.mjs` fails *"if a second, independent definition
of the required-artifact set appears anywhere else in `brain/scripts/**`"*. Measured: the
guard's `ARTIFACT_NAMES` scan matches **with `.md`**, so `SDD_LIFECYCLE_STAGES` is
invisible to it. Stage↔artefact is 1:1 per ADR-0019 — these are the same set. **You
cannot make configurable in one place what is declared in two.**

`sdd.map` already ships (`config-migrations.mjs`, migration `0.10.0`, citing #323 /
ADR-0033); `sdd.stages` does not. M8 S2 must *"reject undeclared stages"* and today has
nothing to validate against. That makes #456-A M8's real prerequisite.

## Scope

### In Scope
- `sdd.stages` key in `brain.config.json` via additive migration; **default identical to
  today's four**.
- Unify the two declarations into one resolved source; `SDD_LIFECYCLE_STAGES` stops being
  an independent literal.
- The **eleven** production importers of `sdd-layout.mjs` (`check-refs`, `new-change`,
  `archive-sweep`, `archive-logic`, `stage-engine`, `governance-tiers`,
  `phase-order-check`, `memory/backends/engram`, `session-start`,
  `memory/lib/feature-resolution`, `review/evaluators/checkpoint`) read the resolved
  set. *#456's body says "three consuming sites" and understates it.*
- Close the drift guard's notation blind spot (bare names, not just `*.md`).
- Validation seam: `artefactFiles()` already refuses an unknown name rather than appending
  `.md`; ADR-0019 Amendment 1 calls that refusal *"the whole test"*. Declared stages
  validate there.

### Out of Scope
- **Slice B** — a custom declared stage running end to end (M8 S6, the last step of #456).
- Lifting `assertRoutableStage`'s refusal. Amendment 1 condition 4 is load-bearing:
  *"The refusal is replaced, not removed… everything above is doctrine until something
  refuses on its behalf."*
- Collapsing the three distinct sets. SCAFFOLD (`REQUIRED_ARTIFACTS`), GATE
  (`requiredArtifactsFor`, tier-scoped), and routable stages stay separate — REQ-L4-2′:
  *"the tier scopes what the GATE demands, never what the SCAFFOLD produces."* #555's
  first cut collapsed two of these.

## The boundary and its authority

ADR-0019 Amendment 1, *"What this amendment does NOT authorise"*, verbatim: declaring
additional stages **is already permitted and already done** — `cold-review` is a fifth
stage, routed in `sdd.map`, and it landed *"because it writes to its own root …
gitignored, read only by its own chain. Nothing shared learned anything."* A stage that
writes INTO `openspec/changes/**` and expects shared readers to find it *"changes what the
gates demand. That is #456's question (stage-set configurability), not this one."*

Slice A stops at the mechanical seam: **the set becomes data; what the gates demand does
not move.**

## What changes for a zero-config consumer

**Nothing.** No `sdd.stages` key → resolved set is the same four, same order, same files,
same gate outcomes. The acceptance bar is behavioural identity, not new capability.

## Capabilities

### New Capabilities
- `sdd-stage-set`: the declared stage set as configuration — resolution, default, additive
  migration, validation of declared names, and single-source-of-truth guarantee.

### Modified Capabilities
- None. No gate's demand changes at spec level in slice A.

## Approach

1. Additive migration adds `sdd.stages` defaulting to the current four (pattern from
   `config-migrations.mjs` `0.10.0`).
2. One resolver owns the set; `sdd-layout.mjs` exposes it, `stage-engine.mjs` consumes it
   instead of re-declaring.
3. Consumers switch from constant to resolved set — mechanically, one at a time.
4. Extend the drift guard to bare-name literals so the blind spot cannot reopen.

## Open questions — BLOCKING design, not decided here

Per `reviewer-protocol.md` §5: two options survive doctrine → this is a new decision, not a
ruling. **Escalated to the human.**

1. **#456's body asks for two things and one is unauthorised.** It says *"adding a
   `threat-model.md` stage, **or dropping `design.md` for docs-only repos**"*. Adding fits
   Amendment 1. **Dropping changes what the gates demand**, which Amendment 1 explicitly
   does not authorise. The ticket as written contradicts standing doctrine; a ruling is
   needed on whether slice A's `sdd.stages` is additive-only.
2. **Citation drift inside ADR-0019 Amendment 1.** It quotes `ARTEFACT_FILE` at
   `sdd-layout.mjs:28-32` with **four** entries; the tree has **five** (`verification:
   'verify-report.md'`). It says *"Twelve modules import that layout"*; measured, **eleven**
   production / sixteen with tests. `reviewer-protocol.md` §2 warns against exactly this
   (*"Citations here name symbols, never line numbers"*, #580) — and the amendment cites
   line numbers. Needs a human ruling: correct the amendment in place, or record the
   measured numbers here and leave the ADR alone.

Any doctrine correction is DRAFTED under `openspec/changes/issue-456-stage-set/brain-drafts/`
and promoted by the human (Tier 3: no agent commits to `brain/core/**` or `brain/project/**`).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `brain/scripts/lib/sdd-layout.mjs` | Modified | Set resolved, not frozen literal |
| `brain/scripts/lib/stage-engine.mjs` | Modified | Consumes resolved set; refusal untouched |
| `brain/scripts/lib/sdd-layout.test.mjs` | Modified | Guard sees bare names |
| `brain/core/config-migrations.mjs` | Modified | Additive `sdd.stages` migration |
| eleven production importers | Modified | Read resolved set |
| `brain/project/decisions/adr-0019-*.md` | Draft only | Under `brain-drafts/`, human promotes |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Slice A drifts into slice B or lifts `assertRoutableStage` | Med | Refusal is explicitly out of scope; its test must stay green unchanged |
| Collapsing SCAFFOLD into GATE (#555's first cut) | Med | REQ-L4-2′ separation asserted by test in both directions |
| Eleven consumers exceed the 1000-line `lite` budget | Med | `sdd-tasks` forecasts; chain PRs if the forecast is high |
| Open question 1 resolved late, forcing rework | Med | Design phase is blocked on it, not apply |

## Rollback Plan

Revert the migration and restore both literals. Because the default is byte-identical to
today's set, any consumer already on `main` is unaffected — rollback is a code revert with
no data migration, and `brain.config.json` files carrying `sdd.stages` are ignored by the
reverted readers.

## Dependencies

- Human ruling on both open questions before `sdd-design`.
- ADR-0019 Amendment 1 (signed) — the authority for the scope boundary.
- No dependency on #643: the additive-migration pattern already exists at `0.10.0`.

## Success Criteria

- [ ] `npm test` green at or above the measured baseline (**4497 pass / 0 fail**).
- [ ] Zero-config repo: resolved set === today's four, same order; **no gate outcome changes**.
- [ ] Exactly one declaration of the stage set survives in `brain/scripts/**`.
- [ ] Drift guard fails on a bare-name rival literal (test proves the blind spot is closed).
- [ ] `assertRoutableStage` still refuses all four lifecycle stages; its test is unmodified.
- [ ] SCAFFOLD ≠ GATE separation asserted by test (REQ-L4-2′).
- [ ] All eleven production importers read the resolved set; none holds a private copy.
- [ ] Both open questions carry a recorded human ruling before design starts.
