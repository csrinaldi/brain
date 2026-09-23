# ADR-0035 — The archive sweep's `issue-link` exemption is content-earned, never granted by branch name

**Status**: Accepted · **amended 23/09/2026** (Amendment 1 — see below)
**Date**: 2026-09-23 — Cristian Rinaldi

## Context

Issue #557 made archiving a machine guarantee. After every clean post-merge audit,
`.github/workflows/governance-postmerge.yml` runs `brain/scripts/governance/postmerge/sweep.mjs`,
which moves each change whose issue is closed from `openspec/changes/<name>/` into
`openspec/changes/archive/<iid>/`, consolidates its spec delta into
`openspec/specs/<capability>/spec.md`, and opens at most one `auto-archive/<date>` pull request
against `main`, with a body ending `Part of #557.`.

`issue-link` (`brain/scripts/governance/run-check.mjs#runIssueLinkCheck`, invariant 1 in
`workflow-governance.md`) requires a closing keyword (`Closes`/`Fixes`/`Resolves #N`) on a pull
request to the default branch; `Part of #N` alone is accepted only on a non-default target
(`requiresClosingKeyword`). A sweep pull request targets `main` and cannot honestly carry a
closing keyword: it resolves nothing, it performs recurring housekeeping on behalf of #557.
**PR #1097 (2026-09-23) failed `issue-link` with exactly that reason.** Left alone, every sweep
pull request stays red forever, and because the workflow keeps at most one `auto-archive/*`
pull request open (design D6's backlog cap), the first red one blocks every later day's sweep.

This is the second time this repository has had to carve an exception into an invariant the
doctrine calls "not skippable". The first is ADR-0034's memory lane: `memory/<host>-<date>` pull
requests, which also close no issue. Both are machine-authored pull requests that legitimately
link nothing, and both carry the same risk. An exemption keyed on the branch name alone
(`if head starts with auto-archive/, skip issue-link`) is spoofable: anyone who can push a
branch with a matching name bypasses the gate, for an arbitrary diff.

ADR-0034 L1 already answered that for the memory lane: *"the branch name is a claim, the path
check … is the proof."* #889 implemented it as its design D1a: `runIssueLinkCheck` recomputes
`checks/lane.mjs#classifyLane` over the diff before it skips anything, and never trusts the name.
This ADR applies the same rule to a second lane instead of inventing a weaker mechanism.

## Decision

**A second content-earned `issue-link` exemption, for `auto-archive/<date>` heads. The branch
name makes the claim; a predicate recomputed over the diff is the proof.**

`brain/scripts/governance/checks/archive-sweep.mjs#classifySweepDiff` is a pure function with
the same structure as `classifyLane`, wired into `runIssueLinkCheck` right after the memory-lane
block and in the same shape.

### The claim — the branch shape

`SWEEP_BRANCH_RE = /^auto-archive\/\d{4}-\d{2}-\d{2}$/`, anchored at both ends, matching the
workflow's `br="auto-archive/${today}"` with `today="$(date -u +%F)"`. It is tested first,
before any git call: a head that does not match never reaches the diff closures, so a diff
failure can never affect an ordinary pull request.

### The proof — the diff

Recomputed on every run from `git diff -M100% --name-status` and `--numstat` over
`BASE...HEAD`. Every entry must be one of the following, or the exemption is refused:

1. **An exact-content rename** (`R100`, git's own 100%-similarity detection) from
   `openspec/changes/<name>/…` (not already under `archive/`) to
   `openspec/changes/archive/<dest>/…`, where the path below the two-segment prefix is
   identical. A file whose content drifted during the move is reported by git as a delete plus
   an add, and the delete is refused.
2. **An added file** that is `openspec/specs/<capability>/spec.md` — the ONLY added file this
   predicate ever accepts. **As of Amendment 1 (#557): no added file under
   `openspec/changes/archive/<dest>/` is ever accepted, at any `<dest>`, under any condition.**
   Before Amendment 1, this category also admitted any path under `archive/<dest>/` (later,
   briefly, gated by a same-folder rename check); both were holes. See Amendment 1 for what
   they allowed and why closing the category entirely costs nothing.
3. **A modified `openspec/specs/<capability>/spec.md` with zero deleted lines**, checked on
   `--numstat` rather than inferred from the path. Consolidation both creates and appends to
   spec files (`archive-logic.mjs#mergeSpecs`): the 2026-09-23 backfill produced 18 creates and
   several appends.

In addition, **at least one rename from the first category is required.** A diff with only
spec changes is refused: a real sweep never changes a spec without moving a folder, and
accepting such a diff would let a hand-made `auto-archive/*` branch rewrite a consolidated spec
with no linked issue at all.

Anything else is refused: code, workflows, `brain/**`, `.memory/**`, a delete with no matching
rename, a copy, a type change, a spec modification that deletes a line. A refused diff falls
through to the ordinary `issue-link` rule, which requires a closing keyword on `main`.

### Fail-closed

A diff that cannot be computed (git throws; a shallow clone, for instance) makes the pull
request "not exempt". It is never reported as `uncomputable: true` and never passed silently: it
falls through to the ordinary rule, which refuses it with the message the repository already
understands. This is the memory-lane block's own property, kept identical on purpose.

## Residual risk, named rather than assumed away

1. **The destination `<iid>` is not cross-checked against the source folder.** The predicate
   proves that a rename is byte-identical and keeps its relative path. It does not prove that
   `openspec/changes/issue-518-foo/` went to `archive/518/` rather than `archive/999/`. The
   destination segment is matched as `[^/]+`, not even as digits. Choosing `<iid>` is
   `lib/archive-sweep.mjs#selectSweep`'s job, not `issue-link`'s. Accepted because a forgery
   still has to move existing content byte-for-byte and cannot carry a new payload through a
   rename. A cross-check against `sdd-layout.mjs#parseChangeId` is a possible follow-up.
2. **An added file under `openspec/changes/archive/<dest>/` is accepted with any content**,
   provided the diff also carries at least one real rename. That is wider than "an exact move",
   and neither `archive-sweep.mjs`'s header comment nor its tests state it. The blast radius is
   bounded: the path is inert history, is not compiled into `AGENTS.md` and is not loaded as
   doctrine, and code, workflows, `brain/**` and `.memory/**` stay refused. It is still a way to
   land unlinked text on `main`. Refusing `A` under `archive/` unless it pairs with a rename is
   the follow-up that closes it. This ADR records the predicate as it runs, not as it was
   described.
   **[Amended by Amendment 1 (#557) — CLOSED, not narrowed. `classifySweepDiff` refuses every
   added file under `archive/**` unconditionally: no real `archiveChange` run ever adds one
   there, so there was never a legitimate case an exemption would protect. An interim
   "pairs with a rename" rule was tried first and found still gameable by a same-folder
   smuggle; it was removed rather than tightened further. See Amendment 1.]**

## The sibling gap: `auto-revert/*`

The post-merge auto-revert step has the same failure. It opens `auto-revert/<sha>` against
`main` (`gh pr create --base main`) with a body ending `Part of #259.`, so `issue-link` refuses
it for the same reason it refused PR #1097. **This ADR does not close that gap.** A revert's
diff is the inverse of an arbitrary merge, so it has no fixed shape a path predicate can check.
Its proof would have to be different: for example, recomputing that HEAD is exactly
`git revert` of a merge that `brain:audit` named as an offender. That deserves its own decision.
Widening this one to cover it would give a second lane a predicate designed for the first.

## Consequences

- Sweep pull requests pass `issue-link` on `main` without a closing keyword, and only when
  their diff has the shape a sweep produces.
- `workflow-governance.md`'s invariant 1 row, which says `issue-link` is "not skippable", stays
  true in the sense it was written for: no label bypasses it. It is now incomplete, because two
  content-proven exemptions exist. The row is amended alongside this ADR to name both.
- Any future third lane gets the same treatment: a branch regex tested first, a diff predicate
  recomputed in the IO wrapper, the pure evaluator left unaware of context (ADR-0016), and
  fail-closed to the ordinary rule.

## Rejected alternatives

**A branch-name-only exemption.** Spoofable, for any diff. ADR-0034 L1 already named and fixed
this mistake once. Repeating it for a second lane would be a regression, not a parallel decision.

**An amendment to ADR-0034.** ADR-0034 decides that memory travels on its own lane. Its L1–L9,
its tier table for `mrAutoMerge` and its secret scrub (C1) are all about memory records. The
archive sweep shares the mechanism, not the domain. Grafting it on would make a reader search
memory-lane decisions for an `openspec/` housekeeping rule. A sibling ADR that names ADR-0034 as
its precedent keeps each decision findable under its own subject.

**A skip label (`skip:issue-link`), mirroring `skip:memory-gate`.** `issue-link` has no override
path, and a label that automation applies to its own pull request is a claim the automation
makes about itself. A content proof needs no one to remember anything, and nothing can apply it
falsely.

**A closing keyword in the sweep body (`Closes #557`).** It would pass the gate by saying
something false: the sweep does not resolve #557, and GitHub would close the issue on the first
merge. That is the #867 class ADR-0034 L1 rejected for the memory lane.

## Amendment 1 — residual risk 2 is closed: zero added files under `archive/**` are ever exempt (issue #557)

**Signed**: 23/09/2026 — Cristian Rinaldi

Residual risk 2, as this ADR named it, was real and demonstrable: `classifySweepDiff`
exempted **any** added file under `openspec/changes/archive/<dest>/`, provided the same
diff carried at least one valid archive rename **anywhere** — not necessarily into
`<dest>`. A minimal proof:

```
classifySweepDiff({
  nameStatusLines: ['R100\topenspec/changes/issue-9-x/spec.md\topenspec/changes/archive/9/spec.md',
                    'A\topenspec/changes/archive/anything/payload.sh'],
  numstatLines: ['0\t0\topenspec/changes/{issue-9-x => archive/9}/spec.md',
                 '40\t0\topenspec/changes/archive/anything/payload.sh'] })
→ exempt: true, offending: []
```

A hand-made `auto-archive/<date>` branch carrying one genuine rename could land arbitrary
content under `archive/anything/` on `main` with no linked issue and no closing keyword.

### What was checked before choosing the fix

Two questions the maintainer asked before any code changed, answered from
`archive-logic.mjs#archiveChange` and `sdd-layout.mjs`:

1. **Does a real archive run ever ADD a file under `archive/<iid>/`?** No. `archiveChange`
   writes under `destDir` in exactly one way: `fs.rename(srcDir, destDir)` — a whole-folder
   move with content untouched, so git's `-M100%` detector reports every file that lands
   there as an R100 rename, never an `A`. The only other write the function performs is
   `fs.mkdir('openspec/changes/archive')`, a directory, not a file. `sweep.mjs`'s markdown
   report — the one place an "archive report" might have been added under `archive/**` — is
   written to `$RUNNER_TEMP/sweep-body.md` and used only as the PR body; the workflow's
   `git add -A` step never touches it. Measured directly against the real 2026-09-23 phase-6
   backfill (`fdca7970...a3bb5b02`, 612 diff lines): every `A` line is
   `openspec/specs/<capability>/spec.md`; zero `A` lines appear anywhere under
   `openspec/changes/archive/`.
2. **Is `archivePath(iid)` always numeric?** No. `archiveChange` uses the raw `changeId` as
   the destination segment for a grandfathered change (`isGrandfathered`), and
   `openspec/changes/archive/` carries real, current, non-numeric folders today —
   `auto-adrs`, `cli-i18n`, `feature-working-memory`, `governance`, `installer-versionado`,
   `install-home-scaffold`, `managed-paths-namespace`, `vcs-adapter` — plus several
   date-prefixed legacy folders predating this convention. A fix that required `<dest>` to
   match `^\d+$` would refuse those.

Together, (1) and (2) point past a shape rule: there is no filename, extension, or numeric
pattern that separates a legitimate archived file from an illegitimate one, because there
is no legitimate ADDED file at all. Anything present under `archive/**` that is not a
rename is, by (1), evidence of something other than a real sweep.

### The interim fix, and why it still had a hole

The first fix tried was narrower: require the added file's destination FOLDER to be, in the
same diff, the destination of at least one already-valid archive rename. That refused the
proof case above, but not this one — one genuine rename into `archive/9/`, plus an unrelated
file added into that SAME folder:

```
classifySweepDiff({
  nameStatusLines: ['R100\topenspec/changes/issue-9-foo/proposal.md\topenspec/changes/archive/9/proposal.md',
                    'A\topenspec/changes/archive/9/payload.sh'],
  numstatLines: ['0\t0\topenspec/changes/{issue-9-foo => archive/9}/proposal.md',
                 '3\t0\topenspec/changes/archive/9/payload.sh'] })
→ exempt: true (under the interim, folder-pairing rule)
```

The pairing checked the FOLDER a rename landed in, never the specific file being added — so
a forged branch needed only one genuine rename to unlock arbitrary content anywhere inside
that rename's own destination folder. Confirmed by the maintainer directly against
`archive-sweep.mjs` before this amendment was rewritten.

### The fix

Given §"What was checked": no real `archiveChange` run ever adds a file under `archive/**`
at all, so there was never a legitimate case the interim pairing rule — or any narrower
carve-out — needed to protect. The tightest correct rule is therefore the simplest one:
`classifySweepDiff` refuses **every** added file under `openspec/changes/archive/**`,
unconditionally, regardless of what renames exist anywhere in the diff. The only added file
this predicate accepts anywhere is `openspec/specs/<capability>/spec.md` — the genuinely
legitimate case `archiveChange#mergeSpecs` produces via `fs.mkdir` + `writeFile`, unrelated
to `archive/**`.

Both proof cases above (the original cross-folder smuggle and the same-folder smuggle) are
now refused, naming the offending file. The real phase-6 backfill diff, re-run against the
tightened predicate, is still `exempt: true` — the fix changes nothing about a genuine
sweep, because a genuine sweep never had an `A` under `archive/**` to lose.

`brain/scripts/governance/checks/archive-sweep.mjs` (this branch,
`feat/issue-557-s5-sweep-added-files`) carries the implementation and its test suite
(`archive-sweep.test.mjs`), including both proof cases above and the real backfill check.

### What this does not change

Residual risk 1 (the `<iid>` destination not being cross-checked against the source
folder's own issue number) is untouched by this amendment and remains open, exactly as
this ADR already named it.
