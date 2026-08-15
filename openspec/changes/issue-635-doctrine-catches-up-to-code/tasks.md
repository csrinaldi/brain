---
status: draft
issue: 635
---

# Tasks — #635

- [x] **T1** Check the doctrine BEFORE writing anything: both targets are `brain/core/**` /
      `brain/project/**`, which AGENTS.md Tier 3 forbids an agent to commit to "even if
      explicitly asked", and which `brain-writes-reviewed` fails unconditionally and
      un-overridably. Ruled: drafts + `brain:promote`, the path #671 used for ADR-0031.
- [x] **T2** Re-execute the round-trip disproof with in-tree production code instead of copying
      the ticket's output: same `id`, different bytes, `source` widened by `renderFuente`.
- [x] **T3** Re-run `store.duplicates.test.mjs::roundtrip-divergence` on the branch — passes.
- [x] **T4** Verify each `amend-find` anchor occurs exactly once, before drafting.
- [x] **T5** Draft the ADR-0017 Amendment 1 (two acts: the dedup rule, the churn discipline).
- [x] **T6** Draft the `memory-format.md` correction, naming the ADR draft as its companion.
- [x] **T7** Validate both with the promoter's OWN parser. This caught a real defect: the first
      ADR draft omitted `amendment: N` and was refused. Fixed and re-validated — all three acts
      `{state:'pending', free:1}`, `applyEdits` OK, body 85 lines, Status line and `HOME.md`
      marker both applicable.
- [x] **T8** Re-measure the corpus (`2050 records, no warning` after #636) and reframe the
      cross-file caveat as a property of the corpus rather than a snapshot that will rot.
- [x] **T9** Promoted by the maintainer: `1deb201` (memory-format) and `c199918` (ADR-0017
      Amendment 1). Cascade verified on the pushed branch — Status line
      `**amended 15/08/2026** (Amendment 1 — see below)`, `**Signed**: 15/08/2026 — Cristian
      Rinaldi`, `brain/HOME.md` marker written, `AGENTS.md` regenerated.
- [x] **T11** **Read the promoted result back instead of trusting the verb, and found a gap I
      left.** `memory-format.md` still carried the dead literal *"MUST NOT rewrite the whole index
      every run"* — Act 2 restated the churn rule in ADR-0017 only, so correcting one artefact and
      not the other recreated exactly the contradiction #635 exists to close. A third draft
      (`memory-format-churn.draft.md`) repairs it, validated the same way:
      `{state:'pending', free:1}`, `applyEdits` OK. Filed as a new draft rather than folded into
      the signed ones.
- [ ] **T12** **Requires the maintainer.** `npm run brain:promote` on both drafts, same sitting.
      `npm run brain:promote -- .../brain-drafts/memory-format-churn.draft.md`, on the same
      branch. The verb refuses on a non-TTY, has no auto-accept branch to reach, and stages
      without committing — the typed word and the commit are the human signature.
- [ ] **T10** *(recorded, not done)* the credentials this session pushes with make its PRs read
      as maintainer-authored, so `brain-writes-reviewed` would likely not have caught a direct
      edit to `brain/`. The containment held by rule, not by enforcement. Whether that gap is
      worth closing is a governance question, not one this ticket owns.
