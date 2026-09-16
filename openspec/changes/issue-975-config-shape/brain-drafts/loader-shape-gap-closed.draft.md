# The #975 fix closes the shape gap #980's PR description names as open — draft (issue #975)

> **Tier 2 draft. Not yet promoted.** `evidence-reader-empty-on-failure.md` is a
> non-ADR anti-pattern doc, so this is an in-place edit under §1c's shape minus
> the ADR-only acts (no `amendment:`, no `home-summary:`, no Status line).
>
> ```
> npm run brain:promote -- openspec/changes/issue-975-config-shape/brain-drafts/loader-shape-gap-closed.draft.md
> ```
>
> **Why.** PR #980 (issue #976, OPEN at the time this draft was written —
> verified via `gh pr view 980` / `gh pr diff 980`, not assumed; #980 has
> since **merged** into `origin/main` at `0dfac874`, and `git show
> origin/main:brain/core/anti-patterns/evidence-reader-empty-on-failure.md`
> confirms the merged text matches the anchor below verbatim) rewrites the
> "Applied at" paragraph to name six readers as readers that
> "stopped swallowing a config-read **failure**" — a true statement, and
> exactly what #969/#962 fixed. #980's own PR description says explicitly:
> "`loadBrainConfigOrThrow` still accepts JSON that parses but is not an
> object … That is #975, open and approved" — a known gap, deliberately not
> closed by #980. #975 (this change) closes it: `loadBrainConfigOrThrow` now
> also throws when the parsed value is not a plain object. Once #975 lands,
> #980's "known gap, not closed here" framing (in its PR description, not in
> the promoted doctrine text itself) is stale. This draft:
>
> 1. Does NOT touch any text #980 promotes — the `amend-find` below is
>    anchored on the paragraph exactly as `gh pr diff 980` shows it landing,
>    read verbatim from the diff, not paraphrased.
> 2. Appends one sentence recording that the shape gap named in #980's PR
>    description is now closed, with the issue number, so a future reader of
>    the doctrine file (not the PR description, which is not doctrine) sees
>    the closure.
>
> **Ordering — this draft applies only where the target includes #980.**
> The `amend-find` block is the POST-#980 paragraph text. #980 merged into
> `origin/main` (`0dfac874`), and this branch then merged `origin/main`
> (`34e9c2b6`), so the target file here carries that paragraph and
> `assessEdit` reports the anchor found exactly once (`pending`, `free: 1`) —
> measured, not assumed, and recorded in `apply-progress.md` together with the
> earlier `blocked` result from before the merge. Against a target that
> predates #980 the anchor is simply not found, so a promotion there is a
> no-op refusal rather than a silent corruption. `brain:promote` was never
> invoked for this draft: promoting it is the maintainer's separate act.

```brain-amendment/1
target: brain/core/anti-patterns/evidence-reader-empty-on-failure.md
issue: 975
```

```amend-find
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
an empty-list exemption. Issue #975 closed a second failure mode on the same
loader: JSON that parses but is not a plain object (`null`, an array, a
number, a string) used to degrade exactly like `{}`, the same fail-open, one
shape gap removed from a read failure. `loadBrainConfigOrThrow` now throws
on that shape too, naming the path and the JSON type found, so every reader
named above propagates it the same way it already propagates a read/parse
failure.
```
