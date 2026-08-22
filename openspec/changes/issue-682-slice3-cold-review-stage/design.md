# Design — the cold review as an SDD stage

Every decision below was ruled by the maintainer on 2026-08-21, or measured against
`main @ 005dc35`. Nothing here is inferred from a report.

## D1 — `cold-review` is a stage, and Compuerta 1 does not block it

**Ruled:** *"cold-review debe sí o sí ser un stage de SDD, como todos en el futuro;
toda etapa custom o no debe tener su directorio/archivo dentro de openspec."*

ADR-0024 lines 53-55 predict that a `stage → engine` map *"would require its own ADR
superseding ADR-0019's single-lifecycle decision"*. It does not, and ADR-0019's own
rejected alternatives are why. There are two, and only the first is ever cited:

> - **"Expand `VALID_OPS` to route scaffold/verify/archive per-backend."** *Rejected:
>   … the SDD artifact lifecycle would fork per harness instead of staying one evidence
>   contract.*
> - **"Treat the single-`init`-op surface as the normative ceiling."** *Rejected: it
>   would force a future legitimate surface op … the four surfaces are the invariant,
>   **the op count is just today's state**.*

The second one settles the harness question outright: **growing `VALID_OPS` is already
permitted.** What ADR-0019 forbids is forking the SDD **artifact lifecycle** per
harness.

`cold-review` cannot fork it, because its artifact is not one of the four. The lifecycle
ADR-0019 protects is `proposal → spec → design → tasks`, files in a change dir consumed
by `phase-order` and `change:archive`. A review artifact is consumed by `brain:review`
and by a human reading a PR. Routing it touches neither.

**Therefore:** this change needs an ADR for what it *does* decide — network, credential
and determinism — and needs no supersede. Compuerta 1 stays open for M8, where a stage
that *does* produce one of the four gets routed. That is the case ADR-0024 was warning
about, and it is still ahead of us.

## D2 — the artifact lives at `openspec/reviews/pr-NNN/`, not in the change dir

**Ruled:** *"openspec/reviews/pr-NNN/ — la review mira el PR, no el change."*

A change dir is keyed by the ticket being implemented. A review is keyed by the diff
being read, and one PR can span work that no single change dir owns. Keying the artifact
by PR number keeps the primary key equal to what the reviewer actually looked at.

It also keeps `phase-order` honest: `openspec/changes/**` is what Rules A and C walk. A
review artifact appearing inside a change dir would be a fifth artifact in a lifecycle
that has four, which is precisely the fork D1 argues does not happen.

## D3 — the file is written, never committed, by the review run

The verdict is bound to `head_sha`, captured at cold boot, and §10 makes a verdict whose
head moved stale. If the review run committed its artifact to the PR branch, the head
would move **after** the read: the review would invalidate itself, every time.

So the run **writes** `openspec/reviews/pr-NNN/cold-review.md` and stops. Whoever
addresses the findings commits it, in the same commit that answers them — the same way
an agent writes `design.md` and a human's commit is the signature (ADR-0028).

Two things fall out, and both are improvements:

- The record of *what the review said* lands next to *what was done about it*, in one
  commit, instead of floating as a separate act.
- The committed artifact makes the review itself checkable for report-vs-tree drift: a
  later cold read can diff the artifact against the posted verdict. Today that
  comparison has no left-hand side.

## D4 — the producer writes a file; only the verb touches the VCS

The subagent has no VCS credential, opens no connection to the forge, and posts nothing.
`brain:review` reads the artifact, merges its findings into the existing pipeline, and
posts.

This is not tidiness. §2's three structural locks — COMMENT-only state, no approve verb
in the port, the two-key split — all live in the poster. A second posting surface means
each lock must be re-proved there, and the credential that surface would need is exactly
the one #604 proved cannot be trusted when the environment injects it. Keeping the
producer credential-free means the four rounds of identity trouble this ticket already
survived cannot recur on the new path.

Measured, so the seam is not imagined: `deriveInlineComments(findings)` yields
`{path, line, body}` for every finding carrying `file` and a positive-integer `line`,
and `postVerdict` rides them on the **same** `prReviewComment` call as the fenced block
(#405), reporting `inlineDropped` when an anchor is lost. The PR half is built. What was
missing is a reader that produces anchored findings.

## D5 — the artifact is a fence-tagged file, not a `protocol:` block

#495 D1, carried into ADR-0032, draws a family line:

| family | shape | why |
|---|---|---|
| posted to the VCS | ` ```yaml ` + `protocol: <name>` | a comment is rendered by the forge; `yaml` gets highlighting |
| **a file in the repo, read by a verb** | ` ```<name> ` — **the tag IS the selector** | nothing renders it for a human reviewer of a diff |

The review artifact is the second family: ` ```brain-findings/1 `.

Writing it in the first family's shape would be a live defect, not a style choice.
`parse-verdict.mjs` accepts any block whose `protocol:` is `brain-review/1|2`; a file
carrying that shape, once committed, becomes a verdict block in the repo. `cold-boot.mjs`
computes `rev` and holds the anti-loop lock from verdict blocks. This is the corruption
the round-3 cold read refused to cause when it declined to hand-write a block, stated as
a rule instead of a judgement call.

## D6 — the finding contract is already fixed, and this change does not widen it

`gatherInferentialInputs` takes **coordinates** — `worktreePath`, `baseSha`, `headSha`,
`changedFiles`, `prBody` — and never a diff string, so the generator reads the diff
itself from the cold worktree. Its return is an array of findings, each projected onto
`CARRIED_FIELDS` (`id`, `severity`, `evidence_class`, `evidence`, `cites`, `file`,
`line`) by `sanitiseFinding`. Anything else is dropped, which is what makes REQ-682-4
testable rather than aspirational.

The artifact carries exactly those fields, and `file`/`line` are what become inline
comments. A generator that throws or returns a non-array is a **failure**: `cli.mjs`
refuses to post rather than render a green judgment half over an empty list. Reading an
artifact that is missing, unparseable, or carries no findings block must fail the same
way — "the file was not there" and "the reader found nothing" are different states and
must not render identically.

## D7 — the model is a concrete id, opaque to brain

**Ruled.** `sdd.map['cold-review'] = { engine, model }`, where `model` is a
pass-through: brain never interprets it, never validates it against a catalogue, never
maps it to a tier. #323 already ruled this shape for M8's map; this change is its first
inhabitant rather than a second opinion.

The rejected alternative is abstract tiers (`cheap | balanced | deep`), which the roadmap
recommended for M5's **port**. It is rejected *here* and not in general: a tier needs
something to translate it to an id, that translator does not exist, and inventing one in
the reviewer would be the binding M5 is meant to own.

The verdict declares the axis (REQ-682-3). Whether it should also declare the model is
left open deliberately — it is a disclosure question, and the honest place to answer it
is once a real run exists to disclose.

## D8 — the provisional half, recorded where the last one was

The prompt handed to the spawned engine is the cold-reviewer **role**, which #754 says
exists nowhere and which #576's Adversary archetype will own. Until M5 lands it is a
provisional inhabitant, declared in the same terms `resolve-challenger.mjs`'s header
already uses for the challenger binding:

> *PROVISIONAL: … WHEN #312 LANDS: delete the binding half and call the port instead.*

This is the second use of that pattern on this ticket. It is recorded here, in
`tasks.md`, and against #312 — not only in a comment — because the first one was found
by a cold review reading the comment, and a debt that depends on someone reading a header
is a debt that gets paid late.
