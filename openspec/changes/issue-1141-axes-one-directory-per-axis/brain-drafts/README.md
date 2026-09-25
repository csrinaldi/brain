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

## Not drafted: needs a ruling

These ADRs name the old paths in forms `brain:nav` does not check, such as a path without
backticks, a `<placeholder>`, a path relative to `scripts/`, or `file:line`. They are records
of what was decided and where the code was at the time. Some also give how-to steps that now
point at the old directory. Whether to annotate them (ruling R6 on #961, option A, did so for
the script renames) or leave them as history is the maintainer's call, so no draft was written:

| ADR | line(s) | mention |
|---|---|---|
| ADR-0002 | 25 | `scripts/memory/backends/engram.mjs setup` |
| ADR-0004 | 18, 21 | `scripts/memory/backends/engram.mjs`; "create `scripts/memory/backends/<name>.mjs`" (how-to) |
| ADR-0008 | 30, 38 | `scripts/vcs/providers/<provider>.mjs`; "adding a new provider = `scripts/vcs/providers/<x>.mjs`" (how-to) |
| ADR-0011 | 22, 35 | `scripts/memory/backends/<backend>.mjs`, `<name>.mjs` (how-to) |
| ADR-0012 | 22, 26, 34 | `scripts/harness/backends/<SDD_HARNESS>.mjs`; "each module in `scripts/harness/backends/`"; "create `scripts/harness/backends/<name>.mjs`" (how-to) |
| ADR-0019 | 80, 250, 258 | `brain/scripts/harness/backends/gentle-ai.mjs:74,221`; `memory/backends/engram.mjs` (a measured importer list) |
| ADR-0021 | 10, 21 | `brain/scripts/vcs/providers/github.mjs:157-159`; `providers/vcs.contract.test.mjs` |
| ADR-0022 | 13 | `brain/scripts/vcs/providers/github.mjs:161` |
| ADR-0023 | 12 | `roles/role-port.mjs` (now `axes/sdd-engine/role-port.mjs`) |

`brain/core/anti-patterns/evidence-reader-empty-on-failure.md:3` names
`providers/github.mjs` as where the anti-pattern was discovered. That is history, not a
pointer, and is left as it is.

`brain/core/methodology/workflow-governance.md:131` quotes a `scripts/.*/providers/` pattern
that the same paragraph says was never implemented. It is not a path to a file and needs no
change.
