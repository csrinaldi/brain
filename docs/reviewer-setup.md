# Reviewer setup — `brain:review`

`brain:review` runs as a service-account identity, never as your own token
(protocol §11). This doc says **what**, never the value — see
`brain/core/methodology/reviewer-protocol.md` for why the token is never
distributed.

**It needs TWO environment variables, both pointing at the same credential.**
Setting only the first one is worse than setting neither — see
[Both vars are load-bearing](#both-vars-are-load-bearing).

## The env vars

| Var | What it does | Read by |
|-----|--------------|---------|
| `BRAIN_REVIEWER_TOKEN` | **Gates the run.** Its name is `reviewer.tokenEnv` in `brain.config.json`. Git carries the NAME only — never the value. | `brain/scripts/review/identity.mjs` |
| `GH_TOKEN` (GitHub) / `GITLAB_TOKEN` (GitLab) | **Authenticates the write.** The verdict is posted through the provider CLI, which uses ambient credentials. | `gh` / `glab` |

- **Where they live locally:** **your shell environment only** — e.g. exported
  from `~/.bashrc`, `~/.zshrc`, or a wrapper script.

  > `brain:review` **does not read `.env`**. Unlike other brain entrypoints, no
  > module under `brain/scripts/review/**` parses the dotenv file; it reads
  > `process.env` directly. A token placed only in `.env` produces
  > `refusing to run — env var "BRAIN_REVIEWER_TOKEN" is not set`, which
  > misdiagnoses its own cause. Tracked on issue #316 (unify the `.env` parsers).

- **Scope:** a Personal/Project Access Token for the reviewer's service account,
  scoped to `repo` (GitHub) or `api` (GitLab) — no admin scopes.

## Getting a token

If `BRAIN_REVIEWER_TOKEN` is absent from the environment, `brain:review` refuses
to run and prints a `patSetupUrl` for the active provider. Open it, generate a
token for the reviewer service account, and export **both** vars:

```bash
TOK="<paste here — never commit it>"
export BRAIN_REVIEWER_TOKEN="$TOK"   # gates the run
export GH_TOKEN="$TOK"               # authenticates the write (GitLab: GITLAB_TOKEN)

npm run brain:review -- --pr <n>
```

## Both vars are load-bearing

`BRAIN_REVIEWER_TOKEN` is a **gate-only** credential today: it never reaches the
write path. `prReviewComment`
(`brain/scripts/vcs/providers/github.mjs`) takes `({ project, number, body })` —
no token parameter — and shells out to `gh api`, which authenticates with
whatever credentials are ambient.

So if you export only `BRAIN_REVIEWER_TOKEN`:

1. `identity.mjs` sees the token, and `reviewer.handle` is set, so the **§10
   self-review guard compares the configured handle against the PR author,
   finds them different, and PASSES**.
2. The verdict nevertheless posts as whoever the provider CLI is logged in as.
3. If that happens to be the PR author, the guard has reported itself satisfied
   over a self-review.

That is strictly worse than the honest `self-review guard inactive` warning it
replaces, because the failure is **silent**. Export both, or export neither.

### Verify before trusting a verdict

After a run, confirm the posting identity is the service account and that the
review is COMMENT-state (never APPROVED — locks 1 and 2):

```bash
gh api "repos/<owner>/<repo>/pulls/<n>/reviews" \
  --jq '.[-1] | .user.login + " | " + .state'
```

## Who grants access

The reviewer's service account (`reviewer.handle` in `brain.config.json`) is
owned by the repo maintainer. Ask them for:

1. Confirmation the service account exists and is registered in
   `governance.reviewActors` — **and never in `governance.approvalActors`**
   (§3 / §11: registering it there would authorize it to apply
   `status:approved`, the merge keystroke).
2. A freshly generated token — tokens are per-operator, not shared.

## Operating rules for the reviewer credential

1. **Use it for `brain:review` only.** Never drive the web UI, merges, labels,
   or approvals under the reviewer session. Governance outcomes depend on which
   identity acts: an APPROVED review from the reviewer identity on a
   `brain/core/**` or `brain/project/**` change either satisfies L6 as the human
   signature (if it is missing from `reviewActors`) or fails L6 (if it is
   present) — and label actions taken under it are attributed to the service
   account in `brain:metrics`.
2. **Never let the reviewer approve a `brain/**` change.** Tier 2 requires a
   human signature distinct from the author; the reviewer is not it.
