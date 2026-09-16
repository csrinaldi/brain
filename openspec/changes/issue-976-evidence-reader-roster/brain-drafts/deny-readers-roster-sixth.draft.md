# The roster paragraph promotes the sixth reader and the approved-label exemption — draft (issue #976)

> **Tier 2 draft. Not yet promoted.** `evidence-reader-empty-on-failure.md` is a
> non-ADR anti-pattern doc, so this is an in-place edit under §1c's shape minus
> the ADR-only acts (no `amendment:`, no `home-summary:`, no Status line).
>
> ```
> npm run brain:promote -- openspec/changes/issue-976-evidence-reader-roster/brain-drafts/deny-readers-roster-sixth.draft.md
> ```
>
> **Why.** `deny-readers-roster-correction.draft.md` (issue #962's exploration,
> merged onto main) named `brain-audit.mjs`'s `loadConfig` as a sixth
> DENY-direction reader "still swallowing the failure, tracked in issue #962."
> PR #969 fixed it (`brain-audit.mjs`'s `loadConfig` now delegates to
> `loadBrainConfigOrThrow`, propagating a read/parse failure to the top-level
> `.catch` instead of swallowing it to `{}`) and merged, closing #962. The
> roster paragraph on `main` is now stale: it still describes the sixth reader
> as broken and still tracked. Issue #962 is CLOSED, so a draft whose contract
> names it fails the promotion gate's issue-link check (an approved OPEN
> issue is required) — this draft carries the same edit forward under #976,
> the follow-up issue opened to promote it. This draft:
>
> 1. Moves `brain-audit.mjs`'s `loadConfig` into the fixed list (six readers,
>    not five, all propagating a config-read failure) and drops the
>    "tracked in issue #962" language, since #962 is closed and the fix is
>    merged.
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
>    `brain/scripts/governance/approved-label.mjs` directly (issue #976 apply
>    batch, re-verifying the same claim issue #962's apply batch made);
>    reported here rather than assumed.
>
> **Ordering.** Anchors on the paragraph `deny-readers-roster-correction.draft.md`
> already promoted onto main. The `amend-find` anchor is unchanged from the
> draft #962 left behind: re-verified byte-identical against
> `brain/core/anti-patterns/evidence-reader-empty-on-failure.md` on this
> branch (fresh off `origin/main`) before this file was written.
>
> **Known gap, not fixed here.** `loadBrainConfigOrThrow` accepts JSON that
> parses but is not an object (`null`, `[]`, `42`, a bare string) and returns
> it as-is; every DENY reader listed below then degrades as if the config
> were empty on that shape, not on a read/parse failure. That gap is tracked
> in issue #975 (open, approved, unfixed as of this draft) and is NOT claimed
> as fixed by this paragraph — the paragraph is about config
> read/parse failures, which #969 fixed for `brain-audit.mjs`, not about the
> non-object-shape gap #975 covers.

```brain-amendment/1
target: brain/core/anti-patterns/evidence-reader-empty-on-failure.md
issue: 976
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
