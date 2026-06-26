# Design — VCS Adapter

> How the [proposal](proposal.md) is implemented. Technical decisions and refactor mapping.

## Architecture

Mirror of the memory adapter (ADR-0004):

```
brain.config.json  { "vcs": { "provider": "github" } }
        │
        ▼
scripts/vcs/cli.mjs            ← dispatcher: reads vcs.provider, imports the backend
        │
        ├── providers/github.mjs   ← gh
        └── providers/gitlab.mjs   ← glab (parity with current behavior)
        ▲
brain/core/methodology/vcs-contract.md   ← verb contract (what each provider must implement)
```

The dispatcher can be used as a library (`import { vcs } from './vcs/cli.mjs'` → object with the verbs) and as a CLI (`node scripts/vcs/cli.mjs <verb> [args]`) for `.sh` callers.

## Provider interface

Each `providers/<x>.mjs` exports one function per verb. Signatures and **normalized shapes** (the caller never sees provider-specific fields):

```js
// Identity / auth
authCheck({ host }) -> boolean
authLogin({ host, token }) -> boolean          // token via stdin internally
whoami() -> { username }                        // GL .username / GH .login → username

// Issues
issueView({ project, number }) -> { number, title, labels: string[], body }
issueList({ project, state, assignee }) -> [{ number, title, labels: string[] }]
   // assignee: 'me' | 'none' | undefined ; state: 'open' (normalized)

// MRs / PRs
mrList({ project, state }) -> [{ number, title, headBranch }]

// CI
commitStatus({ project, sha }) -> 'success'|'failed'|'pending'|'canceled'|null   // normalized enum

// Infra
repoCloneUrl({ host, project, token }) -> string   // authenticated HTTPS URL
patSetupUrl({ host, name, scopes }) -> string      // PAT creation URL in the browser
projectResolve({ project }) -> string|number       // GH: identity (slug); GL: numeric id
```

## Normalization (case by case)

| Verb | GitLab | GitHub | Normalized |
|---|---|---|---|
| `whoami` | `.username` | `.login` | `username` |
| `issueView`/`issueList` | `iid`, `description` | `number`, `body` | `number`, `body` |
| `issueList` filters | `state=opened`, `assignee_id=None` | `state=open`, `assignee=none` | `state:'open'`, `assignee:'none'` |
| `mrList` | `merge_requests`, `iid`, `source_branch`, `!NNN` | `pulls`, `number`, `headRefName`, `#NNN` | `number`, `headBranch`, display `#NNN` |
| `commitStatus` | `success/failed/running/pending/canceled` | check-runs `success/failure/...` or statuses `state` | GitLab-style enum (GH `failure`→`failed`, `cancelled`→`canceled`) |
| `repoCloneUrl` | `oauth2:<token>@` | `x-access-token:<token>@` | provider-specific, hidden from caller |
| `projectResolve` | `glab api projects/<slug>` → id | no-op (direct slug) | caller uses the opaque return as "project" |
| `patSetupUrl` | `/-/user_settings/personal_access_tokens?scopes=api` | `/settings/tokens/new?scopes=repo` | provider-specific |

**`gitProjectId`**: currently used only by `project-status.mjs`. With the adapter, `projectResolve` provides the identifier; the config field remains as an optional hint (GitLab) and irrelevant (GitHub).

## Refactor mapping (which verbs each script uses)

| Script | Verbs it will use | Risk |
|---|---|---|
| `tracker-board.mjs` | `authCheck`, `whoami`, `projectResolve`, `issueList` | low (read-only) |
| `project-status.mjs` | `authCheck`, `issueList`, `mrList` | low (read-only) |
| `day-start.mjs` | `authCheck`, `authLogin`, `whoami`, `commitStatus`, `repoCloneUrl` | medium (auth + sync) |
| `ticket-start.mjs` | `issueView`, `repoCloneUrl` (+ `iid`→`number` in branch naming) | medium |
| `bootstrap.sh` | `authCheck`, `authLogin`, `patSetupUrl`, `issueList`, credential helper | high (cross-cutting, sh) |
| `install-tools.sh` | installs `gh` vs `glab` based on provider | low |

## Chained PR plan

The complete adapter exceeds 400 lines and touches critical scripts. It is delivered in chained PRs, each independently mergeable and revertible:

1. **PR1 — Foundation (additive, zero behavior change):** `vcs-contract.md` (core) + v0.2.0 migration (`vcs.provider`) + dispatcher `cli.mjs` + provider skeletons + normalization helpers + dispatcher/migration tests.
2. **PR2 — Providers:** `github.mjs` + `gitlab.mjs` with the 10 verbs, tests against the contract. Without touching callers yet.
3. **PR3 — Read-only callers:** `tracker-board.mjs` + `project-status.mjs`.
4. **PR4 — Auth + sync:** `day-start.mjs` (+ `whoami`/`commitStatus`/`authLogin`).
5. **PR5 — Ticket:** `ticket-start.mjs` (`iid`→`number`).
6. **PR6 — Bootstrap + tools:** `bootstrap.sh` (credential helper, `patSetupUrl`) + `install-tools.sh`.

PR1 and PR2 do not change observable behavior → safe to merge first. The caller refactor (PR3+) replaces `glab`/curl with the dispatcher while keeping the `gitlab` provider as parity.
