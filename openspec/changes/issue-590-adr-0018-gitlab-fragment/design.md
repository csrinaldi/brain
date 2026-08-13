---
status: draft
issue: 590
---

# Design — adr-0018-gitlab-fragment (issue 590)

## D1 — Write the ADR, do not renumber

See `proposal.md`. ADR-0016 is the CI-context normalisation; the GitLab
fragment is a different decision.

## D2 — The check lives in `test/**`, not in `check-refs-rules.mjs`

`repo:check` validates *prohibited references*; this is a *resolution*. And
`brain/project/check-refs-rules.mjs` is outside this line of work's file claim.

## D3 — The check excludes itself

Measured: scanning itself produced 8 of 13 findings, all about its own prose
(the registries must *name* the numbers they exempt). The exclusion is a single
path, anchored to `import.meta.url` by a guard so it cannot be re-pointed at a
second file. Stated cost: a rotted pointer in that file's own comments is not
caught.

## D4 — Two registries with different meanings

`FIXTURE_CITATIONS` (deliberate fakes in test material — never resolve) and
`KNOWN_GAPS` (real rot this ticket does not repair, each naming the issue that
owns it). Both staleness-guarded.

## D5 — The PR stays RED until the signature

The check passes once the ADR exists in `brain/project/decisions/`, and the
agent cannot put it there (ADR-0028: the commit is the signature;
`brain:promote` refuses on a non-TTY). This is deliberate: a green PR would
mean the ADR was hand-written or the citation was excused, and both are the
defect.

## D6 — What the review round changed

A cold read of this change against itself, by the author and labelled as such.

- **G1 — the scan surface was undefended.** On a green tree, adding
  `brain/core/` and `.github/` to `UNSCANNED_ROOTS` left the suite 7/7 green.
  The vacuity guards could not cover it: they are absolute counts, and
  excluding all of `brain/scripts/**` still leaves 114 files and 393 citations.
  `REQUIRED_ROOTS` closes it.
- **G2 — the ADR misdescribed the mechanism it documents.** It claimed the
  managed literal sits *above* the `brain/scripts/**` COPY glob, attributing
  the guarantee to position. Measured: it sits *below* (lines 41 vs 44), and
  `strategyFor()` resolves by exact-key lookup before iterating globs.
- **G3 — `KNOWN_GAPS` overclaimed.** It said every entry named its ticket; none
  did, and the test only checked for a non-empty string. Enforced now.
- **G4 — draft links were unverified until after the signature.**
- **H1/H2 — these artifacts were in the wrong language and this spec described
  a surface that had not been current since the second commit.** Both are the
  same class as the ticket itself: an artifact saying something other than what
  is there.

## Hot micro-decisions

- The probe proving the check goes green with the ADR present was done by
  creating the destination file, running, and deleting it — never committed. An
  uppercase name did not match `ADR_FILE_RE`, which incidentally confirmed the
  filename shape is anchored exactly as `brain:promote` writes it.
- The ADR-0023 gap surfaced while measuring. It is in `KNOWN_GAPS` with its
  reason and is now owned by #599 — not repaired here: the files are outside
  the claim, and the decision needs measurement first.
- The scaffold emits these templates in Spanish and never reads
  `docs.language`, which is how H1 happened. That is #605; it explains the
  defect without excusing it, since 85 of 91 change dirs were rewritten by hand.
