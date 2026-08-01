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
| `authCheck` | `({ host }) -> boolean` | Is there an authenticated session? Never throws — both providers call the raw `run()` wrapper (not `runJson`), whose `ok: r.status === 0` normalizes a non-zero exit to `false`, never a rejection (issue #365, M10 Phase 2 rank-6) — the OPPOSITE divergence from `mrList`/`issueList`'s pinned throw. Host-argument divergence: GH (`gh auth status`) omits `--hostname` entirely when `host` is falsy; GL (`glab auth status`) always passes `--hostname`, even the literal `undefined` when `host` is omitted — GL does not branch. |
| `authLogin` | `({ host, token }) -> boolean` | Authenticate (token via stdin internally). Never throws, same `run()`-based boolean discipline as `authCheck` (issue #364, M10 Phase 2 rank-5). The token is delivered via `opts.input` (stdin) on both providers, never as a CLI argument. Host-default divergence: GH (`gh auth login`) defaults `host` to `'github.com'` when omitted (`host \|\| 'github.com'`); GL (`glab auth login`) does not default — an omitted `host` is passed through unguarded. |
| `whoami` | `() -> { username }` | Current user. GL `.username` / GH `.login` → `username`. Transport is `runJson` on both providers, so a transport failure REJECTS (`exec.mjs:31-32`), the same discipline as `mrList`/`issueList`, opposite `authCheck` (issue #385, M10 Phase 2 — final Gap-A batch). Return shape is exactly `{ username }` — no provider field (`login`, `id`, `avatar_url`) survives normalization. |
| `issueView` | `({ project, number }) -> { number, title, labels, body, author }` | GL `iid`/`description`/`author.username` → `number`/`body`/`author`; GH `user.login` → `author`. `author` added issue #239 A3 (REQ-L5-1 needs the issue author, same API call — no extra round-trip). |
| `issueList` | `({ project, state, assignee }) -> [{ number, title, labels }]` | `state:'open'`, `assignee:'me'\|'none'\|undefined`. Like `mrList`, `issueList` does not wrap its transport call — `runJson` throws on a non-zero exit or malformed JSON and neither provider catches it, so a transport failure REJECTS rather than yielding a null-shape (issue #362, M10 Phase 2 rank-4); unlike `mrList`, both call sites already absorb the throw (`tracker-board.mjs`'s `safeList` try/catch, `project-status.mjs`'s wrapping try/catch), so it is contained and load-bearing, not merely out of scope to fix. Pagination: GH requests `per_page=100`, GL requests `per_page=50`; neither provider paginates beyond the first page (same asymmetry as `mrList`, follow-up issue). GitHub-only normalization: (1) GH's `/issues` endpoint returns both issues and PRs, so `github.mjs` filters out any entry carrying a `pull_request` field before mapping; (2) GH's `labels` field is an array of label objects, unwrapped to plain name strings via `.map(l => l.name)`, whereas GL's `labels` is already a flat string array requiring no unwrapping. |
| `mrList` | `({ project, state }) -> Promise<[{ number, title, headBranch }]>` | GL `merge_requests`/`source_branch` → `headBranch`. Unlike `prView`/`prReviews`/`labelEvents`/`prStatusRollup`, `mrList` does not wrap its transport call — `runJson` throws on a non-zero exit or malformed JSON and neither provider catches it, so a transport failure REJECTS rather than yielding a null-shape (issue #355, M10 Phase 2 rank-3). Pagination: GH requests `per_page=100`, GL requests `per_page=50`; neither provider paginates beyond the first page, so a project with more open MRs/PRs than the lower threshold silently truncates at a different point per provider (follow-up issue, not fixed here). |
| `mrCreate` | `({ project, title, body, head, base?, labels?, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ url }\|{ url: null, error }>` | Opens a PR/MR. `base` defaults to `'main'`; `labels` omitted (not sent empty) when none given. GH: `gh pr create`. GL: `POST projects/{enc}/merge_requests` over `gitlabApiFetch` (issue #239 A3). Never throws — `{ url: null, error }` on failure. |
| `prView` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<{ number, labels, body, author, headRefOid, baseRefOid }>` | GL `iid`/`description`/`author.username` → `number`/`body`/`author` (GitLab: direct API v4 over `gitlabApiFetch`); GH `gh pr view --json`. `headRefOid` (ADR-0021 Decision 1) is the API's head sha — the anchor a cold caller checks out **detached** at, never a branch name. GH: `gh pr view --json` field `headRefOid`. GL: the MR payload's `sha`, falling back to `diff_refs.head_sha`. `baseRefOid` (ADR-0022 Decision 1) is the base branch's tip sha. GH: `gh pr view --json` has no `baseRefOid` field — sourced via a strict supplementary call, `gh api repos/{owner}/{repo}/pulls/{number} --jq .base.sha`. GL: the MR payload's `diff_refs.base_sha`, no extra request. On a fetch failure returns `{ number, labels: null, body: null, author: null, headRefOid: null, baseRefOid: null }` (uncomputable) — never throws. On a successful fetch, `body` is `''` when genuinely empty, never `null` (issue #239 A3 task 3.7 — `null` means uncomputable, `''` means successfully-empty); `headRefOid`/`baseRefOid` follow the same uncomputable-vs-empty discipline, `null` when the sha cannot be resolved. |
| `prStatusRollup` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ name, status, conclusion }>\|null>` | READ-only status-check rollup for a PR's head commit (ADR-0021 Decision 2) — no write, no APPROVE path, no label mutation. GH: `gh pr view --json statusCheckRollup`, one entry per check. GL: resolves the MR head sha, then `GET projects/:id/repository/commits/:sha/statuses`, one entry per pipeline job/status (GitLab has no separate `conclusion` field — normalizes to `conclusion: null`). `null` = uncomputable (fetch failed), never a fabricated `[]`. |
| `labelEvents` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ actor: { login }, action: 'add'\|'remove', label, at }>\|null>` | Provider-agnostic label-history read, dispatched on runtime `ctx.provider` (issue #239 A3). GH `event:'labeled'\|'unlabeled'` → `action`; GL `resource_label_events`' native `action` passes through. Ascending by `at`; `null` = uncomputable (fetch failed), never a fabricated `[]`. |
| `prReviews` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ state, author, body }>\|null>` | Provider-agnostic PR/MR review read, dispatched on runtime `ctx.provider` (issue #239 A3 TASK2; `body` + the GitLab notes source added by issue #317). `body` is LOAD-BEARING, not cosmetic: the reviewer's `brain-review/N` verdict block lives in it and `parse-verdict.mjs` requires a string body, so without it `cold-boot`'s `priorVerdicts` is always `[]` and the anti-loop lock, the `rev >= 3 -> STOP` bound, the §8 doctrine load and board reconciliation are ALL inert. Like `prView.body`, a review with no comment normalizes to `''`, never `null` — `null` is reserved for the whole-result uncomputable signal. GH: Reviews API `state`/`user.login`/`body` pass through, `--paginate`. GL: reads TWO endpoints — MR **notes** (`order_by=created_at&sort=asc`, paginated at `per_page=100`) for the verdict thread, each non-system note normalizing to `{state:'COMMENTED', author, body}`; **approvals** (`approved_by[]`) for L6 only, each approver normalizing to `{state:'APPROVED', author, body:''}`, appended after the chronological notes (the approvals endpoint exposes no per-approver timestamp, so interleaving would be fabricated). GitLab notes MUST normalize to `COMMENTED`, never `APPROVED` — the L6 gate counts only `APPROVED`, so mapping a comment to `APPROVED` would let anyone clear the self-approval gate by commenting. Ordering is oldest-first on both providers because `poster.mjs`/`board.mjs` take the LAST parsed verdict as current. `null` = uncomputable (EITHER GitLab fetch failing yields `null` — a notes-only result on an approvals failure would fail-OPEN on L6); a genuinely empty thread is `[]`, not `null`. |
| `prCommits` | `({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ sha, login, at }>\|null>` | Provider-agnostic PR/MR commit-list read, added issue #358 Q5 Phase 4 to resolve `actor-check.mjs`'s tiered evidence (REQ-L5-1'): `lite`'s distinct-act evidence needs the head commit's timestamp (the last entry's `at`); `regulated`'s no-commit-on-branch evidence needs the full commit-author list. GH: `gh api --paginate repos/{project}/pulls/{number}/commits`, oldest-first (no explicit sort needed, unlike `labelEvents`/`prReviews`); `login` is the commit's account-linked GitHub author (`commit.author.login`, nullable when unlinked). GL: `GET projects/:id/merge_requests/:iid/commits` over `gitlabApiFetch`; `login` normalizes to `null` for EVERY entry — GitLab exposes only free-text `author_name`/`author_email`, and resolving an account would need a second per-commit user lookup this verb does not make (a documented residual: REQ-L5-1'-regulated's evidence is uncomputable on GitLab today, callers must treat an all-null login set as "cannot verify", never "authored zero commits"). `null` = uncomputable (fetch failed, or GitLab's response body is not an array), never a fabricated `[]`. |
| `commitStatus` | `({ project, sha }) -> Status\|null` | Normalized enum (see below). `null` has THREE distinct producers: no checks ran; a value outside the canonical enum; and a **completed** GitHub check whose `conclusion` is `neutral` or `skipped`, which `GITHUB_STATUS_MAP` maps to `null` (`normalize.mjs:24-25`) — indistinguishable from "no checks ran" at the contract boundary. That `null` (a successful call, nothing to report) is distinct from a transport failure, which REJECTS (`exec.mjs:31-32`), neither provider wraps it. Selection asymmetry: GH fetches all check runs and takes `[0]` client-side; GL pushes `per_page=1` server-side (issue #385, M10 Phase 2 — final Gap-A batch). |
| `repoCloneUrl` | `({ host, project, token }) -> string` | Authenticated HTTPS URL. The credential occupies the userinfo **password** position, never the path or query. User literal hidden from the caller: `x-access-token` (GH) / `oauth2` (GL). Host-default divergence: GH falls back to `github.com` when `host` is falsy; GL has **no fallback**, so an omitted host yields a literal `undefined` hostname (latent defect, locked not fixed — issue #385, M10 Phase 2 — final Gap-A batch). |
| `patSetupUrl` | `({ host, name, scopes }) -> string` | PAT creation URL in the browser. **Not a parity verb.** GH ignores `host` entirely and hardcodes `github.com` (breaks GitHub Enterprise Server — latent defect, locked not fixed); GL is host-driven. Query key diverges: GH `description=`, GL `name=`. `scopes` is comma-joined on both. Neither provider URL-encodes `name`/`scopes`, so a name containing `&` or a space produces a malformed URL (latent defect, locked not fixed — issue #385, M10 Phase 2 — final Gap-A batch). |
| `projectResolve` | `({ project }) -> string` | Identity: returns the slug. Both GH and GL address projects by slug/encoded-path, so callers pass the slug everywhere (incl. `repoCloneUrl`). Extension point if a host ever needs a different id. Identity is now contract-locked on both providers (issue #385, M10 Phase 2 — final Gap-A batch); it does not URL-encode — each verb encodes at its own call site, so encoding here would double-encode. |
| `branchProtect` | `({ project, branch?, checks, requiredReviews? }) -> { enforced, reason?, remedy? }` | Apply (or refresh) branch protection. `branch` defaults to `'main'`; `checks` is an array of required check context strings; `requiredReviews` defaults to `1`. Returns `{enforced:true}` on success or `{enforced:false,reason,remedy}` on failure (never throws). GitHub: idempotent `PUT repos/{project}/branches/{branch}/protection` via `gh api --input -`; may return `reason:'tier'` on GitHub Free private repos. GitLab: `POST projects/{enc}/protected_branches` (push_access_level=0, allow_force_push=false); idempotent on 409; never returns `reason:'tier'` (protected branches are free on all GitLab tiers). Approval-count enforcement (requiredReviews) requires GitLab Premium and is not enforced in this slice. |
| `prReviewComment` | `({ project, number, body }) -> Promise<{ url }\|{ url: null, error }>` | Posts a review whose event is **`COMMENT`, hardcoded** (issue #266 lock 2, REQ-266-3) — no parameter, flag, or branch selects a different event. GH: `POST repos/{project}/pulls/{number}/reviews`. GL: no review-state concept on notes — `POST projects/{enc}/merge_requests/{number}/notes`. Never throws. |
| `issueComment` | `({ project, number, body }) -> Promise<{ url }\|{ url: null, error }>` | Posts a plain issue comment — rulings on issues. GH: `POST repos/{project}/issues/{number}/comments`. GL: `POST projects/{enc}/issues/{number}/notes`. Never throws. |
| `labelAdd` | `({ project, number, labels }) -> Promise<{ ok }\|{ ok: false, error }>` | Adds labels. The **caller** enforces the deny-set (REQ-266-9), not the verb. GH: `POST repos/{project}/issues/{number}/labels`. GL: `PUT projects/{enc}/issues/{number}` with `add_labels` (issues-only, matching `labelEvents`). Never throws. |
| `labelRemove` | `({ project, number, labels }) -> Promise<{ ok }\|{ ok: false, error }>` | Removes labels — monotonic-tightening removals only (REQ-266-9). GH: per-label `DELETE .../labels/{label}`, stopping at the first failure (no bulk-remove endpoint). GL: `PUT projects/{enc}/issues/{number}` with `remove_labels`. Never throws. |
| `labelList` | `({ project, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<string[]>` | The remote's full declared label set, normalized to bare name strings (issue #334, vcs-label-preflight contract). Consumed by `vcs/label-preflight.mjs`'s `labelPreflight` as the pre-write conformance check before `mrCreate` — the two providers disagree on an unknown label (GitHub hard-errors, GitLab silently creates it), so this verb + its policy wrapper catch that BEFORE the write. GH: `gh api --paginate repos/{project}/labels?per_page=100` (paginate is load-bearing — a single page can silently drop labels on a >30-label repo). GL: manual page-by-page fetch (`projects/{enc}/labels?per_page=100&page=N`) over `gitlabApiFetch`, stopping once a page comes back short — `gitlabApiFetch` returns only the JSON body (no `Link` header to follow). MAY throw like its sibling normalized READs; `labelPreflight` is the total/never-throws layer, not this verb. |

### Normalized `commitStatus` enum

`'success' | 'failed' | 'running' | 'pending' | 'canceled' | null`

The canonical style is GitLab's. Providers map their native enum to it
(GitHub `failure` → `failed`, `cancelled` → `canceled`, `in_progress` → `running`,
`queued` → `pending`). For GitHub check-runs, the live `status` is used until the
check completes, then its `conclusion`. `null` = no status available. A **completed**
GitHub check whose `conclusion` is `neutral` or `skipped` ALSO maps to `null` — the
same value as "no checks ran" (issue #385, M10 Phase 2 — final Gap-A batch).

## Normalization rules

- **Naming**: `number` (not `iid`), `body` (not `description`), `headBranch` (not
  `source_branch`/`headRefName`), `username` (not `login`).
- **Filters**: `state:'open'` (not `opened`), `assignee:'none'` (not `None`/`assignee_id`).
- **Display**: the reference is shown as `#<number>` for issues and MRs/PRs alike.
- **`projectResolve`**: the caller passes the slug as `project` to every verb. Both
  GitHub and GitLab address projects by slug / URL-encoded path, so it is the identity.
  It stays in the contract as an extension point for a host that needs a different id.

## Label-resolution rule (issue #334)

`brain:ship`'s PR label is sourced VERBATIM from the linked issue's own `type:*` label
(matched provider-agnostically via `/^type::?/` — both GitHub's `type:bug` and GitLab's
scoped `type::bug` forms), never re-mapped, never inferred from the branch or config when
present. Before that label is sent to `mrCreate`, `vcs/label-preflight.mjs`'s
`labelPreflight({ provider, project, label })` confirms it exists in the remote's declared
label set (via `labelList`) — this converts the two providers' divergent unknown-label
behavior (GitHub hard-errors; GitLab silently CREATES the label) into one uniform, local
refusal before the write. `labelPreflight` never throws and never caches: an uncomputable
lookup fails CLOSED (`{ exists: false, error }`), never treated as "label exists".

## How to add a provider

Create `scripts/vcs/providers/<name>.mjs` exporting the 21 verbs and add `<name>` as a
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
| `issueView` | implemented | implemented (A2b — issue #231; contract-pinned issue #334) |
| `labelList` | implemented (issue #334) | implemented (issue #334) |
