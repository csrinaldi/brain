# Design: lane branch reconciliation (#936, absorbs #930)

## Technical Approach

Three layers, bottom-up. Each one is testable without the next:
1. **#930 port widening.** `mrList` items gain `state` and `merged`, and the verb gains an optional `headBranch` filter.
2. **The shared `contentDelivery()` helper.** Same-day reparent in `collectLane` step 8 uses it.
3. **The sweep module.** The ship op calls it after today's ship. It re-ships prior-day refs through `shipLane` with an injected no-collect seam.

The #920 R8 ruling is reversed inside `shipLane`, so today's branch and prior-day branches share a single closed-PR rule.

## Architecture Decisions

| # | Decision | Rejected | Rationale |
|---|---|---|---|
| D1 | **mrList shape.** `{number,title,headBranch,state,merged}`, where `state ∈ 'open'\|'closed'\|null` and `merged ∈ boolean\|null` (null together). GitHub (`github.mjs:457-460`): `state=r.state`, `merged = r.merged_at !== undefined ? r.merged_at !== null : null`. GitLab (`gitlab.mjs:621-625`): `opened→open/false`, `closed→closed/false`, `merged→closed/true`, and anything else (for example `locked`) maps to `null/null`. | A third `'merged'` state value | Matches spec.md:22-35. A merged PR is closed on both forges, and GitHub's native enum has no `merged`. |
| D2 | **Closed listing and the page limit.** Add an optional `headBranch` filter. GitHub uses `pulls?state=all&head=<owner>:<branch>&per_page=100`, with `owner = project.split('/')[0]` and a URL-encoded value. GitLab uses `merge_requests?state=all&source_branch=<enc>&per_page=100`. When `headBranch` is set and the page comes back full (100), the provider **throws** (fail closed). Unfiltered calls keep today's query byte-for-byte. | Paginate `state=closed` over the whole repo; bound it to N pages | `state=closed` means different things per provider: GitHub includes merged PRs and GitLab excludes them (`normalize.mjs:48-51`). A repo-wide scan is unbounded. Filtering by head bounds the result by construction. Other consumers (board, queue, stranded) see no change. |
| D3 | **Helper location.** New `brain/scripts/memory/lane/delivery.mjs`. It imports nothing from `lane/`. `collect.mjs` and `ship.mjs` both import it. | Putting it inside `collect.mjs` or `ship.mjs` | A leaf module avoids the ship→collect→ship cycle and keeps `collect.mjs` IO-only. |
| D4 | **Closed-PR rule (reverses R8).** Keep only the items whose `headBranch` matches. If any item is open, reuse it. Otherwise the **highest-numbered** item decides: `closed && merged===false` means `closedUnmerged` (no push, no create, report it); `merged===true` or an empty list means create. A null field or a throw means `prLookupFailed` (fail closed). The lookup moves **before the push** (`ship.mjs:363-384`). | Keeping the lookup after the push | A push onto a human-closed PR's branch is a re-ship, which the proposal forbids. "Newest wins" handles the pre-#936 [closed, merged] histories that R8 created. |
| D5 | **Sweep scope.** Today's ref is excluded. Today's ship covers it: reparent makes a delivered tip harmless, and tomorrow's sweep deletes it. | Deleting today's delivered ref in the sweep | That would race today's collect for no user-visible gain. Spec alignment point, see Open Questions. |
| D6 | **Order.** Today's `shipLane` runs first, unchanged. The sweep runs only after today's ship succeeds, and only when not `--dry-run`. | Running the sweep first | Keeps today's latency and exit semantics. A failing today-branch becomes a prior-day ref tomorrow and is swept then. |
| D7 | **Remote-only refs.** Fetch the ref into `refs/remotes/origin/<b>`, classify it, and report `remoteOnly` with its delivery status. Nothing is mutated. | Materializing a local ref and re-shipping it | Deleting a remote branch is Tier 2 (AGENTS.md:149). A remote-only ref comes from another clone or a manual delete, so report-only is the safe choice. |

## Interfaces / Contracts

```js
// lane/delivery.mjs — argv byte-identical to today's surveyDelivery (ship.mjs:99-119)
export function contentDelivery({ git, root, rev, baseFetched })
  // -> { status: 'delivered'|'pending'|'unknown', reason: null|'baseStale'|'diffFailed' }
// ship.mjs surveyDelivery becomes: map delivered→true, pending→false, unknown→null (same reason).
```

"Tip's own tree", as spec.md:50 states it, is implemented as the paths the lane adds since `merge-base(origin/main, rev)`, which is the three-dot diff. A whole-tree check would read a record scrubbed from `main` as pending forever.

`collectLane` return gains `reparented: boolean`. `shipLane` outcome gains `closedUnmerged: boolean` (false by default) and `reparented`. `cli.mjs --json` gains `sweep: null | { remoteListed: boolean, branches: [{ branch, date, where: 'local'|'remote'|'both', action, delivered, pr, reason }] }` with `action ∈ deleted|shipped|reconciled|closedUnmerged|unknown|diverged|failed|remoteOnly`.

## Reparent (collect.mjs step 8, :276-282)

```
existingTip = rev-parse ref            // CAS <old>, unchanged
if existingTip:
  d = contentDelivery({rev: existingTip, baseFetched})
  plan.parent = d.status==='delivered' ? originMainTip : existingTip
  reparented  = d.status==='delivered'
update-ref ref <new> <existingTip>     // :339, same CAS, same raced mapping
```

`pending` and `unknown` keep appending, as they do today. `collected` stays correct because the planner already skips X as `already-on-main` (plan.mjs:117-121), so the diff-tree against M's tree (:324-328) yields only Y. When nothing is new, the ref is left untouched (:305-311). If a stale remote branch survives, `surveyRef` computes `behind>0` and ship throws `diverged` (ship.mjs:357-361). It never force-pushes.

## Sweep (new `lane/sweep.mjs`)

`sweepLanes({ root, project, tier, host, today, git, vcs, ship = shipLane })`:
1. `fetch origin main` once, giving `baseFetched`.
2. List local refs with `for-each-ref --format=%(refname) refs/heads/memory/`. List remote refs with `ls-remote --heads origin 'refs/heads/memory/*'`. If `ls-remote` fails, set `remoteListed:false` and continue.
3. Filter each ref with `^memory/(.+)-(\d{4}-\d{2}-\d{2})$` and keep it only when group 1 `=== slugifyHost(host)`. `slugifyHost` is newly exported from plan.mjs:60. This exact match stops a `gandalf` host from claiming `gandalf-rog-…`. Suffixed names are ignored, and `LANE_BRANCH_RE` stays unchanged. Skip `date === today`.
4. Walk the refs in ascending date order. Each branch runs under its own try/catch, and errors map to rows:

| Classification | Action |
|---|---|
| `contentDelivery` returns `unknown` | `unknown` (keep the ref) |
| `delivered` | `update-ref -d <ref> <observedSha>` (CAS), then `deleted` |
| `pending` | `ship({..., date, collect: noCollect(ref, baseFetched)})`. The outcome maps to `shipped`, `reconciled` or `closedUnmerged`. `diverged`, `prLookupFailed` and other failures map to `diverged`, `unknown` or `failed`. |

`noCollect` returns `{ref, commit:null, collected:0, skipped:[], duplicates: emptyDuplicates(), baseFetched, skippedWorktrees:[]}`. Because `collectLane` is never called, today's records **cannot** enter a prior-day ref. Every git call receives `cwd: root`, which is `BRAIN_MEMORY_TEST_ROOT` under test.

```
cli ship ──► shipLane(today) ──► [ok] ──► sweepLanes ──► per ref:
                                            delivery ─► delete | ship(noCollect) | report
          ◄── JSON {...today, invoker, sweep} ◄─────────────┘
day-start-sweep: laneSweepLine (unchanged) + laneSweepBranchLines(outcome.sweep)
```

The `#1012` guard is untouched. The sweep runs inside the already-authorized `ship` op, and no new entrypoint or invoker is added.

**i18n** (`brain/scripts/i18n/{en,es}.mjs`; the proposal's `memory/i18n` path is wrong): `day.memory.laneSweep.branch.{deleted,shipped,reconciled,closedUnmerged,unknown,diverged,failed,remoteOnly}` and `memory.ship.sweep.{same}` (stderr, non-json), plus `memory.ship.closedUnmerged`. The `closedUnmerged`, `unknown`, `diverged`, `failed` and `remoteOnly` rows print as `warn`.

## File Changes

| File | Action |
|---|---|
| `brain/scripts/vcs/providers/{github,gitlab}.mjs` | Modify (D1, D2) |
| `brain/scripts/vcs/fixtures/{github,gitlab}-mrList-happy.json` | Modify: add state/merged_at |
| `brain/scripts/vcs/fixtures/{github,gitlab}-mrList-all.json` | Create: open, merged and closed items, `derived` provenance |
| `brain/scripts/memory/__fixtures__/fake-vcs-port.mjs` | Modify: honor `state`/`headBranch` args |
| `brain/scripts/memory/lane/delivery.mjs` | Create |
| `brain/scripts/memory/lane/{collect,ship,plan}.mjs` | Modify |
| `brain/scripts/memory/lane/sweep.mjs` | Create |
| `brain/scripts/memory/{cli,day-start-sweep}.mjs`, `brain/scripts/day-start.mjs` | Modify |
| `brain/scripts/i18n/{en,es}.mjs` | Modify |
| `openspec/changes/issue-936-…/brain-drafts/vcs-contract-mrlist-row.md` | Create: Tier 2 draft of the `vcs-contract.md:29` row. `brain/core` is Tier 3. |

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Unit | `contentDelivery` returns delivered, pending, and unknown (both `baseStale` and `diffFailed`). It is argv-identical to surveyDelivery. | Fake git in the `ship.test.mjs` style. `surveyOkRules` stays green without edits. |
| Unit | D4 matrix: open, newest closed-unmerged, newest merged, empty, null field, throw, foreign headBranch. The push must not happen when the PR is closedUnmerged. | Update the `ship.test.mjs` fakes: items gain `state`/`merged`. |
| Unit | Sweep filters: slug collision, suffix, today skip, other host. Row mapping. Every git call has `cwd === root`. | New `sweep.test.mjs`, git spy, no real repo. |
| Contract | Five-key shape, the `all` fixture, and a full page with `headBranch` rejects. | `vcs.contract.test.mjs`, `providers.test.mjs` (argv contains `head=`/`source_branch=`). |
| Integration | **Red first:** the #1050 repro. Ship X, squash with plumbing on the bare origin (`commit-tree` + `update-ref main`, `update-ref -d` on the branch), add Y, ship. Expect `parent === origin/main`, and the three-dot diff and title list only Y. Also partial delivery and `baseFetched:false` append. | `collect.integration`, `ship.integration` (`recordingVcs` gains state). |
| Integration | One test per sweep row, plus remote-only and prior-day-never-absorbs-today, plus a check that the remote sha is unchanged on `diverged`. | New `sweep.integration.test.mjs` on `testTmp` bare origins. No live CLI spawn, and never the real `.git` (#1024). |
| Unit | `laneSweepBranchLines` keys exist in both catalogs. | `day-start-sweep.test.mjs` |

## Review Workload Forecast

This excludes tests, `.memory/**` and `openspec/**`. Estimates: providers ~40, fixtures ~50, fake port ~15, delivery ~70, collect ~25, ship ~90, plan ~2, sweep ~190, cli ~45, day-start(+sweep) ~60, i18n ~60. **Total ≈ 650 lines.**

- Size: within the tier-lite budget of 1000, so no `size:exception` is needed.
- 400-line budget risk: Medium.
- Chained PRs recommended: No. The optional split is slice 1 = D1-D4 plus reparent (~300) and slice 2 = the sweep (~350).
- Decision needed before apply: No.

## Migration / Rollout

No migration is required. Existing stranded refs are swept on the first run after merge. Pre-#936 [closed, fresh] PR histories are resolved by D4's newest-wins rule.

## Invariants

- No `--force` anywhere; ship.mjs:365 argv is unchanged.
- `LANE_BRANCH_RE` (`governance/checks/lane.mjs:15`), `lane-paths`, `lane-scrub` and `memory-gate` are untouched.
- No write under `brain/core/**` or `brain/project/**`. The two drafts live in `brain-drafts/`.

## Open Questions

- Resolved 2026-09-19: spec.md was amended to match D4 (open PR wins, else highest-numbered) and D5 (today's ref goes through today's ship path).
- A human-closed branch stays reported until an operator deletes the local ref. The report text should say so.
