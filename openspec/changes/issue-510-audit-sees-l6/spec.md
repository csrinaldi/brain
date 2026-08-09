---
status: draft
issue: 510
---

# Spec — delta requirements

## REQ-510-1 — `adrPresence` answers only the indexing question

`adrPresence(changedFiles, addedFiles)` MUST require a `brain/HOME.md` co-change only when an
ADR path is in `addedFiles`. Omitting `addedFiles` (or passing null) MUST preserve pre-#510
behaviour, so callers that cannot cheaply produce an added-only list are unaffected.

The "HOME.md changed but no ADR" branch MUST keep reading the **touched** set. Keying it on
the added set would fail a PR that edits an ADR and its index entry together — coherent
today, and a regression this change must not introduce.

```
GIVEN a diff that ADDS brain/project/decisions/adr-0099-x.md and does not touch brain/HOME.md
WHEN adrPresence runs
THEN it fails, and the reason NAMES adr-0099-x.md

GIVEN a diff that MODIFIES an existing ADR and does not touch brain/HOME.md
WHEN adrPresence runs
THEN it passes

GIVEN a diff that MODIFIES an existing ADR and also touches brain/HOME.md
WHEN adrPresence runs
THEN it passes

GIVEN a diff that touches brain/HOME.md and no ADR
WHEN adrPresence runs
THEN it fails
```

## REQ-510-2 — the reason states only what the check established

The failure reason MUST NOT assert that a file was *added* unless the added-only list
established it, and MUST name the ADR path(s) it is failing on. The pre-#510 string
("ADR file added but brain/HOME.md was not updated") is inadmissible under its own evidence.

## REQ-510-3 — an uncomputable added list fails closed, and is not defaulted

Every enforcement surface MUST compute the added-only list through the same failure path as
the full list. A read that fails MUST produce `uncomputable`, never `[]` (which reads as
"nothing was added") and never `null` (which reads as "assume everything touched is new").
Both defaults are a verdict about evidence the surface does not have.

## REQ-510-4 — the three enforcement surfaces agree

`run-check.mjs` (CI), `brain-check.mjs` (local) and `lib/merge-walk.mjs` (audit, via
`brain-audit` and `brain-metrics`) MUST reach the same `adrPresence` verdict for the same
merge. A local pass that CI rejects is the defect #340 already records; an audit failure on a
merge CI passed is worse, because `adrPresence` is tree-keyed and rung 3 would open an
auto-revert against it.

```
GIVEN one merge
WHEN the same evidence is evaluated by CI, by brain:check and by the audit
THEN the three verdicts are identical
```

## REQ-510-5 — the audit evaluates the human-gate invariant directly

The audit MUST evaluate an L6-shaped check over merged history, so that I2 is enforced by the
invariant that owns it rather than by `adrPresence` as a proxy.

- It keys on PR review evidence, reached through the existing port verb (`prReviews`) and the
  existing per-merge PR resolution (`fetchPrMeta`).
- **It is NOT a member of `TREE_KEYED_CHECKS`.** It keys on PR metadata, like `issueLink`, not
  on the tree. Consequence, stated rather than discovered: it never emits `[FAIL-SHA]` and
  never auto-reverts.

## REQ-510-6 — absent review evidence is uncomputable, never a verdict

A merge whose PR cannot be resolved (a direct push, a squash outside the PR flow, an offline
run) yields **absent** evidence, not negative evidence. The check MUST report `uncomputable`
using the vocabulary #474 established, and MUST NOT report the merge as ungoverned.

```
GIVEN a merge whose ADR change carries an approving human review
WHEN the audit evaluates it
THEN it passes

GIVEN a merge whose ADR change carries no human review
WHEN the audit evaluates it
THEN it is reported as ungoverned

GIVEN a merge whose PR cannot be resolved at all
WHEN the audit evaluates it
THEN it is reported as UNCOMPUTABLE, distinguishable in the output from both of the above
```

## REQ-510-7 — A10 is reinforced, and keeps meaning what its comment says

A10's frozen property is unchanged: **a live-at-HEAD ungoverned artifact must always be
reported.** Its fixture invariants (`^M`, never `^A`) MUST remain untouched — the MODIFY
channel is what it exists to pin.

It MUST additionally distinguish the three outcomes of REQ-510-6, so that a pass is a pass for
the reason the fixture describes and not for an accident of fail-closed arithmetic. Its
header comment MUST be updated to name the invariant now doing the work, because a fixture
whose comment describes a mechanism that no longer runs is an apparent protection — the class
#499 closed in the doctrine and this change must not re-open in the tests.

## REQ-510-8 — every new guard is proven by mutation

Each guard added here MUST be shown RED against a seeded defect before it is accepted green,
with the mutation's diff printed before the run. Five substitutions silently failed to match
during #478 and produced meaningless greens; a guard nobody watched fail is decoration.

A fixture built only from ADDED paths cannot observe this defect — the whole of it lives in
the gap between the two lists — so the modified-ADR case MUST be driven explicitly.
