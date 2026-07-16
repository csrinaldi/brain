# ADR (DRAFT) — External-reviewer VCS port verbs + the `reviewActors` / `approvalActors` two-key split

> **Status:** Draft — agent-authored, awaiting human promotion and signature (Tier 2 / ADR-0013:
> the agent drafts to `brain-drafts/`, the human promotes to the decisions store and signs).
> The final ADR number is assigned on promotion.
>
> **Change:** Track H (issue #266), phase H0. First slice: `issue-266-h0a-reviewer-protocol-doctrine`.
> **Base:** `feature/v2.0.0@3174492d`. **Approval:** external reviewer rev-2 APPROVE
> (issue #266 comment 4986616224).

## Context

The external reviewer is real and load-bearing today but human-mediated: a human relays a
checkpoint report to the reviewer and relays the verdict back. The role — verify against the
server, rule design forks against doctrine, sequence parallel work — is mechanizable. The single
piece of judgment that must stay human is the *keystroke* (`status:approved`, `override:*`,
`size:exception`), not the whole role.

Automating the reviewer creates one hazard that shapes everything else. `brain:protect` sets
`required_approving_review_count: 1` on `main`, and L6 (`brain/scripts/vcs/brain-writes-reviewed.mjs`)
counts any review with `state === 'APPROVED'` from a non-author, non-allow-listed login as *the*
human review of a `brain/**` write. A reviewer agent running `gh pr review --approve` would satisfy
branch protection **and** the brain-writes gate in one call — it would become a merge authorizer.
The asymmetry cannot be a rule the agent remembers; it must be structurally impossible.

A second, subtler coupling was found during cold review (finding **H0-LOCK3-DUAL**, issue #266
comment 4974795208). Today `governance.approvalActors` feeds `botAllowlist` in **two** gates with
**opposite** semantics:

- **L6** (`brain-writes-reviewed.mjs`): restrictive — an allow-listed APPROVE does **not** count as
  the human review.
- **L5** (`brain/scripts/vcs/actor-check.mjs`, `evaluateActor`): permissive — an allow-listed actor
  applying `status:approved` returns `{ level: 'pass', reason: 'allow-listed automation identity' }`.

Registering the reviewer handle in that one key would de-authorize it at L6 **and** authorize it to
self-apply `status:approved` at L5 — the exact self-authorization the design forbids, hidden behind
one config line.

## Decision

**1. Add four write verbs to the VCS port, all incapable of approving.**

| Verb | Contract |
|---|---|
| `prReviewComment({ project, number, body })` | `event: 'COMMENT'` **hardcoded** — no APPROVE code path exists |
| `issueComment({ project, number, body })` | rulings on issues |
| `labelAdd({ project, number, labels })` | caller enforces the deny-set (monotonic tightening only) |
| `labelRemove({ project, number, labels })` | caller enforces the deny-set |

Both providers (`brain/scripts/vcs/providers/github.mjs`, `.../gitlab.mjs`) implement them or the
verb-contract drift-guard turns red. Adding verbs to the port is itself a decision (this ADR +
`decision` label), by the protocol's own rule (`brain/core/methodology/vcs-contract.md`,
`brain/scripts/vcs/cli.mjs` `VERBS`).

**2. Split `governance.approvalActors` into two single-semantic keys, each read by exactly one gate.**

- `governance.reviewActors` (**NEW**) — "these identities do **not** count as the human reviewer."
  Read **only** by L6. The human-approver search excludes `author + reviewActors`. The reviewer
  handle registers **here and only here**.
- `governance.approvalActors` (**EXISTING**, semantics unchanged) — "these identities **may**
  legitimately apply `status:approved`." Read **only** by L5. The reviewer handle **never** appears
  here.

No key feeds two gates. The dual-semantics coupling is dissolved by construction, not by convention.
(Human decision, csrinaldi 2026-07-14: "la separación de la lista en dos es la correcta" — issue
#266 comment 4975121847. Durable record: `.memory/records/` `rec-1efa1893e1427623`.)

## Consequences

**The three structural locks against reviewer-as-authorizer** (any one failing leaves the other two):

1. verdicts post as **COMMENT-state** reviews (`prReviewComment`, `event: 'COMMENT'`) — L6 ignores
   `COMMENTED` by construction, so a verdict cannot be miscounted as an approval;
2. the VCS adapter **never gains an approve capability** — there is no code path to emit APPROVE;
3. the reviewer handle lives in `reviewActors` (L6-only) and never in `approvalActors` (L5-only).

**Two mandatory tests gate the landing of the two-key split** (the decision does not land without
both — they belong to the implementation slice, H0-b):

- **t1** — the reviewer identity does **not** pass `actor-check` when applying `status:approved`;
- **t2** — the reviewer identity **is** excluded from the L6 human-approver count.

Because `actor-check` independently rejects a misapplied `status:approved` from any identity not in
`approvalActors` — and the reviewer is never in `approvalActors` — a deny-set bug in the caller is
still caught downstream. The claim "actor-check independently catches a misapplied `status:approved`"
becomes true again for the reviewer identity precisely because of the split.

**Labels: monotonic tightening only.** The reviewer may apply labels that make a gate stricter
(`decision`, `seq:*`, `reviewed:*`, `needs-ruling`) via `labelAdd`, and never ones that loosen
(`size:exception`, `skip:memory-gate`) or unlock (`status:approved`). The deny-set is hardcoded in
the caller, not left to the model; L5 `actor-check` is the independent backstop.

**Files touched at implementation (H0-b):** `brain/scripts/vcs/cli.mjs` (`VERBS`),
`brain/scripts/vcs/providers/{github,gitlab}.mjs`, `brain/scripts/vcs/actor-check.mjs`,
`brain/scripts/vcs/brain-writes-reviewed.mjs`, `brain.config.json` (the two governance keys),
`brain/core/methodology/vcs-contract.md`.

## References

- Issue #266 body (Track H design, rev-2 APPROVE).
- rev-1 verdict / finding H0-LOCK3-DUAL: issue #266 comment 4974795208.
- Human decision: issue #266 comment 4975121847.
- rev-2 APPROVE + binding conditions: issue #266 comment 4986616224.
- Durable records: `rec-1efa1893e1427623` (decision), `rec-ed1c325e24addf22` (design-off meta-finding).
