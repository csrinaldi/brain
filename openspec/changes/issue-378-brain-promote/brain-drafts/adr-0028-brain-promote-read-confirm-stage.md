# ADR-0028 — `brain:promote` is read-confirm-stage: the mechanics are automated, the signature is not

> **status:** proposed — pending human promotion | **date:** 2026-08-07 | **owner:** @crinaldi
> **relates to:** ADR-0003 (core/project split), ADR-0014 §L6 (`brain-writes-reviewed`), ADR-0026 (doctrine tiers)

> **Tier 2 draft.** `brain/project/decisions/**` is human-promoted (`agent-authorities.md` Tier 2;
> `consolidation-protocol.md` §2 — the human moves it *"in a commit authored by them"*). Promoting
> this file also requires the `brain/HOME.md` entry, both because `consolidation-protocol.md` §1b
> demands it and because `adrPresence` fails a diff that adds an ADR without touching `HOME.md`.
> The number `0028` is a suggestion; `0018` and `0023` are also free.

## Context

Promoting a Tier 2 draft into `brain/` is a hand-executed checklist — copy to a path an
anchored regex must match, rewrite the header to a convention that lives only in the other
ADRs, strip the draft banner, add the `brain/HOME.md` entry, regenerate `AGENTS.md`, and
commit. Getting any one of the middle steps wrong fails a required gate, and the human is
executing it at the exact moment they are thinking about *content*, not paths.

Issue #378 proposes automating that. The hazard is stated in the ticket and is not
hypothetical: this is precisely the action two anti-patterns forbid.

- `ia-escribe-brain-sin-gate.md` — AI writes to `brain/` without a human gate.
- `ia-promueve-sus-propios-artefactos.md` — whose stated cause is exact here: *"for an
  agent, 'completing the task' includes leaving the artifact in its terminal state: if the
  draft's destination was to be approved, the agent marks it approved."*

A one-command promoter is the tool that makes that failure trivial. `reviewer-protocol.md`
§2 sets the standard that applies: *"That asymmetry cannot be a rule the agent
remembers… It must be impossible by construction."*

## Decision

`brain:promote` **renders, confirms and stages**. It does not commit and it does not push.

The commit is the signature. A tool that produces the commit has taken the signature.
Staging is the correct boundary: everything mechanical is automated, and the one act that
carries authorship is left untouched, in the human's own shell, under their own hands.

Four locks make that structural rather than remembered:

1. **Refuses on a non-TTY**, before anything is read or written. An agent's shell is
   non-interactive, so the common case is impossible rather than discouraged.
2. **No auto-accept option and no environment read exists.** Not undocumented — *absent*.
   Every option-shaped token is a hard abort, so an added flag does not silently no-op.
   The module reads `process.env` zero times, asserted as an occurrence count.
   Adding a bypass is a doctrine change and requires an ADR amending this one.
3. **Stages, never commits, never pushes.** The single git seam enforces an allowlist
   containing `add` and `config` and nothing else.
4. **The confirmation is one exact typed word**, not a letter.

The scope of the first slice is **new-file ADR promotion** plus the full cascade
(`brain/HOME.md` entry, `AGENTS.md` regeneration). In-place edits to already-signed
`brain/**` files — measured on #405 as the *majority* shape — are deliberately excluded,
because encoding the amendment convention requires first writing it down, and writing
doctrine is the Tier 2 act this verb exists to keep human.

## What these locks do NOT achieve — stated so nobody later mistakes the verb for enforcement

This is the load-bearing section of this ADR. Each item is a measurement, not a caveat.

**The TTY check is a speed bump, not a wall.** An agent can allocate a pty and defeat it.
What it buys is cost and visibility: the bypass has to be *chosen*, and it shows up in a
transcript. It does not prevent anything.

**`git config user.name` is a record, not proof of identity.** It is settable by anyone,
including an agent running as the operator. Measured in the session that implemented this:

```
$ git config user.name
Claude
```

The stamped `**Date**: … — <name>` line records who ran the tool. It attests to nothing.

**The real enforcement is unchanged and lives elsewhere** — `brain-writes-reviewed` (L6)
at the PR level, and CODEOWNERS. `brain:promote` removes toil from a gate that is enforced
*downstream*; it adds no enforcement of its own. If anything it makes L6 **more**
load-bearing, not less: a promotion that used to cost eight careful manual steps now costs
one command and a typed word, so the proportion of the guarantee carried by the PR-level
gate goes up.

**The locks constrain the tool, not the agent.** Nothing here stops an agent from writing
`brain/` with a plain file write. That was always true and remains L6's job. What the locks
buy is that *this verb* cannot become the convenient path to doing it.

## Consequences

- A future PR adding an auto-accept option, an environment bypass, or a commit step is a
  **doctrine change**, and must amend this ADR rather than merely pass review.
  `brain-promote.locks.test.mjs` makes such a PR fail rather than merely look wrong.
- The verb ships in `brain/scripts/**` (a managed path) but its `package.json` key is
  **not** injected into consumers via `MANAGED_SCRIPT_KEYS`, matching `brain:save`,
  `brain:review` and `brain:audit`. Distribution is a separate decision.
- The printed commit command is single-quoted and escaped, and carries Conventional
  Commits plus `#N`. Both are correctness requirements rather than polish: ADR titles
  contain backticks, which a double-quoted paste would execute, and `commit-msg` rejects a
  message without a ticket reference.

## Alternatives considered

**Let the tool commit.** Rejected — that is the whole hazard. The commit is the signature.

**Rely on documentation and review instead of locks.** Rejected by `reviewer-protocol.md`
§2's own standard and by the M10 lesson (green-in-test, inert-in-production): a rule the
agent must remember is not a lock.

**Ship without the ADR.** Rejected. The tool's value is small; the risk of it later being
*described* as enforcement is not. This ADR exists mainly to make the limits above
unforgettable.
