# Tasks — slice 3, the cold review as an SDD stage (#682)

## Slice A — the contract, before the transport

- [ ] A.1 Define ` ```brain-findings/1 ` and its reader: the fields are `CARRIED_FIELDS`,
      the tag is the selector, and a file carrying `protocol:` shape is REFUSED with the
      reason (#495 D1).
- [ ] A.2 The reader fails closed on missing / unparseable / malformed, and reports
      "ran and found nothing" as a distinct state (REQ-S3-4). Prove both with a mutation
      that makes them render identically and watch a test die.
- [ ] A.3 Wire the reader to `gatherInferentialInputs` as a `deps.generate` that reads a
      file instead of calling a model. **The judgment half runs end to end at this
      point, with a hand-written artifact** — before any agent is spawned.
- [ ] A.4 Prove REQ-S3-5 against a real posted review: a finding with `file`+`line`
      appears as an inline comment. This is M3's exit criterion, reached.

## Slice B — the transport

- [x] B.1 Draft the ADR (`brain-drafts/`) — network, credential and determinism. Promote
      it before B.2. It decides, and this tracker does not proceed without it.
      **ADR-0033, promoted and signed 21/08/2026.** Its own preamble carried a
      `**Status**:` line as ordinary text and `single-status-line` refused the first
      attempt: the verb writes the signature header itself, so the house shape is the
      blockquote it strips. Recorded because the pre-check that missed it validated the
      PARSER (`transformDraft`) and not the GUARDS — two different layers, and only the
      second is what refuses.
- [ ] B.2 `sdd.map` with `cold-review` as its first entry; `{engine, model}`, `model`
      opaque (D7).
- [ ] B.3 The harness op: spawn an engine with a prompt and a model (REQ-S3-2). Additive,
      and the four SDD artifacts stay produced identically across backends — assert it.
- [ ] B.4 The provisional role prompt, with its debt recorded against #312 **in
      `tasks.md` and on the ticket**, not only in a header comment (D8).
- [ ] B.5 The stage writes `openspec/reviews/pr-NNN/` and does not commit (REQ-S3-3).
      Pin the not-committing: a test that fails if the run leaves the tree dirty.
- [ ] B.6 An engine with no backend REFUSES rather than degrading (REQ-S3-1).

## Slice C — the bound and the close

- [ ] C.1 REQ-682-5: `reviewer.convergence.maxRounds` as its own key, distinct from §7's
      `rev >= 3`. Assert the two bounds are not the same number read twice.
- [ ] C.2 Prove the whole path through the real verb, on a real PR: stage runs → artifact
      written → verdict posted with inline comments. #682 acceptance criterion 3.
- [ ] C.3 The negative case stays honest end to end (#682 criterion 6): an engine that
      fails posts nothing and says why.
- [ ] C.4 **Open the terminal PR** `feature/issue-682-slice3-cold-review-stage → main`.
      Named here from the start, per #713.
- [ ] C.5 Cold review of the chain, from an environment where credentials are not
      proxy-injected — the only place a verdict can be produced (#604, measured four
      times on this line of work).
- [ ] C.6 Close **#682** and **#754**. #754 closes because the role stops being rewritten
      per launch: it is the stage's prompt.

## Not in this change

- `same-model` / `cross-family` axes.
- #761 (the three #743 criteria), #759, #760 — though A.1-A.3 give #760's channel gap its
  answer in practice.
