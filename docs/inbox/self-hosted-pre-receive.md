# Self-Hosted `pre-receive` Hard Gate

## What It Enforces

The `pre-receive` hook enforces the same commit-message invariants as the
client-side `commit-msg` hook, but as a **server-side hard gate** that applies
to every push:

1. **Conventional Commits format** — `<type>[(<scope>)][!]: <description>`
   Types: `feat | fix | docs | style | refactor | perf | test | chore | build | ci | revert`

2. **Ticket reference** — the message (or body) must contain `#N`.

Commits that are exempt from the ticket-reference check (machine-generated,
legitimately ticket-less):
- `Merge …` and `Revert …` — also exempt from format check
- `chore(release): …` — release cuts
- `chore(memory): …` — brain memory syncs

## Why This Is the Only Bypass-Proof Gate

`--no-verify` is a **client-side flag** — it skips local hooks (`commit-msg`,
`pre-commit`, `pre-push`) but has no effect on server-side hooks. A
`pre-receive` hook running on the git server will always execute for every
incoming push, regardless of any client flags.

This makes it the only truly platform-neutral, bypass-proof enforcement
mechanism for commit-message policies.

| Layer | Hook | Bypassable with `--no-verify`? |
|-------|------|-------------------------------|
| Client | `commit-msg` | Yes |
| Client | `pre-push` | Yes |
| **Server** | **`pre-receive`** | **No** |

## Install — Bare Repo / Self-Hosted Git

```sh
npm run brain:protect-server -- /path/to/repo.git
```

This copies `brain/scripts/hooks/pre-receive` into
`/path/to/repo.git/hooks/pre-receive` and sets it executable (`chmod 0755`).

The hook requires only `sh`, `git`, and `grep` — no Node.js or external
tooling on the server.

### Validate

```sh
# The file must exist and be executable.
ls -la /path/to/repo.git/hooks/pre-receive
```

## Install — GitLab Self-Hosted (Manual)

GitLab calls these "server hooks" and they need to be placed on the GitLab
server itself (requires admin/root access):

**Per-project hook:**
```
/var/opt/gitlab/git-data/repositories/<group>/<repo>.git/custom_hooks/pre-receive
```

**Global hook (applies to all repositories):**
```
/opt/gitlab/embedded/service/gitlab-shell/hooks/pre-receive.d/<hookname>
```

See the [GitLab server hooks documentation](https://docs.gitlab.com/ee/administration/server_hooks.html)
for the exact paths and configuration.

> **Note:** Automating the GitLab server-hook installation (e.g. via the GitLab
> API or Ansible) is a deferred follow-up. The current `brain:protect-server`
> command targets bare repos and self-hosted Gitea/Gitosis/plain-git setups
> where you have direct filesystem access.

## Ladder Awareness (GitLab)

`npm run brain:governance-status` reports rung-1 as three honestly-distinguished
sub-gates on GitLab: `merge gate` and `push gate` are API-verified (read
directly from GitLab), while `pre-receive` — the server hook described above —
is **not remotely detectable**. When `vcs.selfHostedPreReceive: true` is set in
`brain.config.json`, the report renders:

```
  pre-receive    armed (config-declared) — not remotely detectable; verify via install runbook (npm run brain:protect-server)
```

No GitLab API reports whether a `custom_hooks/pre-receive` script is actually
installed on a bare repository, so this line is a **declaration**, not a
**verification**. The runbook above (Install — GitLab Self-Hosted) is how you
confirm what the ladder itself cannot probe — install the hook per the manual
steps, then treat the config flag as your own attestation that you did.

## Limitations

The `pre-receive` hook can only inspect **what is in the pushed commits** — it
has no access to pull-request context (labels, PR body, linked issues). This
means the following checks cannot be enforced here:

- `size:exception` label presence
- PR-body issue link
- Any review-gate metadata

Those checks require the platform's API (GitHub Actions, GitLab CI pipelines,
Merge Request rules) and are handled separately by brain's governance layer.

The `pre-receive` hook enforces only the commit-message invariants: format
and ticket reference.
