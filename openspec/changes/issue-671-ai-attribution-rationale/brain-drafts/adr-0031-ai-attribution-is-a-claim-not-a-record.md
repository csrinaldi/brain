# ADR-0031 — AI attribution in commits is an unverifiable claim, not a provenance record

**Status**: Proposed — pending human signature
**Date**: 2026-08-15 — drafted by agent, per `agent-authorities.md` Tier 2

> **Draft location.** `brain/project/decisions/**` is Tier 3 for the agent —
> prohibited, even if explicitly asked. This file is written to
> `openspec/changes/issue-671-ai-attribution-rationale/brain-drafts/` and is for
> the maintainer to move, review and sign. Moving it into `brain/` also owes
> `brain/HOME.md` an index entry, which `decision-gate` checks.

## Context

`agent-authorities.md` Tier 3 has forbidden this since the list was written:

> `- Add AI attribution in commits (Co-Authored-By: Claude...)`

It is the **only** bullet in that list with no stated reason. Every other entry
is self-evidently about authority or irreversibility — committing to the
knowledge half, approving your own MR, rewriting published history, deploying to
a registry. This one is about metadata in a message, and a reader cannot derive
its cost from reading it.

An unexplained rule in a list headed *"even if explicitly asked"* is a rule that
gets re-litigated. It was, on 2026-08-15, when an agent harness that mandates the
opposite met this repository's doctrine and neither side could yield without
someone deciding. This ADR is that decision, written down so the next reader
inherits the reasoning instead of the argument.

### The rule was decaying, measured

```
commits on main:            264
carrying Co-Authored-By:     28   (10.6%)
carrying Claude-Session:     28
carrying 🤖:                  0
```

Nobody noticed until someone looked. That is #575's thesis — *a stage nothing
enforces is the state we are in now* — written in this repository's own
`git log`.

The one check that referenced the rule made it worse rather than better.
`review/evaluators/tranche.mjs` cited *"CLAUDE.md — never add AI attribution to
commits"* while testing `prBody` and nothing else. Three defects in six lines:
it measured the PR body for a rule about commits, `CLAUDE.md` does not exist in
this repository, and its pattern missed `Claude-Session:` entirely. A finding
that reads as verified and points at no text at all is worse than the wrong line
numbers #580 and #586 repaired.

## Decision

**The prohibition stands, and it stands for this reason: `Co-Authored-By:` is a
self-asserted, unverifiable identity claim written into permanent history.**

This repository spent #413 making the reviewer's handle *verified* against its
token rather than taken from config, and #604 adding a negative control because
a *claimed* identity establishes nothing when the environment can answer for the
caller. An agent writing its own name into a commit trailer is that same defect
one layer down: nothing establishes the claim, and the medium is immutable.

Three concrete costs, each measured rather than argued:

1. **Dead internal URLs in public history.** `@logikas/brain` is
   `private: false`, `access: public`. The 28 `Claude-Session:` trailers point at
   `https://claude.ai/code/session_…`, which resolves for nobody outside the
   machine that wrote it — permanently, in a published package's history.
2. **A model name pinned into immutable history.** `Claude Opus 5` in a trailer
   is exactly what #580/#586 ruled against for citations: do not name a thing
   that ages, in a place that cannot be corrected.
3. **A trailer addressed to no one.** `Co-Authored-By:` is a real git convention
   that feeds contributor graphs and tells a future reader whom to ask *"why did
   you do this?"* Pointing it at an entity that cannot answer empties the
   convention for every legitimate use of it in this repository.

### The counter-argument, and why it does not win

**Provenance is valuable, and this repository wants it.** #604's Ruling 3 holds
that a verdict recording what produced it is the only proposal that makes the
reviewer's coldness *verifiable* rather than *procedural*. Provenance in a
verdict is desirable; provenance in a commit is forbidden. Stated that baldly it
reads as a contradiction.

It is not, and the distinction is the substance of this ADR:

> **Provenance is not authorship.** Provenance becomes evidence when the
> **runner** attests to it — a CI job identity, a workflow run id, a credential
> the claimant does not hold. It is worth nothing when the producer asserts it
> about itself, because the case you most need it for is exactly the case that
> would assert it wrongly.

`Co-Authored-By: Claude` is the producer asserting authorship about itself, in a
field meant for accountable people. That is the shape refused here. A
runner-attested provenance record is a different artefact answering a different
question, and #604's Ruling 3 sequences it behind the CI job that can vouch for
it — deliberately, for this same reason.

## Consequences

**Positive.** The rule now carries its reason, so the next agent that meets a
conflicting instruction can weigh it instead of re-deriving it. Enforcement moves
from memory to mechanism: `hooks/commit-msg` (client) and `hooks/pre-receive`
(server, bypass-proof — `--no-verify` is a client-only flag, and `core.hooksPath`
is per-clone, so the server half is the one that always runs). One shared corpus
pins the two hooks and `tranche.mjs` together, closing the one-rule-three-
implementations hazard before it produces its first drift.

**Vendor-neutral by construction.** brain ships into other people's
repositories, and the doctrine says *"AI attribution"*, not one vendor's. A hook
that only recognised the agent this repository happens to use would enforce the
rule here and **silently exempt every consumer using another** — a confident
check over a narrow subject, which is the defect family this repository keeps
closing. The pattern therefore carries an agent list (`claude`, `copilot`,
`chatgpt`, `gpt`, `gemini`, `cursor`, `devin`, `codex`, `aider`, `windsurf`)
rather than a single name.

> **The doctrine text is still vendor-flavoured.** `agent-authorities.md`
> reads *"Add AI attribution in commits (`Co-Authored-By: Claude...`)"*. The
> mechanism is now general and the rule's wording is not. Generalising that
> line is a Tier-2 edit and therefore the maintainer's, not the agent's —
> flagged here rather than done.

**Negative, stated plainly.** The pattern is a list of observed spellings, not a
general detector of AI attribution — no such list can be complete. It will catch
the forms actually in circulation and miss a novel one until that form is added.
A guard that claimed completeness would be the apparent protection
`cites-resolve.test.mjs` exists to refuse (#499).

The breadth has its own cost, and it is the one that matters more: `cursor`,
`codex` and `gpt` are ordinary words. A gate that rejected a commit for saying
*"generated with cursor pagination"* would teach people to reach for the bypass
ADR-0014 §9 prohibits, and would then guard nothing. The `generated` shape
therefore requires a markdown-link bracket, and the shared corpus pins three
such near-misses as **must-accept** — including a human co-author whose surname
merely contains an agent word.

**Accepted cost.** The 28 commits already on `main` are **not** rewritten.
Rewriting published history is the Tier-3 prohibition three bullets above this
one, and the cost of those 28 is already paid. The rule binds forward.

**Interaction with agent harnesses.** Some agent runtimes mandate these trailers
at the system level, so an agent operating here may be under two contradictory
instructions and cannot resolve them alone. The intended resolution is
**squash-on-merge**, which satisfies both without asking either side to break a
rule and without rewriting anything published. This is a real friction and it is
recorded rather than wished away.

## References

- `brain/core/methodology/agent-authorities.md` — Tier 3, the rule this explains
- `brain/scripts/hooks/commit-msg` · `brain/scripts/hooks/pre-receive` — the mechanism
- `brain/scripts/hooks/hooks.attribution-parity.test.mjs` — the shared corpus
- `brain/scripts/review/evaluators/tranche.mjs` — the PR-body finding, and the citation this repaired
- #604 Ruling 3 (provenance vs. self-attestation) · #413 (claimed vs. verified identity)
- #575 (a rule nothing enforces decays) · #580, #586 (do not cite what ages) · #499 (apparent protection)
- #130, #340, #555 (one rule, two implementations)
