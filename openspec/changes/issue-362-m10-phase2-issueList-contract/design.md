---
status: draft
issue: 362
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-issueList-contract/design
---

# Design: `issueList` Contract-Parity Coverage (M10 Phase 2, Rank 4)

Issue #362. Epic #335. Change folder: `openspec/changes/issue-362-m10-phase2-issueList-contract/`.

## Technical Approach

`issueList` joins the existing parameterized loop in
`brain/scripts/vcs/providers/vcs.contract.test.mjs` — one assertion set, run over both entries of the
`PROVIDERS` table. It reuses `loadFixture`, `assertProvenance`, the `{ data } | { throws, error }`
fixture envelope, and the `afterEach(() => setSpawn(spawnSync))` reset that already governs the file.

Unlike every prior rank, **this verb needs no new transport glue at all**. Both providers spawn a CLI
through the shared `runJson`:

| Provider | Call site | Transport |
|---|---|---|
| `github.issueList` | `github.mjs:201-212` | `runJson('gh', ['api', 'repos/…/issues?state=…&per_page=100'])` |
| `gitlab.issueList` | `gitlab.mjs:280-289` | `runJson('glab', ['api', 'projects/…/issues?state=…&per_page=50'])` |

Rank-3 (`mrList`, merged at `5dd7d4c`) already generalized `githubJsonCallArgs` into the
provider-neutral `jsonSpawnCallArgs` (`vcs.contract.test.mjs:78-81`) for exactly this situation.
`issueList` is the second consumer of that seam and consumes it **verbatim** — no rename, no new
helper, no seam change. The rank-3 design's "re-count the registrations" risk does not apply here.

What *is* new is a **second transport call on one code path**. `issueList` accepts an `assignee`
parameter, and when it is `'me'` the verb first calls `await whoami()` (`github.mjs:203`,
`gitlab.mjs:282`), which issues its own `runJson(cmd, ['api', '/user'])`. The loop's glue mocks **one
uniform response for every spawn call** — the same limitation that pushed `prView`'s `baseRefOid`
coverage out of the loop and into the per-provider `BASE_REF_PROVIDERS` block at
`vcs.contract.test.mjs:388`. D1 resolves this.

## Architecture Decisions

### D1 — Reuse `jsonSpawnCallArgs` unchanged; keep the `assignee` path out of the contract loop

| Option | Tradeoff | Decision |
|---|---|---|
| Register `gitlabCallArgs` for `gitlab.issueList` | Injects a `fetchImpl` the verb does not accept (it spawns `glab`, it does not call `gitlabApiFetch`), leaving the real `glab` binary reachable from a suite whose header promises "no live network or CLI spawn happens" | Rejected |
| Parameterize `assignee: 'me'` inside the loop using a call-aware spawn stub that dispatches on `args[1] === '/user'` | Technically achievable — `BASE_REF_PROVIDERS` proves the file tolerates multi-call stubs — but `assignee` changes only the **query string**, never the normalized shape. That is URL-building, which `providers.test.mjs` owns, and `assigneeParams` is already unit-tested at `cli.test.mjs:110-116`. Putting it in the contract suite asserts a non-contract concern and buys nothing the shape lock does not already cover | Rejected |
| Register `jsonSpawnCallArgs` under **both** provider entries and call with `{ project, state: 'open' }` only | Zero new glue, single transport call per test, and the assertion surface stays exactly the contract's `{ number, title, labels }` promise | **Chosen** |

**Rationale.** The contract suite exists to pin *normalized shapes*, not request construction. Every
`assignee` value produces the identical result shape from the identical response payload; the only
thing that varies is the endpoint string, and that is already covered twice over
(`normalize.mjs:62-72` unit-tested at `cli.test.mjs:110-116`).

Resulting table shape — note that, as with `mrList`, `PROVIDERS.gitlab.issueList` is the *same
function object* as `PROVIDERS.github.issueList`. That is the honest encoding of "both providers
share one transport for this verb", not a copy-paste slip:

```js
const PROVIDERS = {
  github: { module: github, /* … */ mrList: jsonSpawnCallArgs, issueList: jsonSpawnCallArgs },
  gitlab: { module: gitlab, /* … */ mrList: jsonSpawnCallArgs, issueList: jsonSpawnCallArgs },
};
```

**The trap this decision must document in-file.** Excluding `assignee` is not merely a scope call —
including it would produce a **green test that passes for the wrong reason**, which is worse than no
test. Traced mechanically under the uniform-response stub with `assignee: 'me'`:

1. `whoami()` calls `runJson(cmd, ['api', '/user'])` and receives the **issues array** back.
2. `resp.login` (GitHub) / `resp.username` (GitLab) is therefore `undefined`.
3. `assigneeParams('github', 'me', undefined)` yields `{ assignee: '@me' }` via its `?? '@me'`
   fallback — plausible-looking garbage.
4. `assigneeParams('gitlab', 'me', undefined)` yields `{ assignee_username: undefined }`. `toQs`
   (`github.mjs:14-18`) filters `undefined` values out, but `Object.keys(assigneePs).length > 0` is
   still true, so `extra` becomes `'&' + ''` — the endpoint acquires a **trailing `&`**.
5. The second `runJson` returns the same array again and normalizes cleanly.

The test goes green while a broken `whoami` round-trip and a malformed query string sail past. A
comment stating this must sit at the `issueList` block so the next author does not "improve" coverage
by adding the parameter.

### D2 — Three-layer shape lock in the loop; the GitHub-only `pull_request` filter pinned outside it

| Option | Tradeoff | Decision |
|---|---|---|
| `assert.ok('labels' in entry)` per field | Matches the older `labelEvents` block, but passes on a widened normalizer leaking raw `iid`/`state`/`assignees` | Rejected |
| Full-array `deepEqual` only | Catches everything, including the filter and the label unwrap, but only *implicitly*: a failure reports "arrays differ" without naming which invariant broke, and a reader cannot see that the PR filter is under test at all | Rejected |
| Per-entry exact-key `deepEqual` + per-label `typeof === 'string'` + full-array `deepEqual`, all in the loop; plus one GitHub-only test **outside** the loop pinning the `pull_request` filter arithmetically | Each layer names its own defect; the parity-symmetric assertions stay in the parity loop and the genuinely asymmetric one stays out of it | **Chosen** |

**Rationale — why the split falls where it does.** The spec calls for two GitHub-specific
normalization guarantees. They are not equally asymmetric, and treating them the same would be wrong:

- **Label unwrapping is a parity assertion.** `for (const l of entry.labels) assert.equal(typeof l,
  'string')` must hold on *both* providers. GitHub reaches it by unwrapping label objects
  (`github.mjs:211`, `.map(l => l.name)`); GitLab reaches it natively (`gitlab.mjs:288`, already a
  flat string array). Same assertion, two mechanisms, one convergent contract — this is precisely
  what the parameterized loop is for, and it belongs **inside** it.
- **The `pull_request` filter has no GitLab counterpart at all.** GitLab's
  `projects/:id/issues` returns only issues; there is nothing to filter. An
  `if (providerName === 'github')` branch inside a parity loop is the asymmetry the loop exists to
  prevent, so this goes **outside** the loop, following the file's own precedent for
  provider-asymmetric concerns (`BASE_REF_PROVIDERS` at `:388`, and the `prStatusRollup` block).

**Why the filter test is arithmetic, not a spot-check.** The spec requires the PR entries be proven
*filtered out, not merely ignored by coincidence of the fixture's contents*. Asserting
`result.length === 2` against a fixture the reader must count by hand satisfies nothing. The test
instead derives both sides from the fixture itself:

```js
const prCount = fixture.data.filter(r => r.pull_request).length;
assert.ok(prCount >= 1, 'the recorded fixture must contain at least one PR entry — otherwise this test is vacuous');
assert.equal(result.length, fixture.data.length - prCount);
for (const entry of result) {
  const source = fixture.data.find(r => r.number === entry.number);
  assert.ok(!source.pull_request, 'no PR-carrying source entry may survive the filter');
}
```

The `prCount >= 1` guard is the load-bearing line: it makes the test **fail loudly if the fixture is
ever re-recorded from a repo with no open PRs**, rather than silently degrading into a tautology.
This is the one assertion in the change that guards the *fixture*, not the code.

**Full-array lock.** Expected values are hardcoded from the fixture's known content, **not**
re-derived from `fixture.data` through the same `number`/`iid`/`labels` mapping the normalizer
performs — re-deriving would let a normalizer bug that this test mirrors pass undetected. Same
discipline as rank-3's `mrList` expected array (`vcs.contract.test.mjs:305-315`). Order is pinned
because neither provider sorts, so both surface the API's own ordering, and `project-status.mjs:118`
prints in that order.

**Empty case.** `assert.deepEqual(result, [])` under `node:assert/strict` (i.e. `deepStrictEqual`),
so `null` and `undefined` both fail. See D3 for the precise caller consequence — it is *not* the one
the spec asserts.

### D3 — `assert.rejects` on failure, pinned — but for the **opposite reason** rank-3 pinned `mrList`

| Option | Tradeoff | Decision |
|---|---|---|
| Assert `result === null`, matching `prView`/`labelEvents` | RED against today's code; a failing test asserting unimplemented behavior is a broken suite, not a spec | Rejected |
| Change `issueList` to catch and return `null`, then assert `null` | Touches production code inside a test-only change **and is affirmatively harmful here** — see rationale | Rejected |
| `assert.rejects` on both providers, labeled in-test as a caller-absorbed divergence, with `vcs-contract.md` row 28 amended | Locks real behavior and records *why* the divergence is defensible for this verb specifically | **Chosen** |

**Rationale.** `runJson` throws on non-zero exit and on malformed JSON (`exec.mjs:31-32`), and
neither `issueList` wraps the call. So `issueList` throws where `prView`, `prReviews`, `labelEvents`
and `prStatusRollup` return `null`-on-uncomputable.

Rank-3's `mrList` comment reads: *pinned because changing it is out of scope, **not** because a caller
depends on the throw.* **For `issueList` that sentence is false, and copying it would be a
documentation defect.** Verified at both call sites:

- `tracker-board.mjs:44-47` — `safeList` wraps `issueList` in `try/catch` and returns `[]`. This is
  the null-on-uncomputable convention implemented **at the caller** instead of at the provider.
- `project-status.mjs:115-130` — a single `try/catch` wraps the `issueList` call, the `mrList` call,
  and all the printing; a failure prints `ps.vcs.error` with the message's first line.

Every `issueList` call site already absorbs the throw. Converting the provider to return `null` would
make `safeList`'s catch dead code and, worse, would **downgrade `project-status.mjs`'s explicit error
message into a silent "0 open issues"** — a transport failure rendered as good news. So the throw is
pinned here because it is *contained and load-bearing*, and the follow-up issue should weigh
documenting the divergence over eliminating it.

Both `issueList` functions are declared `async` with fully **synchronous** bodies on the no-assignee
path, so a synchronous `runJson` throw surfaces as a **rejected promise**, not a synchronous throw at
the call site. `assert.rejects(() => vcs.issueList({ … }))` is therefore the correct form on both
providers — same as the `issueView` block at `:250-259` and the `mrList` block at `:327-336`.

**The `[]`-vs-`null` requirement, stated precisely.** The spec's justification — *"`tracker-board.mjs`
and `project-status.mjs` iterate the result unguarded"* — is imprecise, and the assertion message
must not repeat it. Traced:

| Caller | Behavior on a `null` return |
|---|---|
| `tracker-board.mjs:58` | `safeList` catches **throws**, not `null` **returns**. `null` flows through to `myIssues.length` → uncaught `TypeError` at ESM top level → non-zero exit. **A real crash.** |
| `project-status.mjs:117` | `issues.length` on `null` → `TypeError` caught at `:128` → degrades to the generic error message. Wrong output, not a crash. |

So the `[]` guarantee is load-bearing at **exactly one** call site. The assertion message names
`tracker-board.mjs:58` specifically — a message that names both files vaguely would send a future
debugger to the wrong place.

## Fixture Strategy

Six fixtures, provenance stamped per the suite's existing `assertProvenance` (exactly one of
`recorded`/`derived`, plus `endpoint` and `date`).

| Fixture | Provenance | Why |
|---|---|---|
| `github-issueList-happy.json` | **recorded** | Live GitHub API is reachable; matches the `github-mrList-happy.json` / `github-issueView-happy.json` discipline. **Required** by the spec — the `pull_request` filter must be exercised against a real payload shape, not a hand-simulated one |
| `github-issueList-empty.json` | derived | A zero-open-issue repo cannot be reliably produced on demand against a live target |
| `github-issueList-failure.json` | derived | A forced non-zero exit cannot be recorded from a successful API call |
| `gitlab-issueList-{happy,empty,failure}.json` | derived | No live GitLab mirror is reachable from this environment — the standing constraint at `record-fixtures.mjs:29-36` |

**Recorded-fixture content requirements.** `github-issueList-happy.json` must simultaneously satisfy
three things, or one of the tests above goes vacuous:

1. **≥1 entry carrying `pull_request`** — otherwise D2's `prCount >= 1` guard fails (by design).
2. **≥2 entries *without* `pull_request`** — so the per-entry assertion loop genuinely iterates; a
   single surviving entry would let a bug that only manifests on the second element pass.
3. **≥1 surviving entry with a non-empty `labels` array** — otherwise the label-unwrap assertion
   never executes a single iteration.

**Recorder wiring — and a trimming rule the prior recorders do not have.** `recordGithubIssueList`
hits `gh api repos/<project>/issues?state=open&per_page=100`, the exact call `github.mjs:206-207`
makes, and projects the response down before writing, as
`recordGithubLabelEvents`/`recordGithubIssueView`/`recordGithubMrList` all do.

The projection is **not** "the fields that appear in the output". `pull_request` never appears in
`issueList`'s result, yet `github.mjs:210` *reads* it — it is filter input. Trimming it away would
produce a fixture in which every entry survives the filter, silently destroying the very coverage
this fixture exists to provide. The rule is therefore **"fields the normalizer reads"**, not "fields
the normalizer maps":

```js
arr.map(r => ({
  number: r.number,
  title: r.title,
  labels: (r.labels ?? []).map(l => ({ name: l.name })),
  ...(r.pull_request ? { pull_request: { url: r.pull_request.url } } : {}),
}))
```

`labels` is recorded as `[{ name }]` objects, **not** flattened to strings — flattening at record
time would pre-apply the normalizer's own unwrap and make the D2 label assertion vacuous. The
`_provenance.note` states both rules explicitly, matching the sibling recorders' note discipline.

**Recorder dispatch.** `record-fixtures.mjs:168-177` destructures `[provider, verb, project, number]`
and calls `CASES[verb](project, Number(number))`. `issueList` is a per-**project** read with no
number, exactly like `mrList` — so it is declared `recordGithubIssueList(project)` (arity 1, the
`NaN` second argument simply unread), reusing the precedent set at `record-fixtures.mjs:142`. The
usage string at `:171-173` groups `issueList` into the existing no-number line alongside `mrList`,
and the header endpoint list at `:17-20` gains a row. **No change to the dispatch line itself.**

**GitLab happy-fixture shape.** `iid`-keyed, `labels` already a flat string array (no per-label
object unwrapping — that asymmetry is the whole point of D2's split), ≥2 entries, and **no
`pull_request` field on any entry** — GitLab's `projects/:id/issues` returns only issues, which is
itself the reason the filter is GitHub-only. Hand-authored from the documented GitLab REST API v4
issues-list shape.

**Failure-fixture shape.** Both use the `{ throws: true, error }` envelope, which
`jsonSpawnCallArgs` turns into `failSpawn` → `{ status: 1 }` → `runJson`'s non-zero-exit throw. This
exercises **one** of `runJson`'s two throw paths; the malformed-JSON path (`exec.mjs:32`) is not
separately fixtured, since both produce the same observable — a rejected promise — and the contract
assertion is on the rejection, not the message.

**Robustness paths deliberately not covered.** Unlike `mrList` (whose `r.head.ref` at
`github.mjs:216` crashes on a `head`-less entry), `issueList` guards its only nested read with
`(r.labels ?? [])` on **both** providers. There is no unguarded-normalizer divergence to pin here —
a genuine difference from rank-3, and the reason this change has one fewer deferred finding.

## File Changes

| File | Change |
|---|---|
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Add `issueList: jsonSpawnCallArgs` to both `PROVIDERS` entries and to the loop destructuring (`:120-127`); add the 3-test `issueList` block inside the loop; add 1 GitHub-only filter test outside it |
| `brain/scripts/vcs/fixtures/github-issueList-{happy,empty,failure}.json` | New |
| `brain/scripts/vcs/fixtures/gitlab-issueList-{happy,empty,failure}.json` | New |
| `brain/scripts/vcs/fixtures/record-fixtures.mjs` | Add `recordGithubIssueList` (arity 1); register in `CASES`; update header endpoint list and usage string |
| `brain/core/methodology/vcs-contract.md` | Amend row 28 with failure-mode, pagination, and the two GitHub-only normalization steps |

Production files touched: **zero**. `github.mjs` and `gitlab.mjs` are read-only inputs.

Estimated diff: ~95 lines of in-loop test code, ~20 lines for the filter test, ~35 lines of recorder,
6 small fixtures, 1 doc row. Comfortably inside the 400-line review budget — no chained-PR split
needed.

## Testing Strategy

Seven scenarios: six inside the parity loop (three per provider), one GitHub-only outside it.

1. **happy** (both providers) — load fixture, `assertProvenance`, call with `{ project, state:
   'open' }`, then per-entry `deepEqual(Object.keys(entry).sort(), ['labels', 'number', 'title'])`,
   per-label `typeof === 'string'`, and a full-array `deepEqual` against hardcoded expected values.
   Asserts `result.length >= 2` first, so a fixture that lost entries fails loudly rather than
   passing a zero-iteration loop.
2. **empty** (both providers) — `deepEqual(result, [])`, message naming `tracker-board.mjs:58`'s
   uncaught top-level `TypeError` per D3.
3. **failure** (both providers) — `assert.rejects`, with the in-test comment recording that the
   divergence is *caller-absorbed* (`tracker-board.mjs:44-47`, `project-status.mjs:115-130`) — the
   opposite framing from `mrList`'s at `:275-282`.
4. **GitHub `pull_request` filter** (outside the loop) — the arithmetic assertion from D2, including
   the `prCount >= 1` fixture guard.

The `issueList` block also carries the D1 comment documenting why `assignee` is absent and what would
silently go green if it were added.

**Existing coverage this supersedes but does not delete.** `providers.test.mjs:136-151` already holds
two isolated per-provider `issueList` tests driven by hand-built `fakeSpawn` payloads. They stay —
they assert per-provider mechanics against inline data, which is that file's remit; the new suite
asserts cross-provider parity against provenance-tracked fixtures. Deleting them is not in scope, but
the change should note the overlap so a future reader does not mistake it for duplication.

Verification is `npm test` on the full suite: the seven new tests green, zero regressions across the
existing ~1900. The regression surface is small — no rename, no helper change, two added table keys.

## Migration / Rollout

**Branch point — verified, and it inverts what rank-3 predicted.** Current `HEAD` is `5dd7d4c`
(*"feat(m10-phase2): mrList contract-parity test suite (rank 3) (#359)"*) on `main`. So:

- **rank-3 (`mrList`, #359) is merged.** `jsonSpawnCallArgs` is present at
  `vcs.contract.test.mjs:78-81` and registered for both providers at `:102` and `:115`. This change
  therefore needs **no rename and no seam work** — the whole D1 burden of rank-3 is already paid.
- **rank-2 (`prReviews`, #317) is NOT merged.** Commit `c2a67b0` exists only on
  `feature/m10-seam-contract-coverage` and is not an ancestor of `HEAD`; no `*-prReviews-*.json`
  fixture and no `prReviews` block exists in the tree today. Ranks landed out of order.

Consequence to plan for: rank-2 edits the same `PROVIDERS` literal and the same destructuring block
(`:120-127`) that this change edits. Branching rank-4 off `main` now guarantees a conflict in exactly
those two hunks whenever rank-2 lands — a two-line mechanical conflict in each, but it will happen.
Additionally, `c2a67b0` registers `prReviews: githubJsonCallArgs` under the **pre-rank-3 name**, so
rank-2's own rebase onto `main` must rename it to `jsonSpawnCallArgs` independently of this change.

Note also that the spec describes the pattern as *"following the existing
`labelEvents`/`prReviews`/`issueView`/`mrList` pattern"* — the `prReviews` half of that reference is
**aspirational at the current HEAD**. Implementation should follow `mrList` (`:275-336`), the closest
merged sibling, and not go looking for a `prReviews` block that is not there.

Rollback is a single revert of the change commit. No production code path is touched, so revert
restores current behavior exactly.

## Open Questions

- **Recorded happy-fixture target.** Which repo to record `github-issueList-happy.json` from. It must
  satisfy all three content requirements above *at record time* (≥1 open PR, ≥2 open issues, ≥1
  labeled issue), which makes the fixture's validity dependent on a moving target. This repo is the
  obvious default and currently qualifies. The `prCount >= 1` guard converts a future bad re-record
  into a test failure rather than silent coverage loss — worth confirming that trade is acceptable
  before the recorder run.
- **Follow-up issue scope.** Two findings are deferred: (a) neither provider paginates, truncating at
  100 (GitHub) vs 50 (GitLab) — the same defect rank-3 logged for `mrList`, so it should join that
  issue rather than open a new one; (b) `tracker-board.mjs:38` resolves `currentUser` via
  `vcs.whoami()` and then calls `safeList({ assignee: 'me' })`, which calls `whoami()` **again**
  internally (`github.mjs:203`) — a redundant round-trip per board render, invisible to this
  change's coverage because D1 excludes the `assignee` path.
- **Divergence disposition.** D3 argues `issueList`'s throw is defensible (contained at both call
  sites, and converting it to `null` would mask a transport failure as "0 open issues" in
  `project-status.mjs`). That conflicts with the direction rank-3 implied for `mrList`. Whether the
  never-throws convention should be narrowed in `vcs-contract.md` to exclude list verbs — rather than
  each list verb being documented as an exception — is a contract-level question this change flags
  but does not settle.
