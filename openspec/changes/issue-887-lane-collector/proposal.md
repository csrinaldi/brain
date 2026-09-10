---
status: proposed
issue: 887
epic: 864
---

# Proposal — #887 the lane collector: git plumbing reads 82 worktrees and touches none of them

Parent: #864 (memory 2.0), task 3.1a — Wave 3. Slice of the #862 ruling (ADR-0034 **L4 + C2**).

## What is wrong today

A record reaches `main` only when the feature PR that happens to be open does — p50 **21.6 h**,
p90 **399.7 h** (`memory:audit`, n=350). The mechanism is `brain/scripts/hooks/pre-push:70`,
which runs `cli.mjs share` on **every** push regardless of branch, exporting the whole machine's
backend into whatever tree is being pushed. Measured consequence: across 82 worktrees of this
clone the **same** untracked record file sits in up to seven of them.

ADR-0034 ruled the lane. Nothing builds it yet. There is no code path in this repository that
*reads* `git worktree list` — every existing use is `add`/`remove`/`prune`
(`ticket-branch.mjs:58`, `review/cold-boot.mjs:83`). The collector is the first consumer of
worktree enumeration as a data source.

## What lands

`brain/scripts/memory/lane/` — a pure planner and a thin IO shell — plus a `collect` op on
`memory/cli.mjs`. It produces **one local ref**, `refs/heads/memory/<host>-<date>`. It does not
push, does not open a PR, and is called by no hook.

## Decisions

### D1 — Verb surface, output shape, failure convention

| option | what it means | cost |
|---|---|---|
| **(a) `collect` op on `memory/cli.mjs`, dispatched before backend selection** | joins `VALID_OPS` (`cli.mjs:103-118`) beside `reindex` (`:142`), `audit` (`:166`), `resolve-index` (`:198`), `split-records` (`:231`) — the five backend-agnostic ops. `package.json` gains `"memory:collect"` | one more op on a dispatcher that already carries fourteen |
| (b) a `lane` namespace / new CLI entry point | a second memory CLI | a second dispatcher, a second i18n surface, a second test harness, for one verb |
| (c) fold it under #888's `brain:memory:ship` | one verb end to end | this slice would have no testable surface of its own, and `ship` is #888's ticket |

**Recommendation: (a).** Same reasoning the other five backend-agnostic ops already carry: the
durable record layout is brain-owned (ADR-0017), not a `MEMORY_BACKEND` concern. The collector
must **never** route through a backend's `share` — that is the export path it exists to replace.

**No collision with #888.** `collect` is this ticket's op on `memory/cli.mjs`; `brain:memory:ship`
(ADR-0034 L5) is #888's npm verb and will *call* `collect`, then push. Two names, two tickets.

**Failure convention — measured, and it is NOT the port's.** `collect` is dispatched before
backend selection, so `unsupportedOp` is unreachable and the `never-throws` discipline of the VCS
port does not apply. It follows `reindex`/`audit` exactly: its own `try/catch`, `memory.collect.done`
/ `memory.collect.failed` in `brain/scripts/i18n/{en,es}.mjs` (shape of `en.mjs:306-307`), exit
0/1.

**Output shape** — `{ ref, commit, collected, skipped, duplicates }`.
`divergent` is **not** a top-level field: `duplicates` is `lib/duplicates.mjs`'s accounting object,
which already carries `{ ids, lines, divergent, groups }` (`duplicates.mjs:108,125`). A second
top-level `divergent` would be a second source of truth for the same number. Reusing the
accounting also means `reportDuplicates` (`cli.mjs:96-98`) prints the C2 report for free, in
`formatDuplicateReport`'s existing `[divergent]` vocabulary.

### D2 — Same-day re-run (idempotency)

| option | what it means | cost |
|---|---|---|
| **(a) append a commit onto today's ref** | parent = current ref tip, tree = `read-tree <ref tip>` + the new blobs. A run with zero new candidates writes nothing and returns `{ commit: null, collected: 0 }` | the tree is based on a possibly-stale `main`; see the residual below |
| (b) mint `memory/<host>-<date>-<n>` per run | every run is its own branch | N PRs per host per day. The `-<n>` suffix in ADR-0034 L1's grammar exists for a same-day **name collision across hosts**, not for one host's repeat run — (b) spends the suffix on the wrong problem and floods the reviewer with lanes |
| (c) refuse when the ref exists | trivially idempotent | an unattended host that already shipped once at 09:00 cannot ship the 14:00 capture until tomorrow |

**Recommendation: (a).** It answers explore §7 Q1: the collector appends, never suffixes.

**Residual, named:** the appended tree descends from `main` as it was at the *first* run of the
day. GitHub's PR diff is three-dot (against the merge base), so records added to `main` in between
never appear as deletions in the lane diff. **#889's `lane-paths` must compute its path set
three-dot as well** — a two-dot diff would show them as deletions and fail the lane by
construction. Flagged to #889, not solved here.

**Remote ref that does not exist locally: out of scope.** The collector fetches `origin main` only
(`git fetch origin main --quiet`) and reads/writes only the **local** ref. It never fetches
`refs/heads/memory/*`. If the remote lane ref has moved on, #888's push discovers the
non-fast-forward and reports it — the collector must not force anything, and records are
append-only (`memory-backend-contract.md`).

### D3 — Deterministic dedup on divergence (C2)

Grouping is by basename. Byte-identical copies across worktrees collapse to any one copy; they are
indistinguishable. For **divergent** copies of the same filename:

| option | what it means | cost |
|---|---|---|
| **(a) lexicographic worktree path, then physical line** | ADR-0034 C2's literal added tiebreak. The reader's own first-wins rule (`duplicates.mjs:20-24`, `store.mjs:349-399`) cannot discriminate here: post-#677 a file **is** one record, so "earliest month file, earliest physical line" degenerates to "line 1 of both" | the winner depends on where a worktree happens to live on disk — arbitrary, but total, stable, and reproducible without reading any clock or filesystem metadata |
| (b) content-hash-smallest | no dependence on paths | equally arbitrary, harder to explain to the operator holding the diff, and it is **not** what the maintainer ratified |
| (c) mtime | "newest wins" reads intuitive | not reproducible: a copy, a rsync, or a checkout rewrites mtime. A rule whose answer changes between two runs on the same bytes is not a rule |

**Recommendation: (a)** — it is the ratified condition; changing it needs the maintainer, not this
slice. Divergences are **reported, never refused** (the ADR's explicit rejection: refusing bricks
`reindex`/`share`/`pull`/`save` on the machine that needs them most).

**The proof obligation is STABILITY, not single-run correctness** (explore §7 Q4). `plan.test.mjs`
feeds the *same* candidate set in **shuffled worktree-enumeration order** and asserts the plans are
deeply equal, and asserts a repeated call on identical input returns an identical plan. A test that
only checks "the expected winner won once" passes for a sort that is accidentally
enumeration-dependent.

### D4 — A candidate that fails the secret scrub

| option | what it means | cost |
|---|---|---|
| **(a) skip that one file, collect the rest** | scan **before** `hash-object -w`; the failing candidate enters `skipped` with `{ reason: 'secret', pattern, lineNumber }` and never reaches the object database | deviates from `share()`'s all-or-nothing throw (`engram.mjs:394-407`) |
| (b) abort the whole batch | `share()`'s literal precedent | one poisoned record on an unattended host blocks **every** clean record indefinitely, with no human at the terminal to fix it. That is a denial of the whole lane by one file |
| (c) collect it; let #889's `lane-scrub` catch it | the required context is the gate | `hash-object -w` is a **durable write**: the secret is in `.git/objects` and survives every reset, reachable until a `gc --prune`. The point of a first line is not writing it down |

**Recommendation: (a).** C1 makes `lane-scrub` a required, non-waivable status context on the PR —
that is #889's, and it stays the gate. The collector is the *first* line, and its job is to never
put a secret into the object database in the first place. Fail-closed for that file, open for the
other thirty-nine. This answers explore §7 Q2.

**The report must not print the secret.** `scanTextForSecrets` returns `{ pattern, lineNumber, line }`
(`secret-scrub.mjs:87`) and `line` is the matched text. `share`'s message interpolates
`lineNumber` and `pattern` only (`engram.mjs:402-405`); `collect` does the same. A test asserts the
matched literal never appears in the output.

### D5 — Candidate selection

Enumerate every worktree of the clone via `git worktree list --porcelain`; per worktree,
`git status --porcelain -- .memory/records`. Rules:

| case | ruling | reason |
|---|---|---|
| untracked (`??`) record file, absent from `origin/main`, `validateRecord` passes | **collect** | the lane is additions under `.memory/records/` only (L1) |
| present on `origin/main` | skip, `already-on-main` | one `git ls-tree -r --name-only origin/main -- .memory/records` for the whole run, not one `cat-file -e` per candidate — see D6 |
| tracked-and-modified (` M`) | skip, `modified-tracked` | collecting it makes the lane diff carry a **modification**, which is not a lane (L1). It is also a record mutating after `main` saw it — the `supersedes` path (#805), never a lane commit |
| `validateRecord` fails (`format.mjs:133`) | skip, `invalid` | never mint a commit the reader cannot parse |
| `.memory/index.jsonl` | never a candidate | L3 — derived (ADR-0017), regenerated by `post-merge`. Excluded by the filename grammar **and** by an explicit test |
| the main checkout | it is the first porcelain stanza; treated like any other worktree | it holds records like every other tree |
| `prunable` / `bare` stanza | skip the worktree | no readable working tree; the collector **never** runs `worktree prune` — it mutates nothing |
| `locked` stanza | included; an unreadable path degrades to `skipped: 'unreadable'` | a lock is not a reason to lose a record, and an ENOENT mid-run is a race, not a crash |

### D6 — Implementation shape

```
lane/plan.mjs     planLaneCommit({ worktrees, candidates, onMain, host, date, parent })
                  → { files: [{ path, absPath, content, worktree }], duplicates, skipped, message }
                  pure — no fs, no spawn, no clock, no hostname
lane/collect.mjs  the IO shell: enumerate, read, scrub, hash, tree, commit, update-ref
```

- **Git seam**: `gitTry` / `gitOrThrow`, the shape of `governance/postmerge/git-seam.mjs:27,54`
  (never-throws / throws-with-`.status`), **injected** into `collect.mjs`. Distinct from
  `vcs/lib/exec.mjs`'s `run`/`setSpawn` (the `gh`/`glab` seam) — do not conflate them.
- **The invariant, and the test that proves it**: no working tree and no repository index is
  touched. The temporary index lives in a `mkdtempSync` path via `GIT_INDEX_FILE`, removed in a
  `finally`. The integration test snapshots `git status --porcelain` in **both** scratch worktrees
  before and after the run and asserts byte equality. Without that assertion the invariant is a
  comment.
- **Commit**: `git commit-tree <tree> -p <parent> -m "memory: <host> <date> (<n> records)"`, where
  `<n>` is the records in *this* commit. `<host>` = `os.hostname()` slugified to `[a-z0-9-]`,
  matching L1's grammar `^memory/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}(-\d+)?$`.
- **Author identity**: the ambient git identity, i.e. whatever `commit-tree` already resolves.
  Never a token, never a fabricated `Name <email>`. If the identity is unset, `commit-tree` fails
  and the run fails with git's own message — a collector that invents an author is a collector that
  forges provenance.
- **Offline**: if `git fetch origin main` fails, continue against the existing local
  `origin/main` and report `baseFetched: false`. An unattended host must still collect. If
  `origin/main` does not resolve at all, fail loudly.
- **Cost control**: one `ls-tree` for the whole run instead of one `cat-file -e` per candidate —
  82 worktrees × N records is otherwise 82 + N subprocesses.

### D7 — Scope

**In**: `lane/plan.mjs`, `lane/collect.mjs`, the `collect` op in `memory/cli.mjs`'s `VALID_OPS`
and its dispatch block, `memory.collect.*` in `i18n/{en,es}.mjs`, `"memory:collect"` in
`package.json`, and the two test files named below.

**Out / non-goals**:

- **the push and the PR** (#888/3.1b) — including the `--no-verify` push, which is *its* ruling
  (ADR-0034 L9), and `mrCreate` + `mrAutoMerge`. This slice must not grow a push call or a PR-body
  builder;
- **`brain:memory:ship`** and any hook wiring — session-end and `day:start` call **nothing** new in
  this slice (L5 is #888);
- **`lane-paths` / `lane-scrub`** as CI contexts (#889/3.1c);
- **retiring `pre-push:70`** and the other four feature-PR surfaces (#890/3.1d) — they keep working
  untouched, so this slice is additive and reversible;
- any change to `share`, `reindex`, the record format, or `memory-gate`.

**Doctrine**: no `brain/core/**` write and no `brain-drafts/` file. ADR-0034 already carries the
collector's ruling, and — verified — no drift guard reads `memory-format.md` or
`memory-backend-contract.md` the way `verb-contract-drift-guard.test.mjs` reads `vcs-contract.md`.
Unlike #886, this PR needs no maintainer promotion sitting to go green.

**Capabilities (spec contract)**: none new, none modified under `openspec/specs/**` — this repo
keeps that tree empty; the normative surface is ADR-0034 plus
`brain/core/methodology/memory-format.md`, neither of which changes here.

## What #888 receives

- a local `refs/heads/memory/<host>-<date>` and `{ ref, commit, collected, skipped, duplicates }`;
- `commit: null` with `collected: 0` means **nothing to ship** — a normal outcome, never an error,
  and #888 must not open an empty PR on it;
- `skipped` entries carry a machine-readable `reason`; the `secret` ones belong in the operator
  report, and the `lineNumber`/`pattern` pair is the whole of what may be printed;
- the ref is local only. Fetching, pushing, and the non-fast-forward story are #888's.

## STRICT TDD

Tests first, in this order:

1. `brain/scripts/memory/lane/plan.test.mjs` — pure unit tests of `planLaneCommit`: identical-bytes
   collapse; divergent tiebreak by lexicographic worktree path; **stability under shuffled
   enumeration order** (D3); already-on-main skip; `modified-tracked` skip; `index.jsonl` never a
   candidate; empty-candidates shape.
2. `brain/scripts/memory/lane/collect.integration.test.mjs` — a real temp git repo
   (`resolve-index.integration.test.mjs:23-90`'s `mkdtempSync` + direct `spawnSync('git', …)`,
   `__fixtures__/tmp-tree.mjs#removeTempTree` for cleanup) plus two **real** `git worktree add`
   trees. Assertions: both worktrees' `git status --porcelain` unchanged before/after; the winning
   commit holds the lexicographically-first worktree's copy; a same-day re-run **appends** and never
   mints a second branch; a secret-bearing candidate is absent from the commit **and** its plaintext
   is absent from the output.
3. Then `plan.mjs`, then `collect.mjs`, then `cli.mjs` + i18n + `package.json`.

## Changed-line estimate (400-line budget)

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**` from the counted diff.

| path | counted lines |
|---|---|
| `brain/scripts/memory/lane/plan.mjs` | ~120 |
| `brain/scripts/memory/lane/collect.mjs` | ~160 |
| `brain/scripts/memory/cli.mjs` | ~35 |
| `brain/scripts/i18n/en.mjs` + `es.mjs` | ~12 |
| `package.json` | ~1 |
| **counted total** | **~330 — Medium risk** |
| uncounted but reviewer-visible: `plan.test.mjs` ~180, `collect.integration.test.mjs` ~220 | ~400 |

**Recommendation: one PR, with a pre-agreed split line.** ~330 counted fits the budget, but the
reviewer-visible total is ~730. If the shell overruns the estimate, split at the seam the design
already draws — **PR 1**: `plan.mjs` + `plan.test.mjs` (pure, no CLI surface, ships nothing a user
can invoke); **PR 2**: `collect.mjs` + the CLI op + i18n + the integration test. Both slices are
autonomous, verifiable, and revert cleanly. `delivery_strategy: ask-on-risk` — the decision belongs
to `sdd-tasks`' forecast, and this is its input.

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| A worktree holds thousands of untracked records; the run turns into thousands of subprocesses | Med | one `ls-tree` per run, not one `cat-file -e` per candidate (D6); `hash-object -w` stays per file because it must. Report the count so a pathological host is visible |
| `hash-object -w` writes a secret into `.git/objects`, where reset cannot reach it | Med | the scrub runs **before** the hash (D4), asserted by a test that inspects the commit tree, not just the printed output |
| `.memory/index.jsonl` slips into the lane, breaking L3 | Low | excluded by the record filename grammar and by a dedicated test |
| The divergence winner surprises an operator ("why that copy?") | Med | it is reported in `formatDuplicateReport`'s `[divergent]` vocabulary with the losing occurrences named; the rule is ADR-0034 C2 and the report cites it |
| `lane-paths` (#889) computes a two-dot diff and sees D2's appended tree as deletions | Med | flagged in D2 as an explicit input to #889; three-dot is the contract |
| A `git worktree list` stanza shape not covered (bare, prunable, locked, detached) crashes the run | Low | the porcelain parser is pure and unit-tested against each stanza kind; unknown stanzas skip the worktree, never abort the batch |
| The collector is written, and nothing calls it | High (by design) | intended: #888 is the caller. The op is invocable by hand (`npm run memory:collect`) so it is testable before its caller exists |

## Rollback

Revert the PR. Nothing calls `collect`; no hook, no CI context, no config key, and no existing op
changes behaviour. The only durable side effects a *run* leaves are loose objects and one local
ref — `git update-ref -d refs/heads/memory/<host>-<date>` plus the normal `gc` removes both. No
working tree was modified, by construction, so there is nothing to restore.

## Success criteria

- [ ] `npm test` green; `npm run memory:collect` produces a ref whose commit contains only
      `.memory/records/*.jsonl` additions.
- [ ] Both scratch worktrees' `git status --porcelain` are byte-identical before and after a run —
      asserted, not assumed.
- [ ] The divergence tiebreak returns an identical plan under shuffled worktree enumeration order.
- [ ] A secret-bearing candidate is skipped with `{reason:'secret', pattern, lineNumber}`, the other
      candidates are collected, and the matched text appears nowhere in the output or the tree.
- [ ] A same-day second run appends a commit to the existing ref; a run with no new candidates
      writes nothing and returns `commit: null`.
- [ ] No push, no PR, no hook, and no `brain/core/**` file is touched by this slice.

## Proposal question round

Raised for the maintainer; each has a working recommendation above, so none blocks `sdd-spec` /
`sdd-design`.

1. **D4 deviates from a precedent.** `share()` aborts the whole batch on a secret hit; this
   proposal skips the one file. Is skip-and-report the intended reading of C1 at the *collector*
   stage, with `lane-scrub` remaining the all-or-nothing gate on the PR?
2. **D5's `modified-tracked` skip is silent data.** A record already on `main` that changed locally
   is never collected. Should the collector merely report it, or is that condition loud enough to
   warrant a non-zero exit, since it means someone mutated an append-only record?
3. **D2's residual is a dependency, not a defect.** Is it acceptable that #887 ships a lane shape
   whose correctness on day-two runs depends on #889 computing `lane-paths` three-dot?
4. **Delivery.** Single PR at ~330 counted / ~730 visible lines, or the pure/shell split at the
   planner seam from the start?
