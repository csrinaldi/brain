# ADR-0028 — `brain:promote` is read-confirm-stage: the mechanics are automated, the signature is not

**Status**: Accepted · **amended 12/08/2026** (Amendment 1 — see below)
**Date**: 2026-08-07 — Cristian Rinaldi

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

**[Amended by Amendment 1 (#509) — the exclusion is lifted. `consolidation-protocol.md` §1c/§1d
wrote the convention down (`94d326d`), so encoding it is no longer writing it, and the verb now
takes an in-place amendment draft as well. The four locks below are unchanged and cover both
shapes. See Amendment 1.]**

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

## Amendment 1 — the in-place amendment shape ships, and the locks do not move (issue #509)

**Signed**: 12/08/2026 — Cristian Rinaldi

### What changed

The deferral this ADR recorded was conditional, and both conditions are met. §1c ("Amending a
signed ADR" — three acts in one commit) and §1d (the promotion cascade) were written down in
`94d326d`, and `be2d143` — ADR-0026 Amendment 2, promoted by hand by the human who signed §1c —
is a complete worked instance of them.

`brain:promote` now accepts a second draft shape: a file named `*.draft.md` carrying one fenced
`brain-amendment/1` block that names a target under `brain/**` and the passages the amendment
supersedes. The verb performs §1c's three acts, §1b's `brain/HOME.md` marker for the ADR shape,
and §1d's `AGENTS.md` regeneration — then stages and stops.

**The four locks hold, and two of them needed work to keep holding.** There is still one non-TTY
refusal, one argument parse with no auto-accept option, one exact typed word, and a git seam that
can produce neither a commit nor a push. Both draft shapes run through the same flow rather than
through a sibling verb, precisely so those locks keep one implementation each. Two corrections
belong on the record rather than in a footnote, because both were found by cold review and both
mean a lock was weaker than this ADR claimed:

- **Lock 2's structural half had stopped covering the verb.** The guard scans source for
  `process.env` reads and bypass-flag literals, and it scanned one file; the verb now spans two.
  An environment read inserted into the new module left the lock suite fully green, and the
  forged value reached the `**Signed**:` attribution of a promoted ADR. The count is still zero;
  the GUARD is what regressed. It now derives its file list from the verb's own import
  statements and fails when an unclassified module appears, so a third module cannot repeat it.
- **Lock 3's allowlist gained `status`, and needed to.** `git add` is not inert: on an unmerged
  path it marks the conflict RESOLVED. Run mid-rebase, the verb staged conflict markers into
  `brain/HOME.md` and into the `AGENTS.md` compiled from it, and left git believing the merge was
  settled. An allowlist of `add` and `config` never made "stages, never commits" true by itself —
  what makes it true is refusing to run when the repository has unmerged paths, which requires
  reading `git status`. The property the lock protects is unchanged: no allowed subcommand can
  produce a commit or a push.

### Why a verb rather than a check

Every ad-hoc promoter re-derives the cascade from prose, and the cascade is the part a human
reading prose gets wrong. `promote-529.sh` was written from the doctrine text and lost the
`AGENTS.md` regeneration; the drift guard failed on the human's signing commit, through no fault
of the signer. `promote-516.sh` got it right by copying what this verb already did. #516's own
recommendation states the principle: **a tool that performs the cascade cannot forget it**, which
beats a check that catches the omission afterwards.

### The measurement

The acceptance is `be2d143` itself. Given the tree at `be2d143^` and the #473 amendment draft,
the verb stages `adr-0026-governance-doctrine-tiers.md`, `brain/HOME.md` and `AGENTS.md`
**byte-identical** to the files the human's commit produced, with zero new commits and a printed
commit command the `commit-msg` hook accepts. Proven red by mutation on four independent acts —
the Status line, the in-place annotation, the `brain/HOME.md` marker and the `AGENTS.md`
regeneration — each mutation read back off disk before the suite ran.

### Accepted losses, recorded rather than implied

1. **A hand-executed amendment is exactly as unguarded as it was before.** `decision-gate` still
   passes a modified ADR with no `brain/HOME.md` change (#510), `brain:nav` still passes because
   the link is already there, and `phase-order` is still detection-only at `lite`. What this
   amendment buys is that the *sanctioned path* cannot forget the marker — not that the marker
   is now enforced. #516's content-keyed check remains buildable and unbuilt.
2. **The verb applies what the draft declares.** Anchors are exact strings and any count other
   than one refuses the whole run, so it cannot edit something adjacent — but a draft that
   declares the wrong replacement produces the wrong amendment, correctly staged. The human
   reading the rendered plan before typing the word is still the check on content, exactly as in
   slice 1.
3. **One target per run.** Amendments that span several files — `promote-516.sh` touched four —
   need one draft each. Multi-target and cascading amendments were left out rather than
   half-built.
4. **A half-applied cascade is refused, not repaired.** If the Status line, the annotations, the
   appended section and the `brain/HOME.md` marker are not all applied or all missing, the verb
   names each act's state and stops. That is deliberate — §1c is three acts in ONE commit, and a
   tool that finishes someone else's partial edit is guessing at what they meant — but it means
   the human who pasted the section by hand still repairs it by hand. Resuming a partial cascade
   was considered and left out; it wants its own ticket, not a branch in this one.
5. **The verb stages whole files.** If a target already carried unrelated uncommitted edits, they
   are staged into the signing commit along with the amendment. The verb discloses them in the
   plan before the typed word rather than refusing, because refusing would block a human with an
   unrelated edit in flight — but the signature covers them, and that is a real widening of what
   one confirmation means.
