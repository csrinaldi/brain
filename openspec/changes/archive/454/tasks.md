---
status: draft
issue: 454
---

# Tasks — #454

## Human (Tier 2 — an agent may draft, a human signs)

- [ ] **T0** Direction signed: **option (A)**, a config-declared identity set.
- [ ] **T1** ADR-0026 Amendment 3 — §1c's three acts + §1d's cascade, one commit.
      `brain:promote` refuses in-place edits by design; #509 is that automation, unbuilt.
      `promote-amendment-3.sh` applies the four edits deterministically and stops before
      committing. Anchors dry-run clean against `main`.

## Implementation

- [x] **T2** `defaultReadAgentActors` — `?? []`, absent by default, **no migration**.
- [x] **T3** `evaluateDistinctAct`'s exempt set extended; `gatherActorCheckInputs` threads it.
- [x] **T4** This repo's `brain.config.json` declares its agent identity — the only place a
      platform name appears.
- [x] **T5** `agent-identity-agnostic.test.mjs` — the structural lock, deriving its forbidden
      strings from the config.
- [x] **T6** Evaluator tests: exempt does not re-arm · absent key still re-arms · unresolvable
      still re-arms · third party still re-arms · §9 unchanged · reader threaded · SHIPPED
      reader defaults to `[]`.

## Verification

- [x] **T7** Full suite: **2926 tests, 0 failures**.
- [x] **T8** Five mutations, each diff printed before it ran:

  | | mutation | turns RED |
  |---|---|---|
  | M1 | `agentActors` dropped from the exempt set | REQ-454-1, -4 |
  | M2 | the reader is never threaded into the inputs | REQ-454-5 |
  | M3 | the reader defaults to a value instead of `[]` | REQ-454-6 |
  | M4 | a vendor literal planted in the decision path | REQ-454-8 |
  | M5 | one identity declared in both keys | REQ-454-9 |

## What the work corrected — recorded because they were wrong turns

- [x] **T9** The ticket's premise was false. Agent commits DO resolve to an account; they are
      foreign because the identity is unlisted, not because it is unattributable. Found by
      driving the API, not by reading the ticket. It also means the ticket's proposed
      direction (1) buys no security property, which is why the loss is written into the
      amendment.
- [x] **T10** The agnosticism guard's first scope was wrong and would have condemned the
      adapter pattern. 18 files reported; reading them showed nearly all are adapters, where
      naming a platform is the point. Re-scoped to the decision path.
- [x] **T11** M3 came back GREEN on the first run. Every test drove `evaluateActor` directly,
      so none ran the shipped reader — the same gap #510's M3 found one ticket earlier, in a
      different file. Closed by REQ-454-6.
