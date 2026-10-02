# Tasks: a same-day lane re-ship after a squash merge (#1190)

Strict TDD. Every code item is RED (write the failing test, run it, see it fail for the stated reason), then GREEN (the smallest implementation), then a green run of the file. Paths are under `brain/scripts/memory/` unless stated otherwise. Spawn hygiene: every spawn in a test carries a `timeout`; no test passes `input` (#1221).

## Review Workload Forecast

- Estimated changed lines, excluding tests and `openspec/`: about 100 (`ship.mjs` +75, `cli.mjs` +6, catalogs +6, KNOWN-LIMITATIONS -10, plus roughly 3 for the design note).
- Test lines (excluded from the lite budget by `governance.ignoreList`): about 450.
- Lite budget: 1000. 400-line budget risk: Low.
- Chained PRs recommended: No
- Decision needed before apply: No. Delivery strategy is `ask-on-risk` and nothing crosses the thresholds.
- Single work-unit commit order follows the phases below.

## Phase 0: spec and design corrections (no code)

- [x] 0.1 Correct `spec.md` "Newest PR" term to the real `decidePr` rule: an open PR wins; otherwise the highest-numbered PR. Update REQ-1 and the Terms line to match. (Ruling 1)
- [x] 0.2 Correct spec scenario 4.1: `closedUnmerged` is an outcome that exits 0, not an error. Reword "refuses with the existing `closedUnmerged` error" to "returns the existing `closedUnmerged` outcome, exit 0, no push". (Ruling 1)
- [x] 0.3 Record D5 in `design.md` "Decisions": the cross-day sweep calls `shipLane`, inherits the replace path, and that is accepted because both keys are still required, so nothing unmerged is ever replaced. Tick the matching Open questions (D5, newest-PR wording, 4.1 wording, stderr capture). (Ruling 2)

## Phase 1: `decidePr` basis field (spec REQ-1, REQ-4)

- [x] 1.1 RED `lane/ship.test.mjs`: `decidePr` returns `{action:'create', basis:'none'}` for an empty list, `basis:'merged'` with `number` for a newest PR `merged === true`, `basis:'other'` for any other computable create. Fails: no `basis` field.
- [x] 1.2 GREEN `lane/ship.mjs` (`decidePr`, around `:210,226`): add `basis`. Existing `decidePr` tests stay green.

## Phase 2: `surveyRef` returns `remoteTip` (REQ-1)

- [x] 2.1 RED `lane/ship.test.mjs`: `surveyRef` returns `remoteTip` equal to the sha of `origin/<branch>` after a successful fetch, and `remoteTip: null` on the missing-remote, fetch-failed and other early returns. Fails: property absent.
- [x] 2.2 GREEN `lane/ship.mjs` (`:54-74`): `git rev-parse --verify --quiet refs/remotes/origin/<branch>` after the fetch; `null` on the other three returns.

## Phase 3: the two-key replace path (REQ-1, REQ-2, REQ-3, REQ-4)

- [x] 3.1 RED (REQ-1.1, 1.2): `#1190 replace: both keys hold` asserts exactly one push with argv `['push','--no-verify','--force-with-lease=<ref>:<observed remoteTip>','origin','<ref>:<ref>']`, no bare `--force`, no leading `+`, a new PR created, `mrAutoMerge` armed, `replaced: {from, mergedPr}` set. Fails: the ship throws `diverged`.
- [x] 3.2 RED (REQ-2.1): remote delivered and no PR, then newest PR open: each throws `diverged`, one `mrList`, zero pushes.
- [x] 3.3 RED (REQ-2.2): newest PR merged but remote tip `pending`: `diverged`, zero port calls. A second case with `baseFetched:false` (remote `unknown`): `diverged`, zero port calls.
- [x] 3.4 RED (REQ-4.1): `behind>0`, remote delivered, closed-unmerged: returns the `closedUnmerged` outcome (non-throwing), no push.
- [x] 3.5 RED (D3): `behind:null` with a stale remote: no lease argv, the non-ff backstop yields `diverged`; `ahead:0` or `remoteTip:null`: `diverged`.
- [x] 3.6 RED (tighten `:403`): on every non-replace path, no argv element starts with `--force`. Keep `:425` ("behind > 0 ... zero port calls") and `:450` unchanged.
- [x] 3.7 GREEN `lane/ship.mjs` (`:399` block): inside `behind>0`, check `ahead>0 && remoteTip!==null`, then `contentDelivery({git, root, rev: remoteTip, baseFetched})` (the sha, not the ref name), then `decidePr`. Branch on `closedUnmerged` / `create`+`basis:'merged'` (set `replace`, fall through) / else `diverged`. Reuse the decision at `:415` via `decision ??=`. Diverged messages keep `${ref}` and carry the D2 suffixes. Build the lease argv in a template literal. Add `replaced: null` to `base`.
- [x] 3.8 Run `lane/ship.test.mjs`: all green, including `:403`, `:425`, `:450`.

## Phase 4: failure classification on the real stderr (REQ-5, ruling 3)

- [x] 4.1 MEASURE first: in `lane/ship.integration.test.mjs`, build a bare remote with `git config receive.denyNonFastForwards true`, put a lane branch at a pre-squash tip, run a real `git push --force-with-lease=<ref>:<sha> origin <ref>:<ref>` from a divergent local, and capture the real stderr. Keep the captured text as a fixture constant in the test (with a comment naming the git version). Do not guess a string.
- [x] 4.2 RED `lane/ship.test.mjs`: pure `classifyReplaceFailure(stderr)` pinned on (a) the real text from 4.1 expected to be `replaceRefused`, (b) a real stale-lease stderr `(stale info)` expected to be `leaseStale` (capture it the same way from a moved remote), (c) an unrelated stderr expected to be `pushFailed`. Order is stale, then refused, then other. If the real text does not match the pattern table in D3, adjust the pattern, not the fixture. Fails: function not exported.
- [x] 4.3 RED (REQ-5.1, 5.2, fake spawn): `[remote rejected] ... (protected branch hook declined)` gives `replaceRefused`, exactly one push, no delete argv. `(stale info)` gives `leaseStale` and `diverged`, exactly one push, no retry, no delete.
- [x] 4.4 GREEN `lane/ship.mjs`: export `classifyReplaceFailure`; on the replace path throw the tagged errors with the `memory.ship.leaseStale` / `memory.ship.replaceRefused` messages; leave `:429` verbatim on the ordinary path. No retry, no delete.
- [x] 4.5 RED `lane/sweep.test.mjs`: a `leaseStale` error maps to a `diverged` row; a `replaceRefused` error maps to a `failed` row with the message as the reason. GREEN only if the existing mapping at `lane/sweep.mjs:156` does not already satisfy it (otherwise the test is a pin and passes at once; record that in the commit).
- [x] 4.6 RED `lane/sweep.test.mjs` (ruling 2): the sweep's replace still requires both keys. A prior-day `pending` ref whose remote tip is content-delivered but whose newest PR is `merged:false` stays `diverged`, and one whose PR is merged but whose content is not delivered stays `diverged`; neither pushes. A both-keys case may replace. Prove through `shipLane` as `sweep.mjs:151` calls it.

## Phase 5: CLI mapping and catalogs (REQ-5, REQ-7)

- [x] 5.1 RED `cli.ship.test.mjs`: in the local `git()` helper add `timeout: 30_000`; in `runCli` add `timeout: 60_000` and `stdio: ['ignore','pipe','pipe']`. Add `#1190: a refused forced update exits 1 with memory.ship.replaceRefused's en text, origin unchanged` (use `hostname()` and today as at `:84`; origin has `receive.denyNonFastForwards=true`). Fails: the CLI maps the error to `diverged`.
- [x] 5.2 RED `cli.ship.test.mjs`: `#1190: a same-day re-ship after a squash exits 0 and prints memory.ship.replaced` on stderr.
- [x] 5.3 RED catalog parity: a test (or the existing en/es parity test) fails until `memory.ship.leaseStale`, `memory.ship.replaceRefused` and `memory.ship.replaced` exist in both `i18n/en.mjs` and `i18n/es.mjs`.
- [x] 5.4 GREEN `cli.mjs` (`:678-684`): insert `err?.leaseStale ? "leaseStale" : err?.replaceRefused ? "replaceRefused"` before `diverged`; print `memory.ship.replaced` as a stderr evidence line next to `:639` when `replaced` is set. Add the three catalog texts from design D3 to `i18n/en.mjs` (after `:463`) and `i18n/es.mjs` (after `:424`), artifact language English for en, existing Spanish for es.
- [x] 5.5 Run `cli.ship.test.mjs` and the i18n tests: all green. Confirm `test-spawn-hygiene.test.mjs` still passes with no new allowlist entry.

## Phase 6: real-git integration (REQ-1, 2, 3, 5, 7)

- [x] 6.1 In `lane/ship.integration.test.mjs` add `timeout: 30_000` to the local `git()` helper (`:26`).
- [x] 6.2 RED (REQ-7.2, 1.1): `#1190: squash with the branch surviving, PR merged` leaves the remote branch in place after the simulated squash, sets `prs[0].state='closed'` and `prs[0].merged=true` via `recordingVcs().prs`, then ships again. Expects a lease replace, a new PR, remote equal to the second commit, and no delete issued. Keep the existing `#1050` test at `:263` (the variant that deletes) and correct its comment at `:276-278`.
- [x] 6.3 RED (REQ-2.1): surviving branch, PR still open: `diverged`, remote sha unchanged.
- [x] 6.4 RED (REQ-3.1): extra unmerged commit on the remote, PR merged: `diverged`, remote sha unchanged, `mrList` count unchanged. The existing `:126` racing-writer test stays unchanged and green.
- [x] 6.5 RED (REQ-5.2): lease race. A git wrapper moves origin just before the lease push: `leaseStale`, the racer's sha survives, one push.
- [x] 6.6 RED (REQ-5.1, ruling 3): origin with `receive.denyNonFastForwards=true`: `replaceRefused`, remote sha unchanged, one push. Also assert the real stderr from this run is classified `replaceRefused` by `classifyReplaceFailure` (the same fixture text as task 4.1).
- [x] 6.7 GREEN: no new implementation expected beyond Phases 1-5; fix any gap the real git exposes in `lane/ship.mjs` only, with a unit test added first for each fix. Run the integration file: green.

## Phase 7: docs and the ADR amendment draft (REQ-8, ruling 4, ruling 5)

- [x] 7.1 RED then GREEN `docs/KNOWN-LIMITATIONS.md`: assert (`rg '1190' docs/KNOWN-LIMITATIONS.md` returns nothing; if a docs test exists, extend it first) and remove the #1190 entry (around `:71`), keeping the rest of the file intact. Check `CHANGELOG.md` `Known follow-ups` mentions of #1190: they are historical, leave them unchanged and note that in the commit body.
- [x] 7.2 Write `brain-drafts/adr-0034-amendment-5.md` as a `brain-amendment/1` draft following the design outline: `target: brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md`, `amendment: 5`, `issue: 1190`; amend-find `never a force-push` (design cites `:84`) with an annotating amend-replace; sections What changed, Why, What it does NOT close (remote force-push rule still refuses loudly, branch never deleted, sweep exposure D5, merged key trusts `mrList` with no head sha), Tier 3 reasoning (product acts, own lane branch, proof of delivery and merge, lease). Also include the status-line and `brain/HOME.md` cascade fields the contract requires.
- [x] 7.3 Validate with `planAmendment({draftText, targetText, homeText, gitUserName, today})` from `brain/scripts/lib/amendment-draft.mjs`, run from a throwaway script in the scratchpad (not committed). Each find anchor must occur exactly once in the target (`countOccurrences === 1`); the plan must return no errors. Fix the anchors, not the target. Do not apply the plan: the human signs and promotes (`brain:promote`).

## Phase 8: final checks (ruling 6)

- [x] 8.1 Full `npm test`: green.
- [x] 8.2 `npm run brain:repo:check`: green.
- [x] 8.3 Diff-size check against the lite budget of 1000, tests excluded (`governance.ignoreList` drops `*.test.mjs`, `.memory`, `openspec/changes`): expected about 100. Report the measured figure.
- [x] 8.4 Confirm every success criterion in `proposal.md` has a test or a verified file change; list the mapping in the apply-progress artifact.

## Order and parallelism

Sequential: Phase 0, then 1, 2, 3, 4, 5, 6 (each depends on the previous code), then 8. Phase 7 (docs and the amendment draft) can run in parallel with Phases 5 and 6 once Phase 3 is done; Phase 8 runs last.
