---
status: tasked
issue: 886
---

# Explore: #886 mrAutoMerge — merge by tier on the memory lane, never a throw

Parent: #864 (memory 2.0), task 2.5 — Wave 3. Slice of the #862 ruling (ADR-0034 L2).

## Current state (measured on `main @ 136d8d4f`)

The ruling is archived at `openspec/changes/archive/862/{spec,design,proposal}.md`; the promoted
doctrine is `brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md` (L2).

**Exact contract (archive/862/design.md, "mrAutoMerge"; spec L2; ADR-0034 L2):**

```
mrAutoMerge({ project, number, method = 'squash', apiBase?, token?, proxyUrl?, fetchImpl? })
  -> Promise<{ enabled: true, url } | { enabled: false, reason, error? }>
```

`reason ∈ 'requires-human-approval' | 'unsupported' | 'transport'`. Never throws. GitHub:
`gh pr merge <n> --auto --squash`. GitLab: `PUT projects/{enc}/merge_requests/{iid}/merge` with
`merge_when_pipeline_succeeds=true`. Sits in `vcs-contract.md` immediately after `mrCreate`
(currently `:33`) and gains a Phase-3 adapter-status row (`:95-104`).

**VCS port shape** (`brain/scripts/vcs/`):

- `cli.mjs:38-46` — the `VERBS` array is the single dispatch source; a verb missing here is not
  CLI-callable even if both providers export it.
- `cli.mjs:159-168` — `bindIdentity` wraps EVERY function export exhaustively; `mrAutoMerge`
  inherits credential binding automatically, no extra wiring.
- `verb-contract-drift-guard.test.mjs` — a live guard with three checks: doc table ⊆ VERBS,
  VERBS ⊆ (doc table ∪ allowlist), and `sharedFunctionExports(github, gitlab)` ⊆ VERBS.
  Implementing `mrAutoMerge` in both providers without adding it to `VERBS` and to the
  `vcs-contract.md` table fails this test automatically.
- Never-throws pattern for a mutating write verb: `branchProtect` (github.mjs:263-295) calls the
  sync `gh(...)` wrapper (`lib/exec.mjs:20-33`, `ok: status===0`), classifies `stderr` by regex
  into a `reason`, and returns a fixed-key object; `vcs.contract.test.mjs:2214-2220` pins the key
  set (`Object.keys(result).sort()` equality). `mrAutoMerge`'s failure shape
  (`{enabled:false,reason,error?}`) follows the same discipline.
- `mrCreate` (github.mjs:571-595, gitlab.mjs:1112-1147) is the closest sibling for the happy
  path: GitHub spawns `gh` synchronously and returns `{url}` / `{url:null,error}`; GitLab calls
  `gitlabApiFetch` (`gitlab-api.mjs:39`, PRIVATE-TOKEN header, JSON body) inside try/catch.
- Contract tests live in one parameterized file, `providers/vcs.contract.test.mjs`.
  `BRANCH_PROTECT_PROVIDERS` (`:2168-2228`) is the scaffold to copy: a `{module, ok(args),
  fail(args)}` map per provider, `setSpawn` glue for GitHub (no fixture files for a mutating
  verb), `fetchImpl` glue for GitLab. `mrCreate`'s glue at `:141-187` shows the fixture-file
  alternative (`fixtures/{provider}-mrCreate-happy.json`).

**Tier configuration**: `brain/scripts/vcs/governance-tiers.mjs` — `TIER_PARAMS.{lite,standard,
regulated}.requiredReviews` = `0, 1, 1` (`:265, :277, :292`). `tierParams(tier).requiredReviews`
is the read a caller resolves from `resolveTier(loadBrainConfig())`. `brain.config.json:13,17`
declares `vcs.provider: "github"`, `governance.tier: "lite"` for this repo.

**Credential**: no new mechanism. `getVcs({identity})` / `bindIdentity` already bind a credential
to every verb; `mrAutoMerge` takes an optional `token` like `mrCreate` does on GitLab. ADR-0034
L5's rule (ambient identity at `lite`, `BRAIN_MEMORY_TOKEN` on unattended hosts) is the caller's
concern (#888). `credential-env.mjs`'s `withoutCredentials` (ADR-0033) is a separate surface.

**GitHub prerequisite**: `gh pr merge --auto` requires "Allow auto-merge" enabled on the
repository and at least one required status check on the target branch; otherwise the PR merges
immediately. The lane's required contexts (`lane-paths`, `lane-scrub`, #889) satisfy the second
condition once they exist. The live setting of `csrinaldi/brain` is recorded by the orchestrator
below.

**Distinction for #888's caller**: `mrAutoMerge` ARMS auto-merge; it does not merge and does not
wait for checks. `{enabled:true}` means "armed", not "merged". The forge merges later, once the
required contexts are green.

**Testing**: `node:test`, no network or spawn in contract tests — GitHub via the `setSpawn` seam,
GitLab via injected `fetchImpl`. `npm test` is the project-wide runner. STRICT TDD applies.

## Approaches

1. **New verb, refusal computed by the caller.** The verb unconditionally arms auto-merge; the
   caller (#888) resolves the tier and never calls it when `requiredReviews > 0`, producing the
   `requires-human-approval` outcome itself. Matches design.md's literal signature (no
   `requiredReviews` parameter). Cost: the "never auto-merges without a review" invariant lives in
   every caller, not at one choke point. Effort: low.
2. **New verb, refusal computed inside the verb.** `mrAutoMerge` takes `requiredReviews`
   explicitly, mirroring `branchProtect` (the one precedent verb that needs tier data and takes it
   as a parameter rather than reading config), and refuses before touching the provider. Matches
   L2's wording ("`mrAutoMerge` refuses rather than pretends"). Cost: design.md's signature
   snippet must be amended to add the parameter. Effort: low, same code.
3. **Extend `mrCreate` with an `auto` flag.** Rejected: `mrCreate`'s shape is pinned
   (`vcs.contract.test.mjs:844-878`), the ruling names `mrAutoMerge` as a new verb with its own
   return vocabulary, and creating a PR and arming auto-merge on an existing PR are two operations.

**Recommendation**: approach 2. It follows the only precedent verb that needs tier data
(`branchProtect`) and keeps the invariant inside the port instead of trusting each caller.

## Files this change touches (tests first)

1. `brain/scripts/vcs/providers/vcs.contract.test.mjs` — `MR_AUTO_MERGE_PROVIDERS` block
   mirroring `BRANCH_PROTECT_PROVIDERS`: happy path `{enabled:true,url}`; tier refusal
   `{enabled:false,reason:'requires-human-approval'}` with no provider call; transport failure
   `{enabled:false,reason:'transport',error}`; unsupported (auto-merge disabled on the repo);
   never throws; fixed key set.
2. `brain/scripts/vcs/verb-contract-drift-guard.test.mjs` — no edit; passes only once the verb is
   in `VERBS` and in the contract table.
3. `brain/scripts/vcs/providers/github.mjs` — `mrAutoMerge` near `mrCreate` (:571-595), `gh()`
   wrapper plus stderr classification like `branchProtect` (:263-295).
4. `brain/scripts/vcs/providers/gitlab.mjs` — `mrAutoMerge` near `mrCreate` (:1112-1147),
   `gitlabApiFetch` PUT inside try/catch.
5. `brain/scripts/vcs/cli.mjs` — `'mrAutoMerge'` in `VERBS` (:38-46).
6. `brain/core/methodology/vcs-contract.md` — the row after `mrCreate` and the adapter-status
   row. Tier 2: a draft under `brain-drafts/`, promoted by the maintainer.

## Open questions for the proposal

1. Does `mrAutoMerge` take `requiredReviews` explicitly (approach 2) or does the caller pre-check
   the tier (approach 1)? design.md's snippet omits the parameter; L2's wording reads as the
   verb's own behaviour.
2. Does `reason:'unsupported'` cover "auto-merge is not allowed for this repository" (GitHub's
   own error) — and what does the live repo say?
3. Is `method` ever anything but `'squash'`? The lane PR contract says squash unconditionally;
   `prReviewComment` hardcodes its event (REQ-266-3 lock 2) — precedent for a fixed method.
4. Scope boundary: #886 builds the verb only. No caller wiring (#888), no production enablement
   (#805 gates it), no collector (#887).

## Risks

- The drift guard makes it impossible to land the verb in one provider only or to skip the
  `VERBS` and doc updates: providers ×2, `cli.mjs` and the contract row are one indivisible unit.
- The contract doc row is Tier 2 (`brain/core/**`): it ships as a draft in `brain-drafts/` and
  the maintainer promotes it, as #863 and #862 did.

## Live measurement added by the orchestrator (2026-09-09)

`gh api repos/{owner}/{repo}` on `csrinaldi/brain`: `allow_auto_merge: false`,
`allow_squash_merge: true`, `allow_merge_commit: true`, `delete_branch_on_merge: true`.
`main` protection: 6 required status checks, `strict: true`, `required_approving_review_count: 0`,
`enforce_admins: false`.

Consequence: today `gh pr merge --auto` on this repo fails with GitHub's "auto-merge is not
allowed for this repository" — the `unsupported` reason is a real outcome here, not a
hypothetical, and the contract test must cover it. Flipping `allow_auto_merge` is a repository
setting (the maintainer's act) and belongs to the enablement step #805 gates, not to this slice.
