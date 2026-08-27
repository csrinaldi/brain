# The cold review as a product stage

*brain · design note · measured 2026-08-27 against `origin/main @ dd31906`.*

What the product model is, what the tree already implements, and the four gaps
between them. Written because a question about credentials turned out to be a
question about architecture, and the answer settles an open gate.

> **Snapshot, not source of truth.** The issues win on any conflict:
> **#773** (the gate), **#775** (the product blocker), **#772** (the tree check),
> **#774** (`credential-roles-coexistence.md`, the credential model in full),
> **#316** (one `.env` reader), **#323** / **#456** (the stage router).
> The line this belongs to is `ROADMAP-M5-M8.md`, rev 6.

## The product model

A workflow engine **started by the developer** — one session that comes up and
lives while they work. It walks the SDD stages; one stage opens the PR; that
fires the `cold-review` stage; a subagent reads a separate worktree and analyses
it deterministically and inferentially; the verdict reaches the PR under an
identity distinct from the author's (`BRAIN_REVIEWER_TOKEN`).

Confirmed by the maintainer on 2026-08-27: **developer-started, not unattended.**

Later — explicitly not now — the stage could be executed by an external agent,
over MCP or in CI. §6 says why that does not change the ruling below.

## What of that already exists

| Piece | State | Where |
|---|---|---|
| `stage → {engine, model}` router | exists, "M8's router in embryo" | `brain/scripts/lib/stage-engine.mjs:1-19` |
| `cold-review` as a stage, `sdd.map`'s first inhabitant | exists; `sdd.map` ships empty | `brain/core/config-migrations.mjs:124-135` |
| The cold worktree | created by the **parent**, not the subagent | `cold-boot.mjs:64-72` (`git worktree add --detach`) |
| A subagent that produces findings | exists | `review/lib/run-cold-review-stage.mjs` |
| The artifact under `openspec/` | `openspec/reviews/pr-NNN/cold-review.md`, **uncommitted** (REQ-S3-3) | `run-cold-review-stage.mjs:27-31` |
| Reading it and building the verdict | the **parent** | `review/cli.mjs:256`, `:605-640` |
| Posting to the PR as the reviewer | the **parent**, `postVerdict` | `review/poster.mjs` |
| Chaining stages / firing automatically | **does not exist** — today it is `npm run brain:review -- --pr N` | #323 · #456 |

## The one inversion, and it is the load-bearing one

The model as first described had the **subagent** posting the verdict and holding
`BRAIN_REVIEWER_TOKEN`. The tree does the opposite, and by measurement rather
than by taste.

`credential-env.mjs` exists because that broke once: before the fix `defaultRun`
called `spawnSync` with no `env`, the child inherited `process.env` whole, and
the only thing between the producer and the reviewer's credential was one
sentence of prompt text. Measured, with the token visible in the child. Today
`credentialEnvNames()` builds the denylist (reviewer + author + forge) and
`withoutCredentials` returns a copy without those names — ADR-0033's only
`by construction` row.

```
brain:review  (parent — HOLDS BRAIN_REVIEWER_TOKEN)
   ├─ cold-boot     → git worktree add --detach <headSha>
   ├─ deterministic evaluators        (in the parent)
   ├─ runStage      → spawnSync(engine, { env: withoutCredentials(...) })
   │                    └─ SUBAGENT: reads the cold worktree, writes ONE file.
   │                       No token. No forge connection. Posts nothing.
   ├─ artifactDeps  → reads openspec/reviews/pr-NNN/cold-review.md
   ├─ buildVerdict  → folds deterministic + inferential
   └─ postVerdict   → posts to the PR as the reviewer identity
```

A producer that posts would need `reviewer-protocol.md` §2's three structural
locks — COMMENT-only state, no approve verb in the port, the two-key split —
re-proved on a second surface. That surface is the one #604 proved cannot be
trusted where the environment injects the credential: an invented token, an empty
token and NO token all resolved to the same login.

**The reframe:** the product does not need the SUBAGENT to hold the token. It
needs the STAGE to act as the reviewer, and that already works. Identical product
behaviour, credential never leaving the parent.

## What that settles about the gate (#773)

The "the developer configures nothing" problem is not the subagent's. It is the
**parent process's**. With a developer-started engine:

- the developer starts the engine **once**, with the credential in that session's
  environment;
- every stage inherits it **in-process** — no `.env`, no export per terminal;
- the subagent receives it **scrubbed**, and the `by construction` row stands.

**Proposed ruling for #773: NO to 1b.** 1a yes — one reader, one precedence, one
refusal shape (#316). The reviewer token stays shell-resolved, and the DX answer
is the engine session, stated as a product decision rather than as a leftover.

**Declared residue:** an engine started unattended (a daemon, a cron, nobody
typing) would have to read the credential from disk, which is 1b again. That case
is **not covered** by this ruling and is written here so it is not discovered
later as an omission.

## The future surfaces, and why they do not reopen it

- **CI is the EASY case, not the hard one.** In CI secrets arrive as environment
  variables — exactly what `withoutCredentials` reaches. The `by construction`
  row holds unchanged. **CI does not ask for 1b.**
- **MCP is a different question, and it is not 1b either.** An external agent
  invoking the stage means brain does not control the process holding the
  credential. That is not "is the token read from a file" but "who is the caller
  and how does it authenticate" — #357's territory, whose written recommendation
  is option A: MCP as an ADDITIONAL surface, not a replacement for
  `AGENT_PLATFORM`.

So the "no" to 1b must **name** both future surfaces rather than nailing the door
shut. The day they open, they should open against a written decision.

## The gaps, measured

1. **The subagent neither posts nor holds a token** — above. Signed in ADR-0033.
2. **The parent creates the worktree.** The subagent could not: with no forge
   credential it can neither clone nor fetch. `run-cold-review-stage.mjs:154-159`
   refuses when given no `worktreePath`.
3. **There is no orchestrator.** Chaining stages is #323 (M8) plus #456
   (configurable stage set). The mental model is the roadmap, not the present.
4. **The verdict does not persist under `openspec/`.** The artifact is written
   and deliberately NOT committed: committing it would move the head the verdict
   binds itself to, and §10 would then make the verdict stale against its own
   commit — a review that invalidates itself by recording that it happened. What
   remains as the record is an open product decision.
5. **The review cannot block a merge.** The verdict is a COMMENT;
   `REQUEST_CHANGES` is not wired — **#746**, open and approved.
6. **The reviewing machine cannot be logged into a forge CLI.** Measured
   2026-08-27 with `gh` logged in: the probe returns
   `{"state":"reachable","ok":false}` and the stage refuses. This is **#775**, and
   it is the product's first blocker, not a configuration detail. That ticket
   carries both measurements and a candidate that closes the channel without
   touching the operator's keyring.

## Work this implies

| # | What | Who | Blocks |
|---|---|---|---|
| 1 | Rule #773: no to 1b, with the unattended residue and the two future surfaces named | human signature | #316 |
| 2 | An explicit non-goal in #316 citing #773, so 1b cannot ride along | human signature | — |
| 3 | #775 — the logged-in-machine blocker | agent, once approved | the product |
| 4 | Decide what remains as the verdict's record under `openspec/` | human | — |
| 5 | The engine as the carrier of the credential session | design | crosses #323 / #456 |

Gaps 3 and 5 already have a home in `ROADMAP-M5-M8.md` rev 6 (Stage 4 · M8, and
#746).
