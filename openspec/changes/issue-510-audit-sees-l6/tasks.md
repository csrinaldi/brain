---
status: draft
issue: 510
---

# Tasks — the audit sees L6 (issue 510)

- [x] T1 — **Measure before designing.** 22 → the defect reproduced on PR #507; three
      enforcement surfaces mapped; the option-1 implementation written end to end and shown
      to break A10. Branch kept local as evidence.
- [x] T2 — **The finding that re-scoped it twice.** First: two invariants share one function.
      Second: I2 is not new — it is L6, and the audit is blind to it. Nine coupling points
      collapse to three.
- [x] T3 — Maintainer rulings recorded on #510: separate the invariants; A10 reinforced,
      option (3).
- [x] T4 — Artefacts: proposal · spec (REQ-510-1…8) · design · this file.
- [ ] T5 — **ADR draft** at `brain-drafts/` — what the audit may be blind to, and the
      re-freeze of A10. Tier 2: the agent drafts, a human promotes.
- [ ] T6 — `adrPresence` keeps I1 (REQ-510-1, REQ-510-2). Implementation exists on the local
      option-1 branch and is measured: 7/7 cases, backward compatible.
- [ ] T7 — Thread the added-only list through the three surfaces via the same failure path
      (REQ-510-3, REQ-510-4).
- [x] T8 — **Third refutation, measured.** L6 cannot be I2: PASS at `lite`, WARN at
      `standard`/`regulated` on A10's inputs. I2 split out to **#511**; T8-T10 of the old plan
      go with it.
- [ ] T9 — Record the blindness (REQ-510-5): `KNOWN-LIMITATIONS` entry pointing at #511.
- [ ] T10 — **HUMAN: choose the A10 posture** (REQ-510-6) — hold · coarse audit · record the
      loss. Nothing merges until this is answered.
- [ ] T12 — **Mutation proof for every guard** (REQ-510-8), diffs printed before running.
- [ ] T13 — **HUMAN: promote the ADR** and sign the diff (`brain:approve`).

## Micro-decisiones en caliente

- **The naive fix had to be written to be refuted.** Reading `adrPresence` shows an indexing
  rule; only running the suite shows the content tripwire. Recorded on the issue so the next
  reader does not re-derive it.
- **Evidence is time-dependent.** L6's fail-open is correct at PR time ("not reviewed YET")
  and wrong post-merge ("never reviewed"). Same evidence, two meanings, and nothing in either
  check said which reading it took. This is the finding that survived the whole investigation.
- **A fixture is a claim about a mechanism.** A10 would have passed under the new design for
  the wrong reason, and a green nobody can explain is the defect this repo keeps paying for.
