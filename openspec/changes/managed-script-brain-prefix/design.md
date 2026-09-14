# Design: memory scripts move to the `brain:memory:*` namespace (#961)

Base re-verified on this worktree (2026-09-14). Rulings R1–R10 (engram `sdd/managed-script-brain-prefix/ruling`, obs #3485) are inputs, not options. This is longer than the usual 800-word design limit because the orchestrator asked for the anchored file:line list, the guard's exact assertions, and the draft anchors. Tables carry most of it.

## Technical Approach

The rename is a table-driven, anchored substitution, never a sweep, and it happens in three sequenced steps (R1):

```
 (1) Tier-1 PR (agent)            (2) Promotion PR (maintainer)         (3) #954 (maintainer)
 package.json +11 brain:memory:*  brain:promote 7 core drafts ─┐        MANAGED_SCRIPT_KEYS: 7 bare
 scripts/i18n/docs/specs renamed  brain:promote 5 ADR drafts  ─┼─► AGENTS.md    → brain:memory:*
 pin test + hazard guard          hand-edit 2 .mjs comments (R8)  regenerated  regex ^brain:[a-z]
 bare aliases stay (R4)           Closes #961                                  tripwire green
 Closes #<sub>, Refs #961
        │  doctrine still says `npm run memory:*` → the aliases keep it runnable
        └────────────────────────────────────────────────────────────────────►
```

At every point doctrine and catalog agree. Between (1) and (2), doctrine and `AGENTS.md` cite bare names, and those names are real alias scripts. #954 is not on `main` yet, so no tripwire runs.

## Rename map (R3)

| old (repo-only alias, kept) | new | managed after #954 |
|---|---|---|
| `memory:save` | `brain:memory:save` | yes |
| `memory:index` | `brain:memory:index` | yes |
| `memory:share` | `brain:memory:share` | yes |
| `memory:pull` | `brain:memory:pull` | yes |
| `memory:resolve-index` | `brain:memory:resolve-index` | yes |
| `memory:audit` | `brain:memory:audit` | yes |
| `memory:ship` | `brain:memory:ship` | yes |
| `memory:reindex` | `brain:memory:reindex` | no (repo-only) |
| `memory:split-records` | `brain:memory:split-records` | no (repo-only) |
| `memory:collect` | `brain:memory:collect` | no (repo-only) |
| `memory:migrate-v1` | `brain:memory:migrate-v1` | no (repo-only) |

**The substitution rule (R7):** a match needs `(?<![\w:-])memory:(NAME)(?![\w-])` with NAME taken from this table. Every site is listed below. The rule only double-checks a listed site; it never finds new ones.

## Architecture Decisions

| # | Decision | Rejected | Rationale |
|---|---|---|---|
| D1 | `package.json` keeps lines 65-75 **byte-unchanged** and inserts the eleven `brain:memory:*` keys right after `:76` (`brain:memory:session-end`), each with the same command string as its alias | turning the existing lines into renames plus re-added aliases | This is +11 lines instead of +33, and the alias lines never move. |
| D2 | The pinning test compares each key against a **literal** expected string (`node ./brain/scripts/memory/cli.mjs <verb>`), not only key against alias | `scripts[a] === scripts[b]` alone | If both entries are wrong the same way, an equality check still passes. A literal is an independent source. |
| D3 | The hazard guard is a test file with its scanner inside, plus temp-dir fixture tests | a production `lib/` module | Test files are on the ignore list, so the guard adds 0 counted lines, and no runtime caller needs it. |
| D4 | The guard has **four** assertions. R7's third one ("no `npm run memory:*`") is split into a `run` context (A3) and a bare token (A4) that never overlap | only R7's three | This goes beyond R7 without contradicting it. Without A4, a revert of a comment or catalog string would go unnoticed, and no mutation could prove it. Because A3 and A4 never overlap, every revert kills exactly one assertion. |
| D5 | Signed text is not rewritten: `brain/HOME.md:53` (the ADR-0002 Amendment 2 marker), `memory-backend-contract.md:154` (inside its signed Amendment 1), ADR bodies (R6) | renaming them in place | They were true when signed. The same "history" reasoning as R5. |
| D6 | `docs/inbox/**` is unchanged | renaming the 5 refs | It is a capture zone (#327). #922's tripwire excludes it too. The dated handoffs are history. |
| D7 | Prose that names the verb as a feature ("secret scanner for `memory:share`", the `audit.mjs:144` report title, the `methodology-map` timeline `:1026`) **is renamed** | leaving "concept" prose alone | Same reason as R8: text that keeps the dead name stops showing up when someone searches for the new one. And A4 needs no allowlist. |
| D8 | **ADR drafts carry the contract, body and rename table, but NO `amend-find` pair.** See the ruling gap below. | inventing an inline marker | An inline marker would contradict R6 ("no inline markers"). |

### RULING GAP (not a deviation, but it blocks promoting the five ADRs)

`parseAmendmentDraft` refuses an ADR draft with zero edits (`brain/scripts/lib/amendment-draft.mjs:171-177`, implementing §1c act 2, `consolidation-protocol.md:36-38`). R6 says ADR bodies stay untouched. So **`brain:promote` cannot apply an ADR amendment the way R6 describes it.** The drafts are written to R6 exactly, so the verb refuses them loudly and never writes a partial result. The maintainer picks one of two ways at step (2):

- **A:** allow one §1c annotation per ADR. The anchor and replacement are ready in each draft as a `text` block; changing the tags to `amend-find`/`amend-replace` makes it promotable.
- **B:** do acts 1, 3 and 4 by hand from the draft, keeping R6 exactly. That leaves the verb path, and §1c warns: "Off that path, you are still the enforcement".

The Tier-1 PR does not depend on this choice.

## Anchored rename procedure (R7): Tier-1 PR

All sites were re-verified today. The line numbers are at base `29b2702d`.

| Category | file:line |
|---|---|
| package.json | insert 11 keys after `:76` (D1) |
| scripts, entry | `brain-to-engram.mjs:6`; `brain-save.mjs:5,33,43`; `brain-metrics.mjs:314,340`; `bootstrap.sh:312,313,334` (`$PM run --silent memory:pull` actually runs) |
| hooks | `hooks/pre-push:6,10,115`; `hooks/post-merge:57` |
| harness / vcs | `harness/backends/plain.mjs:18`; `vcs/contributor-scaffold.mjs:276` |
| memory | `memory/cli.mjs:8`; `staged-records-check.mjs:15`; `index-lag.mjs:45,107`; `lane/plan.mjs:112`; `backends/engram.mjs:14,802,827,1471,1537`; `lib/backend-selection.mjs:13,19`; `lib/store.mjs:101`; `lib/upstream-records.mjs:300`; `lib/duplicates.mjs:13,35,189`; `lib/format.mjs:227`; `lib/migrate-v1.mjs:215`; `lib/secret-scrub.mjs:1,3`; `lib/audit-io.mjs:1,22`; `lib/audit.mjs:1,144`; `lib/resolve-index.mjs:6`; `__fixtures__/env.mjs:12` |
| i18n (R9) | `en.mjs:76,103,201,203,294,334,409,452,470`; `es.mjs:67,93,185,187,267,303,364,403,421`. Keys stay the same, only values change. Parity is untouched, so `coverage.test.mjs:96-104` stays green. `:288,290` update in the same commit. |
| docs | `docs/workflow-guide.md:86`; `docs/methodology-map/index.html:825,863,867,1026` |
| root / forge | `README.md:193,194`; `.github/PULL_REQUEST_TEMPLATE.md:135`; `.gitlab/merge_request_templates/Default.md:135` (**the exploration missed it**); `.gitignore:82` (**the exploration missed it**) |
| living specs | `openspec/specs/governance/spec.md:687,691,695,701,831`; `feature-working-memory/spec.md:53,58,64,169,177,184,185`; `governance-v3/spec.md:988,1014,1020,1027` |
| tests | 82 occurrences in 28 `*.test.mjs` files. `sdd-tasks` lists them file by file. |

**Never touched:** `adr-0002…:31,86` and `adr-0034…:136,143` (they already read `brain:memory:ship`); `.github/workflows/governance.yml:133` (`memory:index-lag`, a different script); `.memory/records/**`; `openspec/changes/archive/**`; every other `openspec/changes/**` folder, including their `brain-drafts/`; `CHANGELOG.md:523-532`; `AGENTS.md` (compiled output); `brain/HOME.md`; `docs/inbox/**`; `brain/core/**` and `brain/project/**` (drafts only). Two names look close but are out of scope: `memory:import` is not a script, and `session:start` is another alias family.

**Rename-blind tests, which must be tightened:** `plainfiles.save-index-failure.test.mjs:216-217` (`/memory:reindex/`) and `harness/backends/plain.test.mjs:36` (`/memory:share/`) still match the substring inside `brain:memory:*`. They become `/npm run brain:memory:reindex/`, `/Do NOT run brain:memory:save again/` and `/npm run brain:memory:share/`, so reverting the production string kills them.

## Interfaces / Contracts

**Pinning test:** `brain/scripts/memory/package-scripts.test.mjs`

```js
const VERBS = ['save','index','share','pull','resolve-index','audit','ship','reindex','split-records','collect','migrate-v1'];
const skip = existsSync(join(ROOT, '.brain-source')) ? false : 'memory scripts are not managed until #922';
for (const v of VERBS) test(`brain:memory:${v} and its alias run cli.mjs ${v} (#961 R4)`, { skip }, () => {
  const want = `node ./brain/scripts/memory/cli.mjs ${v}`;
  assert.equal(pkg.scripts[`brain:memory:${v}`], want);
  assert.equal(pkg.scripts[`memory:${v}`], want);
  assert.ok(!MANAGED_SCRIPT_KEYS.includes(`memory:${v}`), 'a bare alias is never managed');
});
```

**Hazard guard:** `brain/scripts/lib/memory-script-prefix.test.mjs`. It holds a pure `scan(files: {path,text}[])` that returns findings per assertion. The fixture tests build trees with `testTmp()`. One test reads the real tree **read-only** (no git, no writes, gated on `.brain-source`), the same way `session-start-config.test.mjs` reads `package.json`.

- **Tier-1 set (T1):**
  - `package.json`, where only the **values** of `scripts` are scanned (the keys are R4's aliases);
  - `brain/scripts/**` except `**/*.test.mjs`;
  - `docs/**` except `docs/inbox/**`;
  - `README.md`, `.gitignore`, `.github/**`, `.gitlab/**`, `.claude/**`, `.gemini/**`;
  - `openspec/specs/**`;
  - `test/**` except `*.test.mjs`.
- **Hazard set (H):** T1 plus `brain/core/**`, `brain/project/**`, `brain/HOME.md`, `AGENTS.md` and `CHANGELOG.md`. It excludes `openspec/changes/**`, since this change's own artifacts name the hazard.

| # | Assertion | Scope | Mutation that proves it (kills only this one) |
|---|---|---|---|
| A1 | no `brain:brain:` | H | fixture: `README.md` gets `` `brain:brain:memory:ship` `` |
| A2 | `governance.yml` holds `- name: memory:index-lag (` exactly once, and `brain:memory:index-lag` appears 0 times | the file / H | fixture: rewrite that line to `brain:memory:index-lag` |
| A3 | no `/\brun\s+(?:--silent\s+)?memory:(NAMES)(?![\w-])/` | T1 | fixture: `README.md` `npm run brain:memory:share` → `npm run memory:share` |
| A4 | no bare `(?<![\w:-])memory:(NAMES)(?![\w-])` that is not in an A3 context | T1 | fixture: a comment `` `brain:memory:share` `` → `` `memory:share` `` |

Each fixture tree starts clean for the other three assertions: it has a correct `governance.yml`, no bare tokens and no double prefix. The real-tree test is RED before the rename and GREEN after it.

## Doctrine drafts (R6, R8)

The drafts live in `brain-drafts/`: 7 core `.draft.md` files (31 edits, each a minimal unique substring whose `find` is not contained in its `replace`, so `k=0`), 5 ADR `.draft.md` files, and `README.md` (promotion order, the ruling gap, R8 checklist, collision table). The count is **7** core `.md` files, not the 8 the proposal says. The eighth core file is `config-migrations.mjs`, which is R8.

**Promotion order:**
1. `agent-authorities` → `harness-contract`. These are `SOURCE_DOCS`, so each regenerates `AGENTS.md`.
2. `consolidation-protocol`, `memory-backend-contract`, `memory-format`, `feature-working-memory-contract`, `anti-patterns/README`.
3. ADR-0002 (Amendment 3), ADR-0011 (1), ADR-0014 (1), ADR-0017 (3), ADR-0034 (1). Each one touches `brain/HOME.md`, which regenerates `AGENTS.md`.
4. The R8 hand edits. Commit after each promotion.

**R8 checklist:**
- `brain/core/config-migrations.mjs:69`: `'fail-closed memory:share secret scanner` → `'fail-closed brain:memory:share secret scanner`. Nothing pins this string; the only other copy is in `explore.md`.
- `brain/project/check-refs-rules.mjs:81`: `memory:share and would re-export into the` → `brain:memory:share and would re-export into the`. Re-align the comment column.

**Collisions:** 11 draft files in 7 unarchived folders name these scripts.

| Draft | State | If someone re-runs it after this change |
|---|---|---|
| 863 `agent-authorities.draft`, `harness-contract.draft` | promoted, then superseded | f=0, r=0 → blocked, refuses |
| 863 `memory-backend-contract.md` (new-file draft) | promoted | refuses: destination exists (`brain-promote.mjs:850-854`) |
| 330 `memory-format-index-merge.md` | promoted (diff-shaped, no contract) | not promotable by the verb |
| 677 `adr-0017-amendment-2`, 635 `adr-0017-amendment-1` | promoted | refuses: Status stands at 3 |
| 677 `memory-format.draft`, 635 `memory-format-churn.draft` | promoted | their replacements no longer occur → blocked |
| 701 `memory-format.note.draft.md` + `README.md` | **not promoted**; to be pasted by hand | **would bring back bare `memory:share` prose** (no `npm run`, so the tripwire stays silent). The drafts README records: rename it when pasting. |
| 405 `anti-pattern-mutation-blind-by-axis.md` | promoted (it carries a STOP banner) | the `npm run memory:index` line is draft metadata, not body |

None of their anchors overlap the new drafts' anchors. R5 forbids editing them.

## #954 after step (2) (R2)

1. `brain/core/managed-paths.mjs:57-63`: the seven `'memory:X'` entries become `'brain:memory:X'`.
2. `brain/scripts/lib/managed-paths.test.mjs:148,152-153`: the title says "namespaced brain:", the regex goes back to `/^brain:[a-z]/`, and the message says `"brain:"`. On the #954 branch this is commit `db9635b7`.
3. The tripwire's extraction is **unchanged**. It still matches `memory:*` filtered by real scripts, and because R4 keeps the aliases real, a bare name that comes back into doctrine turns it red.
4. `issue-922…/brain-drafts/managed-script-keys.draft.md` text: an optional sync.

## Testing Strategy (STRICT TDD)

Commands always use `GIT_CONFIG_GLOBAL=/dev/null node --test <file>`. The baseline is measured first on `origin/main` under that same isolation: pass/fail/skip counts for `"brain/scripts/**/*.test.mjs"`. This phase could not run a shell; `sdd-apply` records the baseline before its first change.

| Order | RED | GREEN | Mutation |
|---|---|---|---|
| 1 | pinning test (keys absent) | `package.json` +11 | edit `brain:memory:save`'s value → only the pinning test fails |
| 2 | guard fixture tests A1-A4 | scanner in the test | as in the guard table |
| 3 | guard real-tree test (A3/A4 red) | per-category renames, each with its tightened test first | revert any single site → A3 or A4 fails, never both |
| 4 | updated i18n expectations (`coverage:288,290`, `duplicates.i18n:64-65`) | catalogs | revert `en.mjs:201` → coverage test and A4 fail. Pinned strings are the one case where two layers fail; this is accepted and stated. |

## Line budget (Tier-1 PR, against 400)

| Surface | Counted |
|---|---|
| package.json | +11 |
| brain/scripts production (60 lines) | ~120 |
| docs, README, templates, .gitignore (10 lines) | ~20 |
| CHANGELOG entry | ~12 |
| **Total** | **~163 (Low risk)** |

Not counted (ignore list): tests, `openspec/**`, `AGENTS.md`, `.memory/**`.

## CHANGELOG entry

The file has no `Unreleased` precedent, so the entry is a new top section that the release renames:

> ## Unreleased — memory scripts join the `brain:` namespace (#961)
> **No manual step.** The eleven `memory:*` scripts are now `brain:memory:*` (`save`, `index`, `share`, `pull`, `resolve-index`, `audit`, `ship`, `reindex`, `split-records`, `collect`, `migrate-v1`), like `brain:memory:session-end`. brain's own `package.json` keeps the bare names as identical aliases, so commands in history and records still run. Consumers never had these scripts. The managed seven arrive with #922 under their `brain:memory:*` names only.

## Failure modes

| Failure | Caught by |
|---|---|
| double prefix `brain:brain:` | A1 |
| `memory:index-lag` corrupted | A2 |
| a bare `run memory:X` left in T1 | A3 |
| a bare comment or catalog string left | A4 |
| an alias drifts from its canonical key, or becomes managed | pinning test |
| #954 merged before step (2) | R1; #954 stays a draft. If merged anyway, the tripwire goes red on the doctrine's bare `npm run`. |
| a promoted anchor drifted | `assessEdit` refuses (`free ≠ 1`) |
| ADR drafts refused by the verb | ruling gap, option A or B |
| #701's note pasted with a bare name | drafts README; not machine-caught |
| aliases removed some day | the tripwire would miss bare doctrine names. Named in the drafts README; the pinning test would fail first. |

## Migration / Rollout

No consumer migration. Rollback is as in the proposal.

## Open Questions

- [ ] **Ruling gap (blocks the ADR half of step 2):** option A (one §1c annotation per ADR) or option B (hand-applied acts 1, 3, 4)?
