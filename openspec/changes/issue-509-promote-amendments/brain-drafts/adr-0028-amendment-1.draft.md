# ADR-0028 Amendment 1 — draft (issue #509)

> **status:** Tier 2 draft. Not yet promoted. ADR-0028 already exists at
> `brain/project/decisions/adr-0028-brain-promote-read-confirm-stage.md`, so this is an
> in-place amendment, not a new ADR file.
>
> **Promote it with the verb this change ships** — the contract below is machine-readable:
>
> ```
> npm run brain:promote -- openspec/changes/issue-509-promote-amendments/brain-drafts/adr-0028-amendment-1.draft.md
> ```
>
> It renders the plan, waits for the typed word, writes the ADR, the `brain/HOME.md` marker and
> a regenerated `AGENTS.md`, stages them, and stops. **Your commit is the signature.**

```brain-amendment/1
target: brain/project/decisions/adr-0028-brain-promote-read-confirm-stage.md
amendment: 1
issue: 509
home-summary: `brain:promote` also performs §1c's in-place amendment cascade; the four locks and the human signature are unchanged, #509
body: ## Amendment 1 — the in-place amendment shape ships, and the locks do not move (issue #509)
body-end: ### Notes for the promoter
```

```amend-find
The scope of the first slice is **new-file ADR promotion** plus the full cascade
(`brain/HOME.md` entry, `AGENTS.md` regeneration). In-place edits to already-signed
`brain/**` files — measured on #405 as the *majority* shape — are deliberately excluded,
because encoding the amendment convention requires first writing it down, and writing
doctrine is the Tier 2 act this verb exists to keep human.
```

```amend-replace
The scope of the first slice is **new-file ADR promotion** plus the full cascade
(`brain/HOME.md` entry, `AGENTS.md` regeneration). In-place edits to already-signed
`brain/**` files — measured on #405 as the *majority* shape — are deliberately excluded,
because encoding the amendment convention requires first writing it down, and writing
doctrine is the Tier 2 act this verb exists to keep human.

**[Amended by Amendment 1 (#509) — the exclusion is lifted. `consolidation-protocol.md` §1c/§1d
wrote the convention down (`94d326d`), so encoding it is no longer writing it, and the verb now
takes an in-place amendment draft as well. The four locks below are unchanged and cover both
shapes. See Amendment 1.]**
```

## Amendment 1 — the in-place amendment shape ships, and the locks do not move (issue #509)

**Signed**: DD/MM/YYYY — <Name>

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

### Notes for the promoter

Delete this section's heading from the promotion by leaving `body-end` as it is: the contract
above stops the appended section here, so these notes never reach the ADR.

- The `**Signed**:` line above is a placeholder. The verb overwrites it with the promotion date
  and `git config user.name`; do not fill it in by hand.
- The `brain/HOME.md` marker is generated from `home-summary` — read it in the plan before
  confirming.
