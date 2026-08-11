---
status: draft
issue: 340
epic: 335
---

# Proposal — `brain:check` greenlit PRs that CI rejects

## What was wrong

`brain:check` is the verb the golden path tells you to trust before shipping. It reported
**6/6 pass, "Ready to brain:ship"** on PRs whose `issue-link` CI job then failed — observed on
PR #338 and hit again in production on PR #484.

The cause was one rule with two implementations and nothing pinning them together.
`brain:check` called the **pure** check functions; CI calls the **evaluators** that apply
policy on top of them. The pure functions do not know about the base branch, the approved
label, or which issue a memory record is scoped to.

The direction is what makes it a defect rather than a nuisance, and #340 states it: *a local
check stricter than CI is annoying; a local check laxer than CI is a broken promise.*

## The audit found three, not one

#340's last line — *"audit the other five checks for the same divergence before assuming this
one is isolated"* — was the load-bearing instruction. It was. Driven on `main` at `9d49e7a`:

| check | input | local | CI | direction |
|---|---|---|---|---|
| `issueLink` | `Part of #N` on a PR to the default branch | **PASS** | FAIL | **laxer — broken promise** |
| `issueLink` | a closing ref to a **non-approved** issue | **PASS** | FAIL | **laxer — broken promise** |
| `memoryPresence` | a `session_summary` scoped to a **different** issue | **PASS** | FAIL | **laxer — broken promise** |
| `diffSize` | over budget **+** `size:exception` | FAIL | PASS | stricter — safe |
| `adrPresence` | every shape | — | — | aligned since #510 |

Two of the three were invisible to the ticket. The approved-label check and the issue-scoped
memory match are both **policy layers CI grew after `brain:check` was written**, and nothing
noticed either.

## What lands

**`brain:check` calls the CI evaluator.** Not "aligned regexes", not "a second implementation
kept in sync" — `runCheck` from `governance/run-check.mjs`, the same function the CI job
invokes, for `issue-link` and `memory-gate`. There is nothing left to keep in sync because
there is nothing left to be in sync *with*.

`diffSize` and `adrPresence` deliberately stay on the pure functions, and the audit is why:
`adrPresence` is aligned by construction (#510 gave it `addedFiles` and all three enforcement
surfaces pass it), and `diffSize` diverges in the **safe** direction only — CI honours a
`size:exception` label, and no label exists before the PR does. Routing it through the CI
evaluator would mean inventing a label set, which is the one change that could make local
*laxer*.

## The third state

A check whose evidence could not be gathered — no network for the approved-label lookup, an
unresolvable default branch — is now **`[UNVERIFIED]`**, and the verb does not print *"Ready to
brain:ship"* when any exists. It names them, with a remedy.

It is not an exit-1, and that is deliberate: CI fails closed on uncomputable because a merge is
at stake, while a local verb that refuses to run offline is a verb people stop running — the
"gates are obstacles" lesson from #529's ruling. What it must never do is **claim**. Removing
the claim is what removes the defect.

## The two hazards the ticket named

**Hazard 1 — fail closed on an unknown base.** Done, and it is the reason `getDefaultBranch`
has no fallback: `DEFAULT_BRANCH` (the same env var `ci-context.mjs` reads) then git's record
of the remote's default, then `null`. `init.defaultBranch` was tried and removed — it describes
branches git *creates*, not this remote's, so reading it would answer confidently with a value
that has nothing to do with the repo.

The **target** branch is a different problem: no local command can know it, because the PR does
not exist. It defaults to the default branch — the *stricter* rule — with `BASE_BRANCH` as the
explicit opt-out. Assuming "slice" is the permissive guess and would reproduce this ticket
exactly.

**Hazard 2 — first-match-wins on the closing reference.** Confirmed and **filed as #545**, because it is a different defect: this ticket is *two implementations of one
rule*; that one is *one implementation misreading its input*. Bundling them would make the
parity guard hostage to a policy debate about PR prose.

## What makes it not repeat

A **parity suite**: seven fixtures, each describing one change **once**, fed to both surfaces.
Every assertion is one-sided first — local may never pass where CI fails — and then equal on
identical evidence, because a local check hardcoded to fail would satisfy the one-sided rule
while being useless.

Three mutations prove it detects: reverting `brain:check` to the pure calls turns **5 red**,
assuming "slice" on an unresolvable base turns **1 red**, rendering `UNVERIFIED` as `PASS`
turns **2 red**.

That is the same shape as `vcs.contract.test.mjs`'s parameterized parity suite, moved from the
provider seam to the local-gate/CI-gate seam — which is what #340 asks for, and what makes this
belong to M10 (#335).
