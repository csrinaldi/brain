---
status: design
issue: 443
epic: 313
artifact_store: openspec
topic_key: sdd/issue-443-tranche-tier-budget/design
---

# Design — the tranche diff budget follows the tier (issue #443)

## D1 — thread through the existing tier resolution, do not add a second one

`gatherTrancheInputs` already does `resolveTier(deps.readConfig ?? loadBrainConfig)` to
derive `requiredJobs`/`detectionJobs`, and already returns `tier` in its result object.
The budget rides that same resolution:

```js
const { required: requiredJobs, detection: detectionJobs } = resolveJobSets(tier);
const { diffBudget } = tierParams(tier);
return { requiredGates, changedFiles, budget, prBody, requiredJobs, detectionJobs, diffBudget, tier };
```

Both call sites (`cli.mjs:215`, `checkpoint.mjs:176`) pass the gathered object straight
into `evaluateTranche`, so a new key propagates with no edit at either — the seam was
designed for exactly this and it should be used as designed.

The rejected alternative was reading the config inside `evaluateTranche`. That function
is the pure core (the file's opening comment states it: *"a pure `evaluateTranche(inputs)`
core + `gatherTrancheInputs(deps)`"*); giving it I/O to satisfy a one-line fix would
cost the property that makes every one of its 12 unit tests cheap.

## D2 — the default is `tierParams('standard').diffBudget`, and that is not laziness

`evaluateTranche`'s `requiredJobs`/`detectionJobs` already default to the stale
`'standard'`-tier snapshot for callers that skip the gather seam, with a comment saying
so. The budget adopting the *same* tier for its *own* default is what keeps those
defaults coherent: a caller that skips the seam gets one consistent tier's doctrine,
not a `standard` job set judged against a `lite` budget.

Deriving it (`tierParams('standard').diffBudget`) rather than writing `400` is the point
of REQ-443-3 — if the doctrine table ever re-tiers `standard`, this default moves with
it instead of silently becoming a fourth opinion.

## D3 — evidence carries the arithmetic; `cites` carries the source

Today's finding:

```js
evidence: `git diff --numstat ${base}...${head} | diff-size-count.mjs = ${budget.lines}`,
cites: 'governance.yml diff-size gate (400-line budget)',
```

The `cites` line is doubly wrong after this change: `governance.yml` is no longer where
the number lives (it shells out to `governance-tiers.mjs diff-budget`), and the number
in the parenthetical is only correct at one tier. Protocol §10 requires findings to be
self-evidencing, so the comparison and the tier move into `evidence` while `cites`
names the resolving function — mirroring the gate finding two blocks above, which
already reads `governance-tiers.mjs requiredJobs(tier)`.

`evaluateTranche` does not currently receive the tier NAME (only the job sets). It is
added as an optional input alongside `diffBudget` purely for this evidence string, and
degrades to omitting the `(tier: …)` suffix when absent — a pure-core function must not
require a field its oldest callers never pass.

## D4 — `honorSizeException` is deliberately NOT wired here

`TIER_PARAMS` also carries `honorSizeException` (true at lite/standard, false at
regulated), and it is tempting to pull it in while touching the budget. The tranche
evaluator reads no labels at all — `changedFiles`, `prBody` and the rollup are its
entire input surface. Honoring the waiver would mean adding a labels input, a waiver
branch and its own test matrix: a behaviour change wearing a bug fix's clothes.

The governance `diff-size` gate is where the waiver is evaluated, and it already tiers
correctly. If the reviewer should mirror the waiver, that is a separate ticket with its
own red-first evidence.

## D5 — restoring #409's finding source is part of THIS change, not a follow-up

The harness README says, at the `redJob` parameter: *"The original plan — a diff-budget
breach — is blocked on #443… When #443 lands, restore `diffLines`-driven breaches and
retire this parameter's default."* That instruction is a debt this change is the payer
for.

Mechanically: the fixture's default becomes `redJob: null` with all gates green, and
`diffLines` (default 250) carries the finding at `regulated`. The `lite` control then
needs attention — 250 lines is *under* lite's 1000 budget, so the `/1` control case
would post a finding-free verdict. That is fine for what REQ-409-4 asserts (it asserts
the protocol string, not findings) but it must be checked rather than assumed, and if
any `lite` case needs a finding it takes `redJob` explicitly. The e2e is the place this
gets verified, by running it.

## D6 — red-proof plan (the standing rule: watch the protection fail)

Five tiers of red, in order:

1. `regulated` + 250 lines, current code → APPROVE, no budget finding. This is the
   ticket's reproduction; it must be observed before the fix.
2. `lite` + 500 lines, current code → budget finding present. The false positive.
3. `standard` + 401 lines, before and after → identical **decision** (fires / `id` /
   `severity` / `conclusion`). The `evidence` and `cites` strings DO change at
   `standard` too, by REQ-443-4's design — an earlier draft of this step said
   "identical finding object", which was false in two of four fields and was caught by
   the cold review of PR #471. The no-op is about the verdict, not the prose.
4. After the fix, mutate `tierParams(tier).diffBudget` back to a literal `400` in
   `gatherTrancheInputs` → cases 1 and 2 go red again. Verify the mutation took effect
   (the #409 lesson: a mutation that lands in a JSDoc comment is inert and proves
   nothing).
5. The #409 e2e at `regulated` with `redJob: null` → the budget finding is what carries
   the `/2` assertions, across the real process boundary.
