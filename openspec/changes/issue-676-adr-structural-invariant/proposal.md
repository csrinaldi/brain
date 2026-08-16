---
status: draft
issue: 676
---

# Proposal — the signed ADRs already on disk are measured, not only the ones being written (issue 676)

## What

One e2e suite that reads every `brain/project/decisions/adr-*.md` in the tree and
asserts each carries exactly one `**Status**:` line — by **calling**
`checkSingleStatusLine` from `brain/scripts/lib/amendment-draft.mjs`, never by
re-deriving the rule.

Point 1 (repairing ADR-0029) landed in PR #692. Measured on this base: 30 signed
ADRs, 30 with exactly one Status line. **The test is born GREEN**, and the ticket
required that order — the alternative is shipping a guard beside the exemption
that makes it pass (#499).

## Why

#675 put the rule on the WRITE path: `brain:promote` refuses to produce a
malformed ADR. Nothing asks the question of the files already there. ADR-0029 sat
malformed in `main` from 2026-08-11 and was found by hand — unamendable by the
sanctioned route, because `applyStatusAct` refuses to touch a file with two
Status lines. A rule enforced only where writes happen does not measure the
artefacts that already exist.

## The four decisions

**1 · It lives at `test/adr-status-line-single.e2e.test.mjs`.** The subject is
repository state on disk, not a unit — the shape of
`adr-citation-resolves.e2e.test.mjs`, which already sweeps versioned files.
Colocating under `brain/scripts/lib/` is wrong twice: `brain/scripts` is in
`package.json`'s `files` allowlist and `brain/project` is not, so the test would
ship to consumers and read a directory their install does not have. That is
#674's shape — a check whose surface and subject disagree.

**2 · No exemption, no allowlist, no `KNOWN_GAPS`.** `adr-citation-resolves`
earns its registries: a fixture citation and a ticketed gap are legitimate. There
is no legitimate second `**Status**:` line in a signed ADR — the amendment path
refuses that file — so an exemption would record an unamendable ADR as
acceptable. The list would also start empty: a hole with no occupant.

**3 · The refusal names file, count, lines, and what it costs.**
`checkSingleStatusLine` returns `count` and `indices`; the message renders
`path:line` for each and states the consequence — *this file cannot be amended by
`brain:promote`; repair is by hand, and `brain/project/decisions/**` is Tier 3.*
It does NOT reuse `locateStatusLines`: that guidance is draft-side ("fix the
preamble blockquote") and there is no draft here. A correct verdict with an
invented cause is the #604 shape.

**4 · This invariant only.** Not a disk-side mirror of the `GUARDS` registry.
`applies()` keys on a destination being written; re-reading it as "which rules
hold for a file at rest" is a second definition of the same idea, for rules with
no measured on-disk victim.

## Born green, so it proves nothing yet

The mutation is part of the work, not a follow-up: insert a second `**Status**:`
line into a real signed ADR, run, revert with `git checkout --`. Axes to vary
before the green is trusted (`red-proof-blind-along-an-unvaried-axis`): zero
lines as well as two; preamble position and body position; and a reader that
returns `[]` — a decisions dir yielding no ADR must FAIL, not pass vacuously.

## Cost and rollback

One test file, no production code, no new dependency. Rollback is deleting it.

## Success criteria

- [ ] The suite imports `checkSingleStatusLine`; no second implementation of the rule.
- [ ] Green on `main`'s 30 ADRs; red on a mutated one, with the file and line named.
- [ ] An unreadable or empty decisions dir fails the suite.
