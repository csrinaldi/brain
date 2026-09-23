---
status: draft
issue: 442
---

# Tasks — #442

- [x] **T1** `resolveReviewProtocol(config, tier)` beside `resolveTier` — the function the
      module's own docstring already named.
- [x] **T2** `cli.mjs` resolves through it, and a throw becomes a readable boot refusal that
      posts nothing.
- [x] **T3** `brain.config.json` requests `brain-review/2` — the dogfooding.
- [x] **T4** 4 pure guards (every tier × absent/explicit/unknown) + the shipped-config guard.
- [x] **T5** 3 e2e cases over a real config file and the real CLI: override → `/2`, absent →
      `/1` on the wire, unknown → refuse.
- [x] **T6** `fixture.mjs` gains `protocol`, omitting the key when null so the tier-default path
      stays testable.
- [x] **T7** Four mutations RED.
- [x] **T8** Full suite: **3118 tests, 0 failures**.

## Recorded

- [x] **R1** **The ticket's "does not do" list has one entry that expired.** It said verdicts
      would carry annotated findings but empty `follow_ups`, "same as at regulated today".
      #408 landed first, so brain's own reviews now get the annotation AND a working
      `pre-existing` producer. Sequenced apart, they compose.
- [x] **R2** **Four CLI tests went red and one was named "no override".** They load the real
      `brain.config.json`, so they observe brain's ACTUAL resolved protocol — which is what
      makes the dogfooding visible from the CLI rather than only from a fixture. Rewritten to
      the new truth; the property they carried moved to the pure and wire layers, where it can
      be stated without depending on what brain happens to declare.
- [x] **R3** **The no-override e2e needed two layers because `parseVerdict` is asymmetric**: it
      sets `result.protocol` only for `/2`. One obvious assertion fails against correct output
      and its inverse passes against a broken parser. The wire plus the parser's absence is the
      only pair that says the right thing — REQ-409-6's lesson, one field over.
- [x] **R4** **Fail-closed matters more here than for the tier.** A bad tier changes budgets and
      job sets visibly; a bad protocol falling back changes nothing an operator can see. The
      run succeeds, a verdict posts, and causal admission simply never ran.

## Rebased onto #408, and what the two make true together

- [x] **T9** Rebased onto `main` after #553 merged. Both PRs touched `test/review-regulated/`'s
      fixture and e2e file from different bases, so both conflicted — and both conflicts were
      append-vs-append, resolved by keeping **both** sides.
- [x] **T10** **Test counts verified across the resolution**, because a conflict resolution
      that silently deletes tests never turns a suite red (the #522/#523 lesson): the e2e file
      went 12 → 14 (#408) → **17** (+3 here), `cli.test.mjs` 31 → **33** (#408's two CLI cases
      survived the four cases this ticket rewrote), `governance-tiers.test.mjs` → **33**.
      Predicted before resolving, checked after. Full suite **3142 tests, 0 failures**.

- [x] **R5** **The two tickets compose into something neither states alone.** #442 makes brain's
      own reviews `/2`, and the base probe #408 shipped only runs at `/2` — so **brain now
      re-runs `local-checks` at base on its own PRs**. Measured on this branch: `lite` +
      `brain-review/2`, `.brain-source` present, so the reproduction includes the unit suite.
      It fires only when `gate:local-checks` is already a blocker; any other red gate, or a
      green PR, costs nothing. That is the laziness rule being load-bearing rather than
      decorative, and it became true the moment these two landed together.
