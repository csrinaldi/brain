# ADR-0032 Amendment 1 — draft (issue #723)

> **Tier 3 target. Not promoted, and not promotable by an agent.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-709-declaring-selector/brain-drafts/adr-0032-amendment-1.draft.md
> ```
>
> Run it on THIS branch so the amendment lands in the same pull request as the fix
> and the Phase 8 checkoff. The verb renders the plan, waits for the typed word,
> performs §1c's acts, writes the `brain/HOME.md` marker and a regenerated
> `AGENTS.md`, stages them, and stops. **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0032-graph-block-declared-by-its-tag.md
amendment: 1
issue: 723
home-summary: the rendering assumption is closed by observation on both providers — an unknown info-string keeps its code-block shape and loses only highlighting, so the cost stays at "no colours"; and the tag's other half, D6's hidden-declaration refusal, was never wired until #723, #723
body: ## Amendment 1 — the assumption is measured, and the half that was never wired (issue #723)
body-end: ### Notes for the promoter
```

```amend-find
**That assumption was not verified.**
```

```amend-replace
**That assumption was not verified** *at the time this ADR was drafted.*
**[Amended by Amendment 1 (#723) — CLOSED BY OBSERVATION on 18/08/2026, both providers. It holds: the block keeps its code-block shape and loses only syntax highlighting. The cost stays at "no colours" and never rises to "five visibly ugly lines". See Amendment 1 for the probe and its control.]**
```

```amend-find
- **The rendering assumption above must be closed by observation**, and if it is false
```

```amend-replace
- **The rendering assumption above must be closed by observation** — ✅ **DONE, Amendment 1 (#723)**: confirmed on GitHub and GitLab, 18/08/2026. The paragraph below is kept as the standing instruction for anyone re-opening the question. If it is false
```

## Amendment 1 — the assumption is measured, and the half that was never wired (issue #723)

**Signed**: DD/MM/YYYY — <Name>

This ADR named one claim it could not check and one thing it insisted the tag was
not. Both are settled here, and they resolve in opposite directions.

### 1 · The rendering assumption holds — measured, on both providers

The claim: an unknown fence info-string still renders as an ordinary code block on
GitHub and GitLab, losing only syntax highlighting.

**The probe carried a control, and that is the part worth keeping.** Each issue body
held block **A** (` ```brain-graph/1 `) beside block **B** (` ```yaml `) with
byte-identical content, plus a trailing line to reveal a swallowed fence. Without
**B**, *"renders as a code block without highlighting"* and *"renders wrong"* are
indistinguishable — the observation would have been a feeling.

GitHub via issue #732; GitLab via a matching issue on `gitlab.com/csrinaldi/brain`.
Reported identical on both.

**So the honest cost stated in this ADR is the real one.** It stays at *no colours*
and never rises to *five visibly ugly lines in one issue body*. The decision does not
move — it never depended on this — but the record no longer carries an open obligation
with nothing recording its discharge.

### 2 · The tag really was only half the fix, and the other half shipped unwired

This ADR's title says the tag is **only half the fix**, and D6 named the other half:
a declaration that is *hidden* must be refused out loud, never reported absent.

**It was not wired.** `epic-graph.mjs` never destructured the splitter's `skipped`
channel, so four shapes that hide a complete, well-formed declaration answered `null`
— the value REQ-639-4 defines as *"nobody declared one"*:

| shape | before #723 |
|---|---|
| blockquoted graph fence | `null` |
| four-space-indented graph fence | `null` |
| HTML-commented graph fence | `null` |
| a runaway foreign fence that swallows it | `null` |

That is the exact conflation this ADR was written to end, surviving inside its own
delivery. The suite was green throughout and said nothing, because no test varied
that axis.

**Why it escaped is the part that generalises.** D0 sequenced the selector before the
splitter, deliberately and correctly. Task 2.2 asked for both halves, but `skipped`
did not exist yet when PR #720 landed — so the box was checked against the half that
was buildable at the time, and when PR #722 created the field nothing came back.

> **A requirement split across an ordering constraint has no claimant for its second
> half.** The ordering that makes a change safe is the same ordering that lets half a
> task look finished. Whoever writes the next D0-style sequence should name the
> second half's owner in the task itself.

### 3 · What this does not change

The decision. The tag is still the selector, still chosen because unspoofability
outranks the rendered-artifact rule, and D1's family rule is still not repealed.
Amendment 1 closes an open question and records a defect in the delivery — neither
touches what was decided.

### Notes for the promoter

- Two `amend-find`/`amend-replace` pairs, each anchor verified to occur **exactly
  once** in the target before this draft was written.
- The first replacement keeps the original sentence and qualifies it rather than
  deleting it: *"was not verified"* was true when written, and erasing it would hide
  that this ADR shipped with a named gap on purpose.
- The `brain/HOME.md` marker is §1c's fourth act and the one with no gate behind it
  (#516) — confirm it landed before committing.
