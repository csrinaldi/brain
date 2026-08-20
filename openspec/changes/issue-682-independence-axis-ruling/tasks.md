---
status: draft
issue: 682
---

# Tasks

Three slices onto `feature/issue-682`. Only the tracker merges to `main`, which
is how #682's *"producer and challenger land together"* holds while the work
stays reviewable.

**Slice order is a safety property, not a preference.** Slice 1 ships a working
challenger with no network and no credential; slice 2 ships the producer that
needs one. At no point does a reasoned finding exist with nothing to challenge
it — the state #552 ruled against.

**No task here names a field a later slice creates.** Where a requirement spans
slices it is split at the slice boundary and each half is tickable on its own.

---

## Slice 1 — the resolver and the `human` axis (no network, no credential)

Delivers REQ-682-1, REQ-682-2, and REQ-682-6.

- [x] 1.1 Add `challengerAxis` and `inferentialEnabled` to `tierParams()` in
      `brain/scripts/vcs/governance-tiers.mjs`: `lite` → producer off, axis
      unused; `standard` → on, `same-model`; `regulated` → on, `cross-family`.
      Pure, tested against the existing tier table.
- [x] 1.2 Write `brain/scripts/review/lib/resolve-challenger.mjs` exporting
      `resolveChallenger({ config, tier })`. Reads
      `reviewer.inferential.{enabled,challenger.axis}`; `null`/absent resolves
      from tier (REQ-682-1). Returns `null` when the producer is off
      (REQ-682-2).
- [x] 1.3 An unrecognised `axis` value makes `resolveChallenger` REFUSE — an
      explicit error, never a silent fallback to a default. An unknown axis is
      an unknown evidentiary strength, and #683's rule is that a verdict whose
      self-description could be false is not posted.
- [x] 1.4 Implement the `human` axis runner: marks each inferential blocker with
      an outcome **distinct from `unchallenged`** and escalates (REQ-682-6).
      Returns a runner, never `null` — the cheap wrong implementation is the one
      that returns `null`, so a test pins it directly.
- [x] 1.5 Test: `human`-axis output and no-runner output must NOT be equal.
      Assert on the rendered shape, not the internal object — #552's defect was
      invisible until it was rendered.
- [x] 1.6 Wire `resolveChallenger` at `cli.mjs`'s existing seam: replace
      `runner: deps.refuterRunner ?? null` with
      `runner: deps.refuterRunner ?? resolveChallenger({ config, tier })`. The
      test-side injection keeps winning, so every existing test is unaffected.
- [x] 1.7 Mutation: flip the `lite` producer default to on and prove a test
      fails. If none does, REQ-682-2's protection of the credential-free install
      is not actually pinned.
- [x] 1.8 Record the boundary debt against **#312** in
      `brain/scripts/review/lib/resolve-challenger.mjs`'s header: the
      agent/model binding is a provisional inhabitant of #312's port and is
      deleted when the port lands. A comment, not a doc — it must be read by
      whoever edits the file.

## Slice 2 — the producer, additive, and its declaration

Delivers REQ-682-3 and REQ-682-4. Depends on slice 1: the challenger must exist
before anything emits a finding for it to challenge.

- [x] 2.1 Write `brain/scripts/review/evaluators/inferential.mjs` with the
      evaluator triple the other three follow — `PRODUCES`,
      `evaluate*`, `gather*Inputs`. `PRODUCES = Object.freeze(['inferential'])`.
- [x] 2.2 Wire it as ADDITIVE in `cli.mjs`, not as a fourth mode (Decision 1):
      it runs alongside the mode's evaluator and its findings merge into
      `evalResult.findings`.
- [x] 2.3 Pass both `PRODUCES` values to the existing call:
      `unionControls([TRANCHE_PRODUCES, INFERENTIAL_PRODUCES])`. REQ-682-3's
      declaration needs no new plumbing — `controls.mjs` already derives the
      field from the evaluators that ran.
- [x] 2.4 Test that `#690`'s complement shrinks by itself when the producer
      runs. `controls.test.mjs:114` already asserts *"when #682 lands, the
      complement empties itself — no edit required"*; make that test go from
      hypothetical to exercised without editing its assertion.
- [x] 2.5 REQ-682-4: assert the challenger's input is a subset of what the
      verdict renders. If the challenger can see something a reader of the
      verdict cannot, the boundary has leaked and `same-model` is
      self-attestation.
- [x] 2.6 Verify there is no side channel: no shared context object, no extra
      field, no log the challenger reads. A grep-level test is not enough —
      assert on the arguments the runner actually receives.
- [x] 2.7 Move REQ-409-6's pin onto the new behaviour rather than deleting it
      (#682 acceptance criterion 4, the instruction its author left, honoured
      twice already).

## Slice 3 — the transport ADR, then the `same-model` runner

Delivers REQ-682-5 and Decision 5. Depends on slice 2.

- [ ] 3.1 Draft the ADR to `brain/project/decisions/brain-drafts/`: the model
      transport for `same-model` and `cross-family`, and its network,
      credential and determinism costs. brain has NO outbound model machinery
      today — the only network call in the tree is `gitlabApiFetch` — so this
      ADR introduces the first one.
- [ ] 3.2 Promote the ADR (`npm run brain:promote -- <draft path>`) and index it
      in `brain/HOME.md` **on this branch, before any code cites it.** Two
      independent reasons, both measured: `test/adr-citation-resolves.e2e.test.mjs`
      (#590) holds `brain-drafts/` in `UNSCANNED_ROOTS`, so an `ADR-NNNN` cited
      from live code while the ADR exists only as a draft resolves to nothing
      and FAILS; and `decision-gate` fails an ADR added under
      `brain/project/decisions/` when `brain/HOME.md` is not in the same diff.
- [ ] 3.3 Implement the `same-model` runner behind the shape slice 1 fixed:
      `runner(inferentialBlockers) → { outcomes }`. Fresh context; receives the
      findings and the diff; never the producer's reasoning.
- [ ] 3.4 The negative case stays honest (#682 acceptance criterion 6): a run
      where the model was unreachable must NOT post a verdict that looks like a
      run where nothing was found. Fail closed on uncomputable evidence, per
      protocol §10 — the single most likely place for this feature to go wrong,
      by the ticket's own assessment.
- [ ] 3.5 Prove it end to end **through the real verb** (#682 acceptance
      criterion 3), never by hand-feeding `evidence_class: inferential`. That is
      the standard #552's own fix was held to.
- [ ] 3.6 `cross-family` is NOT implemented here. `regulated` resolving to it
      must refuse with a clear message rather than silently degrading to
      `same-model` — a tier that asked for stronger evidence and got weaker
      without being told is the defect this whole ticket is about.

---

## Review workload forecast

| slice | production lines (est.) | budget at `lite` | chained PR |
|---|---|---|---|
| 1 | ~180 | 1000 | yes — into `feature/issue-682` |
| 2 | ~220 | 1000 | yes |
| 3 | ~260 + ADR | 1000 | yes |

`governance.ignoreList` excludes `**/*.test.mjs` and `openspec/changes/**`, so
tests and these artifacts do not count. **Chained PRs recommended: yes** — not
for the budget, which no slice approaches, but because each slice is a distinct
reviewable claim and slice 3 introduces the repo's first outbound model call.

**Decision needed before apply: no.** `delivery_strategy` is settled by the
tracker branch that already exists, and the chain strategy is
`feature-branch-chain` by the same fact.

## Not in this change

- The four launch scenarios (subagent, headless CLI, CI, MCP) — a distribution
  ticket, orthogonal per the ruling.
- `cross-family` beyond its refusal in 3.6.
- M5's port shape. This change consumes whatever #312 lands and proposes
  nothing about it.
