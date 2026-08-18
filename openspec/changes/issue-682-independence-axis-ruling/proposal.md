---
status: draft
issue: 682
---

# Proposal — rule the refuter's independence axis, and put it on the tier ladder (issue 682)

## What

The ruling #682's acceptance criterion 1 asks for, and only that. **No producer
is built and no challenger is built.** The deliverable is the decision, with its
cost in the same sentence, exactly as the ticket demands — and one adjustment
the decision forces on a claim `test/fresh-install/` currently enforces.

## Why

#682 was opened by #552's ruling and deliberately left unscoped by the agent
that made it. Its own body says the scoping is the deliverable, and its first
acceptance criterion is a ruling on the refuter's independence axis *before any
code*.

Everything that ruling waits on is already paid for. #552's four sequencing
preconditions, measured on `main` @ `46fb991` rather than assumed:

| # | precondition | state | evidence |
|---|---|---|---|
| 1 | #552 landed — the refuter fails closed and is visible on the wire | met | #552 closed 2026-08-15 |
| 2 | **a production `refuterRunner`** | **open** | `cli.mjs:510` still reads `runner: deps.refuterRunner ?? null` |
| 3 | #575 Ruling 3's mechanical-only declaration | met | #683 and #690 both closed |
| 4 | the producer, with its own approved ticket | is #682 | open, `status:approved` |

**One precondition is open, and it is the axis question.** Nothing else blocks.

## The ruling

> **The independence axis is a property of the reviewer, configured per repo and
> graded by tier, and it is declared in every verdict it produces.** The default
> is a challenger in a fresh context — the same model as the launching agent,
> never the same process and never holding the producer's reasoning — because
> that costs one extra model call per reasoned finding and no second vendor
> credential, where a cross-family jury costs a second credential and a second
> price on every run and the human axis costs a person's attention before any
> code is touched.

Four axes, and the ruling picks per tier rather than once for everyone:

| axis | what challenges the claim | cost, in the same sentence |
|---|---|---|
| `human` | a person, before the fixing agent acts | costs a person's attention on every reasoned blocker, and buys the only axis where the challenger is provably not the claimant |
| `same-model` | a fresh context of the launching agent's model, given the finding and the diff and never the producer's reasoning | costs one extra model call per reasoned finding and no new credential, and buys the weakest honest independence — correlated errors remain |
| `cross-family` | a second model family | costs a second vendor credential and a second per-run price, and buys the strongest machine independence |
| `mechanical` | a deterministic check, where the claim reduces to one | costs no determinism at all, and covers only the minority of reasoned claims a test can falsify |

### Why the axis belongs to the reviewer, not to how it is launched

The reviewer can be launched four ways — a subagent from an SDD `cold-review`
stage, a human running `brain:review`, a CI job, or an MCP server. Those are a
distribution question and they are **orthogonal** to this one: every one of them
can run with `refuterRunner: null` and no independence at all.

Binding independence to a launch scenario produces a reviewer that is honest in
one deployment and blind in another, and a verdict whose reader cannot tell
which they are holding. So the axis is resolved from config and tier, and every
scenario inherits the same answer.

### Why the default is not `human`

`escalate: 'human'` is already wired and free, and it is the honest floor. It is
not the default because it is opt-in by the maintainer's ruling: a reviewer that
stops for a person on every reasoned finding cannot run unattended, which is the
mode three of the four launch scenarios exist to serve.

## The adjustment this forces, and it is not optional

Making `same-model` the default challenger means a repo running the inferential
producer needs a model credential in the reviewer's environment. `brain:review`
today shells out to `gh`/`glab` and nothing else.

`test/fresh-install/in-container.sh` **enforces** the opposite claim for the
install path:

```
#   1. Install @logikas/brain from the REGISTRY, with no credential
# No credential gate. See the header: needing one was the defect, not the setup.
```

That claim was #435's exit criterion and it shipped one week ago. So:

> **The inferential producer is OFF at the `lite` tier.** With no producer there
> are no reasoned findings, with no reasoned findings there is nothing to
> challenge, and a fresh install keeps needing no credential. #682's own cost
> table already points here — *"tier — almost certainly not `lite` by default"*.

`lite` therefore keeps today's behaviour exactly: mechanical controls only,
declared as such since #683/#690.

## The declaration, and why it is the non-negotiable half

A configurable axis makes the strength of a challenge vary per repo and per run.
Without a declaration, two verdicts render byte-identically:

```
refuter_outcome: 'corroborated'   ← challenged by the same model, fresh context
refuter_outcome: 'corroborated'   ← challenged by a different model family
```

Two evidentiary strengths, one rendering. That is #552's own defect a third time
over, and worse here because a *configuration option* produces it: the repo that
picks the cheapest axis gets a verdict that reads exactly like the repo that
paid for the strongest.

#683 exists for this shape one field over — *"a mechanical-only verdict does not
say it is mechanical-only"*. The same rule applies: **a verdict states which axis
challenged its reasoned findings, or the axis is not evidence.**

## The constraint this puts on the producer

The runner contract already carries a context boundary:

```js
runner(inferentialBlockers) → { outcomes: [{ id, outcome, rationale }] }
```

The challenger receives findings, never the producer's reasoning. That boundary
is only real if the finding object does not carry the producer's chain of
thought in its own fields. **That is a constraint on the producer's output
shape**, it does not enforce itself, and it belongs in this ruling because the
`same-model` default is worthless without it.

## Configuration surface

The reviewer already resolves behaviour from `brain.config.json` through
`resolveTier` / `tierParams` / `resolveReviewProtocol` (`cli.mjs:279`), and
#682 notes `reviewer.protocol` is already overridable per repo. The same seam:

```json
"reviewer": {
  "inferential": {
    "enabled": null,
    "level": 2,
    "challenger": {
      "axis": "same-model",
      "agent": null,
      "model": null
    }
  },
  "convergence": {
    "maxRounds": 2
  }
}
```

`null` means *resolve from tier*. Tier defaults:

| tier | producer | challenger axis |
|---|---|---|
| `lite` | off | — (nothing to challenge) |
| `standard` | on | `same-model` |
| `regulated` | on | `cross-family` |

`convergence.maxRounds` is a **separate key on purpose**. The round limit
governs whether a fix converges; the challenger governs whether the finding was
true. They fail differently and a reader who finds them nested together will
conflate them.

### The failure mode the round limit does not catch

Worth recording because it is the clearest argument for the challenger existing
at all. In a review→fix loop, the fixing agent complies with a finding; it does
not test it. A reasoned finding that is confidently **wrong** is therefore the
one that converges *fastest* — one round, no disagreement, no escalation — while
the round limit only fires when the loop fails to converge.

The loop catches disagreement. The challenger catches falsehood. Neither
substitutes for the other.

## What this is not

Not the producer and not the challenger — #682 requires those to land together
and this change builds neither. Not the launch scenarios, which are a separate
distribution ticket. Not a backfill of anything.

## Almost certainly needs an ADR

The ruling changes the reviewer's dependency surface, its credential surface and
its determinism — the three properties ADR-0021, ADR-0022 and #604 lean on — and
it adds a tier-resolved default. Drafted to `brain-drafts/`, promoted with
`brain:promote`, signed by a human, per ADR-0028.

## Open for the maintainer

1. **The `lite`-off adjustment.** It is the one place this proposal moves
   something the maintainer did not ask for. Rejecting it means accepting that
   a fresh install needs a model credential, and that `test/fresh-install/`
   changes.
2. Whether `regulated` defaulting to `cross-family` is worth the second
   credential, or whether it should default to `same-model` with `cross-family`
   opt-in as well.

## References

- #682 (this ticket) · #552 and `openspec/changes/issue-552-inferential-producer-ruling/spec.md` (the ruling this one continues)
- #683 / #690 (the declaration rule this applies one field over) · #575 Ruling 3
- #604 Ruling 3 · #413 · ADR-0031 (provenance is not authorship) · ADR-0026 (the tier surface)
- #405 / PR #490 (inline comments, built, zero producers) · #394 (the escalation-storm guard)
- #435 and `test/fresh-install/` (the credential-free claim this ruling protects)
- `brain/scripts/review/cli.mjs:510` · `lib/causal-admission.mjs:97` · `evaluators/refuter.mjs:42`
