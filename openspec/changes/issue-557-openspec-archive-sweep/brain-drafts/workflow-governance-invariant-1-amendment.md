# Proposed doctrine text — `workflow-governance.md`, Invariant 1 (`issue-link`)

**For human review.** This is a draft insertion, not applied to `brain/core/**` by the
agent (`agent-authorities.md` Tier 2 — `brain/` modifications require a human to move the
artifact from `openspec/changes/**/brain-drafts/` into `brain/`). Proposed as a new
paragraph immediately after the "Four Invariants and Their Gates" table in
`brain/core/methodology/workflow-governance.md`, or as a new subsection alongside
"Invariant 3 scope" / "Invariant 4 scope" (existing precedent for a per-invariant detail
section in that file) — maintainer's call on placement.

---

### Invariant 1 scope — two content-earned exemptions, never a branch-name exemption

The "not skippable" character in the table above means no label bypasses `issue-link` —
there is no `skip:issue-link` the way `skip:memory-gate` exists for Invariant 3. It does
NOT mean the check never yields to anything: two narrow, branch-shaped exemptions exist,
and both share one discipline — **the branch name is a claim, never the proof; the diff's
own content is recomputed and checked before the exemption is granted.**

| Exemption | Branch shape | Content proof | Source |
|---|---|---|---|
| Memory lane | `memory/<host>-<date>` | every changed path is an ADDED `.memory/records/*.jsonl` file | ADR-0034 L1, `checks/lane.mjs#classifyLane` |
| Archive sweep | `auto-archive/<date>` | an exact-content (`git -M100%`) folder rename `openspec/changes/<name>/**` → `openspec/changes/archive/<iid>/**`, plus only pure-addition changes to `openspec/specs/**/spec.md` | ADR-0035, `checks/archive-sweep.mjs#classifySweepDiff` |

Both predicates are recomputed from the ACTUAL diff (`git diff BASE...HEAD`) on every
run — never read from the branch name alone, and never cached from a prior run. A branch
matching the shape with a diff that does not match the content proof falls through to the
ORDINARY `issue-link` rule (closing keyword required on the default branch) — it is never
silently exempted and never silently hard-failed as "uncomputable" (an uncomputable diff
also falls through to the ordinary rule, fail-closed).

**Why not a label.** Both classes are opened by unattended automation (a memory collector,
a post-merge sweep job) with no human in the loop to apply a skip label, and — more
importantly — a self-applied label would be exactly the spoofable shortcut this doctrine
exists to prevent. The content proof is the whole point: it is cheaper to compute than to
trust.
