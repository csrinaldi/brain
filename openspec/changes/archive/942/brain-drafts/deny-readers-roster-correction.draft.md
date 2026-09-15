# The #942 reader roster names what it missed — draft (issue #962)

> **Tier 2 draft. Not yet promoted.** `evidence-reader-empty-on-failure.md` is a
> non-ADR anti-pattern doc, so this is an in-place edit under §1c's shape minus
> the ADR-only acts (no `amendment:`, no `home-summary:`, no Status line).
>
> ```
> npm run brain:promote -- openspec/changes/archive/942/brain-drafts/deny-readers-roster-correction.draft.md
> ```
>
> **Why.** The "Applied at" paragraph promoted from
> `deny-readers-fail-closed.draft.md` lists five readers that stopped
> swallowing a config-read failure. Those five are correct, but the paragraph
> reads as the complete roster, and it is not:
>
> - `brain/scripts/brain-audit.mjs`'s `loadConfig` (`:159-165`) returns `{}` on
>   any error, and `:354` feeds `governance.reviewActors` — the deny set — to
>   `evaluateMerge`. `brain-audit.mjs` is the release gate
>   (`.github/workflows/release.yml`). This is a sixth DENY-direction reader,
>   still failing open, tracked in issue #962.
> - `actor-check.mjs`'s `defaultReadAgentActors` still returns `[]` on failure,
>   correctly: it is ALLOW-direction. The paragraph did not name it, so a reader
>   could not tell it from an overlooked one.
>
> Found by the cold review of PR #960.
>
> **Ordering.** This draft anchors on the paragraph that
> `deny-readers-fail-closed.draft.md` wrote. Promote it only after that draft,
> which is already applied on this branch.
>
> **When #962 ships**, the sentence naming the sixth reader becomes stale and
> needs its own amendment moving `brain-audit.mjs` into the fixed list.

```brain-amendment/1
target: brain/core/anti-patterns/evidence-reader-empty-on-failure.md
issue: 962
```

```amend-find
Applied at `brain/scripts/vcs/actor-check.mjs`'s `defaultReadDenyActors`,
`brain/scripts/vcs/brain-writes-reviewed.mjs`'s `defaultReadBotAllowlist` and
`defaultReadApprovalActors`, and `brain/scripts/approve/cli.mjs`'s
`defaultReadDenyActors` / `defaultReadAgentActors` — five readers that
stopped swallowing a config-read failure (issue #942, R1, R3). The
ALLOW-direction readers in the same files (`actor-check.mjs`'s own
`approvalActors` reader, `governance.ignoreList` consumers,
`approved-label.mjs`) were left unchanged, deliberately: empty is already the
strict answer for them.
```

```amend-replace
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
