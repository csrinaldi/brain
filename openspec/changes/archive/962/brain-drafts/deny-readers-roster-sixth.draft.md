# The #962 fix promotes the sixth reader into the roster — draft (issue #962)

> **Tier 2 draft. Not yet promoted.** `evidence-reader-empty-on-failure.md` is a
> non-ADR anti-pattern doc, so this is an in-place edit under §1c's shape minus
> the ADR-only acts (no `amendment:`, no `home-summary:`, no Status line).
>
> ```
> npm run brain:promote -- openspec/changes/issue-962-release-gate-deny-reader/brain-drafts/deny-readers-roster-sixth.draft.md
> ```
>
> **Why.** `deny-readers-roster-correction.draft.md` (issue #962's exploration,
> merged onto main) named `brain-audit.mjs`'s `loadConfig` as a sixth
> DENY-direction reader "still swallowing the failure, tracked in issue #962."
> #962 now fixes it (`brain-audit.mjs:159-179`, this change), so the paragraph
> is stale: it still describes the sixth reader as broken. This draft:
>
> 1. Moves `brain-audit.mjs`'s `loadConfig` into the fixed list (six readers,
>    not five, all propagating a config-read failure).
> 2. Reclassifies `approved-label.mjs`'s `resolveApprovedLabel`. The prior
>    paragraph named it as one of the ALLOW-direction readers "left unchanged,
>    deliberately: empty is already the strict answer for them" — but
>    `governance.approvedLabel` is a single string, not a list, and
>    `approved-label.mjs`'s `main()` (`:52-62`) degrades a config-read failure
>    to the ratified constant `DEFAULT_APPROVED_LABEL = 'status:approved'`
>    (`:19`), never to `[]`/`''`. That is the SAME shape the doc's own
>    "Exemption" paragraph already carves out for `governance-tiers.mjs`'s
>    `resolveTier` — a doctrine-chosen fixed fallback, not a deny/allow list at
>    all — so `approved-label.mjs` belongs there, not in the ALLOW-reader
>    bullet list this section is about. Verified by reading
>    `brain/scripts/governance/approved-label.mjs` directly (issue #962 apply
>    batch); reported here rather than assumed.
>
> **Ordering.** Anchors on the paragraph `deny-readers-roster-correction.draft.md`
> already promoted onto main. Promote this only after #962's code fix lands
> (this change) — the paragraph should not claim `brain-audit.mjs` is fixed
> before it is.

```brain-amendment/1
target: brain/core/anti-patterns/evidence-reader-empty-on-failure.md
issue: 962
```

```amend-find
Applied at `brain/scripts/vcs/actor-check.mjs`'s `defaultReadDenyActors`,
`brain/scripts/vcs/brain-writes-reviewed.mjs`'s `defaultReadBotAllowlist` and
`defaultReadApprovalActors`, and `brain/scripts/approve/cli.mjs`'s
`defaultReadDenyActors` / `defaultReadAgentActors` — five readers that
stopped swallowing a config-read failure (issue #942, R1, R3). A sixth
DENY-direction reader, `brain/scripts/brain-audit.mjs`'s `loadConfig` feeding
`governance.reviewActors` to the release gate, still swallows the failure and
is tracked in issue #962. The ALLOW-direction readers were left unchanged,
deliberately, because empty is already the strict answer for them:
`actor-check.mjs`'s `approvalActors` and `agentActors` readers,
`governance.ignoreList` consumers, and `approved-label.mjs`.
```

```amend-replace
Applied at `brain/scripts/vcs/actor-check.mjs`'s `defaultReadDenyActors`,
`brain/scripts/vcs/brain-writes-reviewed.mjs`'s `defaultReadBotAllowlist` and
`defaultReadApprovalActors`, `brain/scripts/approve/cli.mjs`'s
`defaultReadDenyActors` / `defaultReadAgentActors`, and
`brain/scripts/brain-audit.mjs`'s `loadConfig` (feeding `governance.reviewActors`
to the release gate) — six readers that stopped swallowing a config-read
failure (issue #942, R1, R3 for the first five; issue #962 for the sixth).
The ALLOW-direction readers were left unchanged, deliberately, because empty
is already the strict answer for them: `actor-check.mjs`'s `approvalActors`
and `agentActors` readers, and `governance.ignoreList` consumers.
`approved-label.mjs`'s `resolveApprovedLabel` is not one of them:
`governance.approvedLabel` is a single string, not a list, and a config-read
failure degrades to the ratified constant `'status:approved'`
(`approved-label.mjs:19,56-60`) — the same fixed-fallback shape as
`governance-tiers.mjs`'s `resolveTier` (the Exemption paragraph above), not
an empty-list exemption.
```
