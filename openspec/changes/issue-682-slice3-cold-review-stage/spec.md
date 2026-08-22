# Spec — slice 3, the cold review as an SDD stage (#682)

## REQ-S3-1 — `cold-review` resolves like any other stage

- **WHEN** `brain:review` needs the judgment half and `sdd.map['cold-review']` names
  `{engine, model}`
  **THEN** the engine and model are resolved from that entry, `model` is passed through
  opaquely, and the resolved pair is what the run uses.
- **WHEN** the entry is absent
  **THEN** the judgment half does not run, and the verdict says so in `conditions[]` —
  the state that ships today, unchanged.
- **WHEN** the entry names an engine with no backend
  **THEN** the run REFUSES rather than falling back. An engine the operator named and did
  not get is not the same state as one they never named.

## REQ-S3-2 — the harness grows one op, and it does not fork the artifact lifecycle

- **WHEN** the orchestrator runs the `cold-review` stage
  **THEN** it goes through the harness port, with a prompt and a model, and returns what
  the engine produced.
- The op is additive. ADR-0019's second rejected alternative already permits it — *"the
  four surfaces are the invariant, the op count is just today's state"*. What must remain
  untrue is that any of `proposal / spec / design / tasks` is produced differently per
  backend.

## REQ-S3-3 — the artifact is a file at `openspec/reviews/pr-NNN/`

- **WHEN** the stage runs against PR `NNN`
  **THEN** it writes `openspec/reviews/pr-NNN/cold-review.md`, carrying a
  ` ```brain-findings/1 ` block.
- The block is fence-tagged, never ` ```yaml ` with a `protocol:` scalar. A file in the
  repo carrying a verdict's shape would be loaded by `parse-verdict.mjs` and would
  corrupt `rev` and the anti-loop lock (#495 D1, ADR-0032).
- **WHEN** the run finishes
  **THEN** the artifact is written and **not committed**. Committing it moves the head
  the verdict is bound to, and §10 would make the verdict stale against its own commit.

## REQ-S3-4 — a missing artifact and an empty one are different states

- **WHEN** the artifact is absent, unparseable, or its findings block is malformed
  **THEN** the run FAILS CLOSED: it posts nothing and names the cause. It must never
  render a verdict declaring the inferential control applied.
- **WHEN** the artifact parses and its findings list is empty
  **THEN** the judgment half ran and found nothing, and the verdict declares
  `inferential` among the controls applied.

These two must not render identically. That is #552's fold, and the reason
`gatherInferentialInputs` already treats a throw and a non-array as failures rather than
coercing them to `[]`.

## REQ-S3-5 — anchored findings become inline comments

- **WHEN** a finding from the artifact carries `file` and a positive-integer `line`
  **THEN** it appears as an inline comment on that line of the PR, riding the same
  `prReviewComment` call as the fenced verdict (#405).
- **WHEN** an anchor cannot be placed
  **THEN** the count reaches a reader (`inlineDropped`), and the finding's text is still
  in the summary block. A dropped anchor may never become a dropped finding.

## REQ-S3-6 — the fields that cross are the fields that render

- Findings from the artifact are projected onto `CARRIED_FIELDS` before anything else
  reads them, forced to `evidence_class: inferential`, and their ids namespaced.
- A generator that grows a field does not widen the boundary by existing. The oracle is
  not the list: every carried field must appear in a rendered verdict.

## REQ-682-5 — `convergence.maxRounds` is a key of its own

Carried here from #682, where it was declared orphan by the tracker's own `tasks.md` and
never given a task in any slice.

- **WHEN** `reviewer.convergence.maxRounds` is set
  **THEN** it bounds the produce→challenge rounds for a single run, independently of
  §7's `rev >= 3` bound, which counts posted revisions and is a different quantity.
- **WHEN** it is absent
  **THEN** the bound in force today applies, unchanged.

Naming the two bounds separately is the point: one limits how long a single run argues
with itself, the other limits how many times a PR may be re-reviewed. Conflating them is
how a run either loops or stops early for the wrong reason.

## Not in this spec

- `same-model` / `cross-family` challenger axes.
- Whether the verdict should declare the model that produced its reasoned findings — a
  disclosure question, answerable once a real run exists to disclose.
- The `brain:config` surface (#761).
