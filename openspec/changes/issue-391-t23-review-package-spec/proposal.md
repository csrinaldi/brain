---
status: draft
issue: 391
epic: 313
slice: T2.3
---

# Proposal — T2.3: Review package specification — prReviews contract + brain-review/2 schema

## Executive Summary

The reviewer subsystem (`brain:review`) produces one artifact — a `brain-review/N` verdict —
and consumes one input — `prReviews(...)`. Neither is currently specified as a stable contract.
`prReviews`'s shape changed twice in the last month (issue #239 → issue #317) and a live branch
still pins the *pre-fix* shape as a locked contract test. The verdict schema has a shipped v2
(`evidence_class`, `causal_disposition`, `follow_ups`) that is fully implemented and unit-tested,
but never selected in production, and the doctrine document that defines the schema still titles
its only worked example `brain-review/1`. M3 ("Reviewer as a real code-review tool", epic #313)
cannot be built against an interface that is simultaneously two contradictory shapes and a
schema version nobody activates. T2.3 closes both gaps: it promotes the already-implemented
`prReviews` shape and dual GitLab read path to a formal OpenSpec contract, and it promotes the
already-implemented `brain-review/2` schema to formal doctrine with a stated activation
condition. No runtime behavior changes — this is a specification-only slice that gives Tanda 3
(M3) a contract to build against instead of two undocumented, drifting implementations.

## Current State

**`prReviews` — fixed on `main`, broken on the working branch.** Issue #317 found that
`prReviews` on both providers dropped the review `body`, which is the only place a
`brain-review/N` verdict block lives. Without `body`, `cold-boot`'s `doctrine.priorVerdicts` is
always `[]` in production, silently disabling the anti-loop lock, the `rev >= 3 → STOP` bound,
the doctrine §8 prior-verdict load, and board reconciliation — while every test stayed green on
fixtures that injected `body` directly. PR #383 (commit `f88b3f3`) fixed this on `main`:
`prReviews` now returns `{ state, author, body }` on GitHub, and on GitLab reads **two**
endpoints — MR notes (`{state:'COMMENTED', author, body}`, oldest-first, paginated) for the
verdict thread, and the approvals API (`{state:'APPROVED', author, body:''}`) for the L6
`brain-writes-reviewed` gate — merged with notes never counting as `APPROVED` (a security
boundary: a comment must never clear a self-approval gate). `vcs-contract.md` documents this
informally in prose.

`feature/m10-seam-contract-coverage`, however, still carries a contract test
(`vcs.contract.test.mjs:217-233`) added in the same M10 Phase 2 slice that asserts the
**pre-fix** shape as a locked contract: `Object.keys(entry).sort()` must equal exactly
`['author', 'state']`, with the comment *"a body key ... must fail this lock"*. That branch's
test suite would fail the moment it merges `main`'s `body` field — it pins the bug #317 just
fixed as the contract. This is the concrete instance of the "M10 stale contract test"
mentioned in the epic; T2.3 must correct it as part of formalizing the real contract.

**`brain-review/2` — fully implemented, never activated, undocumented as doctrine.**
`brain/scripts/review/lib/schema-v2.mjs` validates `evidence_class`
(`deterministic | inferential | insufficient`) and `causal_disposition` (`introduced |
behavior-activated | worsened | pre-existing | base-only | unknown`). `verdict.mjs` implements
the hard admission rule: findings with a non-candidate disposition (`pre-existing`,
`base-only`) are routed to `follow_ups[]` instead of blocking, and a `REVISE`/`STOP` verdict
requires at least one causal finding. `parse-verdict.mjs` accepts `protocol: brain-review/2`
alongside `/1`. All of this is unit-tested (`schema-v2.test.mjs`, `verdict.test.mjs`,
`parse-verdict.test.mjs`). But `cli.mjs:204` calls `buildVerdict({...})` **without ever passing
`protocol`**, so `verdict.mjs`'s default (`protocol = 'brain-review/1'`, line 30) is what ships
on every real run. `/2` has no config key, no CLI flag, no tier gate — it is dead code with a
green test suite.

Compounding this, `reviewer-protocol.md` §6 is titled *"The verdict schema `brain-review/1`"*
and documents only that schema. §13 (Subagent Executor Doctrine), added later, already assumes
`/2` output — *"strictly produces `brain-review/2` fenced blocks with full causal
admission"* — without §6 ever being amended to define `evidence_class` /
`causal_disposition` / `follow_ups`. The doctrine document is internally inconsistent about
which protocol version is current.

**Q5 (#358, merged into doctrine) defines `governance.tier` (`lite`/`standard`/`regulated`)
but says nothing about the reviewer protocol version.** It is the natural place to gate `/2`
activation (a `regulated` tier plausibly requires causal admission before a finding can block),
but T2.3 is the first change to make that tie-in explicit — #358 does not mention
`brain-review` at all.

## Scope

**In scope:**

1. Formalize the `prReviews` contract as an OpenSpec spec (GitHub + GitLab dual-endpoint
   normalization, `null`-vs-`[]` discipline, ordering, the notes/approvals split and why
   notes must never count as `APPROVED`).
2. Document the `brain-review/2` schema as doctrine in `reviewer-protocol.md`
   (`evidence_class`, `causal_disposition`, `follow_ups`, the admission rule), resolving the
   `/1`-vs-`/2` contradiction between §6 and §13.
3. Define the activation condition for `/2` — where `cli.mjs` would select a protocol
   version and how that ties to `governance.tier` (Q5).
4. Correct the stale `feature/m10-seam-contract-coverage` contract test that locks the
   pre-#383 shape, as a precondition, not a deliverable of this spec change.

**Out of scope:**

- Implementing `/2` activation (wiring `cli.mjs` to actually pass `protocol` conditionally).
  This change specifies the condition; a follow-up implements it.
- Any change to the refuter role or further causal-admission behavior (#284) beyond what is
  already shipped.
- Renegotiating the Q5 tier matrix itself (#358) — T2.3 only adds the reviewer-protocol
  row/tie-in to the existing matrix.

## Deliverables / Acceptance Criteria

1. **`openspec/specs/vcs-pr-reviews-contract/spec.md`** — formal spec for the `prReviews`
   verb: the GitHub shape (`{state, author, body}`), the GitLab dual-endpoint shape (notes for
   the verdict thread vs. approvals for L6, and why they must never merge into one semantic),
   `null` (uncomputable) vs. `[]` (empty) discipline, ordering guarantee (oldest-first, both
   providers), and the `body: ''`-never-`null`-on-success rule matching `prView.body`.
2. **`brain/core/methodology/reviewer-protocol.md`** — §6 (or a new adjacent section) amended
   to formally define `brain-review/2`: the three schema fields, the admission rule (only
   `introduced`/`behavior-activated`/`worsened` findings may block; `pre-existing`/`base-only`
   route to `follow_ups[]`), and an explicit statement resolving the §6/§13 version
   contradiction (which section is current, which is historical).
3. **A T2.3 design doc** stating the `/2` activation condition — the precise point in
   `cli.mjs` where a protocol version would be selected, and how that selection composes with
   `governance.tier` (does `regulated` require `/2`? is `/1` still valid at `lite`/`standard`?)
   — without implementing the wiring.

Each deliverable must cite the exact file/line evidence above (not re-derive it), since all
three facts have already been verified in the tree.

## Risks and Mitigation

| Risk | Severity | Mitigation |
|---|---|---|
| `feature/m10-seam-contract-coverage` merges before its stale contract test is corrected, reintroducing the #317 bug's exact symptom (`priorVerdicts` always `[]`) under a passing test suite | **High** | Treat the branch-sync as a hard precondition of this change, not a parallel task; the spec.md deliverable must match `main`'s shipped shape, and the stale test must be corrected in the same PR that lands the spec, not deferred. |
| Documenting `/2` as doctrine implies it is safe to activate; a careless follow-up flips the default without re-litigating the tier tie-in | Medium | The design doc explicitly separates "specified" from "activated" — deliverable 3 states the *condition*, not a default, and calls out that flipping the default is a separate, reviewable change. |
| `/1`-only code paths (older PRs' verdict threads, `cold-boot`'s doctrine load) break if `/2` becomes selectable | Low | `parse-verdict.mjs` already accepts both protocols side by side (verified: `proto !== 'brain-review/1' && proto !== 'brain-review/2'` guard) — no parser change needed; this is a documentation-only risk, not an implementation one. |
| Q5's tier matrix (#358) doesn't actually have a row for reviewer-protocol version, so "tying `/2` to `regulated`" is a new decision, not a citation | Medium | Design doc must flag this as a new tie-in requiring the same ADR-adjacent scrutiny Q5 itself got, not smuggle it in as if #358 already decided it. |

## Design Considerations

- **Spec location**: `prReviews` is one verb among 16+ on the VCS port
  (`brain/core/methodology/vcs-contract.md`); promoting just this verb to a dedicated
  `openspec/specs/vcs-pr-reviews-contract/` tree (rather than folding it into a general
  `vcs-contract` spec) mirrors the empty directory scaffold already present at
  `openspec/specs/vcs-pr-reviews-contract/` and keeps the contract test suite's existing
  per-verb fixture convention (`{provider}-prReviews-{happy,failure}.json`) as the spec's
  worked examples.
- **Schema doc placement**: `brain-review/2` belongs in `reviewer-protocol.md` next to `/1`
  (§6), not in a separate schema document — the two protocols are versions of the same
  artifact and a reviewer parsing a verdict thread needs both defined in one place, the way
  `parse-verdict.mjs` already treats them as one guarded union.
- **Activation as a design question, not a spec question**: the *shape* of `/2` is settled
  (shipped, tested); the *condition* under which it is chosen is not, and is genuinely
  entangled with Q5's tier axis. This is why deliverable 3 is a design doc, not a spec
  addition — it is a decision T2.3 surfaces for ratification, not a fact T2.3 documents.
- **No behavior change in this slice**: every fact this proposal cites is already true in the
  tree (main's `prReviews` shape, schema-v2.mjs's validators, cli.mjs's protocol default). The
  work is entirely making the implicit contract explicit and reviewable — the actual `/2`
  activation wiring is intentionally deferred to keep this slice's diff to documentation and
  the one stale-test correction.

## Related Issues

- #317 — `prReviews` strips `body`; fixed on `main` via PR #383 (commit `f88b3f3`).
- #284 — Reviewer v2: refuter role & causal admission (source of the `/2` schema).
- #266 — Reviewer protocol as doctrine (source of `reviewer-protocol.md` itself).
- #358 — Q5 doctrine tiers (`lite`/`standard`/`regulated`); tie-in point for `/2` activation.
- Epic #313 — brain 1.1 line; T2.3 is the last Tanda 2 precondition before Tanda 3 (M3).
