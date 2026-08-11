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
