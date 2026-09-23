# Amendment draft — `vcs-contract.md` gains the `commitPrs` verb and `prView`'s `absent` field (issue #1086)

> **Tier 2 draft. Not yet promoted.** `brain/core/**` is never edited by an agent. The
> maintainer promotes it after this PR merges:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1086-audit-pr-resolution/brain-drafts/vcs-contract-commitprs-row.draft.md
> ```
>
> This is the blocking hand-off `tasks.md` Phase 5 names: `verb-contract-drift-guard.test.mjs`
> stays RED for `commitPrs` (fired by Phase 3.5's `cli.mjs` `VERBS` entry) until this row is
> promoted onto `main` on this branch. Design D7 names this a deliberate BLOCKING Tier 2
> dependency, not a `DOCUMENTED_BUT_NOT_REQUIRED` allowlist entry.

```brain-amendment/1
target: brain/core/methodology/vcs-contract.md
issue: 1086
```

## Edit 1 — the `prView` row gains the `absent` field (`vcs-contract.md:35`)

```amend-find
| `prView` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ number, labels, body, author, headRefOid, baseRefOid }>` | GL `iid`/`description`/`author.username` → `number`/`body`/`author` (GitLab: direct API v4 over `gitlabApiFetch`); GH `gh pr view --json`. `headRefOid` (ADR-0021 Decision 1) is the API's head sha — the anchor a cold caller checks out **detached** at, never a branch name. GH: `gh pr view --json` field `headRefOid`. GL: the MR payload's `sha`, falling back to `diff_refs.head_sha`. `baseRefOid` (ADR-0022 Decision 1) is the base branch's tip sha. GH: `gh pr view --json` has no `baseRefOid` field — sourced via a strict supplementary call, `gh api repos/{owner}/{repo}/pulls/{number} --jq .base.sha`. GL: the MR payload's `diff_refs.base_sha`, no extra request. On a fetch failure returns `{ number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null }` (uncomputable) — never throws. On a successful fetch, `body` is `''` when genuinely empty, never `null` (issue #239 A3 task 3.7 — `null` means uncomputable, `''` means successfully-empty); `headRefOid`/`baseRefOid` follow the same uncomputable-vs-empty discipline, `null` when the sha cannot be resolved. |
```

```amend-replace
| `prView` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ number, labels, body, author, headRefOid, baseRefOid, absent }>` | GL `iid`/`description`/`author.username` → `number`/`body`/`author` (GitLab: direct API v4 over `gitlabApiFetch`); GH `gh pr view --json`. `headRefOid` (ADR-0021 Decision 1) is the API's head sha — the anchor a cold caller checks out **detached** at, never a branch name. GH: `gh pr view --json` field `headRefOid`. GL: the MR payload's `sha`, falling back to `diff_refs.head_sha`. `baseRefOid` (ADR-0022 Decision 1) is the base branch's tip sha. GH: `gh pr view --json` has no `baseRefOid` field — sourced via a strict supplementary call, `gh api repos/{owner}/{repo}/pulls/{number} --jq .base.sha`. GL: the MR payload's `diff_refs.base_sha`, no extra request. On a fetch failure returns `{ number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null }` (uncomputable) — never throws. On a successful fetch, `body` is `''` when genuinely empty, never `null` (issue #239 A3 task 3.7 — `null` means uncomputable, `''` means successfully-empty); `headRefOid`/`baseRefOid` follow the same uncomputable-vs-empty discipline, `null` when the sha cannot be resolved. `absent` (issue #1086, D1/D2) is an ADDITIVE third failure-shape field: `false` on a successful fetch, `true` when the provider AFFIRMATIVELY reports the requested number is not a pull request (`isNotFound(text)`, `uncomputable-cause.mjs` — the module's shared not-found predicate, never a provider-local regex), `null` on any OTHER failure (including a malformed-response parse catch) — never on success. `labels`/`body` stay `null` in BOTH failure branches, byte-identical to before this field existed, so a consumer that does not read `absent` behaves exactly as it did before. |
```

## Edit 2 — the `commitPrs` row, after `commitStatus` (`vcs-contract.md:40`)

```amend-find
| `commitStatus` | `({ project, sha }) -> Status\|null` | Normalized enum (see below). `null` has THREE distinct producers: no checks ran; a value outside the canonical enum; and a **completed** GitHub check whose `conclusion` is `neutral` or `skipped`, which `GITHUB_STATUS_MAP` maps to `null` (`normalize.mjs:24-25`) — indistinguishable from "no checks ran" at the contract boundary. That `null` (a successful call, nothing to report) is distinct from a transport failure, which REJECTS (`exec.mjs:31-32`), neither provider wraps it. Selection asymmetry: GH fetches all check runs and takes `[0]` client-side; GL pushes `per_page=1` server-side (issue #385, M10 Phase 2 — final Gap-A batch). |
```

```amend-replace
| `commitStatus` | `({ project, sha }) -> Status\|null` | Normalized enum (see below). `null` has THREE distinct producers: no checks ran; a value outside the canonical enum; and a **completed** GitHub check whose `conclusion` is `neutral` or `skipped`, which `GITHUB_STATUS_MAP` maps to `null` (`normalize.mjs:24-25`) — indistinguishable from "no checks ran" at the contract boundary. That `null` (a successful call, nothing to report) is distinct from a transport failure, which REJECTS (`exec.mjs:31-32`), neither provider wraps it. Selection asymmetry: GH fetches all check runs and takes `[0]` client-side; GL pushes `per_page=1` server-side (issue #385, M10 Phase 2 — final Gap-A batch). |
| `commitPrs` | `({ project, sha }) -> Promise<number[]\|null>` | The pull requests that contain a commit (issue #1086, D3). Ascending numbers on a successful read; `[]` when the provider definitively reports none; `null` on ANY transport failure or malformed response — never a fabricated `[]` for a failure, and never throws. Mirrors `commitStatus`'s commit-keyed shape — the only other verb keyed on `{ project, sha }`. Opened ONLY by the shared merge-evidence layer (`fetchPrMeta`, `merge-walk.mjs`) when `prView` reports a definitive `absent: true` on the subject's own number — the gate is structural: a transport failure (`absent: null`/`false`) never reaches this verb by any path. GH: `gh api --paginate repos/{project}/commits/{sha}/pulls`, mapping `r.number`. GL: `GET projects/:enc/repository/commits/:sha/merge_requests` over `gitlabApiFetch`, mapping `r.iid`. Numbers only, not full PR objects — the caller re-enters `prView` for every other field, so no second evidence shape is introduced. |
```
