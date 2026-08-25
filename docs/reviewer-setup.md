# Reviewer setup — `brain:review`

`brain:review` runs as a service-account identity, never as your own token
(protocol §11). This doc says **what**, never the value — see
`brain/core/methodology/reviewer-protocol.md` for why the token is never
distributed.

**`BRAIN_REVIEWER_TOKEN` is the one that matters.** It gates the run AND, since
#501, authenticates the write. The forge var is a fallback for unbound callers —
see [What the binding changed](#what-the-binding-changed) for what this section
used to claim and why it was wrong.

## The env vars

| Var | What it does | Read by |
|-----|--------------|---------|
| `BRAIN_REVIEWER_TOKEN` | **Gates the run.** Its name is `reviewer.tokenEnv` in `brain.config.json`. Git carries the NAME only — never the value. | `brain/scripts/review/identity.mjs` |
| `GH_TOKEN` (GitHub) / `GITLAB_TOKEN` (GitLab) | **A fallback, no longer the write path.** Since #501 the reviewer credential is BOUND to the port and reaches `gh`/`glab` on its own — see [What the binding changed](#what-the-binding-changed). Still worth setting for the non-reviewer verbs, which are not bound. | `gh` / `glab` |

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
export BRAIN_REVIEWER_TOKEN="$TOK"   # gates the run AND authenticates the write
export GH_TOKEN="$TOK"               # fallback for unbound callers (GitLab: GITLAB_TOKEN)

npm run brain:review -- --pr <n>     # the `--` is required: without it npm eats the flag
```

## Making it survive a new terminal

`export` lasts as long as the shell. A new terminal starts with neither var and
`brain:review` refuses again — correctly, since it cannot tell an unset token
from a revoked one.

Keep the value in a file only you can read, and source it when you need it:

```bash
mkdir -p ~/.config/brain && touch ~/.config/brain/reviewer.env
chmod 600 ~/.config/brain/reviewer.env
```

```bash
# ~/.config/brain/reviewer.env — NOT in any repo
export BRAIN_REVIEWER_TOKEN="<token>"
export GH_TOKEN="$BRAIN_REVIEWER_TOKEN"
```

Then either source it per session, or add a function to your shell rc so the
token is loaded deliberately rather than sitting in every shell you open:

```bash
brain-reviewer() { . ~/.config/brain/reviewer.env; }
```

**Do not put the token directly in `~/.bashrc`.** Not because the file is
readable — it is yours — but because every process you start inherits it,
including editors, language servers and any agent you run. The reviewer
credential is scoped to `repo`; the fewer processes holding it, the smaller the
surface, and `brain:review` needs it for the length of one command.

**A `.env` file does not work here, and the error misdiagnoses itself.**
`brain:review` reads `process.env` directly — no module under
`brain/scripts/review/**` parses dotenv. A token placed only in `.env` produces
`refusing to run — env var "BRAIN_REVIEWER_TOKEN" is not set`, which names the
symptom and not the cause. Tracked on issue #316.

## What the binding changed

**This section used to be called "Both vars are load-bearing" and its reasoning
is no longer true of the code.** It argued that `BRAIN_REVIEWER_TOKEN` was a
*gate-only* credential which "never reaches the write path", because
`prReviewComment` takes no token parameter and `gh api` authenticates with
whatever is ambient. That was correct when it was written. #501 bound the
identity to the port, and the doc did not follow.

What the code does now — `github.mjs`:

```js
function ghOpts(opts = {}) {
  const identity = currentIdentity();
  if (!identity) return opts;
  return { ...opts, env: { ...process.env, GH_TOKEN: identity, ...(opts.env ?? {}) } };
}
```

Every `gh` invocation in the provider runs through this, and the review path
binds: `review/cli.mjs` builds its port as `getVcs({ identity: identity.token })`
and hands that same bound port to cold boot AND to the poster. So the reviewer
credential IS injected as `GH_TOKEN` for the call, and it **wins over an ambient
one** — it is spread before `opts.env`, not after.

GitLab resolves the same way, with the precedence written out — `gitlab.mjs`:

```js
const glToken = (token) => token ?? currentIdentity() ?? vcsToken(PROVIDER);
```

An explicit token first (so `whoami()` can verify a credential OTHER than the
bound one — that is what the #604 negative control needs), then the bound
identity, then the generic credential every non-reviewer caller keeps using.
Both providers are pinned on the source by `identity.drift.test.mjs`: a verb that
called `run('gh', …)` directly, or resolved `vcsToken(PROVIDER)` inline, would
bypass the binding and still pass every behavioural test.

**So the old warning inverts.** It said exporting only `BRAIN_REVIEWER_TOKEN`
would let the §10 guard report itself satisfied while the verdict posted as
whoever the CLI was logged in as. With the binding in place that is exactly what
CANNOT happen on the review path: the write goes out under the credential the
guard checked. Setting the forge var is now belt-and-braces, not load-bearing.

### A keyring session is NOT covered by any of this

`gh auth login` stores its credential in the OS keyring, which is not an
environment variable and cannot be removed by scrubbing one. That matters
because `runStage` hands the cold-review producer an environment with the
credential names stripped, and a keyring session survives it untouched:
measured, with all seven names unset, `gh auth status` still reported a
logged-in account.

`producer-forge-reach.mjs` is what closes that gap, and it **refuses the run**
rather than proceeding — so on a machine with a `gh auth login` session, the
cold-review stage will decline to spawn and say the producer can still reach the
forge. That refusal is correct, and the fix is not to bypass it:

```bash
gh auth logout                  # drop the keyring session
export GH_TOKEN="$TOK"          # authenticate by environment instead
```

The environment is reachable by the scrub; the keyring is not. **On the machine
that runs the cold review, a token in the environment is not a convenience — it
is what makes the isolation possible at all.**

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
