# VCS Adapter Contract

> **status:** current | **last-reviewed:** 2026-06-26 | **owner:** @crinaldi

> **Purpose:** defines the abstract verbs that any VCS provider must implement
> so the harness can operate over GitHub, GitLab, or another host without
> touching the scripts. Referenced by ADR-0008.

The active provider is chosen via `vcs.provider` in `brain.config.json` (explicit,
repo-level — see ADR-0008). The dispatcher `scripts/vcs/cli.mjs` reads that key and
delegates to `scripts/vcs/providers/<provider>.mjs`. Credentials live in `.env`
(`GITHUB_TOKEN` / `GITLAB_TOKEN`), never in the config.

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
| `issueView` | `({ project, number }) -> { number, title, labels, body }` | GL `iid`/`description` → `number`/`body`. |
| `issueList` | `({ project, state, assignee }) -> [{ number, title, labels }]` | `state:'open'`, `assignee:'me'\|'none'\|undefined`. |
| `mrList` | `({ project, state }) -> [{ number, title, headBranch }]` | GL `merge_requests`/`source_branch` → `headBranch`. |
| `commitStatus` | `({ project, sha }) -> Status\|null` | Normalized enum (see below). |
| `repoCloneUrl` | `({ host, project, token }) -> string` | Authenticated HTTPS URL. User literal hidden from the caller. |
| `patSetupUrl` | `({ host, name, scopes }) -> string` | PAT creation URL in the browser. |
| `projectResolve` | `({ project }) -> string` | Identity: returns the slug. Both GH and GL address projects by slug/encoded-path, so callers pass the slug everywhere (incl. `repoCloneUrl`). Extension point if a host ever needs a different id. |

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

Create `scripts/vcs/providers/<name>.mjs` exporting the 10 verbs and add `<name>` as a
valid value of `vcs.provider`. The callers are not touched.

## Current implementation

`github` (`gh`) and `gitlab` (`glab`). The `gitlab` provider reproduces the historical
behavior of the scripts (parity — a revert leaves the GitLab flow intact).
