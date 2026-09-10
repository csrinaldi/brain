---
status: proposed
issue: 247
---

# Design — #247 the chunk read-back becomes a boundary a test owns, and a ledger #874 inherits

Parent: #864 task 2.3. Ruling: **#863 D3** (`openspec/changes/issue-863-backend-contract/proposal.md:91-99`,
restated `design.md:32`) — 2.3 is the *read-back*, the export retires at **3.2 (#874)**, then 2.4.
Inputs: `proposal.md` (D0–D6), `explore.md`. No ruling artifact exists in engram under
`sdd/issue-247-chunk-retirement/ruling`; the ruling is #863's, cited by file:line throughout.

## Approach in one paragraph

Nothing that runs changes. One new test module — `brain/scripts/memory/chunk-boundary.test.mjs` —
walks every `*.mjs` under `brain/scripts/**` and `test/**`, extracts the import graph edges that
reach `migrate-v1.mjs`'s `collectChunkObservations`, and asserts that set **equals** an annotated
allowlist in both directions. The same module carries three more pins: `readChunkObservations` has
no importer *and* no definition; `plainfiles.share` on a real temp store produces a `.memory/` tree
with no `chunks` entry; `brain-audit.mjs`/`brain-check.mjs` still import `readRecordObservations` and
no chunk reader. The only production edit is a header note in `engram.mjs` pointing each chunk seam
at the ledger row that retires it (~12 counted lines). `share`, `dualWriteRecords`, and the #469
scrub subsystem are byte-unchanged.

## Module map

```
brain/scripts/memory/chunk-boundary.test.mjs          NEW   the four guards, one allowlist
brain/scripts/memory/backends/plainfiles.share.test.mjs  MOD  +1 real-fs temp-store negative
brain/scripts/memory/lib/migrate-v1.test.mjs          MOD   the allowlist is a contract, not an accident
brain/scripts/memory/backends/engram.mjs              MOD   header note → ledger (the only counted diff)
brain/scripts/governance/run-check.test.mjs:32        MOD   prose → cross-reference to the guard
openspec/changes/issue-864-memory-2-0/tasks.md:32     MOD   one line (D0's reconciliation)
```

## Architecture decisions

### A1 — The guard lives beside the code it constrains, not under `governance/`

Proposal D6 placed it at `governance/chunk-boundary.test.mjs`, beside the prose it replaces
(`run-check.test.mjs:32`). **Chosen instead: `brain/scripts/memory/chunk-boundary.test.mjs`.**
`brain/scripts/governance/**` is a directory of *gate scripts* — every `.mjs` there is (or supports)
a `GOVERNANCE_JOBS` entry covered by `VERIFICATION_SURFACE`'s `dirs` (`vcs/governance-tiers.mjs:123`).
This guard is a `npm test` unit assertion with no production module and no CI context; filing it
there implies a gate that does not exist. The constrained surface is entirely `memory/` — three
importers, `plainfiles.share`, `migrate-v1.mjs` — so an engineer editing `engram.mjs` meets the guard
in the same tree. `package.json:62`'s glob is `brain/scripts/**/*.test.mjs`, so it runs either way.
`run-check.test.mjs:32`'s comment keeps its narrative and gains a one-line pointer to the guard.

### A2 — The walk includes `*.test.mjs`, and there is one allowlist, not two

| option | cost |
|---|---|
| exclude `**/*.test.mjs` | the allowlist would hold **2** entries and `migrate-v1.test.mjs:13` — a real importer — would be invisible. A re-introduced chunk read could then park in a test file, which the counted-diff config (`brain.config.json:20`) already excludes from review pressure |
| **include tests, one flat allowlist** | a legitimate new fixture test must add an annotated row. That is the point: the row names the ticket that retires it, so the allowlist is a complete inventory of the chunk blast radius rather than a production-only sample |

Measured today the set is exactly three, one of which is a test — which is the argument. Note what is
**not** in it: `engram.share.test.mjs` mocks the `_readObservations` seam (`engram.mjs:186`) and never
imports the symbol, so it is a ledger row (5) without being an allowlist row.

### A3 — Set equality, both directions, plus a "the scan read something" self-check

`assert.deepEqual(sortedFound, sortedAllowlist)` — a new importer fails, and an allowlisted file that
stopped importing **also** fails, so a retirement at 3.2/2.4 cannot land without deleting its row.
This is stronger than the repo's nearest precedent: `check-refs.mjs`'s exemptions are one-directional
(`:57-58`, `:80`), so a dead exemption there survives silently. The scan additionally asserts it
actually read `engram.mjs`, `cli.mjs` and `migrate-v1.mjs`, and that `migrate-v1.mjs` still exports
the symbol — `settings-hooks.test.mjs:145-150`'s rule, "a scan that reads nothing proves nothing".
A deleted `migrate-v1.mjs` would otherwise leave the guard vacuously green.

### A4 — The matcher must handle `await import(...)` spanning lines — the one real trap

`lane-scrub.test.mjs:88-94`'s source guard filters `source.split('\n')` for `/^\s*import\b/`. That
shape **cannot see `cli.mjs:615-617`**, where the edge is
`const { collectChunkObservations, buildMigrationReport } = await import(\n  "./lib/migrate-v1.mjs"\n);`
— three lines, no leading `import`. The guard therefore matches over the **whole source**, one regex
covering both spellings, keyed on the specifier ending in `migrate-v1.mjs`:

```js
// brain/scripts/memory/chunk-boundary.test.mjs
const CHUNK_IMPORT_RE =
  /(?:import\s*\{([^}]*)\}\s*from\s*|(?:const|let|var)\s*\{([^}]*)\}\s*=\s*await\s+import\s*\(\s*)['"]([^'"]+)['"]/g;

// Line 61, not 48: apply's Work Unit 4.1 header note inserted 13 lines
// ahead of the import block; re-measured after that edit, per tasks.md 0.5.
const ALLOWLIST = [
  { file: 'brain/scripts/memory/backends/engram.mjs',     line: 61,  retiredBy: '3.2 (#874) — ledger row 2' },
  { file: 'brain/scripts/memory/cli.mjs',                 line: 615, retiredBy: '2.4 — ledger row 7' },
  { file: 'brain/scripts/memory/lib/migrate-v1.test.mjs', line: 13,  retiredBy: '2.4 — ledger row 7' },
];
```

Accepted false-positive: a *commented-out* import would count as an edge. Measured — none exists.
The safe direction (a comment fails loud) beats stripping comments and risking a real edge dropped.

### A5 — `readChunkObservations`: no importer **and** no definition; comments stay legal

Two assertions, because zero-importers alone would pass over a resurrected module nobody imports yet:
no file matches the import regex for that symbol, and no file matches
`/^\s*export\s+function\s+readChunkObservations\b/m`. Comments are deliberately **not** scanned —
`store.mjs:281`, `store.test.mjs:266,269` and `run-check.test.mjs:32` mention the name as history, and
a guard that banned the word would force deleting the documentation of why the symbol is gone.

### A6 — The plainfiles pin is an exact tree equality on a real temp store

`plainfiles.share.test.mjs` today injects `_rebuildIndex` (`:16`, `:32`) and touches no filesystem, so
it cannot answer "was a chunk written". The new case runs `share({ root: tmp })` with **real** deps
over a seeded `<tmp>/.memory/records/`, then asserts the recursive listing of `<tmp>/.memory` equals
`['index.jsonl', 'records', 'records/<seed>.jsonl']` exactly. Exhaustive enumeration, not
`assert.ok(!entries.includes('chunks'))`: absence proved by naming everything present cannot rot into
a check that passes because the tree moved. `rebuildIndex` (`store.mjs:238-239`) mkdirs the index's
parent and writes it — that is the whole expected footprint, and `plainfiles.mjs`'s only chunk
reference is a comment at `:145`.

### A7 — The guard is symbol-scoped; the path-literal hole is named, not closed

`_defaultChangedChunkFiles` (`engram.mjs:565-596`) reads `.memory/chunks` via
`readdirSync(join(root, ".memory", "chunks"))` — no symbol, so **this guard does not see it**, nor
would it see a new direct reader written the same way. Closing that needs a second allowlist over
chunk-path literals. Not adopted here: it is unmeasured (comments at `:250-251`, `:499-521`, `:651`
would need excluding) and the slice's value does not depend on it. Named as Open Question 1 with the
measurement that decides it.

## Data flow — what the guard reads (nothing at runtime changes)

```
brain/scripts/**/*.mjs ─┐
test/**/*.mjs ──────────┴─► readFileSync ─► CHUNK_IMPORT_RE ─► edges{file, symbols, specifier}
                                                  │
                          filter specifier ~ migrate-v1.mjs ─► found[]  ══deepEqual══ ALLOWLIST[]
                                                  └► symbol readChunkObservations ─► must be []

plainfiles.share({root: tmp}) ─► rebuildIndex ─► <tmp>/.memory = {index.jsonl, records/} (exact)
brain-audit.mjs:53 / brain-check.mjs:28 ─► readRecordObservations ─► pinned; no chunk reader
```

## Ledger — what dies at 3.2 (#874) and 2.4, with anchors re-measured on this worktree

Anchors below are the FINAL apply-time measurement, taken after Work Unit 4.1's header note
landed in `engram.mjs` (that insertion shifted every subsequent line by exactly +13 — the design-
time anchors, e.g. import `:48`, are superseded by the ones in this table; see tasks.md 0.5).

| # | surface (file:line) | dies at | note |
|---|---|---|---|
| 1 | `engram.mjs#_defaultShareExport` `:486-493` | **3.2** | the `engram sync --export` call itself |
| 2 | `engram.mjs#_defaultReadObservations` `:273-275` + the import `:61` | **3.2** | the read-back; allowlist row 1 |
| 3 | `dualWriteRecords`'s `_readObservations` seam — default `share():199`, call `:345` | **3.2** | proposal said `:323`; **measured `:345`** (post-header-note) |
| 4 | `_defaultChangedChunkFiles` `:578-609`, `scrubMaterializedChunks` `:686`, `assertExportDestinationIsRead` `:653` | **3.2, last** | delete **only after** #469's fail-closed guarantee is re-proved over record-first `save`. Proposal grouped all three at `:565-596`; **measured separately** |
| 5 | `engram.share.test.mjs` (~1069 lines, ~15 chunk-scrub tests) | **3.2** | largest line count in 3.2; not an allowlist row (it mocks the seam) |
| 6 | `.engram → .memory` symlink ensure `engram.mjs:221` → confined to `setup()`; `bootstrap.sh:304` driver registration; `.gitattributes:5` (`merge=engram-manifest`) + `merge-engram-manifest.mjs`; `.memory/manifest.json` untracked | **2.4** | D3's order: after 3.2, or the manifest churn of #803 returns |
| 7 | `secret-scrub.mjs`'s `gunzipSync`/`scrubChunkFile`; `collectChunkObservations` in `migrate-v1.mjs:42` + `cli.mjs:615`; `.memory/legacy/*.jsonl.gz` (48 tracked files); the `.gitignore` chunk block `:81-84` | **2.4** | the legacy gz **reader story**: zero readers outside `migrate-v1 --rollback` (`cli.mjs:578`); historical value only — stated *by 2.4, when it deletes them*, not by #247 |

## The epic 2.3 amendment — exact replacement for `issue-864-memory-2-0/tasks.md:32`

```markdown
- [ ] 2.3 #247 — **[rev 2026-09-10, per #863 D3]** the **read-back boundary only**: `chunk-reader.mjs`'s verdict is *deleted* (PR #258) and `readChunkObservations` has zero importers; a guard test pins that plus `collectChunkObservations`'s annotated allowlist (`migrate-v1.mjs`, `engram.mjs`, `cli.mjs`'s `migrate-v1`); the ledger of what 3.2 deletes is written. **`share` keeps calling `engram sync --export`** — retiring it here would leave engram with no producer path (`save` is `unsupportedOp`), so "`share` reads no chunk file" moves to **3.2 (#874)**.
```

## Testing strategy — STRICT TDD, red before green, in this order

| # | file | red how | pins | command |
|---|---|---|---|---|
| 1 | `memory/chunk-boundary.test.mjs` (new) | write the allowlist with **two** rows (omit `cli.mjs`) → set inequality proves the walk sees the dynamic import (A4) | A3 set equality + scan self-check | `node --test brain/scripts/memory/chunk-boundary.test.mjs` |
| 2 | same file | add a temporary fixture `.mjs` importing the symbol → must fail; delete it | a new importer fails | ditto |
| 3 | same file | assert `readChunkObservations` absent (green on arrival — record it as a *regression* pin, not a red-first) | A5 | ditto |
| 4 | same file | assert `brain-audit.mjs:53`/`brain-check.mjs:28` import `readRecordObservations` and no chunk reader | #258 against silent regression | ditto |
| 5 | `backends/plainfiles.share.test.mjs` (extend) | assert the exact tree before writing the seed → red on the wrong expectation | A6 | `node --test brain/scripts/memory/backends/plainfiles.share.test.mjs` |
| 6 | `lib/migrate-v1.test.mjs` (extend) | `collectChunkObservations` keeps its `migrate-v1`/`--rollback` role | the allowlist is a contract | `node --test brain/scripts/memory/lib/migrate-v1.test.mjs` |
| 7 | full suite | — | nothing regressed | `npm test` |

Cases 3 and 4 are already true; they are stated as such in the PR body so a reviewer is not told a
green assertion was a red-first. Cases 1, 2 and 5 carry the TDD proof.

## Forecast and delivery

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**`.

| file | counted |
|---|---|
| `engram.mjs` header note naming the chunk seams + their ledger rows | **~12** |
| new + extended tests | 0 (excluded) — ~180 reviewer-visible |
| `openspec/**` (proposal, design, tasks, the epic line) | 0 (excluded) — ~250 reviewer-visible |

**Total counted ~12.** `Chained PRs recommended: No`. `400-line budget risk: Low`.
`Decision needed before apply: No`. One PR, `stacked-to-main`, closes #247.

## What apply must measure live (no Bash here)

1. `rg -n "collectChunkObservations" brain/ test/` — the importer set must be **exactly**
   `engram.mjs:48`, `cli.mjs:615`, `migrate-v1.test.mjs:13`. Any fourth row goes into the allowlist
   **with a `retiredBy` ticket**, never silently.
2. `plainfiles.share({root: tmp})` with real deps over a seeded temp store — capture the actual
   recursive `.memory/` listing before writing A6's expectation.
3. `npm test` baseline green **before** the first red test, so the red is attributable.
4. The chunk-path-literal set (`.memory/chunks` / `"chunks"`) across `brain/scripts/**` production
   `.mjs`, comments excluded — the input to Open Question 1.
5. Re-read every ledger anchor's line number immediately before the PR body is written; four already
   drifted from the proposal (rows 3 and 4).

## Risks

| risk | mitigation |
|---|---|
| A ~12-line PR reads as "#247 did nothing" | D0's reconciliation is the PR body's first section, the #247 comment, and the epic line — the deliverable is an enforced boundary plus a ledger, neither of which exists today |
| Allowlist drift — a retirement lands and the row survives as a dead exemption | A3's second direction: an allowlisted file that stops importing fails the guard. `check-refs.mjs` does not do this; the guard is deliberately stricter |
| The guard misses the dynamic import and passes for the wrong reason | A4; and step 1's red-first is *specifically* engineered to prove the walk saw `cli.mjs` |
| A direct `readdirSync('.memory/chunks')` reader is re-introduced | **Not covered** — named in A7, deferred to Open Question 1 |
| The temp-store test writes into the real repo if `root` defaulting is wrong | assert the tree under the `mkdtempSync` path only; `plainfiles.share` takes `root` explicitly (`:292`) |
| 3.2 rediscovers the #469 scrub re-proof late | ledger row 4 says "last, and only after"; it is the one row with an ordering constraint |

## Open questions

- [ ] **1 (A7)** — add a second allowlist over chunk **path literals**, closing the
      `_defaultChangedChunkFiles:566` hole? Costs 0 counted lines; needs measurement 4 first.
- [ ] **2** — is `cli.mjs:615`'s `migrate-v1` dry-run a *permanent* migration tool rather than a 2.4
      retirement? The allowlist annotation says 2.4; a "permanent" answer changes one string.
