# Reviewer setup — `brain:review`

`brain:review` runs as a service-account identity, never as your own token
(protocol §11). It needs ONE credential to reach the VCS API. This doc says
**what**, never the value — see `brain/core/methodology/reviewer-protocol.md`
for why the token is never distributed.

## The env var

- **Name:** `reviewer.tokenEnv` in `brain.config.json` (default
  `BRAIN_REVIEWER_TOKEN`). Git carries this NAME only — never the token value.
- **Where it lives locally:** your shell env, or a gitignored `.env` in the
  repo root (`.env` is already excluded from every commit).
- **Scope:** a Personal/Project Access Token for the reviewer's service
  account, scoped to `repo` (GitHub) or `api` (GitLab) — no admin scopes.

## Getting a token

If `BRAIN_REVIEWER_TOKEN` is unset, `brain:review` refuses to run and prints
a `patSetupUrl` for the active provider — open it, generate a token for the
reviewer service account, and export it:

```bash
export BRAIN_REVIEWER_TOKEN="<paste here — never commit it>"
```

## Who grants access

The reviewer's service account (`reviewer.handle` in `brain.config.json`) is
owned by the repo maintainer. Ask them for:

1. Confirmation the service account exists and is registered.
2. A freshly generated token — tokens are per-operator, not shared.
