# M10 — Seam contract coverage: closing "green in test, inert in production"

> ## ⚠️ SNAPSHOT — not the source of truth
>
> Written 2026-07-25, during the session that reviewed PR #331 and shipped #332.
>
> **The source of truth is issue #335** (the M10 body) and **#313** (the epic). On any conflict,
> the issues win. This file exists for the detail and the file:line evidence that does not belong
> in an issue body — read #335 first, then come here for the reasoning behind it.

---

## 1. The pattern, named

Three defects found in a single session, initially triaged as unrelated:

| # | Mechanism | Test status | Production reality |
|---|---|---|---|
| #317 | reviewer anti-loop / rev-bound / board | green | `prReviews` strips `body`, so `priorVerdicts` is always `[]` and all three features are inert |
| #210 / #331 | L2 release audit gate | 27/27 green | runs on tag push, after the tag exists; cannot block what it gates |
| #334 | `brain:ship` | green | dies on the first real call: hardcoded `kind:feature` label does not exist |

They are the same defect. In each case the **logic** is correct and well tested, and the failure
lives at the **seam** where that logic meets something it does not control: a provider adapter, a CI
workflow, a label taxonomy.

Working name: **seam blindness**. The core is proven; the boundary is assumed.

## 2. Correcting an easier, wrong diagnosis

The obvious first hypothesis was "brain lacks negative tests". Measured on `main`, that is false:

```
brain/scripts/vcs/phase-order-check.test.mjs      15 failure assertions
brain/scripts/vcs/actor-check.test.mjs             9
brain/scripts/brain-audit.test.mjs                 8
brain/scripts/vcs/brain-writes-reviewed.test.mjs   7
brain/scripts/brain-check.test.mjs                 7
```

136 test files, 1899 tests, all green, and the gate-logic modules carry solid negative coverage. The
problem is not that gates are never proven to fail. It is that they are proven to fail **against
inputs the test itself authored**.

- `checkAntiLoop(priorVerdicts)` is well tested with fabricated `priorVerdicts`. Nothing asserted
  that the real `prReviews()` ever returns a populated one.
  Root cause, `brain/scripts/vcs/providers/github.mjs:291`:
  ```js
  return reviews.map(r => ({ state: r.state, author: r.user?.login ?? null }));
  ```
  The GitHub API returns `body` on every review. The normalizer drops it.
- `runShip()` is well tested with an injected `mrCreateFn` stub (`brain-ship.test.mjs:28`) that
  accepts any `labels` value and always resolves. Nothing asserted the label exists on the remote.
- `brain-audit` is well tested as a program. Nothing asserted that the workflow wiring places it
  anywhere it can block a release.

So: **the pure core is well covered; every one of these failures is at a seam.**

## 3. brain already has the right mechanism

This is the important finding, and it is what makes the whole programme cheap.

`brain/scripts/vcs/providers/vcs.contract.test.mjs` is a parameterized contract suite: one assertion
set run over both providers, asserting only what `vcs-contract.md` promises (normalized shapes,
`null`-on-uncomputable, ascending ordering, never-throws). Fixtures live in
`brain/scripts/vcs/fixtures/` and carry `_provenance.recorded` or `_provenance.derived`, never both
(per that file's own header, "lesson #12").

That is exactly the antidote. It does not need to be invented. It needs to be **applied where it is
not**.

### Gap A — uncovered port verbs

Covered by the contract suite: `prView`, `mrCreate`, `labelEvents`, `prStatusRollup`,
`prReviewComment`, `labelAdd`.

Exported by `brain/scripts/vcs/providers/github.mjs` with no contract coverage: **`prReviews`**,
`issueView`, `checkRuns`, `commitStatus`, `capabilities`, `issueList`, `mrList`, `projectResolve`,
`issueComment`, `labelRemove`, `branchProtect`, `authCheck`, `authLogin`, `whoami`.

`prReviews` is the single verb the reviewer subsystem depends on for `priorVerdicts`, and it is the
one verb in that subsystem with no pinned contract. That is #317. The correlation is not a
coincidence; it is the mechanism.

### Gap B — derived fixtures for mutating writes

The suite's own header states that `github-mrCreate-happy.json` is *derived* rather than recorded,
because forced-failure and mutating-write cases cannot be recorded against a live API.

A derived fixture encodes the author's assumption about the API. For `mrCreate` the encoded
assumption was "any label string is accepted". Production rejects unknown labels. That is #334, and
no amount of additional assertions against a derived fixture would have caught it, because the
fixture and the code share the same wrong belief.

This gap is real and cannot be closed by recording alone. It needs a different instrument: a
**pre-flight conformance check** that validates what the code is about to send against what the
remote actually declares.

## 4. Roadmap

Sequenced so that each phase produces something usable on its own, and so that the systemic work
genuinely unblocks #210 rather than delaying it.

### Phase 0 — #334, as the first worked example (small)

Fix `brain-ship.mjs:94`. Derive the label from the linked issue's own `type:*` label via `issueView`
— the issue is already required to exist and carry `status:approved` before a PR may open, so the
information is guaranteed available — rather than hardcoding `kind:feature`.

Ship it **with** the two instruments this roadmap proposes, on one small surface:

- a contract test for `issueView`, closing one Gap-A verb;
- a pre-flight check that the labels about to be sent exist in the remote's declared set, closing
  Gap B for this call site.

Value: the golden path works again, and M10 gets a concrete reference implementation instead of a
doctrine document.

Also worth folding in: `titleFromBranch` (`brain-ship.mjs:41-47`) emits a de-hyphenated branch slug,
not the conventional-commit title `.github/PULL_REQUEST_TEMPLATE.md:73` requires.

### Phase 1 — the coverage audit (#336, cheap, mechanical)

Produce the actual gap list: every exported port verb, whether it has a contract test, whether its
fixtures are recorded or derived, and which scripts consume it. Output a table, not prose.

Deliberately detection-only, in the same spirit as #324. It converts "seam blindness" from a claim
into a ranked worklist, and it is the input to Phase 2's slicing.

### Phase 2 — close Gap A, ranked by blast radius

Contract tests for uncovered verbs, sliced into reviewable PRs. Ranking by what depends on them:
`prReviews` first (reviewer subsystem), then `issueView`, `checkRuns`, `commitStatus` (governance
gates), then the rest.

**Coordination**: #317 is being worked separately. Its fix should carry the `prReviews` contract
test, which is this phase's first item, and that fixture must be **recorded, not derived** — a
hand-authored fixture containing `body` would encode the same assumption the code makes, and would
pass without proving anything.

### Phase 3 — efficacy probes replace presence probes (#337)

`brain/scripts/vcs/substrate.mjs:78-88` — `evalRung2` reports rung 2 as armed when
`.github/workflows/release.yml` merely exists:

```js
const active = Boolean(await safeProbe(probes.releaseGate, { config, env }));
```

A gate that exists is not a gate that can block. This is the same seam blindness expressed in the
substrate ladder, and it is **literally REQ-210-4** of the #210 change.

One option deserves real consideration: keep the presence probe but *demote what it reports*.
Presence proves the workflow is wired, not that rung 2 is enforcing. Reporting those as different
states may be more honest than trying to prove efficacy statically — honest under-reporting beats
confident over-reporting, and it is cheaper.

### Phase 4 — #210 proper, now provable

Build audit-then-tag with `contents: write` on a tag-creation job gated on a green audit, remove or
explicitly demote `push: tags`, and invert the stale assertions in
`release-postmerge-workflows.test.mjs:153-181`.

The negative fixture that was missing all along: **a red audit must leave no tag behind.** With
Phase 3 done, the substrate ladder can assert that honestly instead of inferring it from a file's
presence.

## 5. Why this order

Attacking the pattern first is not a detour from #210. Phase 3 *is* REQ-210-4, and Phase 4's
acceptance criterion only becomes expressible once Phase 3 exists. Doing #210 first would mean
building the tag-creation job and then still having no way to prove rung 2 is armed — which is
precisely how #331 ended up asserting a guarantee it did not implement.

Phase 0 is deliberately first and deliberately small: the golden path is broken today, and a
doctrine that ships before a worked example tends to stay a document.

## 6. Ticket map

| Phase | Ticket | State |
|---|---|---|
| — | **#335** | M10 parent |
| 0 | **#334** | filed; scope expanded by comment |
| 1 | **#336** | coverage audit, detection-only |
| 2 | children of #336, plus **#317** | `prReviews` first, in flight under #317 |
| 3 | **#337** | efficacy probe; blocks #210 |
| 4 | **#210** | rebuild on #331's ashes |

Epic #313 was updated in the same pass: M10 added to the milestone list, the sequence block changed
to `M10(P0,P1,P3) → #210 → M2 → …`, and the prose declaring #210 "the first item of 1.1" rewritten.

Adjacent, not duplicated: **#324** (M9, measures the system that exists), **#328** (stale verdicts
after approval — a distinct race, though it shares the "green means nothing" surface).

## 7. Open questions

1. **Milestone or standard?** M10 may not be a milestone at all, but a cross-cutting constraint
   every subsequent milestone must meet. Leaning toward the latter; it changes how this is ticketed.
2. **ADR or not?** "Every port verb ships a contract test; every mutating write ships a pre-flight
   conformance check" is a process decision with teeth. If it becomes doctrine it needs an ADR,
   drafted under `openspec/changes/{iid}/brain-drafts/` and promoted by a human — explicitly not the
   path #331 took.
3. **How far does pre-flight conformance generalize?** Labels are the obvious case. Milestones,
   assignees, and required-check names share the shape. Phase 0 should decide whether it builds a
   one-off or a small reusable helper.
4. **Does #331 get reduced or closed?** It holds one genuinely useful line (`auditBaseline` in
   `brain.config.json`) and one correct instinct. Everything else asserts undelivered behavior.

## 8. Evidence appendix

- Contract suite: `brain/scripts/vcs/providers/vcs.contract.test.mjs:1-24` — header states scope,
  fixture provenance rules, and the recorded-vs-derived constraint
- Fixtures: `brain/scripts/vcs/fixtures/` — 13 fixtures plus `record-fixtures.mjs`
- `prReviews` normalizer dropping `body`: `brain/scripts/vcs/providers/github.mjs:284-292`
- Presence probe: `brain/scripts/vcs/substrate.mjs:74-89`
- Ship label defect: `brain/scripts/brain-ship.mjs:94`
- Ship test stub that cannot fail: `brain/scripts/brain-ship.test.mjs:28`
- Stale contract assertions: `brain/scripts/vcs/release-postmerge-workflows.test.mjs:153-181`
- Suite size at time of writing: 136 test files, 1899 tests, all green
