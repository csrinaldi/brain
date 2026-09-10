---
status: proposed
issue: 887
---

# Design — #887 the lane collector: a pure planner, an IO shell, and one local ref

Implements `proposal.md` under the ratified ruling `sdd/issue-887-lane-collector/ruling`
(D1–D7, 2026-09-09). Parent: #864 task 3.1a, ADR-0034 **L4 + C2**
(`openspec/changes/archive/862/design.md:67-108`).

## Approach in one paragraph

Every decision that can be made from bytes alone is made in `lane/plan.mjs`, a function of its
arguments with no `node:fs`, no `child_process`, no clock and no `os` import. Everything that
touches the machine — enumerating worktrees, reading files, resolving the secret config, writing
blobs, minting the commit, moving the ref — is `lane/collect.mjs`, whose only git access is one
injected seam. The two invariants this slice exists to guarantee are therefore both provable
without a subprocess: **stability** (the planner is a total order over its inputs) and
**no-secret-in-the-object-db** (the planner never emits a file the shell marked, so
`hash-object -w` is unreachable for it). The `collect` op on `memory/cli.mjs` is a dispatch block
beside `reindex` (`cli.mjs:142`), not a new entry point.

## Module map and signatures

```
brain/scripts/memory/lane/plan.mjs      pure — no fs, no spawn, no clock, no os
  planLaneCommit({ candidates, mainPaths, host, date, parent })
    → { ref, parent, files, duplicates, skipped, message }

brain/scripts/memory/lane/collect.mjs   the IO shell + the default git seam
  collectLane({ root, date, host, git = defaultGit, loadConfig = _defaultLoadConfig })
    → { ref, commit, collected, skipped, duplicates, baseFetched }
```

```js
// planner input — the shell has already read and scanned every copy
candidates: [{
  worktree,            // absolute worktree path, from `git worktree list --porcelain`
  file,                // basename, the dedup key
  path,                // '.memory/records/<file>' — repo-relative, what the tree commits
  status,              // the two porcelain columns, verbatim ('??', ' M', 'MM', …)
  content,             // string | null (null ⇒ readError)
  readError,           // string | undefined
  secret,              // { pattern, lineNumber } | undefined  ← the `line` is NEVER carried
}]
mainPaths: string[]    // one `ls-tree` for the whole run
parent: { ref, tip }   // tip: sha of today's lane ref, or null on the first run of the day
```

```js
// planner output
files:    [{ path, file, content, worktree }]        // the winners, sorted by `path`
skipped:  [{ file, worktree, reason, …detail }]      // sorted by (file, worktree)
duplicates: { ids, lines, divergent, groups }        // duplicates.mjs:125's accounting, verbatim
message:  'memory: <host-slug> <date> (<n> records)'
ref:      'refs/heads/memory/<host-slug>-<date>'
```

`skipped` reasons, closed set: `already-on-main` · `modified-tracked` · `unexpected-status` (+`code`)
· `not-a-record` · `invalid` (+`errors`) · `secret` (+`pattern`, `lineNumber`) · `unreadable`
(+`error`).

## Architecture decisions

### A1 — The shell scans; the planner owns the whole `skipped` array

**Choice**: the shell reads each candidate's bytes, runs `scanTextForSecrets`
(`secret-scrub.mjs:79`) and attaches `secret: { pattern, lineNumber }` to the candidate. It does
**not** filter. The planner routes every non-collectable candidate into `skipped`, including the
secret ones, and never emits them in `files`.
**Rejected**: the shell dropping secret-bearing candidates before the planner sees them (D4's
literal control flow).
**Rationale**: D4's guarantee is *"the secret never reaches the object database"*. If the shell
filters, that guarantee is a control-flow property of an IO module and can only be tested through
a real repo. With the planner as the single gate it is a property of a pure function, asserted in
`plan.test.mjs`, and `hash-object -w` is structurally unreachable for a marked candidate because
the shell only ever hashes `plan.files`. It also keeps ONE writer of the `skipped` shape — #886's
A1 rationale ("a shape written twice drifts once",
`openspec/changes/issue-886-mr-auto-merge/design.md:59-72`).
**Corollary, ruled**: the winner is chosen by C2 **first**, then its `secret` mark decides. A
secret-bearing winner skips the whole group; the planner does **not** fall through to the
runner-up. Falling through would make a secret a *selector of record content* — removing the
secret would silently change which bytes ship.

### A2 — `scanTextForSecrets` on the exact bytes that get hashed, via `hash-object --stdin`

**Choice**: the shell `readFileSync`s the candidate once, scans that string, and writes the blob
with `git hash-object -w --stdin --path <repo-relative path>`, piping the same buffer.
**Rejected**: `git hash-object -w --path <p> <abs>` (explore §4's verified form) — git re-reads
the file, so there is a TOCTOU window between the scan and the write, and any `clean` filter
declared for that path would hash bytes nobody scanned.
**Rationale**: "scan before the write" is only worth the words if the scanned bytes and the
written bytes are provably the same bytes. `--path` is kept so attributes still resolve for the
target path. This is the reason the seam must accept `input` (A3).

### A3 — The git seam lives in `collect.mjs`, shaped like `git-seam.mjs`, widened by `input`/`env`

**Choice**: `defaultGit(argv, { cwd, input, env })` inside `collect.mjs`, returning
`{ status, stdout, stderr }` and never throwing — the shape of
`governance/postmerge/git-seam.mjs:27` — plus a `gitOrThrow`-equivalent wrapper (`:54`) and its
256 MiB `maxBuffer` ceiling (`:17`). Injected as `{ git }`.
**Rejected**: importing `governance/postmerge/git-seam.mjs` (it has no `input`; widening a
governance module for a memory consumer couples two subsystems and drags governance's contract
tests into this slice); a new shared `brain/scripts/lib/exec.mjs` — **that file does not exist**;
the repo already runs two independent seams (`vcs/lib/exec.mjs` for `gh`/`glab`,
`governance/postmerge/git-seam.mjs` for git), so per-subsystem seams ARE the established pattern;
a separate `lane/git.mjs` for one importer is indirection.

### A4 — UTC date, computed once per run

**Choice**: `date = new Date().toISOString().slice(0, 10)`, read **once** at the top of
`collectLane` and passed down; injectable for tests.
**Rejected**: the local ISO date (explore §4's draft).
**Rationale**: the date is half of an **identifier**, not a report. Under local time a laptop that
changes timezone appends today's records to *yesterday's* lane, or mints a second lane for one
day — and the `-<n>` collision suffix that would disambiguate is explicitly not in this slice
(D2). CI and servers run UTC, so a host's lane names and any consumer's reading of them agree by
construction. Accepted cost, named: a 21:00 local capture at UTC−5 lands in the next day's lane.
Reading the clock once also stops a run that crosses midnight from minting two refs.

### A5 — Host slug: a regex the planner owns, not `git check-ref-format`

**Choice**: `host.toLowerCase()` → every run of `[^a-z0-9]` becomes `-` → collapse repeats →
strip leading/trailing `-` → truncate to 40 → strip again. The planner then asserts the finished
ref against L1's own grammar, `^refs/heads/memory/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$`, and
throws if it fails.
**Rejected**: shelling out to `git check-ref-format --branch` (a subprocess for a rule we can
state exactly, and it would make the name computation impure); a `unknown-host` fallback.
**Rationale**: the `[a-z0-9-]` charset satisfies every `check-ref-format` prohibition at once
(no `..`, no `@{`, no control chars, no `\`, no `//`, no leading `.`, no `.lock` suffix,
no trailing `.`), so the L1 grammar is strictly narrower than git's and one assertion covers both.
An empty slug **fails loudly** (`memory.collect.badHost`, naming the raw `os.hostname()`): a lane
named `unknown` collides across every unnamed host, which is precisely the cross-host collision
the unimplemented `-<n>` suffix exists for. Unreachable in practice — any hostname with one
alphanumeric produces a valid slug — and unit-tested anyway.

### A6 — Byte difference decides the tiebreak; canonical difference decides `divergent`

**Choice**: two copies with different bytes need a winner, so C2's tiebreak applies — order by
**worktree path**, byte-lexicographically, take the first. The `divergent` FLAG in the accounting
is set only when `canonicalOrNull(a) !== canonicalOrNull(b)` (a `null` compares as divergent),
exactly as the reader decides it (`store.mjs:388-396,413-427`).
**Rejected**: reporting every byte difference as divergent.
**Rationale**: ADR-0034 C2's acceptance is *"zero new `[divergent]` groups attributable to the
lane"*, measured by the post-merge index rebuild. If the collector called key-order-only
differences divergent it would report a number the rebuild will never confirm. A byte-different,
canonically-equal pair is a **duplicate**, not a divergence — which is what `main` will say.
**Comparator, ruled**: `(a < b ? -1 : a > b ? 1 : 0)`, the style already at `duplicates.mjs:128`.
Never `localeCompare` — it is ICU- and locale-dependent, so the same bytes could pick different
winners on two machines. That is the same reproducibility failure D3 rejected `mtime` for, wearing
a different hat.

### A7 — `canonicalOrNull` moves to `format.mjs`; it is not copied

**Choice**: move the private `canonicalOrNull` (`store.mjs:417-427`) into `format.mjs` beside
`canonicalJson`, export it, and have `store.mjs` import it. The planner imports it from
`format.mjs`.
**Rejected**: exporting it from `store.mjs` (the planner would then import a module full of
`readdirSync`/`writeFileSync`, muddying the "planner has no fs" claim); copying the eleven lines
into `plan.mjs` (the divergence rule would have two homes and could drift silently — the reader
and the lane MUST agree on which pairs are divergent, or C2's acceptance criterion is unmeasurable).
**Rationale**: `format.mjs` is where the shape rules live and it imports no fs, so it is the
correct floor. Mechanical move, no behaviour change, covered by the existing store tests.

### A8 — One `status --porcelain -z -uall` per worktree, not `ls-files --others`

**Choice**: `git -C <wt> status --porcelain -z -uall -- .memory/records`.
**Rejected**: `git -C <wt> ls-files --others --exclude-standard -- .memory/records`.
**Rationale**: `ls-files --others` cannot see `modified-tracked`, which D5 requires as its own
reported skip reason — it would take a second subprocess per worktree, doubling the cost on 82
trees. Two flags are load-bearing and both are gotchas: `-uall`, because the default `-unormal`
**collapses a wholly-untracked directory into one `?? .memory/records/` entry** (the live clone
tracks that directory, the temp fixture will not — the fixture would silently produce zero
candidates); and `-z`, because porcelain v1 C-quotes unusual paths otherwise. Status codes map
totally: `??` → candidate · ` M`/`M `/`MM` → `modified-tracked` · anything else (`A`, `D`, `R`,
`U`, …) → `unexpected-status` carrying the code. A **staged** record (`A `) is a human mid-commit;
the collector does not race a commit in progress.

### A9 — `BRAIN_MEMORY_TEST_ROOT` is honoured, and the CAS on `update-ref` is mandatory

**Choice**: `collect` reads its repo root from `process.env.BRAIN_MEMORY_TEST_ROOT ?? repoRoot`,
the seam `reindex` (`cli.mjs:144`), `audit` (`:169`) and `split-records` (`:234`) already use. The
ref move is `git update-ref <ref> <new> <old>`, where `<old>` is the tip observed at plan time or
the empty string `''` (git's "the ref must not exist").
**Rationale (test root)**: without it, `cli.collect.test.mjs` would enumerate the maintainer's
82-worktree clone — the ambient-state trap `cli.mjs:43-55` already records for `.env`.
**Rationale (CAS)**: two `collect` runs on one host (a hook plus a human) both parent off the tip
they read; a bare `update-ref` lets the loser overwrite the winner and lose a commit that already
exists. A lost race is a distinct, named failure (`memory.collect.raced`, exit 1) and is **not
retried** — the loser's plan is stale, its blobs are harmless loose objects, and a re-run collects
them. The empty-string form of `<old>` is documented in `git help update-ref`; the integration
test pins it empirically rather than trusting the man page.

### D8 — `removeTempTree` moves to `lib/tmp-tree.mjs`; `__fixtures__/tmp-tree.mjs` re-exports it

**Choice**: `collect.mjs` (Slice B) needs `removeTempTree` to dispose of the temp index directory
it builds for `read-tree`/`write-tree` (A1). Before this slice, `removeTempTree` lived at
`__fixtures__/tmp-tree.mjs`, and exactly two production modules (`review/cold-boot.mjs`,
`memory/backends/engram.mjs`) already imported it — #802's own scope note flagged that layering
question ("should the helper move out of `__fixtures__`, whose name reads test-only?") and
deliberately deferred it. `collect.mjs` becoming a THIRD production importer is the point at
which deferring further stopped being reasonable for this slice. Resolved by moving the
implementation to `brain/scripts/lib/tmp-tree.mjs` — the directory this repo already uses for
fs/git-adjacent production helpers — and turning `__fixtures__/tmp-tree.mjs` into a one-line
re-export, so every existing `import ... from '.../__fixtures__/tmp-tree.mjs'` across the test
suite keeps working unchanged.
**Rejected**: leaving the import as-is with only a comment justifying it. That would have been the
smaller diff, but it repeats #802's exact deferral a third time instead of resolving it, and it
keeps a genuinely production-owned helper filed under a directory name that tells the next reader
the opposite of what is true.
**Scope note**: this decision resolves ONLY the helper's location. It does not touch
`cold-boot.mjs`'s or `engram.mjs`'s own bare-`rmSync` calls (`tmp-tree-adoption.test.mjs`'s
ALLOWLIST) — whether those two should also adopt `removeTempTree` is a separate question, still
open, still not this slice's to decide in passing.

## Data flow

```
cli.mjs collect ──► collectLane({ root, date, host })
                         │
   fetch origin main ────┤ (failure ⇒ baseFetched:false, continue on the local ref)
   worktree list ────────┤ 1 call        ls-tree origin/main ────┤ 1 call (D6 cost control)
   status -z -uall ──────┤ 1 call per worktree, `-C <wt>`, READ ONLY
   readFileSync + scan ──┤ in-process, no subprocess          ← the ONLY place bytes are read
                         ▼
                  planLaneCommit(…)         ← pure: sort, group, tiebreak, skip, name
                         │  files[]                     skipped[] ─► stderr (i18n)
                         ▼                              duplicates ─► reportDuplicates (stderr)
   hash-object -w --stdin --path ─► blob per WINNER only
   GIT_INDEX_FILE=<tmp>: read-tree <parent> → update-index --add --cacheinfo → write-tree
                         │  tree === parent tree ? ─► { commit: null, collected: 0 }, exit 0
                         ▼
   commit-tree <tree> -p <parent> -m <message>   ← ambient author identity, never a token
   update-ref refs/heads/memory/<host>-<date> <commit> <oldTip|''>      ← compare-and-swap
```

Every command above runs with `cwd = root` **except** the per-worktree `status`, which is the only
`-C <wt>` call in the module. The temp index lives in `testTmp`-style `mkdtempSync` and is removed
in a `finally`.

## Candidate classification (D5, as executed)

| observed | outcome | decided by |
|---|---|---|
| `??`, name matches `^\d{4}-\d{2}-rec-[0-9a-f]{16}\.jsonl$`, absent from `mainPaths`, `validateRecord` ok | **collect** | planner |
| present in `mainPaths` | `already-on-main` | planner (one `ls-tree`, never `cat-file -e` per file) |
| ` M` / `M ` / `MM` | `modified-tracked` | planner — exit stays **0** (ruling) |
| any other status code | `unexpected-status` | planner |
| name fails the grammar (incl. a pre-#677 `<yyyy-mm>.jsonl` month log) | `not-a-record`, message points at `memory:split-records` | planner |
| `validateRecord` fails (`format.mjs:133`) | `invalid` | planner |
| `scanTextForSecrets` hit (`secret-scrub.mjs:79`) | `secret` + `pattern`, `lineNumber` — the matched `line` is dropped at the shell boundary | shell marks, planner routes (A1) |
| read throws mid-run (ENOENT race) | `unreadable` | shell marks, planner routes |
| `.memory/index.jsonl` | never a candidate | outside the pathspec **and** outside the grammar (L3, belt and braces) |
| `bare` / `prunable` worktree stanza | worktree skipped; `worktree prune` is never run | shell |
| `locked` worktree stanza | included; an unreadable path degrades to `unreadable` | shell |

## Output and exit contract

Follows `audit` (`cli.mjs:166-190`): human i18n lines on stdout by default, `--json` prints the
result object instead. The duplicate/skip evidence goes to **stderr** via `reportDuplicates`
(`cli.mjs:96-98`), so `--json` stdout stays parseable.

| situation | stdout | exit |
|---|---|---|
| records collected | `memory.collect.done` — `{count, ref, commit}` | 0 |
| nothing new (`tree === parent tree`) | `memory.collect.nothing` — `{ref}`, `commit: null` | 0 |
| `fetch` failed, ran on the local `origin/main` | `memory.collect.offline` also printed | 0 |
| any skip, including `secret` and `modified-tracked` | stderr lines; the run still succeeds | 0 |
| git failure, bad host, lost CAS | `memory.collect.failed` / `.badHost` / `.raced` on stderr | 1 |

`reportDuplicates(duplicates, { surface: 'the lane commit' })` — `surface` is passed and
`indexCount` is **not**: no index was written, and passing it would print a store→index arithmetic
that never happened (`duplicates.mjs:194`). Eight keys land in **both** `en.mjs` and `es.mjs` in
the same commit; `coverage.test.mjs:96-102` fails `npm test` on a missing Spanish entry.

## File changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/memory/lane/plan.mjs` | Create | `planLaneCommit` — grouping, C2 tiebreak, skip routing, ref/message naming (~130) |
| `brain/scripts/memory/lane/plan.test.mjs` | Create | pure unit suite (~200, uncounted) |
| `brain/scripts/memory/lib/format.mjs` | Modify | `canonicalOrNull` moved in and exported (A7) |
| `brain/scripts/memory/lib/store.mjs` | Modify | imports it instead of defining it (A7) |
| `brain/scripts/memory/lane/collect.mjs` | Create | seam + enumerate + read + scan + hash + tree + commit + CAS (~185) |
| `brain/scripts/memory/lane/collect.integration.test.mjs` | Create | real temp repo, bare origin, two real worktrees (~280, uncounted) |
| `brain/scripts/memory/cli.mjs` | Modify | `"collect"` in `VALID_OPS` (`:103-118`) + a dispatch block after `split-records` (~40) |
| `brain/scripts/memory/cli.collect.test.mjs` | Create | the op end to end under `BRAIN_MEMORY_TEST_ROOT` (~170, uncounted) |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modify | `memory.collect.*` × 8, shape of `en.mjs:306-307` |
| `package.json` | Modify | `"memory:collect": "node ./brain/scripts/memory/cli.mjs collect"` (`:65-73`) |
| `brain/scripts/hooks/**`, `backends/**`, `brain/core/**` | **Untouched** | no hook wiring, no `share` change, no doctrine write (D7) |

## Testing strategy — STRICT TDD

Red before green, in this order. Slice A is steps 1–2; slice B is 3–5.

| # | Layer | File | Asserts |
|---|---|---|---|
| 1 | unit | `lane/plan.test.mjs` | identical bytes collapse to one copy; **divergent tiebreak = lexicographic worktree path**; the accounting's `divergent` follows `canonicalOrNull`, so key-order-only differences are duplicates, NOT divergences (A6); every skip reason; `not-a-record` for `index.jsonl` and for a `<yyyy-mm>.jsonl` month log; empty-candidates shape (`commit`-less plan, `emptyDuplicates()`); host slug + L1 grammar + `badHost`; a secret-bearing WINNER skips the group without falling through (A1) |
| 2 | unit | `lane/plan.test.mjs` | **stability**: three worktrees × four files, all **6 permutations** of enumeration order enumerated exhaustively, `deepStrictEqual` against the reference plan; and two calls on identical input are deep-equal. Exhaustive, not randomised — a shuffle that fails once is not reproducible, which is the property D3 rejected `mtime` for |
| 3 | integration | `lane/collect.integration.test.mjs` | `testTmp('brain-lane-')` (`lib/test-tmp.mjs:35`) + `git init -q -b main` + a **bare** origin (`git init --bare`, `remote add origin <path>`, push) so `fetch` works offline; two real `git worktree add` trees (`bootstrap.worktree.test.mjs:82`); fixtures per worktree: identical, divergent, secret-bearing, already-on-main, modified-tracked |
| 3a | | | **the invariant**: `git status --porcelain -uall` in BOTH worktrees and the main checkout, byte-identical before and after; `rev-parse HEAD` unchanged in each |
| 3b | | | **the seam guard**: with a counting `git`, every recorded argv containing `-C` has `status` as its verb — behavioural, not a source regex (#886 A4's precedent) |
| 3c | | | **the secret never reached the object db**: compute the would-be blob id with `git hash-object --stdin` (**no `-w`**) and assert `git cat-file -e <oid>` exits non-zero; assert the path is absent from `git ls-tree -r <commit>`; assert the matched literal appears in neither stdout nor stderr |
| 3d | | | the winner in the tree is the lexicographically-first worktree's bytes; a same-day re-run **appends** (`rev-list --count` 2, one ref, `refs/heads/memory/*` has exactly one entry); a third run with no new records writes nothing (`commit: null`, ref sha unchanged) |
| 3e | | | CAS: pre-move the ref behind the planner's back, then run — exit 1, `raced`, ref untouched |
| 4 | cli | `cli.collect.test.mjs` | the op under `BRAIN_MEMORY_TEST_ROOT` (`cli.audit.test.mjs:17-43`'s pattern): exit 0 + `done`; exit 0 + `nothing`; `--json` parses and carries `{ref, commit, collected, skipped, duplicates}`; a git failure exits 1 with `memory.collect.failed`; `memory:collect` resolves from `package.json` |
| 5 | i18n | `i18n/coverage.test.mjs` | unmodified — green only once both catalogs carry all eight keys |

```bash
node --test brain/scripts/memory/lane/plan.test.mjs                    # slice A
node --test brain/scripts/memory/lib/store.test.mjs                    # slice A — A7's move
node --test brain/scripts/memory/lane/collect.integration.test.mjs     # slice B
node --test brain/scripts/memory/cli.collect.test.mjs                  # slice B
node --test brain/scripts/i18n/coverage.test.mjs                       # slice B
npm test                                                               # before handing over
```

## Changed-line forecast and the delivery recommendation

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**`. The counter is
additions **+** deletions, so A7's move costs ~22 counted lines, not ~2.

| counted path | slice | lines |
|---|---|---|
| `lane/plan.mjs` | A | ~130 |
| `lib/format.mjs` + `lib/store.mjs` (the move) | A | ~22 |
| `lane/collect.mjs` | B | ~185 |
| `memory/cli.mjs` | B | ~40 |
| `i18n/en.mjs` + `es.mjs` | B | ~16 |
| `package.json` | B | ~1 |
| **single PR total** | | **~394 — High risk** |
| uncounted, reviewer-visible: `plan.test.mjs` ~200, `collect.integration.test.mjs` ~280, `cli.collect.test.mjs` ~170 | | ~650 |

**Recommendation: SPLIT into the two slices the planner seam already draws.** The proposal
estimated ~330 (Medium) and recommended one PR with a pre-agreed split line; this design's decisions
raise it to **~394 counted against a 400 budget** — the seam with `input`/`env` (A3), `--json` and
the test-root seam (A9), the extra i18n keys, and A7's move. A single PR would arrive with ~1.5%
headroom and ~1,050 reviewer-visible lines. Under `delivery_strategy: ask-on-risk`, `sdd-tasks`
should carry `Chained PRs recommended: Yes` / `400-line budget risk: High` /
`Decision needed before apply: Yes`.

| slice | contents | counted | verified by | rollback |
|---|---|---|---|---|
| **A — the planner** | `lane/plan.mjs`, `lane/plan.test.mjs`, A7's move in `format.mjs`/`store.mjs` | ~152 | `node --test brain/scripts/memory/lane/plan.test.mjs` + the store suite + `npm test` | delete one file, revert an 11-line move; nothing is invocable, so nothing regresses |
| **B — the shell and the verb** | `lane/collect.mjs`, `memory/cli.mjs`, both i18n catalogs, `package.json`, the integration + CLI tests | ~242 | the three `node --test` commands above + `npm test` | revert the PR; the op disappears, slice A stays inert and green |

Chain strategy: **stacked-to-main**, per the epic's own rule that each slice is its own PR to
`main` with no tracker branch (`archive/862/design.md:240-241`). B is authored on top of a `main`
that already carries A.

## Migration / rollout

None. No config key, no state file, no hook, no CI context, no caller. `npm run memory:collect` is
the only way to invoke it, by design — #888 is the caller that does not exist yet. The only durable
side effects of a *run* are loose objects and one local ref (`git update-ref -d`, then `gc`).

## Risks and residuals

| risk | mitigation |
|---|---|
| **#889's `lane-paths` computes a two-dot diff** and reads D2's appended tree as deletions | The dependency, not a defect. See the sentence to post below — it is an apply-time action item, not a code change here |
| A `clean` filter or a TOCTOU race makes the hashed bytes differ from the scanned bytes | A2: one read, `--stdin`, the same buffer. Asserted by 3c, which proves the blob was never written |
| `-unormal` collapses an untracked `.memory/records/` in the fixture, so the suite silently collects nothing and passes | A8: `-uall` is mandatory, and the integration fixture deliberately starts with `.memory/records/` untracked so the flag is load-bearing in the test that would otherwise hide its absence |
| A concurrent run on the same host loses a commit | A9's CAS with the observed `<old>`; the loser fails loudly and its objects are re-collected on the next run |
| A pathological host with thousands of untracked records | One `ls-tree` and one `status` per worktree; only `hash-object` is per-file, and only for winners. `collected`/`skipped` counts make the host visible |
| The divergence winner surprises the operator | Reported in `formatDuplicateReport`'s `[divergent]` vocabulary (`duplicates.mjs:203-210,226`) with the losing occurrences named as `<worktree>/.memory/records/<file>:1` — the `:1` is why C2 needed a second tiebreak at all |
| `localeCompare` sneaks into a sort during implementation | A6 rules it out explicitly; the stability test is exhaustive over permutations but would NOT catch a locale difference — reviewers check the comparator by eye |
| The collector is written and nothing calls it | Intended (D7). `npm run memory:collect` makes it testable before its caller exists |
| UTC boundary surprises an operator capturing late in the evening west of Greenwich | A4, named and accepted; the lane name is an identifier, not a report |

**To post on #889 during apply** (the exact sentence):

> #887 D2 makes a same-day second `collect` **append** a commit onto
> `refs/heads/memory/<host>-<date>`, so the lane's tree descends from `origin/main` as it was at
> the day's FIRST run. `lane-paths` must therefore compute its path set **three-dot** — the merge
> base, `git diff --name-only origin/main...HEAD` — never two-dot: an `origin/main..HEAD` diff
> reports every record `main` gained after the first run as a **deletion**, and fails the lane by
> construction. GitHub's PR diff is already three-dot; the required context must match it.

## Open questions

- [ ] None blocking. The two facts taken from `git help` rather than from a run in this context —
      the empty-string `<old>` form of `update-ref` and `-unormal`'s directory collapse — are each
      pinned by a named integration assertion (3e, 3a), so a documentation error surfaces as a red
      test at TDD time rather than as a wrong design.
