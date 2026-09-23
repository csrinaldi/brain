# Draft — ADR-0026 Amendment 1: `lite` distinct-act re-arms only on foreign commits (issue #418)

**Status: DRAFT — awaiting a human signature.** This amends a ratified ADR
(`brain/project/decisions/adr-0026-governance-doctrine-tiers.md`), so it is a doctrine
ruling, not a code decision: the same shape as ADR-0027's ratification. Nothing in this
change folder proceeds to code until this draft is signed (accepted, amended, or
rejected) by the owner.

**Precondition satisfied:** #413 (reviewer identity verified against the token) —
PR #424. The `reviewActors` exemption below is only safe with a verifiable reviewer
identity; before #413 anyone holding any token could *declare* themselves the bot.

---

## 1. What changes — the evidence-table row

**Current row (`actor-check`, ADR-0026 §"Never-tiered by position"):**

> | `actor-check` | **distinct act** — the approval event is strictly later than the head-commit push | distinct act **+ distinct actor** | + the approver authored no commit on the branch |

**Replacement row:**

> | `actor-check` | **distinct act over foreign commits** (Amendment 1, #418) — the approval event is strictly later than the latest *foreign* commit: one authored by anyone other than the approver or a registered `governance.reviewActors` identity. Commits by the approver or a verified reviewer identity never re-arm an existing approval. An author that cannot be resolved to an account counts as **foreign** (fail closed). With no foreign commit on the branch, any approval event satisfies the evidence. | distinct act **+ distinct actor** — unchanged: the approval postdates the head-commit push | + the approver authored no commit on the branch — unchanged |

`standard` and `regulated` are untouched: there the approver is never the author, so
"did the code change after approval?" genuinely asks *did someone slip work past the
reviewer* — a property worth its cost.

## 2. Appended amendment section (full text to add at the end of ADR-0026)

> ## Amendment 1 — `lite` distinct-act re-arms only on foreign commits (issue #418)
>
> **Signed:** _pending_ · **Date:** _pending_
>
> The original `lite` evidence compared the approval event against the head-commit
> push. Measured cost (#418, during #396): five pushes required five re-applications
> of `status:approved`, and each fresh signature certified nothing the approver did
> not already know — at `lite` the approver is *allowed* to be the author, so the
> check degrades from "did someone slip work past the reviewer" to "did you keep
> working on your own branch". The cost scales linearly with iteration count; the
> security value at n=1 is near zero. It also structurally blocks the automated
> review loop (#409): every agent fix-push would demand a fresh human signature,
> defeating the automation it gates.
>
> Amended rule at `lite`: a push **re-arms** the approval requirement only when its
> author is *foreign* — neither the approver nor a registered
> `governance.reviewActors` identity. Uncomputable authorship is foreign (fail
> closed). The stale-green property #328 fixed is retained against every actor whose
> work the approver has not seen: any third-party push still invalidates the
> approval.
>
> Accepted losses, recorded rather than implied:
>
> 1. **The n=1 "final state" look is gone.** A solo maintainer can approve once and
>    keep pushing. This is the point of the amendment, and it is a real loss — the
>    old rule did force a glance at the final state. Judged near-zero value against
>    linear cost, per #418.
> 2. **A `reviewActors` identity can push after approval without re-arming.** Bounded
>    three ways: the identity is verifiable (#413), it is registered by the owner in
>    config (an L6-only key that never grants approval, per the L5/L6 separation),
>    and `brain-writes-reviewed` still fails any `brain/**` change authored by a
>    reviewer identity at every tier. Residual: for non-`brain/**` paths the bot
>    could land post-approval content that no human re-signed. If that residual is
>    unacceptable, the narrower alternative is to drop the `reviewActors` exemption
>    and keep only the approver exemption — the automated loop then still needs one
>    human re-label per bot push.

## 3. Honest residuals the signature should weigh

- **GitLab gets no relief.** `prCommits()` on GitLab cannot resolve commit authors to
  accounts (`login: null`, the documented residual) — every author is uncomputable ⇒
  foreign ⇒ the behavior on GitLab is exactly today's. Honest, safe, and unequal
  across providers until the GL authorship residual is solved.
- **Unattributed authors get no relief either — including the CCR pattern.** Commits
  authored as `Claude <noreply@anthropic.com>` (this repo's own agent-session
  convention) do not resolve to the approver's account ⇒ foreign ⇒ re-arm. The
  amendment relieves exactly the commits attributed to the approver's account or to a
  registered reviewer identity — nothing else. The operator-side workaround is to
  attribute session commits to an account in one of the two exempt sets; the
  fail-closed default is correct without it.
- **The exemption set is config.** Whoever can edit `governance.reviewActors` can mint
  a non-re-arming identity. Unchanged trust model — that key already gates L6 — but
  this amendment raises what the key buys; worth saying out loud.

## 4. Alternatives rejected (from #418, confirmed here)

- **Approval scoped to PR creation** — drops the final-state property at *every* tier.
- **Content-scoped re-arming** (docs/tests don't re-arm) — fragile, gameable.
- **Document the cost and accept it** — viable only while every push is human; #409
  ends that.

## 5. On signature

The signed section lands in `brain/project/decisions/adr-0026-governance-doctrine-tiers.md`
(row replacement + appended amendment), `brain/HOME.md` stays as-is (already indexes
ADR-0026), the PR carries the `decision` label, and the code in this change folder's
spec proceeds. Rejection closes #418 with the recorded reason.
