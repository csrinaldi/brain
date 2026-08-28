# Two credentials, one session: transparent coexistence

> ## ⚠️ SNAPSHOT — a design proposal, not the source of truth
>
> Written 2026-08-26, during the session that landed #766 and #631, after
> `gh auth logout` broke `gh pr create` and three `brain:review` runs refused on a 401.
>
> **Nothing here is implemented.** The source of truth for any part of it is the
> issue that owns it — **#316** (unify the `.env` parsers) above all, then #501,
> #413, #604, #631, #327. On any conflict, the issues win. This file exists for
> the `file:line` evidence and the reasoning that does not belong in an issue body.
>
> It answers one question, asked by the maintainer: *how do `VCS_TOKEN` and
> `BRAIN_REVIEWER_TOKEN` coexist so a developer sees SDD stages hand off without
> setting anything?*
>
> **The short answer: the port already does it.** What is missing is a uniform
> way to reach it. Most of that is plain implementation work. The last step — the
> one that actually delivers *"set nothing"* — is not: it moves brain's poster
> credential off the only **by-construction** row in ADR-0033's warrant table, and
> that is a decision the table has to record, not a refactor.
>
> ### What this document produced, filed 2026-08-26 and after
>
> The reading below was the input to three tickets, and the split in *Proposal*
> step 1 became a gate on the M5 → M8 line:
>
> - **#773** — the ruling on 1b, and **Compuerta 6** in `ROADMAP-M5-M8.md` §3.
>   It goes before #316, because #316 is already approved and a refactor that
>   delivers 1b by accident reads as plumbing in review.
> - **#772** — ADR-0033's post-run tree check, which exists only as a test.
>   Orthogonal to 1b: it detects a producer that CHANGED the tree and says
>   nothing about one that READ a credential.
> - **#775** — measured after this document was written, on a logged-in machine:
>   the cold-review stage refuses wherever a forge CLI still authenticates.
>
> `docs/inbox/cold-review-as-product-stage.md` carries the **proposed** ruling for
> #773 — no to 1b — reached by writing down the product model this document's
> question came from. It is a proposal there and a decision only in #773.

---

## The premise that turned out to be false

> *"desde la misma sesión el que está logueado siempre gana"*

It does not. `brain/scripts/vcs/providers/github.mjs:44-47` states the rule and
the code implements it:

> `GH_TOKEN` takes precedence over gh's keyring auth, and it is set on the CHILD
> env only: `gh auth login --with-token` would mutate the operator's machine-wide
> gh state as a side effect of running a review, and race any concurrent gh use.

**Measured today.** With `gh auth status` reporting *"You are not logged into any
GitHub hosts"*:

```
$ node brain/scripts/vcs/cli.mjs whoami
{"username":"csrinaldi"}
```

and PR #771 was created through `mr-create` on the same logged-out shell. The
ambient session is not consulted at all when the port has a credential.

So the coexistence the question asks for **already exists in the port.** What
does not exist is a *uniform* way to reach it.

---

## How it resolves today

```
                        ┌─ explicit identity ──→ bindIdentity(mod, identity)
getVcs({ identity? })  ─┤                              │
                        └─ no identity ──→ _token() ───┤
                                          (VCS_TOKEN)  │
                                                       ▼
                                     every verb runs inside runAsIdentity
                                                       │
                                                       ▼
                            github.mjs chokepoint: env { GH_TOKEN: identity }
                                     on the CHILD process only
```

`vcs/cli.mjs:139` — *"An explicit `identity` always wins — the reviewer verifies
and writes as a specific credential and must not be silently redirected to the
generic one."*

| role | variable | resolved by | reads |
|---|---|---|---|
| author / operator | `VCS_TOKEN` | `vcsToken()` → `readEnvVar` | **`.env` first**, then `process.env` |
| reviewer | `BRAIN_REVIEWER_TOKEN` | `identity.mjs:144` | **`process.env` only** |

That last row is the whole problem.

---

## The hard constraint: on a cold-review machine, logging in is not an option

This was found late, and it removes an option the design was implicitly keeping
open. `docs/reviewer-setup.md` §*A keyring session is NOT covered by any of this*:

> `gh auth login` stores its credential in the OS keyring, which is not an
> environment variable and cannot be removed by scrubbing one. […]
> `producer-forge-reach.mjs` is what closes that gap, and it **refuses the run**
> rather than proceeding — so on a machine with a `gh auth login` session, the
> cold-review stage will decline to spawn.
>
> ```bash
> gh auth logout                  # drop the keyring session
> export GH_TOKEN="$TOK"          # authenticate by environment instead
> ```

The cold-review producer runs with the credential names stripped from its
environment. A keyring session survives that scrub — measured: with every name
`credentialEnvNames()` returns unset, `gh auth status` still reported a logged-in
account. So the isolation is only real when there is **no keyring session at
all**.

Two consequences the design must absorb:

1. **`gh auth login` is not a fallback for anything.** Not for the author role,
   not for opening PRs, not "just this once". A developer who logs in to fix a
   credential problem silently disarms the cold-review stage on that machine.
2. **Every role must therefore resolve from something other than the keyring.**
   The doc says it outright: *"On the machine that runs the cold review, a token
   in the environment is not a convenience — it is what makes the isolation
   possible at all."*

   Read that sentence carefully, because it is easy to over-extend and this
   document did on its first pass. It rules out the **keyring**. It says nothing
   about a **file** — and the environment is exactly what the producer's scrub can
   reach, while a file is not. So this constraint pushes toward *"export it"*, not
   toward *"put it in `.env`"*. It is an argument for step **1a**, and if anything
   an argument against **1b**.

This also explains a symptom that looked like breakage during the session that
produced this document: `gh pr create` failed with *"You are not logged into any
GitHub hosts"* while `node vcs/cli.mjs mr-create` created PR #771 on the same
shell, the same minute. The logged-out state was **correct and deliberate** — the
documented procedure — and the only thing wrong was reaching for raw `gh` instead
of the port. That is Gap B below, and it is the gap most likely to be hit by a
human following a habit.

## The four gaps, each measured

### Gap A — two different environment readers

`brain/scripts/review/identity.mjs:144`

```js
const readEnv = deps.readEnv ?? (() => process.env);
```

`brain/scripts/vcs/lib/token.mjs:27-35`

```js
export function readEnvVar(key, root = process.cwd()) {
  try {
    const line = readFileSync(join(root, '.env'), 'utf8')
      .split('\n').find(l => l.startsWith(`${key}=`));
    if (line) return line.slice(key.length + 1).trim();
  } catch { /* no .env */ }
  return process.env[key] ?? null;
}
```

`VCS_TOKEN` may live in `.env`. `BRAIN_REVIEWER_TOKEN` **may not** — it must be
exported into the shell, and `docs/reviewer-setup.md` documents that as a
feature. This is the direct cause of *"el usuario tiene que estar seteando
cosas"*, and it cost most of a session today: a `.env` edit that could not
possibly take effect, three times.

Issue **#316** owns unifying the four `.env` parsers. This is its concrete harm.

### Gap B — raw `gh` escapes the model entirely

`gh pr create` failed on the logged-out shell; `node vcs/cli.mjs mr-create`
succeeded on the same shell, same second. Anything that shells out to `gh`
directly — a script, a doc's copy-paste line, an agent — leaves the credential
model without a word.

`SUBCOMMAND_PORT_REACH` (#569) is the existing shape for "does this reach the
port"; nothing equivalent guards *"does this bypass it"*.

### Gap C — shadowing and typos are silent, in both directions

- `.env` wins over the shell for port verbs, with no message. The workaround an
  operator reaches for (`VCS_TOKEN=… npm run …`) is ignored when `.env` defines
  the key. (#631 aggravating factor; now documented.)
- The match is `startsWith("KEY=")`, so a mistyped key disables the line and
  falls through to `process.env` with **no message**. Observed live today:
  `BRAIN_REVIEWER_TOKE=N<token>` — the `N` on the wrong side of the `=`.

### Gap D — no way to ask "which credential am I about to use?"

Diagnosing today required hand-written `node -e` one-liners to fingerprint
tokens. There is no verb that answers, per role: which variable, read from
where, resolving to which login.

---

## Proposal

### 1. One reader, one precedence — everywhere

Route `identity.mjs` through the same reader as the port, so both roles resolve
by one code path with one stated precedence, and Gap C's silence is closed: when
a key exists in both `.env` and the shell and the values differ, say so.

**This splits, and the split is the whole decision** — see *The blocker on step 1*:

- **1a** — one reader, one precedence, one refusal shape, and the reviewer token
  **still resolved from the shell only**. Pure implementation. Changes no warrant.
- **1b** — the reviewer token becomes readable from a file. This is what delivers
  *"the developer sets nothing"*, and it moves brain's poster credential off
  ADR-0033's only by-construction row. **ADR amendment, not an implementation
  ticket.**

> **RULED — 1a yes, 1b no.** ADR-0033 Amendment 1 (#773). The transparency 1b was
> meant to buy is delivered by the session boundary instead: a workflow engine
> started by the developer carries the credential in-process to every stage, so
> the producer still receives it scrubbed and the by-construction row stands. The
> accepted loss is one export per session. Not covered by that ruling, and named
> in it: an engine started **unattended** would have to read the credential from
> disk, which is 1b under another name.

Issue **#316** owns unifying the four `.env` parsers, which is 1a's mechanism.
1b is not #316's to decide and must not ride along inside it.

### 2. Credentials keyed by ROLE, not by variable name

`brain.config.json` already names one:

```json
"reviewer": { "handle": "csrinaldibot", "tokenEnv": "BRAIN_REVIEWER_TOKEN" }
```

Generalize it so every actor is declared the same way:

```json
"credentials": {
  "author":   { "tokenEnv": "VCS_TOKEN" },
  "reviewer": { "tokenEnv": "BRAIN_REVIEWER_TOKEN", "handle": "csrinaldibot" }
}
```

Entrypoints then declare the ROLE they act as — `getVcs({ role: 'reviewer' })` —
and the resolution table stops being folklore. An SDD stage that hands off to the
next declares its role; nothing about which variable to set reaches the developer.

**This must not become a second declaration of what the code decides** — the
`RECOGNISED_OUTCOMES` class (#759). The map is the single source; no call site
may name a variable directly.

### 3. Refusals name the ROLE, the SOURCE, and the RESOLVED identity

Today: `env var "BRAIN_REVIEWER_TOKEN" is not set`.

Proposed shape:

```
brain:review: refusing to run — role "reviewer" has no usable credential.
  variable : BRAIN_REVIEWER_TOKEN  (from brain.config.json credentials.reviewer)
  .env     : present, but the key reads "BRAIN_REVIEWER_TOKE" — likely a typo
  shell    : absent
  resolved : nothing
```

Every fact in that block was one I had to derive by hand today.

### 4. `brain:credentials` — the doctor verb

```
$ npm run brain:credentials
role      variable               source   login          writes?
author    VCS_TOKEN              .env     csrinaldi      yes
reviewer  BRAIN_REVIEWER_TOKEN   shell    ✗ 401 Bad credentials
```

One call per role. It answers the question that cost the session.

**Caveat that must be designed in:** `identity.mjs`'s #604 negative control sends
one deliberately-invalid credential per run, and repeated invalid attempts are
what trigger GitHub's lockout — `cli.mjs:337-347` says so and warns *"it may have
caused this itself"*. A doctor verb that probes on every invocation must not
become the thing that locks the account out. Probe on demand, not on every run.

### 5. A guard against bypassing the port

A check in the shape of `SUBCOMMAND_PORT_REACH`: no script under `brain/scripts/**`
invokes `gh`/`glab` outside `vcs/providers/**`. Today that rule exists as a
convention and as a comment; the one place it was violated this session was a
human at a terminal, which the guard would not catch — but the docs' copy-paste
lines would be.

---

## Sequencing

| step | depends on | kind | why here |
|---|---|---|---|
| 1a. one reader, reviewer token still shell-only | — | implementation | unblocks everything below without touching the warrant table |
| 5. bypass guard | — | implementation | independent, cheap, keeps 1a true |
| 4. doctor verb | 1a | implementation | needs a single resolution path to report on |
| 2. role map | 1a | config | safe only once resolution is unified |
| 3. refusal shape | 1a, 2 | implementation | the message quotes the role map |
| **1b. the reviewer token becomes file-readable** | 1a | **ADR amendment** | this is the one that delivers "set nothing", and the one with a price — see *The blocker on step 1* |

**Read the kind column before the order.** Everything except 1b is implementation
work that changes no decision. 1b is a decision about ADR-0033's warrant table
and must not be smuggled in as part of an implementation ticket: an "unify the
parsers" PR that happens to make `BRAIN_REVIEWER_TOKEN` readable from `.env`
would move the poster credential off the table's only by-construction row, and
the diff would look like a refactor.

1a through 5 make the credential model **diagnosable and hard to bypass** — which
is most of the pain measured in the session that produced this document. They do
**not** deliver *"ya todo debería estar en el env"*. Only 1b does, and 1b is not
free.

---

## The blocker on step 1, stated precisely

> **This section corrects an earlier draft of this document**, which said step 1
> was blocked by "ADR-0033's open question" and pointed at the two closures that
> ADR names. That conflated two unrelated things. The correction is the point of
> the section, so it is kept rather than quietly rewritten.

### Two different exposures, and only one of them is ADR-0033's open question

| | what it is about | what would detect it |
|---|---|---|
| **ADR-0033's open question** | a producer that **edits code** on its way past | a post-run check of the operator's tree: `git status --porcelain` shows exactly one new untracked entry, at the artifact path, HEAD and index unmoved |
| **the blocker on step 1** | a producer that **reads a credential from a file** | nothing above; the tree check never looks at what was read |

ADR-0033's two named closures — a kernel-enforced confinement (which ADR-0005
forbids assuming) and the post-run tree check — both answer *"did the producer
change anything?"*. Neither answers *"did the producer read `.env`?"*. **Building
the tree check would not unblock step 1 by a single line.**

### What step 1 actually costs

ADR-0033's warrant table has one row carrying a kernel-level guarantee:

| channel | closed by | warrant |
|---|---|---|
| brain's poster credential in the environment | `withoutCredentials` — `spawnSync` hands the child an explicit `env` | **by construction**: the kernel, which does not consult the child |

`withoutCredentials` removes credential **names from the environment**. A file on
disk is not an environment variable, and the fifth cold review measured that the
producer reaches one:

> *"`cwd` is not a confinement. `defaultRun` sets `spawnSync`'s `cwd` and nothing
> else; there is no chroot, no sandbox flag anywhere in the arg list. […]
> Measured: `test -f <operator tree>/.env` returns TRUE from the producer."*
> — `credential-env.mjs:46-60`, and ADR-0033's worktree row, `by cost, not by construction`

So making `BRAIN_REVIEWER_TOKEN` readable from `.env` **moves the poster
credential out of the by-construction row and into the by-cost row**. That is not
a widening at the margin: it is the removal of the only kernel-enforced guarantee
the table has, and the credential it protects is the one `reviewer-protocol.md`
§2's three structural locks all live behind.

`VCS_TOKEN` already sits on the by-cost side, and that was accepted knowingly —
it opens pull requests. The poster credential posts verdicts. **The two are not
interchangeable, and the table's strongest row exists because of the difference.**

### What that means for sequencing

Step 1 is not "unify the readers and ship". It splits:

- **1a — unify the reader, keep the reviewer token out of `.env`.** The developer
  still exports one variable. Delivers Gaps C and D, delivers nothing of the
  "set nothing" requirement.
- **1b — the reviewer token becomes readable from a file.** This needs an
  **ADR-0033 amendment**, not an implementation ticket: the table must either
  state the downgrade and accept it, or name what closes the file channel first.

The honest answer to *"how do we make it transparent?"* is that **1b is where the
transparency lives, and 1b has a price the table has to pay out loud.** Anything
that delivers "the developer sets nothing" without touching that table has moved
the credential somewhere the scrub does not reach and not said so.

## Open questions

1. **Which precedence wins** when a key is in both `.env` and the shell? `.env`
   matches today's port behaviour; shell-first matches most tooling conventions
   and is what a `VAR=… command` invocation expects. Whichever is chosen, the
   losing value must be reported, never silently dropped.
   See *The blocker on step 1* below: the isolation model constrains this choice,
   and not in the way this document first claimed.
2. **Does the role map belong in `brain.config.json` or in the credential
   resolver?** Config is discoverable and consumer-editable; a resolver constant
   cannot drift from the code. #759's class argues for one declaration only.
3. **Should `VCS_TOKEN` be renamed** to something role-named? It is ADR-0007/#33
   vocabulary and consumers depend on it — likely an alias, not a rename.
4. **What does an SDD stage declare** when it both authors and reviews? Today no
   stage does; #768's in-session-subagent question would create one.

---

## References

- `brain/scripts/vcs/providers/github.mjs:37-60` — the single `gh` chokepoint and
  the child-env rule
- `brain/scripts/vcs/cli.mjs:139-144` — explicit identity wins over `_token`
- `brain/scripts/vcs/lib/token.mjs:27-35` — `readEnvVar`, `.env` first
- `brain/scripts/review/identity.mjs:144` — `process.env` only
- `brain/scripts/review/cli.mjs:337-347` — the #604 lockout warning
- `docs/reviewer-setup.md` — both directions, documented in #631
- `docs/inbox/cold-review-as-product-stage.md` — the product model, and the
  proposed ruling for the 1a/1b split
- `brain/project/decisions/adr-0033-cold-review-transport.md:65-71` — the warrant
  table this document's step 1 turns on
- Issues: **#773** (the 1b ruling — Compuerta 6), **#316** (unify the `.env`
  parsers), **#772** (the tree check, orthogonal), **#775** (the stage refuses on
  a logged-in machine), #501 (identity chokepoint), #413 (verified reviewer
  identity), #604 (ambient-credential negative control), #631 (bound gathers),
  #767 (`patSetupUrl` throws), #569 (`SUBCOMMAND_PORT_REACH`)
