# ADR-0026 Amendment 6 — draft (issue #94)

> **status:** Tier 2 draft. Not yet promoted. ADR-0026 is already signed, so this is an
> in-place amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- brain-drafts/adr-0026-amendment-6.draft.md
> ```
>
> The verb renders the plan, waits for the typed word, performs §1c's three acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops.
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0026-governance-doctrine-tiers.md
amendment: 6
issue: 94
home-summary: the platform `required_approving_review_count` is a tier parameter — 0 `lite`, 1 `standard`, 1 `regulated`, #94
body: ## Amendment 6 — the platform review count is a tier parameter (issue #94)
body-end: ### Notes for the promoter
```

```amend-find
| diff budget | 1000 | 400 | 200 |
```

```amend-replace
| diff budget | 1000 | 400 | 200 |
| `required_approving_review_count` | **0** | **1** | **1** |
```

## Amendment 6 — the platform review count is a tier parameter (issue #94)

**Signed**: DD/MM/YYYY — <Name>

### What changed

The doctrine parameters table gains a row: **`required_approving_review_count`** — 0 at `lite`,
1 at `standard`, 1 at `regulated`. `brain:protect` reads it from the resolved tier the same way
it already derives the required-context set from `requiredJobs(tier)`.

### Why

`checks` was tier-derived; the review count was not. The call site omitted it entirely and
`github.mjs`'s `branchProtect` defaults the parameter to `1`, so **the value armed on the
platform came from a function signature rather than from doctrine**. There was no flag, no
config read, and no report of what had been set.

At n=1 the consequence is not cosmetic. GitHub forbids a pull-request author approving their own
pull request, so `required_approving_review_count: 1` blocks every PR in a single-maintainer
repository, permanently, until an admin bypasses. A verb described as idempotent moved `main`
into a state its only maintainer could not merge through, and said nothing.

Measured on this repository 13/08/2026: the live value was `0` and correct — held by nobody
having run `brain:protect` since 05/08/2026, not by anything in code. The state was right and
undefended, which is the inverse of the usual failure: not a protection claiming more than it
does, but a correct one that appears durable and is not.

### The values, and why `regulated` is 1

- **`lite` → 0.** `brain-writes-reviewed` already rules that a human author suffices for a
  `brain/core/**` write at this tier (REQ-L6-1'). Arming 1 imposes a `standard` posture on a
  repository that declares `lite`.
- **`standard` → 1.** L6's human approver is `approvers.find(a => a !== author &&
  !botAllowlist.includes(a))`. A non-author human is the point of the tier.
- **`regulated` → 1, deliberately not 2.** The *"panel ≥ 2, consensus-gated"* row already in
  this table is the **reviewer verdict mode** — how many engines produce the verdict — not the
  human approval count. Reading it as an approval count would be inventing doctrine, which
  `reviewer-protocol.md` §5 forbids. If `regulated` should demand two human approvals, that is a
  separate decision with its own reasoning, not an inference from an adjacent row.

### What this does NOT do — the n=1 coupling, recorded rather than enforced

A tier requiring a second approver is still selectable by a repository that has only one, and
choosing it still yields an unmergeable `main`. Enforcing otherwise needs a verb that enumerates
who can approve, and the VCS port has none of its 26 — adding one is a port widening, i.e. a
`decision`-labelled change with its own ADR (ADR-0020's rule). Out of scope here, and named so
it is a known limitation rather than an assumption.

What closes the silent half is that `brain:protect` now **prints the armed count and the tier
that produced it**, on the same surface as the required checks. The number was never wrong; its
origin was invisible.

### The escape hatch this amendment refuses

`csrinaldibot` holds `write` and looks like the second approver that would make `1` satisfiable
at n=1. It is not usable for that. L6 excludes `governance.reviewActors` identities from the
human-approver count, and `reviewer-protocol.md` §2 Lock 1 exists precisely so a review
identity's verdict can never count as an approval. Such an approval would satisfy GitHub's
counter and fail brain's own gate on any `brain/**` change, while dissolving the asymmetry the
reviewer protocol is built on. Recorded here so it is refused on the record.

### Red-proof

`brain-protect.test.mjs` drives the real `activateProtection` through an injected provider spy
and asserts the arguments it sends: `requiredReviews` is PRESENT — its absence is the defect,
since omission hands the decision to the provider default — and carries the tier's value, for
all three tiers. Two consecutive runs send byte-identical protection. A fourth test pins that
the armed count and its tier are reported.

Three mutations, each diffed against the pre-mutation file and read back from disk before the
result was trusted: omitting the argument, arming `lite` at 1, and deleting the report line.
All three turn tests red — the third only after the sweep found it pinned by nothing, which is
recorded because the report line is half of what this amendment delivers.

### References

- #94 (this amendment) · `brain/scripts/brain-protect.mjs` `protectionFor` ·
  `brain/scripts/vcs/governance-tiers.mjs` `TIER_PARAMS` ·
  `brain/scripts/vcs/providers/github.mjs` `branchProtect`
- REQ-L6-1' (`brain-writes-reviewed.mjs`) — why `lite` is 0
- `reviewer-protocol.md` §2 Lock 1 — why the reviewer handle cannot be the second approver
- #442 / D5 — `regulated` unsatisfiable at n=1, the same finding one gate over

### Notes for the promoter

Act 2 adds a row rather than annotating a superseded one — nothing in the table is superseded,
a parameter is added — so there is no `**[Amended by …]**` marker, and that is deliberate rather
than an omission. §1c act 2 exists so a reader who never scrolls is not left with a rule that no
longer holds; here there was no prior rule to leave them with.

The table has **four** columns. An earlier hand-written version of this amendment put the
annotation in a fifth cell, which markdown would have dropped — the reason this went back
through the verb.
