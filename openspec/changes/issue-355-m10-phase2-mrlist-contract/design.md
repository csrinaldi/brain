---
status: draft
issue: 355
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-mrlist-contract/design
---

# Design: `mrList` Contract-Parity Coverage (M10 Phase 2, Rank 3)

Issue #355. Epic #335. Change folder: `openspec/changes/issue-355-m10-phase2-mrlist-contract/`.

## Technical Approach

`mrList` joins the existing parameterized loop in
`brain/scripts/vcs/providers/vcs.contract.test.mjs` — one assertion set, run over both entries of the
`PROVIDERS` table. Nothing new is invented: the block reuses `loadFixture`, `assertProvenance`, the
`{ data } | { throws, error }` fixture envelope, and the `afterEach(() => setSpawn(spawnSync))` reset
that already governs the file.

What *is* new is the transport. Every verb currently in the loop splits along a provider line —
GitHub spawns a CLI, GitLab fetches over HTTP — so the table carries `githubJsonCallArgs` for one and
`gitlabCallArgs` for the other. `mrList` is the first verb where that split does not exist:

| Provider | Call site | Transport |
|---|---|---|
| `github.mrList` | `github.mjs:215` | `runJson('gh', ['api', 'repos/…/pulls?state=…&per_page=100'])` |
| `gitlab.mrList` | `gitlab.mjs:293` | `runJson('glab', ['api', 'projects/…/merge_requests?state=…&per_page=50'])` |

Both import `runJson` from the shared `lib/exec.mjs`, so the single `setSpawn` seam
(`exec.mjs:11`) already drives both. `gitlabCallArgs` injects `fetchImpl`, a parameter
`gitlab.mrList` does not accept — registering it for this verb would silently pass an ignored option
and let the test spawn the *real* `glab`. The seam must be the spawn seam on both sides.

## Architecture Decisions

### D1 — One provider-neutral spawn glue: rename `githubJsonCallArgs` → `jsonSpawnCallArgs`

| Option | Tradeoff | Decision |
|---|---|---|
| Register `gitlabCallArgs` for `gitlab.mrList` | Zero diff to existing helpers, but injects a `fetchImpl` the verb ignores and leaves the real `glab` binary reachable from the suite — a live-spawn escape in a suite whose header promises "no live network or CLI spawn happens" | Rejected |
| Add a third helper `gitlabJsonCallArgs` that duplicates the body | Preserves the provider-prefixed naming, but two identical functions differing only in name is the exact drift the contract suite exists to prevent | Rejected |
| Rename `githubJsonCallArgs` → `jsonSpawnCallArgs`, register under **both** provider entries | The name states the seam (JSON-over-spawn) rather than the provider, which is what the function has always actually meant; mechanical rename covered by the four verbs already using it | **Chosen** |

**Rationale.** `githubJsonCallArgs` never contained anything GitHub-specific — it is
`setSpawn(throws ? failSpawn : jsonSpawn); return {}`. The `github` prefix was an accident of it
having had only GitHub callers. Naming it after the seam makes the `gitlab.mrList` registration
self-explanatory instead of surprising.

The rename touches four existing registrations (`labelEvents`, `prView`, `issueView` on GitHub, plus
`prReviews` once rank-2 lands) and the sibling `githubRawCallArgs` is deliberately **left alone** —
it is still GitHub-only (`mrCreate` reads bare stdout), and renaming it would be a change without a
reason.

Resulting table shape:

```js
const PROVIDERS = {
  github: { module: github, /* … */ mrList: jsonSpawnCallArgs },
  gitlab: { module: gitlab, /* … */ mrList: jsonSpawnCallArgs },
};
```

Note the asymmetry this makes visible and does not hide: for `mrList`, `PROVIDERS.gitlab.mrList` is
the *same function object* as `PROVIDERS.github.mrList`. That is the honest encoding of "both
providers share one transport for this verb", and it is why the rename is load-bearing rather than
cosmetic.

### D2 — Exact-key shape lock: per-entry `deepEqual` on sorted keys, plus a full-array `deepEqual`

| Option | Tradeoff | Decision |
|---|---|---|
| `assert.ok('headBranch' in entry)` per field | Matches the older `labelEvents` block, but passes on a widened normalizer that leaks `iid`/`source_branch` — the precise failure this verb is uncovered against | Rejected |
| Full-array `deepEqual` only | Catches everything in one assertion, but a failure reports a whole-array diff and the reader must eyeball which entry and which key moved | Rejected |
| Per-entry `deepEqual(Object.keys(entry).sort(), ['headBranch','number','title'])` **and** a full-array `deepEqual` | Two-layer: the per-entry lock names the defect ("entry 2 grew a key"), the array lock pins values and ordering. Mirrors rank-2's `{ state, author }` lock verbatim | **Chosen** |

**Rationale.** The per-entry key lock rejects both a **narrowed** normalizer (a dropped
`headBranch` — `review/board.mjs:71` and `review/queue.mjs:50` read it unguarded) and a **widened**
one (raw `iid` or `source_branch` leaking through, which is what `vcs-contract.md` line 29 promises
never happens). The `.sort()` makes the assertion insensitive to object literal key order, so a
harmless reordering in the normalizer does not produce a false RED.

The full-array `deepEqual` then pins values *and* element order in one assertion. Order matters:
callers index into the list, and neither provider sorts, so both surface the API's own ordering.

The empty case asserts `assert.deepEqual(result, [])` under `node:assert/strict`, which is
`deepStrictEqual` — so `null` and `undefined` both fail it. This is the assertion the spec calls out:
`board.mjs` and `queue.mjs` iterate the result without a guard, so `[]`-vs-`null` is a crash, not a
style question.

### D3 — Failure mode is `assert.rejects`: lock the divergence, document it, do not fix it here

| Option | Tradeoff | Decision |
|---|---|---|
| Assert `result === null`, matching the sibling read verbs | Encodes the convention the contract doc *implies*, but is RED against today's code — a failing test asserting a behavior nobody implemented is a broken suite, not a spec | Rejected |
| Change `mrList` to catch and return `null`, then assert `null` | Aligns the verb with its siblings, but touches production code on four call sites' behalf inside a test-only change, with no coverage of those call sites yet | Rejected — **this is the follow-up issue** |
| `assert.rejects` on both providers, labeled in-test as a documented divergence, with `vcs-contract.md` row 29 amended to say so | Locks real behavior, makes the divergence visible to the next reader, and leaves the fix to a change that can afford to touch production | **Chosen** |

**Rationale.** `runJson` throws on non-zero exit and on malformed JSON (`exec.mjs:31-32`), and
neither `mrList` wraps the call. So `mrList` throws where `prView`, `prReviews`, `labelEvents` and
`prStatusRollup` all return `null`-on-uncomputable and promise never to throw.

Verified mechanically, and worth stating because it is not obvious from the source: both `mrList`
functions are declared `async` while their bodies are fully **synchronous**. A synchronous throw
inside an `async` function becomes a **rejected promise**, not a synchronous throw at the call site.
So `assert.rejects(() => vcs.mrList({ … }))` is the correct assertion form on both providers —
the same form the `issueView` block already uses at `vcs.contract.test.mjs:243`.

The precedent for locking rather than fixing is `issueView`, whose in-file comment reads *"Unlike
`prView`, a fetch failure REJECTS (design A5) — `brain-start.mjs:65` already depends on that, so
this is PINNED, not fixed."* The `mrList` comment must say the opposite thing about intent: this is
pinned because changing it is out of scope, **not** because a caller depends on it. Wording that
distinction explicitly is what keeps the assertion from reading as endorsement.

The `vcs-contract.md` amendment carries the same load. Row 29 today says only
`` `({ project, state }) -> [{ number, title, headBranch }]` `` with a note on the `source_branch`
mapping — silent on failure, silent on pagination. Both go in.

## Fixture Strategy

Six fixtures, provenance stamped per the suite's existing `assertProvenance` (exactly one of
`recorded`/`derived`, plus `endpoint` and `date`).

| Fixture | Provenance | Why |
|---|---|---|
| `github-mrList-happy.json` | **recorded** | Live GitHub API is reachable; matches the `github-prView-happy.json` / `github-issueView-happy.json` discipline |
| `github-mrList-empty.json` | derived | A zero-PR repo cannot be reliably produced on demand against a live target |
| `github-mrList-failure.json` | derived | A forced non-zero exit cannot be recorded from a successful API call |
| `gitlab-mrList-{happy,empty,failure}.json` | derived | No live GitLab mirror is reachable from this environment — the standing constraint documented in `record-fixtures.mjs:27-34` |

**Recorder wiring.** `recordGithubMrList` hits
`gh api repos/<project>/pulls?state=open&per_page=100` — the exact call `github.mjs:215` makes — and
**projects the response down** to `{ number, title, head: { ref } }` per entry before writing, the
same jq-equivalent trimming `recordGithubLabelEvents` and `recordGithubIssueView` already do. An
untrimmed `pulls` response is tens of kilobytes per PR of unconsumed metadata; the fixture must stay
reviewable, and the trimming note goes in `_provenance.note` exactly as the siblings do.

**Recorder dispatch — a real signature mismatch.** `record-fixtures.mjs:142` calls
`CASES[verb](project, Number(number))`. Every existing case is a per-number read; `mrList` is a
per-**project** read with no number. `Number(undefined)` is `NaN`, so a naive registration would
"work" only by the callee ignoring a garbage second argument. The case is therefore declared
`recordGithubMrList(project)` — arity 1, second argument simply unused — and the usage string at
`record-fixtures.mjs:137` is updated to show `mrList` taking `<project>` with no trailing number.
No change to the dispatch line itself; a one-arg function receiving a `NaN` it never reads is
harmless, and rewriting the dispatcher for one case would be a larger blast radius than the problem.

**Failure-fixture shape.** The failure fixtures use the `{ throws: true, error }` envelope, which
`jsonSpawnCallArgs` turns into `failSpawn` → `{ status: 1 }` → `runJson`'s non-zero-exit throw.
This exercises **one** of `runJson`'s two throw paths; the malformed-JSON path (`exec.mjs:32`) is
not separately fixtured, since both produce the same observable — a rejected promise — and the
contract assertion is on the rejection, not on the message.

**A third throw path, deliberately not covered.** `github.mjs:216` reads `r.head.ref` unguarded, so
a well-formed response whose entries lack `head` throws a `TypeError` from inside the normalizer
rather than from the transport. GitLab's `r.source_branch` is a plain property read and returns
`undefined` instead — an outright divergence in normalizer robustness. This is out of scope
(asserting it would pin GitHub's crash as contractual) and belongs in the same follow-up issue as
the throw-vs-null question.

## File Changes

| File | Change |
|---|---|
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Rename `githubJsonCallArgs` → `jsonSpawnCallArgs` (4 existing registrations + declaration); add `mrList` to both `PROVIDERS` entries and to the loop destructuring; add the 3-test `mrList` block |
| `brain/scripts/vcs/fixtures/github-mrList-{happy,empty,failure}.json` | New |
| `brain/scripts/vcs/fixtures/gitlab-mrList-{happy,empty,failure}.json` | New |
| `brain/scripts/vcs/fixtures/record-fixtures.mjs` | Add `recordGithubMrList`; register in `CASES`; update header endpoint list and the usage string |
| `brain/core/methodology/vcs-contract.md` | Amend row 29 with failure-mode and pagination semantics |

Production files touched: **zero**. `github.mjs` and `gitlab.mjs` are read-only inputs to this change.

Estimated diff: ~110 lines of test code, ~35 lines of recorder, 6 small fixtures, 1 doc row.
Comfortably inside the 400-line review budget — no chained-PR split needed.

## Testing Strategy

Six scenarios, three per provider, all inside the existing `for (const providerName of
Object.keys(PROVIDERS))` loop so parity is structural rather than asserted twice:

1. **happy** — load fixture, `assertProvenance`, call, then per-entry
   `deepEqual(Object.keys(entry).sort(), ['headBranch','number','title'])` plus a full-array
   `deepEqual`. The happy fixtures carry **≥2 entries**, so the per-entry loop genuinely iterates —
   a single-entry fixture would let a normalizer bug that only manifests on the second element pass.
2. **empty** — `deepEqual(result, [])`, with the assertion message naming `board.mjs`/`queue.mjs`'s
   unguarded iteration as the reason `null` is unacceptable.
3. **failure** — `assert.rejects`, with the in-test comment recording the divergence per D3.

Verification is `npm test` on the full suite: the six new tests green, and zero regressions across
the existing ~1900. The rename is the regression risk to watch — it is mechanical, but it touches
four working registrations, and a missed one is a `TypeError: labelEventsArgs is not a function` at
suite load, not a subtle failure.

## Migration / Rollout

**Sequencing against rank-2 — verified, not assumed.** Current `HEAD` is `6d8fcfb`; the rank-2
`prReviews` commit `c2a67b0` is **not** an ancestor of it. Both changes edit the same `PROVIDERS`
literal and the same destructuring block, so branching this work before rank-2 lands guarantees a
conflict in exactly those two hunks. Additionally, `c2a67b0` registers `prReviews:
githubJsonCallArgs` under the old name — so the D1 rename must cover **five** registrations, not
four, once it merges.

Mitigation: base this change on `main` **after** rank-2 merges, and re-count the registrations at
that point rather than trusting this document's count.

Rollback is a single revert of the change commit. No production code path is touched, so revert
restores current behavior exactly.

## Open Questions

- **Follow-up issue scope.** Three findings are deferred: (a) `mrList` throws where its sibling read
  verbs return `null`; (b) neither provider paginates, truncating at 100 (GitHub) vs 50 (GitLab);
  (c) `github.mjs:216`'s unguarded `r.head.ref` crashes where GitLab yields `undefined`. Open as one
  issue covering all three, or split (b) out as its own — they share a root cause of "`mrList` was
  never held to the contract discipline" but have independent fixes.
- **Recorded happy fixture target.** Which repo/project to record `github-mrList-happy.json` from —
  it must have ≥2 open PRs at record time to satisfy the ≥2-entry requirement above, which makes the
  fixture's freshness dependent on a moving target. Recording from this repo is the obvious default;
  worth confirming before the recorder run.
