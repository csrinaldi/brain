---
status: draft
issue: 516
---

# Tasks — #516

- [x] **T1** Re-measure the gate rather than trust the ticket's table: `adrPresence` driven over
      all five input shapes, and every call site read. The table reproduces exactly.
- [x] **T2** Verify the claim holds on ALL THREE enforcement surfaces — `run-check.mjs`,
      `brain-check.mjs`, `merge-walk.mjs` all pass `addedFiles`, so there is no surface where the
      pre-#510 behaviour survives.
- [x] **T3** Two pins in `run-check.test.mjs`: the verdict is label-independent, and no
      architectural-surface heuristic exists.
- [x] **T4** Both pins proven real detectors by mutations that IMPLEMENT the doctrine's claim —
      label-conditionality 4 RED, the heuristic 1 RED.
- [x] **T5** Drafts for all five sites under `brain-drafts/`, plus the measurement they rest on.
- [x] **T6** `promote-516.sh` — anchored, idempotent, refuses on drift, regenerates `AGENTS.md`.
- [x] **T7** The script EXECUTED and reverted: five sites across four files land, `brain:nav`
      green, `antigravity.drift` green, second run reports "already promoted".
- [x] **T8** Full suite green.
- [x] **T9** Option (3)'s shape and this change's measurement posted on #509.

## Recorded

- [x] **R1** **There is a FIFTH site, and it is the worst one.** `workflow-governance.md`
      describes a two-step, label-conditional `decision-gate`. **Neither step has ever
      existed** — no call site passes labels, the workflow job has no condition, nothing scans
      the named surfaces. It reaches `AGENTS.md` by compilation, so the fiction is in the
      agent's own instructions. Found by measuring, not by reading the ticket.
- [x] **R2** **Stale and aspirational are different defects.** Sites 1–4 describe behaviour that
      used to be true; the fifth describes behaviour that never was. They read identically and
      need different corrections: rewrite the first, MARK the second as not implemented —
      retiring it silently would discard a design intent nobody decided against.
- [x] **R3** **ADR-0026's divergence note could not simply be retired.** It records two
      divergences in one sentence. The added/modified half closes here; the LABEL half is still
      open — the `standard` row still promises a hard `decision`-label step that has never
      shipped. Splitting the note was the only honest edit.
- [x] **R4** **The two failing branches of the gate are keyed differently, and that is #510's
      content.** Branch A reads the ADDED list ("an added ADR needs a `HOME.md` entry"); branch B
      reads the TOUCHED list ("a `HOME.md` change needs some ADR"). Describing them as one
      symmetric rule is how the doctrine got it wrong in the first place.
- [x] **R5** **This PR is an instance of the gap it documents.** It amends a signed ADR by hand
      because `brain:promote` refuses the amendment path, and nothing but the human would catch
      the marker being omitted. The script was executed and reverted before shipping so the
      cascade is proven rather than described — #529's checklist described a two-file edit for a
      three-file cascade and CI caught it on the signing commit.
- [x] **R6** **A prose fix can leave something behind when the claim is about code.** The two
      pins assert code facts, not prose, and name the doctrine files in their failure messages.
      That closes the drift direction where the code moves; the direction where the doctrine is
      merely ahead of the code stays open by design, and is now labelled as such.
