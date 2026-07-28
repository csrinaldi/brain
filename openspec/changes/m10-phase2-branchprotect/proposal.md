# Proposal: branchProtect contract-parity coverage (M10 Phase 2, rank 2)

> Issue: **#TBD** (rank 2 of the #336 Phase-2 gap ranking) · Milestone: M10 Phase 2
> Change folder is `m10-phase2-branchprotect`; rename to `issue-{iid}-m10-phase2-branchprotect` once the issue id is assigned.

## Intent

`branchProtect` is the only mutating write in the #336 gap set, and it is **absent from the contract-parity suite** (`vcs.contract.test.mjs`) entirely. Its 15 existing tests live in `providers.test.mjs`, which is provider-siloed by construction: it asserts each provider's own CLI-arg details, never that GitHub and GitLab honour the *same* contract. That is exactly the shape of drift the parity suite exists to catch, and it is precisely the pre-#334 `issueView` Gap-A repeating itself.

Exploration surfaced that the divergence is worse than the audit assumed. GitHub's failure mode is honest: on a Free-tier private repo the protection `PUT` 403s atomically and the verb returns `{enforced:false, reason:'tier', remedy}` — the caller *knows* nothing was armed. GitLab's is silent: `branchProtect({ requiredReviews })` declares the parameter and then never references it in the function body. There is no call to GitLab's approval-rules API on any tier, so the verb returns `{enforced:true}` unconditionally once the branch is protected, while review-count enforcement was quietly skipped. Today nothing in the repository detects if that behaviour changes in either direction — silently gaining enforcement, or silently losing it.

Success means both facts become locked, executable statements: the shared `{enforced, reason?, remedy?}` contract is asserted once against both providers, and GitLab's unenforced `requiredReviews` stops being a code comment and becomes a test that fails the moment reality diverges from the documentation.

**Contract correction (carried forward from exploration):** the return shape is `{ enforced: boolean, reason?: string, remedy?: string }`. There is no `enabled`, no `rules`, and no output `requiredReviews` field anywhere in `vcs-contract.md`, either provider, or the existing tests. `requiredReviews` is an **input parameter only**, defaulting to `1`. Any downstream phase asserting otherwise is asserting fiction.

## Scope

### In Scope

- **ADD** one parameterized contract-parity block to `brain/scripts/vcs/providers/vcs.contract.test.mjs` covering `branchProtect` on **both** providers with inline mocks: happy path (`enforced:true`), failure path (`enforced:false` carrying string `reason` and `remedy`), and the never-throws guarantee.
- **ADD** one source-scan test pinning that `gitlab.mjs`'s `branchProtect` body never calls an approval / approval-rules endpoint — converting the documented-but-untested limitation into a locked fact.

### Out of Scope

- **No provider code changes.** `github.mjs` and `gitlab.mjs` are read-only in this slice.
- **No behavioural fix** for GitLab's `requiredReviews` no-op. This slice *pins* the gap; it does not close it.
- **No fixture files.** `branchProtect` is a mutating write, so nothing can be recorded live; inline mocks match the precedent set by 6 of the 10 existing parity verbs.
- **No rewrite of `vcs-contract.md`**, no `providers.test.mjs` changes, no `brain-protect.mjs` post-arm verification, and no other gap-set verb (`mrList` rank 3, `issueList` rank 4 stay untouched).

## Capabilities

### New Capabilities

- `vcs-branch-protect-contract`: the cross-provider `branchProtect` contract — normalized `{enforced, reason?, remedy?}` shape, never-throws totality, and the explicitly-pinned GitLab review-enforcement limitation.

### Modified Capabilities

- None. No existing spec's requirements change; this slice adds assertions for behaviour that `vcs-contract.md` line 39 already documents.

## Approach

Follow the established parity precedent rather than inventing a mechanism. A single `BRANCH_PROTECT_PROVIDERS` map supplies per-provider `ok`/`fail` transport glue, and one `for` loop runs the identical assertion body over `['github', 'gitlab']` — the same shape as `WRITE_VERB_PROVIDERS` and `LABEL_LIST_PROVIDERS` in the same file. Exploration found a simplification available here: unlike `prView`/`labelEvents`, **both** providers' `branchProtect` use the same spawn transport (`run('gh'…)` / `run('glab'…)` through the shared `setSpawn` seam), so one glue shape serves both and no `fetchImpl` split is needed.

Assertions stay at contract level, not vocabulary level. `reason` and `remedy` values legitimately differ per provider (`'tier'` is GitHub-only; `'auth'`/`'permission'` are GitLab's), so the parity test asserts presence and type, never identical strings. Provider-specific vocabulary remains `providers.test.mjs`'s job.

The source-scan test follows the REQ-266-3 lock-2 precedent already in the file, with one critical constraint: **the scan must be scoped to the `branchProtect` function body, not the whole file.** `gitlab.mjs:271` already calls `projects/{id}/merge_requests/{n}/approvals` for `prReviews`, so a file-wide match on `approvals` would false-positive immediately. The test must slice the function source (or match on `requiredReviews` being unreferenced within it) and carry a comment explaining why the narrow scope is load-bearing.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Modified | New parity block + new source-scan test (the entire code delta) |
| `openspec/specs/vcs-branch-protect-contract/spec.md` | New | Capability spec produced by `sdd-spec` |
| `brain/scripts/vcs/providers/{github,gitlab}.mjs` | Read-only | Behaviour asserted, never altered |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Source scan false-positives on `prReviews`' legitimate `/approvals` call | **High** if written naively | Scope the scan to the `branchProtect` function body; assert `requiredReviews` is unreferenced within it. Called out explicitly for `sdd-design`. |
| Pinning the GitLab no-op is read as blessing it | Medium | Test name and comment must state this pins a **known gap**, not desired behaviour. The remediation decision is recorded below, not silently dropped. |
| Over-tight assertions on provider-specific `reason` vocabulary cause brittle failures | Medium | Assert type/presence only; leave vocabulary to `providers.test.mjs`. |
| Duplicating coverage that already exists in `providers.test.mjs` | Low | The 15 existing cases are provider-siloed; the parity block asserts the *shared* contract, which none of them do. |

## Decision required

**GitLab `requiredReviews` enforcement — pin now, decide later, but decide explicitly.** This slice deliberately pins the no-op rather than fixing it, so the gap becomes visible and change-detecting at near-zero cost. The follow-up fork is real and must not evaporate:

- **(a) Implement it** — call GitLab's approval-rules API with feature detection, degrading to `{enforced:false, reason:'tier'}` on Free so GitLab fails closed and visibly, like GitHub does.
- **(b) Ratify the limitation** — keep the behaviour, but make the verb *report* it (e.g. surface an explicit "reviews not enforced" signal) so `brain-protect.mjs` stops implying a guarantee it never received.

Doing neither is the status quo the audit flagged. `sdd-design` must record the choice and, if deferred, open a tracking issue.

## Rollback Plan

Revert the single commit. The change is additive and test-only: no provider code, no fixtures, no spec rewrites, no runtime behaviour. Reverting restores the exact pre-change coverage with zero production impact.

## Dependencies

- `openspec/changes/issue-336-m10-coverage-audit/audit.md` — the ranking source (SHA-pinned snapshot).
- Rank-1 `prReviews` slice — independent; no ordering constraint, and no shared files beyond `vcs.contract.test.mjs` (rebase conflicts are the only coupling).

## Delivery

Single PR, estimated **~80–120 changed lines** (existing parity-verb blocks run 50–70 lines; the scoped dual-provider source scan adds ~30–50). Well inside the 400-line review budget — no chaining, no `size:exception`.

## Success Criteria

- [ ] `vcs.contract.test.mjs` runs one identical assertion set for `branchProtect` over both `github` and `gitlab`.
- [ ] Happy path asserts `{enforced:true}`; failure path asserts `enforced:false` with string `reason` and `remedy`; neither provider throws.
- [ ] A scoped source-scan test fails if `gitlab.mjs`'s `branchProtect` starts or stops calling an approval-rules endpoint — and does **not** false-positive on `prReviews`.
- [ ] `branchProtect` moves from "⚠️ provider-specific only" to "✅ contract-parity suite" in the #336 coverage taxonomy.
- [ ] Zero changes to `github.mjs`, `gitlab.mjs`, `brain-protect.mjs`, or any fixture file.
- [ ] The GitLab `requiredReviews` remediation fork is recorded as an explicit decision, not left implicit.
