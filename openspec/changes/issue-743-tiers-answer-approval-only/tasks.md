# Tasks — the tier answers the approval question, and nothing else (#743)

Applies the maintainer's ruling of 2026-08-20. One slice: the ruling is a single
decision and splitting it would leave the tree in a state where two gates disagree,
which is the defect #743 exists to remove.

## Slice 1 — the parameters leave the tier, and the doctrine follows

- [x] 1.1 Measure the trap before writing code: with `challengerAxis` out of
      `tierParams()` and `enabled` defaulting ON, `resolveJudgment` clears the
      enabled and protocol barriers and reaches the axis with nothing, where it
      throws — every run, every repo, including a fresh install.
- [x] 1.2 `DEFAULT_AXIS = 'human'` — untiered, and the only axis this build
      implements. Pinned with the half that keeps it honest: the default must be a
      member of `IMPLEMENTED_AXES`.
- [x] 1.3 `reviewProtocol`, `inferentialEnabled` and `challengerAxis` out of all
      three rows of `tierParams()`, and out of its typedef.
- [x] 1.4 `PRODUCED_PROTOCOL = 'brain-review/2'`; `resolveReviewProtocol(config)`
      loses its `tier` argument and defaults to it. An explicit `brain-review/1` is
      still honoured — the ruling retired a default, and reading it as forbidding an
      operator's explicit choice would be inventing doctrine (protocol §5).
- [x] 1.5 `resolveJudgment` loses `tier`; `enabled` is `inferential.enabled !== false`;
      the axis falls to `DEFAULT_AXIS`.
- [x] 1.6 Delete the refusal that fired when a tier enabled the half without naming
      an axis. Its branch is unreachable now, and a test for a condition nothing can
      produce is how a suite starts lying about its coverage.
- [x] 1.7 Both call sites in `cli.mjs`.
- [x] 1.8 The thirteen tests that pin the retired doctrine, each classified before
      being touched — retired / re-expressed / inverted. See the PR body.
- [x] 1.9 The recurrence guard #743 asks for as criterion 5: no tier carries a
      review-system key, plus its complement so it cannot pass on an empty table.
- [x] 1.10 `reviewer-protocol.md` §6 and §13; the Compatibility example corrected —
      "a repo whose tier changed mid-PR" can no longer exist.
- [x] 1.11 `docs/KNOWN-LIMITATIONS.md`: "/2 is not dogfoodable" marked fixed, and the
      limitation this change introduces declared in its place.
- [x] 1.12 REQ-682-2 retired, with the measured correction: its justification cited
      `test/fresh-install/in-container.sh`, which never runs `brain:review`.
- [x] 1.13 ADR-0026 Amendment 7 drafted to `brain-drafts/` and promoted by the
      maintainer (Route B), with its cascade to `brain/HOME.md` and `AGENTS.md`.
- [x] 1.14 Open the terminal PR — #762. Named here from the start, per #713.
- [x] 1.15 Cold review of `main...ca1652e`, verdict posted by `csrinaldibot`.
- [x] 1.16 Close its findings: the amendment's table annotation rendered (it was a
      5th cell in a 4-column table, dropped by GFM); the duplicated cascade header;
      the two live cross-references to the retired row; the two docstring paragraphs
      that survived the deletion they describe; the governed-line figure.

## Not in this change

- The three #743 criteria this does not close — **#761**: rulings on the borderline
  rows, the capability surface end to end, and whether three tiers earn their
  complexity.
- #682 slice 3, which is what makes the judgment half able to run at all.
