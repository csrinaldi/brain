# Doctrine drafts for #1141

#1141 moves files, and doctrine cites some of them by path. An agent may not edit
`brain/core/**` or `brain/project/**`, so each citation is either drafted here for the
maintainer to promote or listed below for a ruling.

## Drafted: promote these on this branch

`brain:nav` checks backticked `brain/...` paths. These drafts fix every citation it reports as
dead, plus the other old-path mentions in the same methodology files. Until they are promoted,
`brain:nav` exits 1 and three tests in `npm test` are red:
`lib/home-scaffold-nav-integrity.test.mjs`, `lib/home-index-nav-integrity.test.mjs`, and
`test/review-regulated/regulated-review.e2e.test.mjs` "#408 … healthy base keeps blocking",
whose fixture copies this repo's `brain/`.

Each draft was checked with `planAmendment` (every anchor occurs exactly once). Applying all
seven edits to a scratch copy of the tree made `brain:nav` exit 0.

| draft | target | what it fixes |
|---|---|---|
| `memory-backend-contract.paths.draft.md` | `brain/core/methodology/memory-backend-contract.md` | 4 lines, 2 of them dead citations |
| `vcs-contract.paths.draft.md` | `brain/core/methodology/vcs-contract.md` | 2 lines |
| `reviewer-protocol.paths.draft.md` | `brain/core/methodology/reviewer-protocol.md` | 5 lines |
| `feature-working-memory-contract.paths.draft.md` | `brain/core/methodology/feature-working-memory-contract.md` | 1 line |
| `adr-0016-amendment-1.draft.md` | ADR-0016 | 1 dead citation |
| `adr-0020-amendment-3.draft.md` | ADR-0020 | 2 dead citations, 2 brace-form mentions |
| `adr-0026-amendment-9.draft.md` | ADR-0026 | 1 dead citation (Amendment 6's) |

The ADR amendment numbers were read on 2026-09-25: ADR-0016 had none, ADR-0020 had 2, and
ADR-0026 had 8. If another amendment lands first, renumber before promoting.

## Ruling (maintainer, 2026-09-28)

The old paths named in the table below are ANNOTATED IN PLACE, following the precedent of
ruling R6 on #961 as amended (option A, #973): the historical path stays visible, the current
path is added next to it, and the amendment's own text says plainly that the body is annotated
in place under that ruling — never that it was left untouched (that phrasing was #973's
erratum). Drafted below, one amendment per affected ADR.

## Drafted: ruling R6 applied (this branch, pending promotion)

These ADRs name the old paths in forms `brain:nav` does not check, such as a path without
backticks, a `<placeholder>`, a path relative to `scripts/`, or `file:line`. They are records
of what was decided and where the code was at the time; some also give how-to steps that named
the old directory. Every `amend-find` anchor below was verified to occur exactly once in its
target file, both by `String.split(needle).length - 1` over the raw file text and by running
the real `planAmendment()` from `brain/scripts/lib/amendment-draft.mjs` against the actual
target + `brain/HOME.md` (not a simulation of its rules).

| draft | target | amendment | anchors | what it fixes |
|---|---|---|---|---|
| `adr-0002-amendment-5.draft.md` | ADR-0002 | 5 | 1 | `scripts/memory/backends/engram.mjs setup` (line 25) |
| `adr-0004-amendment-2.draft.md` | ADR-0004 | 2 | 2 | `scripts/memory/backends/engram.mjs` (line 18); "create `scripts/memory/backends/<name>.mjs`" how-to (line 21) |
| `adr-0008-amendment-1.draft.md` | ADR-0008 | 1 | 2 | `scripts/vcs/providers/<provider>.mjs` (line 30); "adding a new provider = `scripts/vcs/providers/<x>.mjs`" how-to (line 38) |
| `adr-0011-amendment-3.draft.md` | ADR-0011 | 3 | 2 | `scripts/memory/backends/<backend>.mjs` (line 22); `<name>.mjs` how-to (line 35) |
| `adr-0012-amendment-1.draft.md` | ADR-0012 | 1 | 3 | `scripts/harness/backends/<SDD_HARNESS>.mjs` (line 22); "each module in `scripts/harness/backends/`" (line 26); "create `scripts/harness/backends/<name>.mjs`" how-to (line 34) |
| `adr-0019-amendment-6.draft.md` | ADR-0019 | 6 | 3 | `brain/scripts/harness/backends/gentle-ai.mjs:74,221` (line 80); `memory/backends/engram.mjs` in the measured importer list, twice (lines 250, 258) |
| `adr-0020-amendment-4.draft.md` | ADR-0020 | 4 | 1 | bare `vcs.contract.test.mjs` (line 156) — a citation `brain:nav` and the earlier Amendment 3 draft both missed, because the filename itself changed (`vcs.contract.test.mjs` → `contract.test.mjs`), not only its directory |
| `adr-0021-amendment-1.draft.md` | ADR-0021 | 1 | 1 | `brain/scripts/vcs/providers/github.mjs:157-159` (line 10) |
| `adr-0022-amendment-1.draft.md` | ADR-0022 | 1 | 1 | `brain/scripts/vcs/providers/github.mjs:161` (line 13) |
| `adr-0023-amendment-1.draft.md` | ADR-0023 | 1 | 1 | `roles/role-port.mjs` (line 12) |

**Ordering dependency**: `adr-0020-amendment-4.draft.md` declares Amendment 4 and can only be
promoted AFTER `adr-0020-amendment-3.draft.md` (already drafted, above) lands — `brain:promote`
refuses an Amendment 4 draft while the target still stands at Amendment 2. Verified by running
`planAmendment()` for Amendment 3 against the real target, then Amendment 4 against the result:
Amendment 4 fails on the untouched target (`"the target stands at Amendment 2 — expected 3 ...
or 4"`) and succeeds once Amendment 3's plan is applied first. If Amendment 3 promotes under a
different number, renumber Amendment 4 before promoting it.

The other nine ADRs above (0002, 0004, 0008, 0011, 0012, 0019, 0021, 0022, 0023) carried no
`brain:nav`-visible citation before this sweep and had no other pending amendment draft, so
each is a normal next-amendment-number draft with no ordering dependency.

## Deliberately not annotated

A broader sweep of every `brain/project/decisions/*.md` file for `harness/backends`,
`memory/backends`, `vcs/providers`, `scripts/roles`, and every individual filename in
`brain/scripts/lib/retired-paths.mjs`, found bare filename mentions — a filename with **no**
directory context at all, such as `github.mjs issueView` (ADR-0014), `gitlab.mjs:352-354`
and `github.mjs`'s `branchProtect` (ADR-0026), `github.mjs:193` / `github.mjs:158` (ADR-0021),
`gentle-ai.mjs` / `plain.mjs` (ADR-0019), and `engram.mjs` (ADR-0017). None of these cite a
directory that moved — the filename itself is unchanged by #1141 (unlike `vcs.contract.test.mjs`
above, which *was* renamed) — so there is no stale path to annotate: a reader who greps the bare
filename still finds it, just at a new location the ADR never claimed. Left as they are.

`brain/core/anti-patterns/evidence-reader-empty-on-failure.md:3` names
`providers/github.mjs` as where the anti-pattern was discovered. That is history, not a
pointer, and is left as it is.

`brain/core/methodology/workflow-governance.md:131` quotes a `scripts/.*/providers/` pattern
that the same paragraph says was never implemented. It is not a path to a file and needs no
change.
