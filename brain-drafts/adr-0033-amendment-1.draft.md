# ADR-0033 Amendment 1 — draft (issue #773)

> **status:** Tier 2 draft. Not yet promoted. ADR-0033 is already signed, so this is an
> in-place amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- brain-drafts/adr-0033-amendment-1.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs §1c's three acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops.
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0033-cold-review-transport.md
amendment: 1
issue: 773
home-summary: the poster credential stays on the environment axis by ruling, not by omission — the engine session is the boundary, #773
body: ## Amendment 1 — the poster credential stays shell-resolved, and that is now a ruling (issue #773)
body-end: ### Notes for the promoter
```

```amend-find
| brain's poster credential in the environment | `withoutCredentials` — `spawnSync` hands the child an explicit `env` | **by construction**: the kernel, which does not consult the child |
```

```amend-replace
| brain's poster credential in the environment | `withoutCredentials` — `spawnSync` hands the child an explicit `env` | **by construction**: the kernel, which does not consult the child. **[Amended by Amendment 1 (#773) — this row is now a RULED position rather than an inherited one: making `BRAIN_REVIEWER_TOKEN` readable from a file was proposed and REFUSED, so the credential stays on the environment axis, which is the axis the scrub reaches]** |
```

## Amendment 1 — the poster credential stays shell-resolved, and that is now a ruling (issue #773)

**Signed**: DD/MM/YYYY — <Name>

### What changed

Nothing in the mechanism. `BRAIN_REVIEWER_TOKEN` is still resolved from the shell alone by
`review/identity.mjs:144`, and `withoutCredentials` still removes it from the producer's
environment. What changed is the **status of that arrangement**: it was an omission, and it is
now a decision. The warrant table's first row carries a ruling, not an inheritance.

The proposal this refuses is **1b** of `docs/inbox/credential-roles-coexistence.md`: making the
reviewer token readable from a file, so a developer configures nothing. **1a** — one environment
reader, one stated precedence, one refusal shape — is untouched by this amendment and remains
#316's work.

### Why

The question that produced 1b was a product question: *the developer should see SDD stages hand
off without setting anything.* Answering it required writing down the product model, which had
never been written — `docs/inbox/cold-review-as-product-stage.md`, on `main`.

The model settles it. A workflow engine **started by the developer** — one session that comes up
and lives while they work — carries the credential for every stage it runs:

- the developer starts the engine **once**, with the credential in that session's environment;
- every stage inherits it **in-process**: no `.env`, no export per terminal;
- the producer receives it **scrubbed**, and this row stands unchanged.

So the transparency 1b was meant to buy is delivered by the session boundary, not by moving the
credential to disk. **The product requirement and the warrant are not in tension once the
boundary is drawn in the right place.**

The reframe underneath it is worth recording, because the first statement of the model had it
backwards: the product does not need the SUBAGENT to hold the reviewer credential. It needs the
STAGE to act as the reviewer — which is what this ADR already builds. The subagent writes a
file; the parent reads it, folds it into the verdict, and posts. Identical product behaviour,
and the credential never leaves the parent.

### What 1b would have cost, measured

`withoutCredentials` removes credential **names from the environment**. A file on disk is not an
environment variable, and the fifth cold review of #682 measured the producer reaching one from
inside its own process:

> *"`cwd` is not a confinement. `defaultRun` sets `spawnSync`'s `cwd` and nothing else; there is
> no chroot, no sandbox flag anywhere in the arg list. And the prompt hands the producer the
> operator's tree as an ABSOLUTE path in its very first instruction. Measured:
> `test -f <operator tree>/.env` returns TRUE from the producer."*

So 1b would have moved this row from `by construction` to `by cost` — the removal of the table's
only kernel-enforced guarantee, and `reviewer-protocol.md` §2's three structural locks
(COMMENT-only state, no approve verb in the port, the two-key split) all live behind the
credential it protects. `VCS_TOKEN` already sits on the by-cost side and that was accepted
knowingly: it opens pull requests. The poster credential posts verdicts. The two are not
interchangeable, and this row exists because of the difference.

### The accepted loss, stated rather than left as a leftover

A developer still exports one variable when the session starts. #316 delivers diagnosability —
one reader, one precedence, a refusal that names the role, the source and the resolved identity —
and it delivers **nothing** of "set nothing". That is the price of this ruling and it is not
hidden: the answer to the ergonomics is the engine session, and it is a product decision, not a
shrug.

`docs/reviewer-setup.md` follows this amendment: shell-only is the supported shape, by decision.

### What this amendment does NOT cover

**An engine started unattended.** A daemon or a cron job with nobody to type has to read the
credential from somewhere on disk, and that is 1b under another name. This ruling does not cover
that case, and the day it is wanted it reopens **here**, against this text, rather than arriving
as an omission nobody recorded.

**Two future surfaces, named so they open against a decision:**

- **CI is the easy case, not the hard one.** In CI secrets arrive as environment variables —
  exactly what `withoutCredentials` reaches. This row holds unchanged, and CI does not ask for 1b.
- **MCP is a different question, and it is not 1b either.** An external agent invoking the stage
  means brain does not control the process holding the credential. That is not *"is the token
  read from a file"* but *"who is the caller and how does it authenticate"* — **#357**'s
  territory, whose recorded recommendation is MCP as an ADDITIONAL surface rather than a
  replacement for `AGENT_PLATFORM`.

**And it claims nothing new about reach.** This amendment rules on where the credential is READ
FROM. It says nothing about what the producer can reach once running: the table's last row —
*any other credential, read by any other tool → not claimed* — is unchanged, the forge-CLI row
still carries its fail-closed probe, and **#775** owns the case where that probe refuses on a
machine a developer actually uses. **#772** owns the post-run tree check, which detects a
producer that CHANGED the tree and says nothing about one that READ a credential. Neither is
unblocked or blocked by this ruling.

### The guard this ruling puts on #316

`#316` unifies the `.env` parsers, and its diff is the one place 1b could land by accident: a
refactor that routes `identity.mjs` through the port's reader would make the reviewer token
file-readable as a side effect, and **the diff would look like plumbing**. #316 therefore carries
an explicit non-goal citing this amendment. A reviewer who sees the reviewer token gain a file
path in that PR is looking at a doctrine change wearing a refactor's clothes.

### Notes for the promoter

Amendment number 1 — ADR-0033 carries none today, and its Status line reads `Accepted` with no
amendment marker.

The `amend-find` anchor is the warrant table's first row and occurs exactly once in the target.

Nothing else in the ADR is superseded: the mechanism, the four other rows, the `VALID_OPS`
argument and the rejected alternatives all stand as signed.
