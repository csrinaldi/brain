# VCS Adapter Contract

> **status:** current | **last-reviewed:** 2026-06-26 | **owner:** @crinaldi

> **Purpose:** defines the abstract verbs that any VCS provider must implement
> so the harness can operate over GitHub, GitLab, or another host without
> touching the scripts. Referenced by ADR-0008.

The active provider is chosen via `vcs.provider` in `brain.config.json` (explicit,
repo-level — see ADR-0008). The dispatcher `scripts/vcs/cli.mjs` reads that key and
delegates to `scripts/vcs/providers/<provider>.mjs`. Credentials live in `.env`
(`VCS_TOKEN`, a single generic var across providers), never in the config.

---

## Required verbs

Each provider exports one function per verb. The **return shapes are normalized**:
the caller never sees provider-specific fields (`iid`, `source_branch`, `.username`,
the GitLab status enum, etc.).

| Verb | Signature | Normalized return |
|------|-----------|-------------------|
| `authCheck` | `({ host }) -> boolean` | Is there an authenticated session? |
| `authLogin` | `({ host, token }) -> boolean` | Authenticate (token via stdin internally). |
| `whoami` | `() -> { username }` | Current user. GL `.username` / GH `.login` → `username`. |
| `issueView` | `({ project, number }) -> { number, title, labels, body, author }` | GL `iid`/`description`/`author.username` → `number`/`body`/`author`; GH `user.login` → `author`. `author` added issue #239 A3 (REQ-L5-1 needs the issue author, same API call — no extra round-trip). |
| `issueList` | `({ project, state, assignee }) -> [{ number, title, labels }]` | `state:'open'`, `assignee:'me'\|'none'\|undefined`. |
| `mrList` | `({ project, state }) -> [{ number, title, headBranch }]` | GL `merge_requests`/`source_branch` → `headBranch`. |
| `mrCreate` | `({ project, title, body, head, base?, labels?, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ url }\|{ url: null, error }>` | Opens a PR/MR. `base` defaults to `'main'`; `labels` omitted (not sent empty) when none given. GH: `gh pr create`. GL: `POST projects/{enc}/merge_requests` over `gitlabApiFetch` (issue #239 A3). Never throws — `{ url: null, error }` on failure. |
| `prView` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ number, labels, body, author, headRefOid }>` | GL `iid`/`description`/`author.username` → `number`/`body`/`author` (GitLab: direct API v4 over `gitlabApiFetch`); GH `gh pr view --json`. `headRefOid` (ADR-0021 Decision 1) is the API's head sha — the anchor a cold caller checks out **detached** at, never a branch name. GH: `gh pr view --json` field `headRefOid`. GL: the MR payload's `sha`, falling back to `diff_refs.head_sha`. On a fetch failure returns `{ number, labels: null, body: null, author: null, headRefOid: null }` (uncomputable) — never throws. On a successful fetch, `body` is `''` when genuinely empty, never `null` (issue #239 A3 task 3.7 — `null` means uncomputable, `''` means successfully-empty); `headRefOid` follows the same uncomputable-vs-empty discipline, `null` when the sha cannot be resolved. |
| `prStatusRollup` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ name, status, conclusion }>\|null>` | READ-only status-check rollup for a PR's head commit (ADR-0021 Decision 2) — no write, no APPROVE path, no label mutation. GH: `gh pr view --json statusCheckRollup`, one entry per check. GL: resolves the MR head sha, then `GET projects/:id/repository/commits/:sha/statuses`, one entry per pipeline job/status (GitLab has no separate `conclusion` field — normalizes to `conclusion: null`). `null` = uncomputable (fetch failed), never a fabricated `[]`. |
| `labelEvents` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ actor: { login }, action: 'add'\|'remove', label, at }>\|null>` | Provider-agnostic label-history read, dispatched on runtime `ctx.provider` (issue #239 A3). GH `event:'labeled'\|'unlabeled'` → `action`; GL `resource_label_events`' native `action` passes through. Ascending by `at`; `null` = uncomputable (fetch failed), never a fabricated `[]`. |
| `prReviews` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ state, author }>\|null>` | Provider-agnostic PR/MR review read, dispatched on runtime `ctx.provider` (issue #239 A3 TASK2). GH: Reviews API `state`/`user.login` pass through. GL: no per-reviewer state history — the approvals API's `approved_by[]` normalizes to one `{state:'APPROVED', author}` entry per approver. `null` = uncomputable (fetch failed); a genuinely empty approvals list is `[]`, not `null`. |
| `commitStatus` | `({ project, sha }) -> Status\|null` | Normalized enum (see below). |
| `repoCloneUrl` | `({ host, project, token }) -> string` | Authenticated HTTPS URL. User literal hidden from the caller. |
| `patSetupUrl` | `({ host, name, scopes }) -> string` | PAT creation URL in the browser. |
| `projectResolve` | `({ project }) -> string` | Identity: returns the slug. Both GH and GL address projects by slug/encoded-path, so callers pass the slug everywhere (incl. `repoCloneUrl`). Extension point if a host ever needs a different id. |
| `branchProtect` | `({ project, branch?, checks, requiredReviews? }) -> { enforced, reason?, remedy? }` | Apply (or refresh) branch protection. `branch` defaults to `'main'`; `checks` is an array of required check context strings; `requiredReviews` defaults to `1`. Returns `{enforced:true}` on success or `{enforced:false,reason,remedy}` on failure (never throws). GitHub: idempotent `PUT repos/{project}/branches/{branch}/protection` via `gh api --input -`; may return `reason:'tier'` on GitHub Free private repos. GitLab: `POST projects/{enc}/protected_branches` (push_access_level=0, allow_force_push=false); idempotent on 409; never returns `reason:'tier'` (protected branches are free on all GitLab tiers). Approval-count enforcement (requiredReviews) requires GitLab Premium and is not enforced in this slice. |
| `prReviewComment` | `({ project, number, body }) -> Promise<{ url }\|{ url: null, error }>` | Posts a review whose event is **`COMMENT`, hardcoded** (issue #266 lock 2, REQ-266-3) — no parameter, flag, or branch selects a different event. GH: `POST repos/{project}/pulls/{number}/reviews`. GL: no review-state concept on notes — `POST projects/{enc}/merge_requests/{number}/notes`. Never throws. |
| `issueComment` | `({ project, number, body }) -> Promise<{ url }\|{ url: null, error }>` | Posts a plain issue comment — rulings on issues. GH: `POST repos/{project}/issues/{number}/comments`. GL: `POST projects/{enc}/issues/{number}/notes`. Never throws. |
| `labelAdd` | `({ project, number, labels }) -> Promise<{ ok }\|{ ok: false, error }>` | Adds labels. The **caller** enforces the deny-set (REQ-266-9), not the verb. GH: `POST repos/{project}/issues/{number}/labels`. GL: `PUT projects/{enc}/issues/{number}` with `add_labels` (issues-only, matching `labelEvents`). Never throws. |
| `labelRemove` | `({ project, number, labels }) -> Promise<{ ok }\|{ ok: false, error }>` | Removes labels — monotonic-tightening removals only (REQ-266-9). GH: per-label `DELETE .../labels/{label}`, stopping at the first failure (no bulk-remove endpoint). GL: `PUT projects/{enc}/issues/{number}` with `remove_labels`. Never throws. |

### Normalized `commitStatus` enum

`'success' | 'failed' | 'running' | 'pending' | 'canceled' | null`

The canonical style is GitLab's. Providers map their native enum to it
(GitHub `failure` → `failed`, `cancelled` → `canceled`, `in_progress` → `running`,
`queued` → `pending`). For GitHub check-runs, the live `status` is used until the
check completes, then its `conclusion`. `null` = no status available.

## Normalization rules

- **Naming**: `number` (not `iid`), `body` (not `description`), `headBranch` (not
  `source_branch`/`headRefName`), `username` (not `login`).
- **Filters**: `state:'open'` (not `opened`), `assignee:'none'` (not `None`/`assignee_id`).
- **Display**: the reference is shown as `#<number>` for issues and MRs/PRs alike.
- **`projectResolve`**: the caller passes the slug as `project` to every verb. Both
  GitHub and GitLab address projects by slug / URL-encoded path, so it is the identity.
  It stays in the contract as an extension point for a host that needs a different id.

## How to add a provider

Create `scripts/vcs/providers/<name>.mjs` exporting the 20 verbs and add `<name>` as a
valid value of `vcs.provider`. The callers are not touched.

## Current implementation

`github` (`gh`) and `gitlab` (`glab`). The `gitlab` provider reproduces the historical
behavior of the scripts (parity — a revert leaves the GitLab flow intact).

### Phase 3 adapter status

| Verb | GitHub | GitLab |
|------|--------|--------|
| `branchProtect` | implemented | implemented (Phase 3 — issue #95) |
| `capabilities` | implemented | implemented (Phase 3 — issue #95) |
| `mrCreate` | implemented | implemented (A3 — issue #239) |
| `prView` | implemented | implemented (A3 — issue #239) |
