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

> **This shape is a ruling, not a workaround** — ADR-0033 Amendment 1 (#773).
> Letting `brain:review` read the reviewer token from `.env` was proposed and
> **refused**: it would move brain's poster credential off the warrant table's only
> `by construction` row, and `reviewer-protocol.md` §2's three structural locks all
> live behind that credential. The supported answer to the ergonomics is a session
> that carries the value — the file below, or the workflow engine that starts once
> and runs every SDD stage in-process. Exporting once per session is the price, and
> it is the decision rather than an omission.

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

**And the trap on the OTHER side, which INVERTED on 28/08/2026.** The two halves
of brain used to read the environment in opposite directions, and that asymmetry
is what cost a session. It no longer exists — but the failure it produced does,
pointing the other way, so it is worth knowing which shape you are looking at.

**Until #316:** every port verb read `.env` FIRST and fell back to the shell only
when the key was absent from the file. So a value you exported was silently
ignored whenever `.env` already defined the same key, and a DEAD line in `.env`
shadowed a healthy credential. Measured 27/08/2026: `gh auth status` reported a
perfectly good login while every port verb answered `HTTP 401 Bad credentials`.
Removing the value was not enough — the fallback applied only when the KEY was
gone.

**Since #316:** there is one reader (`brain/scripts/lib/env-read.mjs`) and one
precedence — **the shell wins**, then `.env`, then a default. So:

```bash
VCS_TOKEN="$SOME_OTHER_TOKEN" npm run brain:review -- --pr 598
```

now does what it looks like it does. And the losing value is REPORTED rather
than dropped: `resolveEnv` returns `shadowed` when both places hold different
values, so a run can say that two were in play instead of silently picking one.

Three things worth carrying forward:

- **`BRAIN_REVIEWER_TOKEN` is still shell-only, and that is a ruling** — ADR-0033
  Amendment 1 (#773), see the top of this document. The shared reader has a named
  spelling for it, `readShellEnv`, so the exception is visible at the call site
  rather than buried in an options object.
- **A mistyped key is still a key nothing looks up.** `BRAIN_REVIEWER_TOKE=Nghp_…`
  — the `N` on the wrong side of the `=` — declares a variable no lookup asks for.
  What changed is that it no longer disables a whole line by prefix accident:
  `parseEnvFile` splits on the first `=` and trims both halves, so `KEY = value`
  now resolves where it used to produce the unreachable key `"KEY "`.
- **Quoted values are now unquoted.** `VCS_TOKEN="ghp_…"` used to resolve WITH the
  quotes attached and produce a 401 that named nothing. One matched pair of
  surrounding quotes is stripped; unmatched and inner quotes are left alone.

Since issue #631 the reviewer's gate read no longer falls back to `VCS_TOKEN` at
all: every gather in `brain:review` runs under the bound reviewer identity.

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
measured, with every name `credentialEnvNames()` returns unset, `gh auth status`
still reported a logged-in account.

`producer-forge-reach.mjs` is what closes that gap, and it **refuses the run**
rather than proceeding — so a machine where a forge CLI still authenticates will
see the cold-review stage decline to spawn and say the producer can still reach
the forge. That refusal is correct, and the fix is not to bypass it.

**Since #775 the stage tries first, so on most machines you do not have to do
anything.** Before probing, the stage creates a per-run, disposable directory and
points `GH_CONFIG_DIR` and `GLAB_CONFIG_DIR` at it — for the probe and for the
producer's spawn alike. The secret stays in your keyring untouched; the CLI
simply can no longer find the host mapping that would make it ask. Measured
27/08/2026 on a logged-in machine: `reachable` without the shadow, `closed` with
it, and `gh auth status` unchanged afterwards.

The probe remains the reader. If the shadow does not close the channel on your
deployment, the run still refuses, and then the remedy is the original one:

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
