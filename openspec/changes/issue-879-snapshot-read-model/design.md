---
status: applying
issue: 879
---

# Design — #879

## D1 — one result vocabulary, borrowed from `brain:status`

Every section, and every per-item fact that can fail on its own (a PR's review
thread, a change's `tasks.md`, a node's roadmap state), is `{ok: true, value}`
or `{ok: false, reason}`, built with `report.mjs`'s `field`/`uncomputable`.
Those constructors already refuse a `null` value and an empty reason, so the
snapshot cannot carry the silence #280 removed from `brain:status`. A JSON
consumer tests one key.

## D2 — pure core, injected edges

`buildSnapshot({root, now, vcs, project, _read, _list, _exists, _run})` reads
through seams, the shape `release-debt.mjs` and `stranded.mjs` use. The
readers (`readAdrIndex`, `readAntiPatterns`, `readChanges`) take the same
`_read`/`_list`/`_exists` seams; the derivations (`parseAdr`,
`parseAntiPattern`, `roadmapState`, `aggregateActors`, `adrDrift`) take facts
and touch nothing. A test hands the composition a fixture tree and a port whose
write verbs throw.

## D3 — records are projected to their index metadata

`records.value` carries `{id, ts, actor, actorKind, type, issue, supersedes,
title, file}` per record — the set `index.jsonl` already holds
(`memory-format.md`), plus `file` as the pointer. `content` is one file read
away and stays there: 2,300 records × content would make the snapshot a
transport of the store rather than a read model over it, and #881's inspector
reads the record file it is pointed at. Duplicate accounting from
`readRecords` is carried as `records.value.duplicates`; the reader never drops
what it deduped.

## D4 — the forge degrades per section, then per item

`graph`, `prs` and `reviews` each depend on the forge and each fails on its
own. Inside `reviews`, one PR whose thread cannot be read is
`{pr, ok: false, reason}` beside the readable ones — the field-level
degradation `status/cli.mjs` established. `issueRelations` is NOT read: the
graph is built from `issueList` + `issueView` (bodies carry the declared
block), and `buildGraph` treats `relations: undefined` as "not asked", so the
edges' `sources` say `declared` and nothing pretends the native side was
consulted.

## D5 — the roadmap is evidence, not a guess

`planned | in-flight | done` per node. `done` is the ticket's state and needs
no PR. `in-flight` needs an open PR whose `headBranch` matches
`ISSUE_BRANCH_RE` (`memory/lib/capture-provenance.mjs`, the one grammar
`brain:ticket:start` writes) for that issue. `planned` is the absence of such a
PR — which is only a fact when the PR list was read. With `prs` unreadable,
every open node's roadmap is `uncomputable`, because "no PR" would be asserted
from a list nobody saw (`evidence-reader-empty-on-failure`).

## D6 — ADRs: parse the prose, name the drift

The parser reads three conventions the 34 files share: the title line
`# ADR-NNNN — Title`, the `**Status**: <word> …` line, and the `## Amendment N —
summary (issue #N)` headings. Amendment dates come from the status line's
`amended dd/mm/yyyy` (a single date per file today; a heading carries none).
`supersededBy` reads `SUPERSEDED by ADR-NNNN` anywhere in the file's status
line or amendment headings; `supersedes` reads `supersedes ADR-NNNN` in the
same places. The drift check compares the parser's numbers with the
`- [ADR-NNNN](project/decisions/…)` lines `home-index.mjs` already recognises
— its `ADR_LINE_RE` is exported rather than re-declared, so the two readers
cannot disagree on what a HOME.md ADR line is.

An unreadable ADR is kept in place as `{path, ok: false, reason}`. Dropping it
would make the drift check report "HOME.md lists an ADR that does not exist"
for a file that exists and merely failed to parse.

## D7 — the verb prints the module

`snapshot-cli.mjs` resolves the port and the project exactly as
`status/cli.mjs` does (`getVcs`, `originIdentity`, both degrading in band),
calls `buildSnapshot`, and prints `JSON.stringify(snapshot, null, 2)` under
`--json` or a text rendering of the same object otherwise. `--now <iso>` pins
the clock so two runs on one tree are byte-identical; the parity test uses it
to compare the spawned verb with the in-process module. Exit code is 0 in
every computed case, including a fully unreachable forge — a report, not a gate.

## Contract / API impact

Additive. One new npm verb (`brain:snapshot`), one new export on
`home-index.mjs` (`ADR_LINE_RE`), no change to any existing return shape.
`MANAGED_SCRIPT_KEYS` is not touched here: #922 owns the audit of which verbs
the installer injects, and adding one more before that ruling would be a
fifth undeclared entry.

## Alternatives rejected

- **A declared data block per ADR** (ADR-0032 style). Ruled out by #879 ruling
  2 until the drift check shows the convention broken. Measured here: it is not.
- **Reading review rounds from the comment timeline.** The port has no
  comment-read verb, and #880 rules that rounds become records. The snapshot
  carries the parsed verdicts `prReviews` returns, which on GitHub is every
  posted review — the RFC's "latest only" is the board's choice, not the port's.
- **Caching the snapshot between calls.** A cache is a store, and a store beside
  the repository is the second source of truth #878 forbids.
