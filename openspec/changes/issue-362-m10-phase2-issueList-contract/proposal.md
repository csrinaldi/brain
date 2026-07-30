---
status: proposed
issue: 362
epic: 335
artifact_store: hybrid
topic_key: sdd/m10-phase2-issueList-contract/proposal
---

# Proposal: `issueList` Contract-Parity Coverage (M10 Phase 2, Rank 4)

Issue #362. Epic #335 (M10 — seam contract coverage), under epic #313. Change folder:
`openspec/changes/issue-362-m10-phase2-issueList-contract/`.

> **⚠️ Retroactive reconstruction — read this before treating it as a PRD.**
>
> This file was written **after** the change shipped, in issue #371, to satisfy `sdd-layout.md`'s
> required-artifact contract. The change dir landed on `main` via **PR #363** carrying `design.md`,
> `tasks.md`, and `specs/issueList-contract/spec.md`, but **no `proposal.md`** — which left `main`
> failing its own `repo:check` gate and blocked every branch cut from it, plus every local commit
> and push in the repository (both the pre-commit and pre-push hooks run `repo:check`).
>
> It is reconstructed faithfully from this dir's own `design.md`, `specs/issueList-contract/spec.md`,
> `tasks.md`, and the merged PR. It is **not** a proposal that preceded and authorized the work, and
> it does not claim to be. Nothing here is a new decision: every choice below was already taken and
> recorded in `design.md` D1/D2. Where this file and `design.md` disagree, **`design.md` wins** — it
> is the contemporaneous artifact.
>
> Written by an agent working outside the M10 lane, at the maintainer's explicit request, after
> first retracting an unsolicited attempt at the same fix. See #371 for that record.

## Intent

`issueList` is the fan-out verb behind `tracker-board.mjs` and `project-status.mjs`'s issue views,
and it has **zero cross-provider contract-parity coverage**. What exists today is two isolated
per-provider unit tests (`providers.test.mjs:136-151`) driven by hand-built `fakeSpawn` payloads
rather than recorded or derived fixtures — so nothing pins that the two normalizers converge on one
shape.

This is rank 4 of M10 Phase 2, the milestone that closes exactly this class of gap: a seam the port
documents but no test holds to its documented shape. It follows rank 2 (`branchProtect`, #354/#352)
and rank 3 (`mrList`, #355/#359, merged at `5dd7d4c`).

## Grounding — what made this rank cheaper than its predecessors

**No new transport glue is needed at all.** Both providers reach the same shared `runJson`:

| Provider | Call site | Transport |
|---|---|---|
| `github.issueList` | `github.mjs:201-212` | `runJson('gh', ['api', 'repos/…/issues?state=…&per_page=100'])` |
| `gitlab.issueList` | `gitlab.mjs:280-289` | `runJson('glab', ['api', 'projects/…/issues?state=…&per_page=50'])` |

Rank 3 already generalized `githubJsonCallArgs` into the provider-neutral `jsonSpawnCallArgs`
(`vcs.contract.test.mjs:78-81`) for precisely this case. `issueList` is its **second consumer and
uses it verbatim** — no rename, no new helper, no seam change, only two table registrations. Rank 3's
"re-count the registrations" risk does not carry over.

## Scope

In scope:

- Six fixtures under `fixtures/`, provenance-tagged: `github-issueList-{happy,empty,failure}.json`
  and `gitlab-issueList-{happy,empty,failure}.json`. The GitHub happy fixture is **recorded**
  (`_provenance.recorded`) via a new `recordGithubIssueList(project)` case in
  `record-fixtures.mjs`; the rest are **derived** (`_provenance.derived`). All six must satisfy
  `assertProvenance` before being wired in.
- `issueList` registered under both entries of the `PROVIDERS` table in
  `brain/scripts/vcs/providers/vcs.contract.test.mjs`, joining the existing parameterized loop.
- A three-layer shape lock **inside** the loop (design D2): per-entry exact-key `deepEqual` on
  sorted `Object.keys` pinning exactly `{ number, title, labels }`, per-label
  `typeof === 'string'`, and a full-array `deepEqual` pinning values and order.
- One **GitHub-only** test **outside** the loop, pinning the `pull_request` filter arithmetically.
- The `vcs-contract.md` `issueList` row amended to match.

Out of scope, and each rejection is load-bearing rather than a deferral of convenience:

- **Parameterizing `assignee: 'me'` inside the contract loop.** This is the important one. The loop's
  glue mocks **one uniform response for every spawn call**, and `assignee: 'me'` makes the verb call
  `whoami()` first (`github.mjs:203`, `gitlab.mjs:282`) — a *second* transport call on one code path.
  Under a uniform stub, `whoami()` receives the issues array, so `resp.login`/`resp.username` is
  `undefined`; `assigneeParams` then yields `{ assignee: '@me' }` from its `?? '@me'` fallback on
  GitHub, and on GitLab produces an endpoint with a **trailing `&`**. The second call returns the
  same array and normalizes cleanly. **The test would go green while a broken `whoami` round-trip and
  a malformed query string sail past** — a green test that passes for the wrong reason, which is
  worse than no test. `design.md` D1 requires an in-file comment at the `issueList` block so a future
  author does not "improve" coverage by adding the parameter.

  Substantively, `assignee` varies only the **query string**, never the normalized shape. Request
  construction is `providers.test.mjs`'s concern, and `assigneeParams` is already unit-tested at
  `cli.test.mjs:110-116`.
- **Registering `gitlabCallArgs` for `gitlab.issueList`.** It would inject a `fetchImpl` the verb
  does not accept — `issueList` spawns `glab`, it does not call `gitlabApiFetch` — leaving the real
  binary reachable from a suite whose header promises no live CLI spawn.
- **An `if (providerName === 'github')` branch inside the parity loop** for the `pull_request`
  filter. GitLab's `projects/:id/issues` returns only issues, so there is no counterpart to filter;
  a provider branch inside a parity loop is the asymmetry the loop exists to prevent. It goes
  outside, following the file's own precedent (`BASE_REF_PROVIDERS` at `:388`, and the
  `prStatusRollup` block).
- **Any production-code change.** M10 Phase 2's completion criteria are explicit: test and fixture
  only.

## Why the filter test is arithmetic rather than a spot-check

The spec requires PR entries be proven *filtered out*, not merely absent by coincidence of the
fixture's contents. `assert.equal(result.length, 2)` against a fixture a reader must count by hand
proves nothing. Both sides are derived from the fixture itself, and the guard

```js
assert.ok(prCount >= 1, 'the recorded fixture must contain at least one PR entry — otherwise this test is vacuous');
```

is the load-bearing line: it makes the test **fail loudly if the fixture stops exercising the
filter**, instead of passing silently on a fixture that no longer contains a pull request.

## Why now

M10 Phase 2 gates Phase 4 (#210, DAG validation), which in turn is the first item of the 1.1 line on
epic #313. Rank 4 is the cheapest remaining rank precisely because rank 3 already built the seam it
needs, so taking it immediately after rank 3 keeps that seam fresh and un-renamed.

## Risk

Low. Test and fixture only; no production code path changes and no seam modification.

One known integration hazard, recorded in `tasks.md`: `prReviews` (rank 2, #317) edits the same
`PROVIDERS` literal and destructuring block (`vcs.contract.test.mjs:120-127`). A small two-hunk
conflict is expected whenever it lands — resolve it mechanically, do not re-derive.

## Note on this dir's remaining artifact debt

Not fixed by #371, which adds this one file and nothing else — flagged so it is not mistaken for
resolved:

- `specs/issueList-contract/spec.md` uses the **nested** spec form. `sdd-layout.md` marks it
  LEGACY-ACCEPTED — *"readers MUST tolerate it, but the scaffold MUST NEVER produce it... not an
  equal alternative to the flat one"* — so a new dir in that shape contradicts the doctrine's intent
  even though `missingRequiredArtifacts` tolerates it. The same applies to
  `issue-355-m10-phase2-mrlist-contract/specs/mrlist-contract/spec.md`.
- `tasks.md` carries 12 unchecked items and 0 checked, though PR #363 merged the implementation.
  Reconciling which items actually shipped belongs to this change's owner.
