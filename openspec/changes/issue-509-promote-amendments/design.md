---
status: draft
issue: 509
---

# Design

## D1 — how a draft declares its target and its anchors

ADR-0026 Amendment 2's draft declared its acts in prose plus line references
(`adr-0026-…md:86`, "append to the end of the `lite` cell"). A human can execute that. A tool
cannot, and the reason is visible in the draft itself: its act-2 paste block is **line-wrapped
prose**, while the file carries that annotation on a single line inside a table row. The human
unwrapped it by hand, silently. A line reference is also stale the moment the file moves, and
"apply a text block near line 86" is a merge problem that half-applies to a signed artefact —
#378 design D2's second reason for deferring this slice.

**Chosen:** one fenced `brain-amendment/1` block of `key: value` scalars, plus ordered pairs of
fenced `amend-find` / `amend-replace` blocks for §1c act 2.

```brain-amendment/1
target: brain/project/decisions/adr-0026-governance-doctrine-tiers.md
amendment: 2
issue: 473
home-summary: a signed `brain-decision/1` block is additional sufficient evidence, #473
body: ## Amendment 2 — a signed decision block is admissible evidence (issue #473)
body-end: ### Promotion is manual
```

Four properties earned it:

1. **Anchors are content, not coordinates.** Both stopgap scripts anchored on exact strings and
   refused on any count ≠ 1. That property is the one thing they both got right, and it is kept
   verbatim.
2. **Fences hold multi-line text with no escaping.** Doctrine text is full of backticks, pipes,
   em dashes and `**bold**`; a quoted-string format would need escaping rules, and an escaping
   rule applied by hand to a signed artefact is a defect generator. A fence is verbatim.
3. **It renders.** The draft stays a readable Markdown document in the PR — the human reviews
   the same file the tool reads, which is what makes the confirmation meaningful.
4. **No parser dependency.** `key: value` scalars plus fences need ~60 lines of code and no YAML
   library. The repo has zero runtime dependencies and this is not the change that adds one.

**Unknown keys are a hard refusal**, not an ignored line: a draft that says one thing and
promotes another is worse than a draft that does not run.

## D2 — the draft declares CONTENT; the verb owns SHAPE

The strongest reason a tool beats a checklist is not speed, it is that the tool cannot be
persuaded to skip a step. So the contract deliberately does **not** let the draft supply the
things that go wrong:

| the draft declares | the verb generates |
|---|---|
| the target path | the Status line, from the target's own current one |
| the amendment number | the `DD/MM/YYYY` stamps (from `todayFn`, formatted here) |
| the superseded passages, verbatim | the `**Signed**:` line (`git config user.name`) |
| the signed section's prose | the `brain/HOME.md` marker, format and all |
| a one-line index summary | the `AGENTS.md` regeneration |

Two consequences worth naming. The amendment **number is verified, not trusted**: the verb reads
`(Amendment 1 — see below)` off the target and refuses anything but `N+1`, so the record cannot
gain a gap or a duplicate. And the `brain/HOME.md` marker is *generated from the same number*
that rewrote the Status line — which is precisely the invariant #516 wanted a check for
(*"the Status line's amendment count increased ⇒ that ADR's `HOME.md` line changed"*), obtained
by construction instead of by inspection.

## D3 — `.draft.md` is the amendment marker, and it is required

Slice 3 of #473 already made `destinationFor()` return `null` for `*.draft.md`, and the #473
draft says the suffix was chosen *deliberately* so the verb "refuses cleanly instead of
attempting to create a second `adr-0026-*.md` file". That convention is now load-bearing rather
than decorative:

- `adr-NNNN-<slug>.md` → slice 1, create a new signed ADR.
- `*.draft.md` + one `brain-amendment/1` block → slice 2, amend an existing signed file.
- anything else → the same refusal as before, with both shapes named.

The suffix is required **in addition to** the contract block, not instead of it. A file that
merely quotes a contract block — a design doc, this file — must never be promotable, and the
naming rule is what makes that structural rather than lucky.

## D4 — one flow, two planners

The alternative was a sibling verb (`brain:amend`). Rejected: ADR-0028's four locks would then
exist twice, and *"when two copies of a rule exist, delete one"* is the repo's own anti-pattern
doctrine. `runPromote` keeps exactly one TTY check, one argument parse, one typed-word
comparison, one git seam and one staging step; the shape dispatch happens between reading the
draft and showing the plan, and each planner returns the same value — the files to write, the
plan text to show, the commit command to print.

That also makes the plan/apply split total: the plan is a pure value, so the acts printed and
the acts applied cannot diverge. A unit test asserts every rendered act's "after" text is
present in the produced text.

## D5 — why this ships no gate, per #516

#516 explicitly refused option (2) — re-imposing ADR ⇔ `HOME.md` co-occurrence on modified ADRs
— because it re-creates the defect #510 removed and re-blocks PR #507's whole class. Its
recommendation was option (3): put the net in the verb. The verb is the net *for promotions that
go through the verb*, and that is a real, bounded claim:

**A hand-executed amendment is exactly as unguarded as it was before this change.** The
`brain/HOME.md` marker still has no gate behind it. What changed is that the sanctioned path can
no longer forget it, and the two scripts that re-derived the cascade from prose are gone. A
content-keyed check ("the amendment count increased ⇒ the index line changed") remains buildable
and remains unbuilt — recorded here rather than implied, because an apparent protection is worse
than a stated absence (#499's class).

## D6 — the `compileAgentsMd` fail-open, removed on every path

`compileAgentsMd(docs)` keyed `docs` by relPath with a `?? ''` per-section fallback. Passing an
**array** — the shape a new caller reaches for first — keyed nothing and compiled five empty
sections: 543 lines deleted from `AGENTS.md`, exit 0, caught only by a human reading the diff
(#509's first comment). The fix is at the compiler, not only at the new call site: a missing key
now throws and names the keys. `init()` never depended on the fallback — it substitutes `''`
explicitly on a read failure and warns — so no behaviour changes for the caller that legitimately
compiles from an incomplete read.

A test pins **why** the throw is load-bearing: the gutted output has the same banner and the same
five section headers as a good one. It does not look like an error, which is what made it
survivable in the first place.

## D7 — the fixture is derived from the input, never from the oracle

The golden test's draft is assembled at run time from two sources, neither of which is the
answer: the prose, the signed section and act 2's annotation come from the pre-existing #473
draft; act 2's anchor comes from the pre-promotion target. Only the contract scalars are authored
in the test. A test asserts the constructed draft contains **none** of the three strings the verb
is supposed to generate (the amended Status line, the filled `**Signed**:` line, the `HOME.md`
marker) — otherwise the fixture would be smuggling the oracle in as input and the byte-equality
would prove nothing.

Three harness proofs run before any comparison: history reads are non-empty, the oracle actually
changed all three files, and the pre-promotion tree is self-consistent (its committed `AGENTS.md`
equals a fresh compile). A reader that comes back empty would otherwise make every byte-equality
below it vacuously true — `evidence-reader-empty-on-failure.md`, one layer down.

**The oracle lives in git history, and CI's `local-checks` job checks out at depth 1**, so the
suite fetches the commit before giving up. The first version of that fallback did not work, and
the *first CI run said so*: 13 skipped where a full checkout skips 0. Reproduced in a real
`git clone --depth 1` and measured — `git fetch origin be2d143` fails with *"couldn't find remote
ref"* because an **abbreviated sha is read as a ref name**. With the full 40 characters the fetch
takes about a second, and the suite runs 13/13 in a shallow clone that started without the
commit. The SKIP branch remains for a checkout with no network — reported as skipped, never as a
pass — but it is no longer the CI path.

That first CI result is worth keeping in the record: a skipped acceptance test and a passing one
are the same colour on the PR page. The number that distinguished them was `# skipped 13`.


## D8 — the idempotence key counts FREE anchors (cold review, BLOCKER 2)

The first key was `targetText.includes(replace)`. It is wrong in a way that only shows up on real
doctrine: if a replacement legitimately appears elsewhere in the document — a rule restated in a
summary, a row repeated in a table — a **genuine first promotion** reports "already done" and
leaves the superseded passage standing. That is the harm §1c act 2 exists to prevent, produced by
the tool meant to prevent it. Reproduced against the real `workflow-governance.md`.

The opposite failure is just as reachable, and was found first: an anchor that is a **prefix of
its own replacement** (`## Lockout Recovery` → `## Lockout Recovery (amended …)`) still occurs
exactly once after the edit lands, so an anchor-count key double-applies and stacks the
annotation.

The key that survives both counts what is *left to do*. With f = occurrences of the anchor,
r = occurrences of the replacement, k = occurrences of the anchor inside the replacement:

```
free    = f − r × k
done    ⇔ r ≥ 1 and free === 0
pending ⇔ free === 1
blocked ⇔ anything else
```

One tie is not breakable by counting and is resolved deliberately: a document with one applied
replacement and one free anchor is arithmetically identical to a never-amended document that
quotes the replacement elsewhere (both f=2, r=1, k=1). It resolves to `pending` — the alternative
is refusing a genuine first application, which is the blocker. The human still reads both
before/after texts in the plan.

Occurrences are counted **including self-overlapping matches**. `String.split` counts
non-overlapping ones, so `|---|---|` reported one occurrence of `|---|` while holding two — a
Markdown table separator is a plausible anchor, and "found exactly once" has to mean what it says.

## D9 — the cascade is one unit: all, or none, or a refusal (BLOCKER 1)

The first version had three independent "already promoted" exits, any one of which could fire
with the rest of the cascade undone. The reachable case is the normal one: the human pastes the
signed section by hand — how all three cited precedents were actually done — then runs the verb
to finish the job. It answered `✓ already promoted`, wrote nothing, exited 0, and left the Status
line, the annotations and the `brain/HOME.md` marker unwritten. The marker is the act this
module's own comment calls *"the one with no gate behind it"*.

`promote-516.sh` keyed on the **last** act of the cascade (`grep -qF "Amendment 4, …" HOME.md`);
the verb keyed on the first. Reading one act to conclude something about four is a guess. So the
verb now reads **every** act and has exactly three dispositions:

| every act | disposition |
|---|---|
| pending | apply the cascade |
| done | `cascadeComplete` — and the caller still checks `AGENTS.md`, because §1d act 3 is part of the cascade: an amended ADR with a stale `AGENTS.md` is one act short, which is precisely #529 |
| mixed | **refuse**, naming each act's state and the remedy |

Resuming a partial cascade was considered and rejected for this slice: finishing someone else's
half-edit means guessing what they intended, and §1c is three acts in ONE commit. The refusal
names what is done and what is not, which is what the human needs to repair it. Recorded as an
accepted loss in the ADR-0028 draft rather than left implicit.

## D10 — the write preconditions, because `git add` is not inert (BLOCKERS 3, 5, 6, 8)

Lock 3 read "stages, never commits, never pushes" as a property of the allowlist. It is not:

- **`git add` on an unmerged path marks the conflict RESOLVED.** Run mid-rebase, the verb staged
  `<<<<<<<` markers into `brain/HOME.md` and into the `AGENTS.md` compiled from it, and left git
  believing the merge was settled. The check is repo-wide, not per-path, because `AGENTS.md` is
  compiled from five source docs and a conflict in any of them compiles markers into it.
- **A staged-but-uncommitted edit to a write path is destroyed** — index-only content has no
  reflog. Refused.
- **A symlinked target writes outside the repository**, unstaged and invisible to `git status`,
  which is outside the stage-only lock entirely. Containment is now `realpath` plus
  `lstat().isFile()`, not `startsWith('brain/')`.
- **Worktree-only modifications are disclosed, not refused.** They are recoverable with
  `git checkout --`, and refusing them would block a human with an unrelated edit in flight — but
  staging takes the whole file, so the plan says so above the confirmation prompt.

`status` joined the git allowlist for this. It is read-only, and it is what makes `add` safe; the
property the allowlist protects — no subcommand can produce a commit or a push — is unchanged and
is now asserted by name rather than by the list's length.

**The write loop rolls back.** It was unguarded, and a failure on the second of three files left
the ADR amended, `brain/HOME.md` untouched and nothing staged — a half-applied signed artefact
the human then had to repair by hand, which is the act this verb exists to remove. Each write
keeps the bytes it replaced; a throw restores them in reverse order and reports how many.

## D11 — the slice ships as two PRs, and the seam is the module boundary

At 1423 counted lines against the `lite` tier's 1000, one PR was not an option, and
`size:exception` is a human keystroke. The cut follows the module boundary, which is also the
line the two cold reviewers split along by themselves:

| PR | content | counted |
|---|---|---|
| A | `lib/amendment-draft.mjs` — the contract, the algebra, the cascade assessment — plus its unit suite and the `compileAgentsMd` fail-open fix with its tests | 784 |
| B | `brain-promote.mjs` — the dispatch, the write preconditions, the rollback, the plan surface — plus the locks guard, the golden oracle, the stopgap deletions and the Tier 2 drafts | 639 |

A ships a module nothing calls yet. That is a real cost, and the PR body says so; what it buys is
that the half where BLOCKERS 1 and 2 live is reviewable as pure text-in/text-out algebra with an
exhaustive table, and the half where BLOCKERS 3, 5, 6 and 8 live is reviewable as I/O against a
real repo. Splitting by feature instead (ADR shape now, doc shape later) would have cut ~50 lines
and put half of each defect class in both PRs.
