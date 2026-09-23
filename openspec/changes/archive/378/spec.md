---
status: spec
issue: 378
artifact_store: openspec
topic_key: sdd/issue-378-brain-promote/spec
---

# Spec — `brain:promote` (issue #378)

Requirements tagged `REQ-378-N`. REQ-378-1 through -4 are the **locks**; they are the
deliverable. The rest is mechanics that exist to make the locks worth having.

---

## The locks

### REQ-378-1 — refuses on a non-TTY, before anything is read or written

`process.stdin.isTTY === false` → exit non-zero, with an explanation, **before** the draft
is read, before the plan is rendered, and before any write. An agent's shell is
non-interactive, so the common case is impossible rather than discouraged.

Proven by spawning the **real** entry point as a real child process with piped stdio (a
genuine non-TTY, not an injected flag) against a real fixture repo, and asserting both a
non-zero exit **and** that the fixture's working tree and index are untouched. Exit code
alone would pass for a script that wrote the files and then failed.

### REQ-378-2 — no `--yes`, no `--force`, no `--non-interactive`, no env bypass, ever

Not undocumented — **absent**. There is no branch to reach.

Two independent guarantees, because a source scan and a behaviour test go blind along
different axes:

1. **Behavioural.** Argument parsing accepts exactly one positional and rejects **every**
   token beginning with `-`, generically. A bypass flag is not ignored — it is a hard
   abort with no writes. Driven with `isTTY: true` and a *refusing* answer function so
   the case fails for the flag, never for the TTY lock (the "negative fixture that fails
   for the wrong reason" mode).
2. **Structural.** The module reads `process.env` **zero times**, asserted as an
   occurrence count over the comment-stripped source. This kills the env-bypass class
   generically rather than by enumerating names, which is the SPELLING axis a name list
   is blind along.

The comment stripper is itself proven: it must remove a banned token that appears only in
a comment, and the stripped source must still contain known code sentinels — otherwise a
stripper that ate the file produces a vacuous green.

### REQ-378-3 — stages, never commits, never pushes

The verb runs `git add` and stops. It prints the commit command and does not run it.

Enforced structurally rather than by a text scan, because the printed command **contains
the string `git commit` by design** — a scan for that string can never work here:

- `ALLOWED_GIT_SUBCOMMANDS` is an exported frozen allowlist. It contains `add` and
  `config`. It does not contain `commit` or `push`, and the single git helper **throws**
  on anything outside it.
- The comment-stripped source contains **exactly one** `spawnSync(` occurrence and zero
  `execSync` / `execFile` / `exec(` — the SITE axis, asserted as a count, so a second
  unguarded git path cannot be added silently.
- End-to-end in a real temporary git repository: after a fully accepted run,
  `git rev-list --count HEAD` is unchanged and `git diff --cached --name-only` lists
  exactly the three expected paths.

### REQ-378-4 — the confirmation is a typed word, compared exactly

The literal word `PROMOTE`. Not `y`, not `yes`, not `promote`, not `Promote`, not the
empty line, not EOF. Comparison is `trim()`-then-`===`; anything else aborts with **no
writes at all** — not a partial application.

Driven across the whole value class the requirement names, on the accept path, so a
predicate relaxed for one class cannot survive.

---

## The mechanics

### REQ-378-5 — the destination is derived from the draft filename, never invented

`<anything>/adr-NNNN-<slug>.md` → `brain/project/decisions/adr-NNNN-<slug>.md`.

The regex is anchored to satisfy `adrPresence`'s `^brain/project/decisions/adr-\d+-.+\.md$`
by construction. A draft filename that does not match is **refused**, naming the
first-slice scope — it is not silently promoted to a path the ADR gate will not count.

The ADR number in the filename must equal the number in the draft's H1. A mismatch is
refused: `adrPresence` keys on the path, `brain/HOME.md` keys on the title, and a
disagreement between them is exactly the silent inconsistency this verb exists to prevent.

### REQ-378-6 — refuses when the destination already exists

Never overwrite a signed artefact. Measured motivation (proposal M1): the issue's own
acceptance fixture, `adr-0025-l5-deny-set.md`, now collides with a real signed ADR that
took the number while the ticket sat open.

### REQ-378-7 — the header rewrite is bounded to the preamble

Between the H1 and the first `## ` heading, every blockquote block is removed (the
drafts' `> **status:**` line and the `> **Tier 2 draft.**` banner both live there), and
the house header is inserted:

```
**Status**: Accepted
**Date**: YYYY-MM-DD — <git config user.name>
```

Bounded to the preamble on purpose: a blockquote inside the body is content, and a
whole-file blockquote strip would eat it. `Accepted` is correct because the human is
signing at the moment they type the word.

An empty `git config user.name` is a refusal, not a blank stamp.

### REQ-378-8 — the printed commit command is paste-safe and hook-conforming

- Single-quoted with `'` escaped as `'\''`. Measured motivation (proposal M5): ADR titles
  contain backticks, and a double-quoted paste executes them.
- Conventional Commits, and carries `#N` — both required by `commit-msg`, and by
  `pre-receive` on push. `N` is read from the draft path's `issue-(\d+)` segment. When it
  cannot be derived, the command carries an obvious `#<issue-number>` placeholder and the
  output says so, rather than printing a command the hook will silently reject.
- English, because the artefacts it touches ship to consumers.

### REQ-378-9 — the cascade is complete: ADR + HOME.md + AGENTS.md, or nothing

One accepted run writes all three:

1. the ADR at the derived destination;
2. the `brain/HOME.md` entry, via the **existing** `insertAdrLink` from
   `brain/scripts/lib/home-index.mjs` — not a second copy of that algorithm;
3. `AGENTS.md`, recompiled via the **existing** `compileAgentsMd` over the five real
   `SOURCE_DOCS` with the *new* `HOME.md` content.

Every refusal in this spec happens before write #1. There is no state in which one or two
of the three landed.

Step 3 is required, and the reason is corrected from the issue's: it is not that no gate
catches it (proposal M2 shows `npm test` does), it is that a cascade nobody remembers
should not cost a red CI round trip.

### REQ-378-10 — the human reads what they sign

Before the prompt: the draft's full body to stdout, then the plan — destination, header
before/after, the exact `HOME.md` line and the line it follows, and the `AGENTS.md`
regeneration. Rendering is pure and separately asserted, so "the plan shown is the plan
applied" is a property of one value, not of two code paths.

---

## Out of scope, stated so it is not mistaken for coverage

- **In-place edits to signed `brain/**` files** — the *majority* shape (proposal, design
  D2). Blocked on a human signing `brain-drafts/amendment-convention.md`.
- Non-ADR new files (an anti-pattern doc indexed in a README, not in HOME's ADR section).
- Deleting the draft; opening the PR; `--list`; assigning the ADR number.

## Pending human acts — NOT agent decisions

- Sign and promote `brain-drafts/adr-0028-brain-promote-read-confirm-stage.md`. The
  number `0028` is a suggestion; `0018` and `0023` are also free.
- Sign and promote `brain-drafts/amendment-convention.md` — the prerequisite for slice 2.
- Decide whether `brain:promote` joins `MANAGED_SCRIPT_KEYS` (it does not, today —
  design D6).
