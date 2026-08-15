---
status: draft
issue: 575
---

# Spec — the cold review is a stage, not an event (issue 575)

The five decisions #575 asks for. Each states its cost in the same breath as the
choice, and names what it forecloses.

---

## Ruling 1 — Where in the order: a LOOP on a rung, not a fifth rung

**The review is not a new rung on the status ladder. It is a loop whose terminal
state advances an existing one.**

`phase-order-check.mjs`'s Rule B enforces a monotonic `STATUS_LADDER`:
`draft → proposed → spec → designed → tasked → applying → verified → archived`.
A rung that could be re-entered would break the one property Rule B exists to
hold, and a review is re-entered by design — fix → re-review is the loop the
whole ticket is about.

The resolution is that **the loop and the ladder measure different things**:

- The **iteration** is already modelled, and not on the ladder: verdicts are
  keyed by `(pr, head_sha, reviewer)` and carry a revision number, bounded by
  protocol §7 at `rev >= 3` → forced `STOP` + `escalate: human`.
- The **terminal state** is monotonic. `reviewed:approved` is reached once and
  is never un-reached by a later fix; a `REVISE` verdict does not move the
  status backwards, it simply fails to advance it.

So the review occupies the span between `applying` and `verified` without adding
a rung to it. Nothing in Rule B changes.

**Cost:** `phase-order` cannot express "this change is mid-review" as a status,
because that is a property of the PR rather than of the change folder. Ruling 5
makes the skip visible through the label index instead.

**Forecloses:** a `reviewing` status between `applying` and `verified`. It would
have to be non-monotonic to be truthful, and Rule B would then be enforcing a
ladder with a hole in it.

---

## Ruling 2 — The artefact is the posted verdict, and the change folder gains nothing

**The stage's output artefact is the `brain-review/N` verdict on the pull
request. No review file is added to `openspec/changes/**`.**

Two properties make the verdict the artefact and disqualify a file:

1. It is bound to `head_sha` and is not posted if the head moved mid-run
   (protocol §10, `reviewed:stale`). A file in the change folder has no such
   binding.
2. It is authored by an identity that is **not** the author's. A file in the
   change folder is written by the author's own worktree, so it could carry
   neither the identity nor the coldness the verdict exists to record. A review
   artefact the author can write is not a review.

**The gate does not have to learn to parse verdict comments** — which is the
alternative cost #575 raises. The index already exists: `reviewed:approved` /
`reviewed:revised` / `reviewed:stopped` / `reviewed:stale` are labels
reconciled from the verdict comments by `brain:review:board` (protocol §9), with
`deny-set.mjs` restricting the reviewer's label writes to `seq:*` and
`reviewed:*`.

So the layering is: **the verdict is the authority, the label is the derived
index, the gate reads the index.** Three layers, one authority.

**Reading a label is still reading the server**, and an earlier draft of this
ruling claimed otherwise. Correcting it changes where the gate goes, so the
distinction is worth stating exactly — measured on `main`:

| gate | reads labels today |
|---|---|
| `actor-check` | **yes** — `fetchIssue` returns `{ labels, author }`; `status:approved` and `override:*` are read from it |
| `phase-order-check` | **no** — zero occurrences; its inputs are `changedFiles` and `changeDirs` |

So for the gate layer as a whole this is **not** a new capability, and for
`phase-order` specifically it **is** — a whole new class of input.

**Consequence, which the corrected claim forces:** the skip-detection gate of
Ruling 5 is **not** `phase-order`. Its natural home is the label-reading layer
where `actor-check` already lives. Putting it in `phase-order` would hand a
file-shaped checker a server-shaped input, for no reason other than that
"stage" and "phase-order" sound related.

What is genuinely cheaper is only this: the gate reads a label, as one gate
already does, instead of fetching a comment thread and running `parseVerdict`
over it. That is the whole saving, and it is smaller than the earlier draft
implied.

**Cost:** the index can lag the verdict — a label desync is the failure mode
§9 already names, and `brain:review:board` is the repair. A gate reading a stale
label is reading a stale index, not a wrong verdict.

**Forecloses:** duplicating the verdict into the change folder. That would
create a second authority for one fact — precisely the defect #555 spent a
ticket removing, re-introduced one release cycle after it closed.

---

## Ruling 3 — The two controls are the `/2` schema's own split, and slice 1 must declare itself incomplete

**Mechanical control is `evidence_class: deterministic`. LLM judgment is
`inferential`. This is not an analogy — it is the vocabulary `brain-review/2`
already declares.**

The mechanical half exists and runs today. The judgment half has a slot, a
refuter wired to fork on it, and **no producer** (#552, verified open).

The stage therefore ships in two slices, and the ruling is about what slice 1
must **say about itself**:

> A mechanical-only review MUST declare that it ran mechanical checks only.

Without that declaration, a consumer reads "no judgment findings" as "a
judgment control ran and found nothing" — the `evidence-reader-empty-on-failure`
family, at the level of the stage rather than a function. "No judgment was
applied" and "judgment found nothing" are different answers, and slice 1 can
only honestly give the first.

**Cost:** slice 1 delivers roughly half the value #575 describes, and says so on
every verdict it posts. That is the point of the declaration.

**Forecloses:** shipping the stage as though it were whole, and hand-feeding
`evidence_class: inferential` to make the fork reachable — refused one level
down already, in #552's own terms: *"inventing the claim would be worse than
omitting it."*

---

## Ruling 4 — It runs as the reviewer identity, in an environment that can prove it

**The `reviewActors` / `approvalActors` separation survives unconditionally, and
the stage additionally inherits #604's requirement on its environment.**

The separation is protocol §2's lock 3 and §11's standing instruction — *"do not
register any reviewer handle in `governance.approvalActors` — ever."* A stage
that runs as the author's identity dissolves lock 3, so the stage's runner is
the reviewer identity, never the author's, and never an identity in
`approvalActors`.

**#604 adds a second requirement that did not exist when #575 was filed.** A
run whose identity evidence is ambient proves nothing about who ran it: behind a
credential-injecting proxy, an invented token and no token at all resolve to the
same login. The stage must therefore run **where the negative control clears** —
an environment that honours credentials.

Those two requirements converge on one shape, and it is the shape #604 already
named: **a GitHub Actions job holding the PAT as a repository secret.** Real
verified identity, auditable run, and — the part that matters for half 2 — no
authoring context **by construction** rather than by convention.

**Cost:** the stage cannot run from an agent container that proxies credentials,
which is where the improvised reviews in #575's own session ran. That is a real
capability loss and it is the correct one: those runs could not have proven
their own coldness.

**Forecloses:** running the stage as a subagent inside the authoring session.
That is the arrangement #604 half 2 describes — every lock passes and the
verdict is indistinguishable from a cold one — and making it a *stage* would
promote it from an accident to a design.

---

## Ruling 5 — Skipping is DETECTED at `lite` and `standard`, REQUIRED at `regulated`

**The gate is a label-reading gate, not `phase-order`** (Ruling 2's corrected
claim). `phase-order` reads zero labels today; `actor-check` already reads them.
The check belongs where the input shape already fits.

**The gate distinguishes three states, never two.**

| state | meaning | at lite / standard | at regulated |
|---|---|---|---|
| no `reviewed:*` label | the stage did not run | detected, reported | **blocks** |
| `reviewed:revised` / `reviewed:stopped` | it ran and did not approve | detected, reported | **blocks** |
| `reviewed:approved` | it ran and approved | passes | passes |

The tiering follows the authority that already exists rather than inventing one.
At `lite`, `actor-check` accepts a signed `brain-decision/1` — a human has
signed the diff, and a missing cold review is information rather than an
authority gap. At `regulated`, the cold review is the point of the tier.

**The absence of a label may never be read as an approval.** That is the same
discipline as Ruling 3, at the gate: "no review ran" and "a review ran and
approved" must not collapse into one passing state.

The index supports that cleanly, and for a reason worth naming. `board.mjs`
freezes `seq:*` as **uncomputable** when a verdict's `sequencing` cannot be
read — no add, no remove, the fact returned rather than inferred from an absence
— but deliberately does **not** freeze `reviewed:*` alongside it, because
`reviewed:*` derives from `verdict:`, which is mandatory and which `parseVerdict`
answers `null` for when missing.

So a `reviewed:*` label is always computable when a verdict exists. An **absent**
`reviewed:*` therefore means "no verdict", unambiguously — never "a verdict this
index could not read". That is what makes the three-state gate honest rather
than merely careful.

**Cost:** a `regulated` change cannot merge without a cold review, including
when the reviewer is unavailable. The escape is the existing human-only
keystroke (`override:*`, `status:approved`), which is what those keys are for.

**Forecloses:** making the stage advisory at every tier. #575's closing line is
that a stage nothing enforces is the state we are in now, and it is right.

---

## What is NOT ruled here

**#552's own decision.** Whether the `inferential` producer is (a) a reasoning
evaluator or (b) a narrow deterministic-but-uncertain one belongs to #552, which
is `status: approved` and owns it. This spec establishes only that Ruling 3
depends on it, and that #575 supplies the *reason to exist* #552 was waiting for
(see `proposal.md`).

**The stage's own name and config key.** That is #456's surface, not this one's.
Naming it here would hardcode a fifth stage in doctrine while the ticket that
makes stages configurable is still open.
