---
status: draft
issue: 887
---

# Explore: #887 — the lane collector (worktree plumbing, no checkout)

Parent: #864 task 3.1a. Implements the collector requirements of the #862 ruling
(`openspec/changes/archive/862/{spec,design,proposal}.md` L4+C2, promoted as
`brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md`). This
ticket produces a **local lane commit/branch ref only** — no push, no PR (#888).

## 1. Current state, measured

- **Record store**: one file per record, `.memory/records/<YYYY-MM>-rec-<id>.jsonl`
  (post-#677 `split-records`). Confirmed live: `.memory/records/2026-06-rec-*.jsonl`,
  and this session's own worktree carries three untracked candidates
  (`.memory/records/2026-09-rec-{05cdb8ee,4c0b872b,9d06150e}...jsonl`).
- **First-wins rule** (`brain/scripts/memory/lib/duplicates.mjs:20-24` doctrine
  comment; enforced in `lib/store.mjs#readRecords`, `:349-399`): month filenames
  read via `readdirSync(...).sort()` (`:356`), lines within a file in physical
  order; the first id seen wins, later occurrences recorded in `duplicates` and
  marked `divergent` when `canonicalJson(record)` disagrees (`:392-396`,
  `canonicalOrNull` `:417-427` — a `null` canonical counts as divergent, the
  safe direction).
  **One-file-per-record consequence for the collector**: since a file *is* one
  record, "earliest month file, earliest physical line" degenerates to "line 1
  of both copies" whenever two worktrees hold the *same filename* — the
  reader's original rule cannot discriminate between them. That is exactly why
  the design adds a second tiebreak (see §4).
- **`validateRecord`**: `brain/scripts/memory/lib/format.mjs:133`.
- **Secret scrub**: `brain/scripts/memory/lib/secret-scrub.mjs` —
  `scanTextForSecrets` (`:79`), `scrubRecordsFile` (`:137`, plaintext, no
  gunzip), `resolveSecretConfig` (`:56`, additive merge of
  `governance.memorySecretPatterns`), `DEFAULT_SECRET_PATTERNS` (`:23-29`).
  **Today's call site**: `backends/engram.mjs:394-407` — `share()` builds
  `candidateText` from all pending records, scans it, and **throws before any
  append** on a hit (`memory.share.secretFoundRecords`, fail-closed, no flag).
  This is direct precedent for the collector refusing to collect a record that
  fails the scrub (see §5).

## 2. Worktree enumeration — genuinely new capability

Searched `brain/scripts/**` for any existing *read* of `git worktree list`:
none. Every existing use of `worktree` is `add`/`remove`/`prune` — creating or
tearing down a scratch checkout (`brain/scripts/lib/ticket-branch.mjs:58-59`,
`brain/scripts/review/cold-boot.mjs:83-93`,
`brain/scripts/review/evaluators/checkpoint.mjs:281-282`). None of them
*enumerate* worktrees to read files out of them. `lane/collect.mjs` is the
first consumer of `git worktree list --porcelain` as a data source. Verified
live in this clone: 82+ worktrees (ADR-0034's own measurement), porcelain
output confirmed (`worktree <path>` / `HEAD <sha>` / `branch <ref>` or
`detached` stanzas, blank-line separated).

## 3. Export path this collector replaces

`brain/scripts/hooks/pre-push:70` runs `cli.mjs share` unconditionally on
every push, exporting the *whole* backend into whatever tree is being pushed —
this is the cross-contamination ADR-0034 names (records from up to 7
worktrees showing up via one push). `memory/cli.mjs`'s `share` op
(`cli.mjs:1-690`) is backend-dispatched; `collect` must NOT go through that
path — it reads `.memory/records/` directly across worktrees via git plumbing,
never invoking a backend's `share`.

## 4. The algorithm, commands verified locally (read-only)

```sh
git fetch origin main --quiet
git worktree list --porcelain                          # confirmed format, live
# per worktree <wt>:
git -C <wt> status --porcelain -- .memory/records       # untracked/modified record files
git cat-file -e origin/main:.memory/records/<f>         # confirmed: exit 0 iff blob exists at that path
git hash-object -w --path .memory/records/<f> <abs>     # confirmed: valid flag
GIT_INDEX_FILE=$tmp git read-tree origin/main
GIT_INDEX_FILE=$tmp git update-index --add --cacheinfo 100644,<oid>,.memory/records/<f>  # confirmed flag+form
GIT_INDEX_FILE=$tmp git write-tree
git commit-tree <tree> -p origin/main -m "memory: <host> <date> (<n> records)"
git update-ref refs/heads/memory/<host>-<date> <commit>   # #887 stops here — #888 pushes
```

`<host>` = `os.hostname()` slugified to `[a-z0-9-]` (matches the branch grammar
in ADR-0034 L1: `^memory/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}(-\d+)?$`);
`<date>` = local ISO date (`YYYY-MM-DD`) at run time.

**Idempotency, same-day re-run**: if `refs/heads/memory/<host>-<date>` already
exists, the collector must **append a new commit on top of it**
(`-p <existing-ref-sha>` instead of `-p origin/main`, tree built from
`read-tree <existing-ref-sha>` instead of `origin/main`), not mint a new
`-<n>` branch — the `-<n>` suffix in the grammar is for a genuine same-day
*name collision* across hosts, not for this host's own repeat run. This needs
confirming in the proposal (open question, §7).

**C2 — deterministic dedup, concretely**:
1. Group all not-yet-on-main candidates by basename (`<YYYY-MM>-rec-<id>.jsonl`).
2. Within a group: byte-identical across every worktree that has it → take any
   one copy (they're indistinguishable).
3. Diverging bytes → apply the reader's rule, worktree-adapted: since
   "month file order" cannot discriminate two copies of the *same* filename
   (§1), order candidate copies by **lexicographic worktree path** (the
   design's added tiebreak), take the first — i.e., the copy from the
   worktree whose `git worktree list` path sorts first, byte-for-byte
   reproducible on every run.
4. Report every diverging group in `formatDuplicateReport`'s vocabulary
   (`duplicates.mjs:187-232`, `[divergent]` marker) — **never refuse**
   (explicit ADR rejection: "refusing a divergent duplicate... bricks
   reindex/share/pull/save").

## 5. Secret scrub on collect — propose: refuse to collect, don't push a dirty ref

Precedent (§1) is unambiguous: `share()` already refuses to append a record
that fails the scrub, before any write. The collector should do the same
*before* `hash-object -w`: run `scrubRecordsFile` (or the equivalent
`scanTextForSecrets` over the candidate's content) per candidate, and any hit
excludes that one file from the batch — reported like a `skipped` entry, not
a hard abort of the whole run (a batch of 40 candidates should not be blocked
by one bad file when the other 39 are clean and the collector runs
unattended). This differs slightly from `share`'s all-or-nothing throw and is
called out as an open question for the proposal (§7) — the design doc does not
rule on batch-vs-file granularity for C1 at the collector stage (C1 the
*required CI check* belongs to #889).

## 6. Seams, verb surface, tests

- **Git seam**: copy the shape of `brain/scripts/governance/postmerge/git-seam.mjs`
  — `gitTry` (`:27`, never throws, returns `{status, stdout, stderr}`) /
  `gitOrThrow` (`:54`, throws with `.status` attached). `lane/collect.mjs`
  injects this exactly as the design names (`gitTry`/`gitOrThrow` at
  `git-seam.mjs:27,54`). Distinct from `brain/scripts/vcs/lib/exec.mjs`'s
  `run`/`setSpawn` (spawnSync wrapper for `gh`/`glab`, not git plumbing) — do
  not conflate the two seams.
- **Verb**: `collect` joins `VALID_OPS` in `cli.mjs:103-118`, dispatched
  **before** backend selection (`cli.mjs:431` onward) — alongside `reindex`
  (`:142`), `audit` (`:166`), `resolve-index` (`:198`), `split-records`
  (`:231`), `migrate-v1` (`:309`): backend-agnostic (git/worktree plumbing,
  no `MEMORY_BACKEND` concern), same reasoning as those five.
  `package.json:65-73` gains `"memory:collect": "node ./brain/scripts/memory/cli.mjs collect"`.
  Output shape: `{ ref, commit, collected, skipped, duplicates }` (issue
  body's own shape) — `duplicates` reuses `lib/duplicates.mjs`'s accounting so
  `reportDuplicates` (`cli.mjs:96-98`) prints it for free. `collect.mjs` may
  throw on a genuine git failure (mirrors `gitOrThrow`'s contract); `cli.mjs`'s
  existing top-level try/catch (`:609-690`) already turns that into
  `memory/cli: collect() failed — <message>` + exit 1 — no `unsupportedOp`
  path needed since `collect` isn't backend-dispatched.
- **i18n**: new keys `memory.collect.*` in `brain/scripts/i18n/{en,es}.mjs`,
  same shape as `memory.reindex.done`/`memory.reindex.failed`
  (`en.mjs:306-307`).
- **Tests, STRICT TDD, name the files**:
  - `brain/scripts/memory/lane/plan.test.mjs` — pure unit tests of
    `planLaneCommit({ worktrees, candidates, onMain })`: identical-bytes
    collapse, diverging-bytes tiebreak by worktree path, already-on-main
    skip, empty-candidates shape.
  - `brain/scripts/memory/lane/collect.integration.test.mjs` — real temp git
    repo (`resolve-index.integration.test.mjs:23-90`'s
    `mkdtempSync(tmpdir(), 'brain-...')` + direct `spawnSync('git', …)`,
    `__fixtures__/tmp-tree.mjs#removeTempTree` for cleanup), plus two
    **real** `git worktree add` scratch trees off that repo
    (`bootstrap.worktree.test.mjs:82`, `cold-boot.mjs:83-93`'s
    add/remove/prune) — write a same-named divergent record into each, run
    the real collector, assert: both worktrees' `git status --porcelain`
    stay clean, the winning commit holds the lexicographically-first
    worktree's copy, and a same-day re-run is a no-op/append per §7 —
    never a second branch. `git-seam.test.mjs`'s pattern (`mkdtempSync` +
    direct git calls, no mocking) is the precedent for any lower-level
    `gitTry`/`gitOrThrow` unit tests below the integration test.

## 7. Open questions for the proposal

1. **Idempotency exact shape**: append-commit onto today's existing lane ref
   (§4) vs. a `-<n>` suffix — the ADR's grammar supports `-<n>` but design
   text doesn't explicitly rule out reusing it for a same-host re-run. Needs
   a one-line ruling.
2. **Scrub granularity** (§5): skip-the-one-bad-candidate vs. abort-the-whole-batch
   on a secret hit. `share()`'s precedent is abort-the-batch; the collector's
   unattended-run context argues for skip-and-report. Needs a ruling before
   `collect.mjs` is written, since it changes the shell's control flow.
3. **Verb name**: issue body doesn't fully commit to `collect` vs.
   `brain:memory:collect` vs. something under the `brain:memory:ship`
   umbrella (L5 names `brain:memory:ship` as the *trigger* verb, which is
   #888's territory) — confirm `collect` is this ticket's op name and `ship`
   is #888's, so the two don't collide in `VALID_OPS`.
4. **Tiebreak proof obligation**: `plan.test.mjs` must assert the tiebreak is
   stable across *repeated* runs with the same input ordering, not just
   correct once — C2's acceptance language ("deterministically, on repeated
   runs") reads as a specific test assertion, not just a property of the sort.

## 8. Scope boundary (issue body §8, restated)

#887 (this ticket): `plan.mjs` (pure) + `collect.mjs` (shell) → a local
`refs/heads/memory/<host>-<date>` commit. **No push, no PR.**
#888: pushes that ref (`--no-verify`) and opens the PR via `mrCreate` +
`mrAutoMerge` (already landed, #886/#895). #889: `lane-paths`/`lane-scrub`
CI contexts. #890: retires the five feature-PR surfaces (`pre-push:70` etc.,
ADR-0034 L6/L7). This ticket must not grow a push call or a PR-body builder.
