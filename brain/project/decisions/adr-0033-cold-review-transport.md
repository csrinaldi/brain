# ADR-0033 — The cold review runs as a spawned subagent: the transport is a stage engine, and the producer never holds a credential

**Status**: Accepted · **amended 28/08/2026** (Amendment 1 — see below)
**Date**: 2026-08-21 — Cristian Rinaldi

## Context

`brain:review`'s judgment half is built and unreachable. `evaluateInferential`,
`evaluateRefuter`, `resolveJudgment` and `buildVerdict` all exist and are tested;
`gatherInferentialInputs` exposes `deps.generate` as the seam that would feed them. Two
measurements on `main @ 005dc35`:

```
grep -c 'deps.generate' brain/scripts/review/cli.mjs   → 0 production callers
grep -n  'VALID_OPS'    brain/scripts/harness/cli.mjs  → VALID_OPS = ['init']
```

`main()` is invoked with no arguments, so `inferentialDeps` is reachable only from tests.
The seam exists; nothing can enter it.

`inferential.mjs` refuses to pick a transport and says why:

> *"There is no production default and this file will not invent one: slice 3's ADR
> decides whether it is an SDK call, a spawned agent, or the harness, and that decision
> changes the reviewer's network, credential and determinism surface."*

This ADR is that decision.

It arrives with two constraints that are facts rather than preferences. The maintainer
has **no API access**, so an SDK call is not implementable today. And M5 and M8 are being
built on one premise — *a stage, an engine, and a model, all declared* — so a transport
that is not shaped like a stage engine is a second mechanism that M8 would have to
absorb or fight.

## Decision

**The cold review is an SDD stage. Its engine is a subagent spawned through the harness
port. Its output is a file. Only `brain:review` touches the forge.**

Four parts, and each is separable:

1. **Resolution.** `sdd.map['cold-review'] → { engine, model }`. `model` is a
   pass-through: brain does not interpret it, validate it against a catalogue, or map it
   to a tier. This is #323's already-ruled shape for M8's router; the cold review is its
   first inhabitant rather than a second opinion.
2. **Execution.** The orchestrator spawns the engine through the harness with a prompt
   and a model. The harness gains one op.
3. **Output.** The engine writes `openspec/reviews/pr-NNN/cold-review.md`, carrying a
   ` ```brain-findings/1 ` block. It is written, never committed by the run.
4. **Projection.** `brain:review` reads that file, merges its findings into the existing
   pipeline, challenges them, builds the verdict, and posts — the fenced block plus
   inline comments on the changed lines.

### Why the producer holds no credential, stated as the property it buys

The subagent reads a cold worktree and writes a file. It does not post: nothing in the
projection step reads anything the producer says as an instruction to publish.

**WHAT "HOLDS NO TOKEN" MEANS, AND WHAT WARRANT EACH HALF CARRIES.** This sentence once
read "it opens no connection to the forge, holds no token, and posts nothing", stated
flatly and followed by *by construction rather than by care*. The third cold review of
this ticket measured that it was broader than anything enforcing it, so it is narrowed
here to the property that is actually bought:

| channel | closed by | warrant |
|---|---|---|
| brain's poster credential in the environment | `withoutCredentials` — `spawnSync` hands the child an explicit `env` | **by construction**: the kernel, which does not consult the child. **[Amended by Amendment 1 (#773) — this row is now a RULED position rather than an inherited one: making `BRAIN_REVIEWER_TOKEN` readable from a file was proposed and REFUSED, so the credential stays on the environment axis, which is the axis the scrub reaches]** |
| a credential injected ambiently by a proxy (#604) | `gatherIdentity`'s negative control, which refuses the whole run before the stage spawns | **by construction**: the run does not reach the producer at all |
| a repo-local `.env` **in the producer's cwd** | the detached worktree at the PR head, where a gitignored file does not exist | **by cost, not by construction** — see below |
| a forge CLI's own store outside the repository (`~/.config/gh`, the OS keyring) | `producer-forge-reach.mjs`, which probes the producer's environment and REFUSES when a forge CLI still authenticates | **by measurement, failing closed** — a probe that cannot reach a verdict refuses |
| any other credential, read by any other tool | nothing | **not claimed** |

The producer also necessarily holds ONE credential it must hold — the engine's own; it
cannot authenticate to run otherwise. The property is not "the child's environment is
empty of secrets"; it is "the child cannot authenticate as brain's poster".

The last row is the honest one. The producer holds a shell, and a credential brain
cannot name read by a tool brain cannot enumerate is an open namespace. This decision
buys the channels above and says so, rather than asserting one nobody reads.

**AND THE WORKTREE ROW WAS OVERSTATED — corrected here, found by the producer itself.**
It read *"by construction"*, and the fifth cold review measured it **from inside its own
process**, which is the only place the question can be settled:

> *"`cwd` is not a confinement. `defaultRun` sets `spawnSync`'s `cwd` and nothing else;
> there is no chroot, no sandbox flag anywhere in the arg list. And the prompt hands the
> producer the operator's tree as an ABSOLUTE path in its very first instruction. Measured:
> `test -f <operator tree>/.env` returns TRUE from the producer."*

The premise is true and the conclusion did not follow: the worktree means the file is not
in the producer's working directory, so nothing trips over it — but `token.mjs` names that
file as where `VCS_TOKEN` lives, and the prompt itself discloses a path outside the
worktree because that is how the artifact gets written. **Raising the cost of reaching a
credential is not closing the channel**, and calling it "by construction" is the same
warrant inflation this table was rewritten to remove, committed in the rewrite.

**What would close it** is the shape the forge-CLI row already has: a probe, not a claim.
Two candidates, neither built here — a producer confined by something the kernel enforces
(a sandbox brain cannot assume under ADR-0005), or a post-run check that the operator's
tree carries exactly one new untracked file at the artifact path. The second is cheap and
is currently asserted only by a test, never in production: **nothing today would notice a
producer that edited code on its way past**, and the verdict would still say only a review
happened. That gap is named rather than closed, because naming it is what this table is
for.

This is the load-bearing half. `reviewer-protocol.md` §2's three structural locks —
COMMENT-only state, no approve verb in the port, the two-key split — all live in the
poster. A producer that posted would need each lock re-proved on a second surface, and
the credential that surface requires is the one #604 proved cannot be trusted where the
environment injects it. That was not theoretical: four consecutive cold reviews of this
ticket's own PRs hit it, and two of them could not produce a verdict at all.

Keeping brain's OWN poster credential away from the producer means the identity problem
cannot reappear on the new path — by construction on the environment axis, and by a
fail-closed probe on the forge-CLI axis. Which warrant covers which channel is the table
above, and it is written that way because "by construction rather than by care" over all
of them was the claim the third cold review had to remove.

### Why growing `VALID_OPS` needs no supersede

ADR-0024 predicts that a `stage → engine` map *"would require its own ADR superseding
ADR-0019's single-lifecycle decision"*. ADR-0019's own rejected alternatives say
otherwise, and the second one is never cited:

> *"Treat the single-`init`-op surface as the normative ceiling. **Rejected**: … the four
> surfaces are the invariant, **the op count is just today's state**."*

Adding an op is permitted. What ADR-0019 forbids is the **SDD artifact lifecycle**
forking per harness — `proposal / spec / design / tasks` produced differently depending
on the backend. `cold-review` produces none of those. Its artifact is consumed by
`brain:review` and by a human reading a PR, not by `phase-order` or `change:archive`.

So this ADR decides a transport and supersedes nothing. The question ADR-0024 was
actually warning about — routing a stage that *does* produce one of the four — is M8's,
and is still ahead.

## Consequences

**Determinism.** Two runs of the same stage over the same tree may differ. The verdict
already carries the vocabulary for this: `evidence_class: inferential` marks a finding as
reasoned rather than observed, and the refuter exists because a reasoned finding must be
challengeable. What changes is that the vocabulary stops being decorative.

**Network.** The reviewer gains a dependency on whatever the engine talks to. It is the
engine's dependency, not brain's: brain spawns a process and reads a file. A failed spawn
is a failure, not an empty finding list — `cli.mjs` already refuses to post rather than
render a green judgment half over nothing.

**Cost.** A review now costs a model run. It is per-PR and visible, and nothing forces it
on a repo that has not declared the map entry.

**The condition disappears.** Every verdict currently carries *"the judgment half is
enabled but no transport is configured"*. This ADR is what retires that sentence, and a
test pins it so the day it goes false is a day a test says so.

## Rejected alternatives

- **An SDK call from inside `brain:review`.** Rejected: not implementable — no API
  access. It also puts a vendor credential in the reviewer's own environment, which is
  the surface #604 measured as untrustworthy, and makes brain a client of a specific
  vendor rather than of a harness it already abstracts.
- **A transport specific to the reviewer, outside the stage/engine shape.** Rejected: it
  is a second mechanism answering the question M8 exists to answer. The reviewer would
  become the one consumer M8's router does not serve.
- **The subagent posts its own findings.** Rejected: §2's locks would need re-proving on
  a second surface, and the producer would need the credential this decision exists to
  avoid. It also collapses two states worth keeping apart — *what was found* and *what
  was published* — into one act.
- **Abstract model tiers (`cheap | balanced | deep`) here.** Rejected *for this layer*, not
  in general: a tier needs a translator to a concrete id, that translator does not exist,
  and building it in the reviewer is the binding M5's role port is meant to own. #323
  already ruled `model` an opaque pass-through in the map.
- **Waiting for M5 and M8.** Rejected: it leaves #682 open for weeks with the judgment
  half on and unable to run in every repo. The provisional-inhabitant pattern is already
  written into `resolve-challenger.mjs`'s header for the challenger binding, and this is
  its second use on the same ticket — with the debt recorded on #312, not only in a
  comment.

## Evidence

- `brain/scripts/review/evaluators/inferential.mjs` — `gatherInferentialInputs`, the DI
  seam and its refusal to invent a default; `CARRIED_FIELDS` and `sanitiseFinding`.
- `brain/scripts/review/poster.mjs` — `deriveInlineComments`, and `postVerdict` riding
  inline comments on the same `prReviewComment` call as the block (#405).
- `brain/scripts/harness/cli.mjs:99` — `VALID_OPS = ['init']`.
- ADR-0019 rejected alternatives 1 and 2 · ADR-0024 lines 53-55 · ADR-0032 / #495 D1
  (the fenced-block family rule).
- #604 (the negative control), and the four cold-review rounds on #758 and #762 that
  measured it in practice.
- #323 (`model` as opaque pass-through) · #456 (the stage set as data) · #576 / #754 (the
  Adversary archetype that takes over the prompt) · #552 (the state a producer without a
  challenger re-creates).

## Amendment 1 — the poster credential stays shell-resolved, and that is now a ruling (issue #773)

**Signed**: 28/08/2026 — Cristian Rinaldi

### What changed

Nothing in the mechanism. `BRAIN_REVIEWER_TOKEN` is still resolved from the shell alone by
`review/identity.mjs:144`, and `withoutCredentials` still removes it from the producer's
environment. What changed is the **status of that arrangement**: it was an omission, and it is
now a decision. The warrant table's first row carries a ruling, not an inheritance.

The proposal this refuses is **1b** of `docs/inbox/credential-roles-coexistence.md`: making the
reviewer token readable from a file, so a developer configures nothing. **1a** — one environment
reader, one stated precedence, one refusal shape — is untouched by this amendment and remains
#316's work.

### Why

The question that produced 1b was a product question: *the developer should see SDD stages hand
off without setting anything.* Answering it required writing down the product model, which had
never been written — `docs/inbox/cold-review-as-product-stage.md`, on `main`.

The model settles it. A workflow engine **started by the developer** — one session that comes up
and lives while they work — carries the credential for every stage it runs:

- the developer starts the engine **once**, with the credential in that session's environment;
- every stage inherits it **in-process**: no `.env`, no export per terminal;
- the producer receives it **scrubbed**, and this row stands unchanged.

So the transparency 1b was meant to buy is delivered by the session boundary, not by moving the
credential to disk. **The product requirement and the warrant are not in tension once the
boundary is drawn in the right place.**

The reframe underneath it is worth recording, because the first statement of the model had it
backwards: the product does not need the SUBAGENT to hold the reviewer credential. It needs the
STAGE to act as the reviewer — which is what this ADR already builds. The subagent writes a
file; the parent reads it, folds it into the verdict, and posts. Identical product behaviour,
and the credential never leaves the parent.

### What 1b would have cost, measured

`withoutCredentials` removes credential **names from the environment**. A file on disk is not an
environment variable, and the fifth cold review of #682 measured the producer reaching one from
inside its own process:

> *"`cwd` is not a confinement. `defaultRun` sets `spawnSync`'s `cwd` and nothing else; there is
> no chroot, no sandbox flag anywhere in the arg list. And the prompt hands the producer the
> operator's tree as an ABSOLUTE path in its very first instruction. Measured:
> `test -f <operator tree>/.env` returns TRUE from the producer."*

So 1b would have moved this row from `by construction` to `by cost` — the removal of the table's
only kernel-enforced guarantee, and `reviewer-protocol.md` §2's three structural locks
(COMMENT-only state, no approve verb in the port, the two-key split) all live behind the
credential it protects. `VCS_TOKEN` already sits on the by-cost side and that was accepted
knowingly: it opens pull requests. The poster credential posts verdicts. The two are not
interchangeable, and this row exists because of the difference.

### The accepted loss, stated rather than left as a leftover

A developer still exports one variable when the session starts. #316 delivers diagnosability —
one reader, one precedence, a refusal that names the role, the source and the resolved identity —
and it delivers **nothing** of "set nothing". That is the price of this ruling and it is not
hidden: the answer to the ergonomics is the engine session, and it is a product decision, not a
shrug.

`docs/reviewer-setup.md` follows this amendment: shell-only is the supported shape, by decision.

### What this amendment does NOT cover

**An engine started unattended.** A daemon or a cron job with nobody to type has to read the
credential from somewhere on disk, and that is 1b under another name. This ruling does not cover
that case, and the day it is wanted it reopens **here**, against this text, rather than arriving
as an omission nobody recorded.

**Two future surfaces, named so they open against a decision:**

- **CI is the easy case, not the hard one.** In CI secrets arrive as environment variables —
  exactly what `withoutCredentials` reaches. This row holds unchanged, and CI does not ask for 1b.
- **MCP is a different question, and it is not 1b either.** An external agent invoking the stage
  means brain does not control the process holding the credential. That is not *"is the token
  read from a file"* but *"who is the caller and how does it authenticate"* — **#357**'s
  territory, whose recorded recommendation is MCP as an ADDITIONAL surface rather than a
  replacement for `AGENT_PLATFORM`.

**And it claims nothing new about reach.** This amendment rules on where the credential is READ
FROM. It says nothing about what the producer can reach once running: the table's last row —
*any other credential, read by any other tool → not claimed* — is unchanged, the forge-CLI row
still carries its fail-closed probe, and **#775** owns the case where that probe refuses on a
machine a developer actually uses. **#772** owns the post-run tree check, which detects a
producer that CHANGED the tree and says nothing about one that READ a credential. Neither is
unblocked or blocked by this ruling.

### The guard this ruling puts on #316

`#316` unifies the `.env` parsers, and its diff is the one place 1b could land by accident: a
refactor that routes `identity.mjs` through the port's reader would make the reviewer token
file-readable as a side effect, and **the diff would look like plumbing**. #316 therefore carries
an explicit non-goal citing this amendment. A reviewer who sees the reviewer token gain a file
path in that PR is looking at a doctrine change wearing a refactor's clothes.
