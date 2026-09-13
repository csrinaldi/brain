# Direction decides whether empty is safe — draft (issue #942)

> **Tier 2 draft. Not yet promoted.** `evidence-reader-empty-on-failure.md` is a
> non-ADR anti-pattern doc, so this is an in-place edit under §1c's shape minus
> the ADR-only acts (no `amendment:`, no `home-summary:`, no Status line).
>
> ```
> npm run brain:promote -- openspec/changes/issue-942-deny-fail-closed/brain-drafts/deny-readers-fail-closed.draft.md
> ```
>
> **Path note for the promoter**: this command is correct as written while the
> change is unarchived, under `openspec/changes/issue-942-deny-fail-closed/`.
> After `/sdd-archive` moves the change to `openspec/changes/archive/942/`, the
> equivalent path becomes
> `openspec/changes/archive/942/brain-drafts/deny-readers-fail-closed.draft.md`
> (the convention every archived change's `brain-drafts/` already follows —
> see `openspec/changes/archive/193/brain-drafts/`). Run whichever path exists
> at promotion time; do not run both.
>
> This draft does NOT change the existing rule that `null` (uncomputable) and
> `[]`/`''` (genuinely empty) are distinct states a REQUIRED gate must not
> conflate. It states the missing half: which readers are ALLOWED to
> manufacture `[]` on a config-read failure in the first place, and which are
> not.
>
> **In-flight collision check** (design.md D6): grepped every
> `openspec/changes/*/brain-drafts/**` at authoring time — no unarchived draft
> targets `evidence-reader-empty-on-failure.md`. If a sibling draft lands on
> this same anchor before this one promotes, re-anchor one of the two to a
> different unique line; `assessEdit`'s uniqueness gate (`free === 1`) refuses
> to guess which one wins.

```brain-amendment/1
target: brain/core/anti-patterns/evidence-reader-empty-on-failure.md
issue: 942
body: ## Direction decides whether empty is safe (issue #942)
```

```amend-find
`null` — REQUIRED gates fail closed ("cannot fetch labels — failing closed"),
```

```amend-replace
`null` — REQUIRED gates fail closed ("cannot fetch labels — failing closed"),
and — for a DENY/exclusion-list reader specifically — this rule is not
satisfied by returning `[]` on a config-read failure either; see "Direction
decides whether empty is safe" below (issue #942),
```

## Direction decides whether empty is safe (issue #942)

The rule above is direction-agnostic on its own: it says a REQUIRED gate must
fail closed on `null`, but not which readers are allowed to manufacture
`null` as `[]` in the first place. Issue #942 names the missing half.

- **A reader that supplies a DENY or exclusion list** (an identity a gate
  must refuse, or exclude from a count) MUST propagate a config read/parse
  failure rather than returning `[]`. Empty is the PERMISSIVE answer in that
  direction — it denies/excludes nobody — so a `catch { return []; }` there
  is a fail-open wearing the shape of a safe default.
- **A reader that supplies an ALLOW or exemption list** (an identity a gate
  excuses, or a fallback a gate treats as absent) MAY still degrade to `[]`
  on the same failure. Empty is the RESTRICTIVE answer in that direction —
  it excuses/admits nobody — so the existing `catch { return []; }` pattern
  above stays correct there, unchanged.

| Direction | Empty means | `catch { return []; }` is |
|---|---|---|
| DENY / exclusion list | nobody is denied/excluded | fail-open — WRONG |
| ALLOW / exemption list | nobody is excused/admitted | fail-closed — safe, unchanged |

**Exemption**: a ratified tier default — `governance-tiers.mjs`'s `resolveTier`
falling back to `'standard'` on an absent `governance.tier`, or a
never-throwing tier-resolution helper built specifically to run safely from
inside an already-failed catch block (`resolveTierForFailure`, duplicated
per file rather than shared across gates) — is not a deny/allow reader at
all. It is doctrine choosing one fixed fallback value on purpose, ratified
and reviewed on its own terms (REQ-TIER-10), and this rule does not reopen
it.

Applied at `brain/scripts/vcs/actor-check.mjs`'s `defaultReadDenyActors`,
`brain/scripts/vcs/brain-writes-reviewed.mjs`'s `defaultReadBotAllowlist` and
`defaultReadApprovalActors`, and `brain/scripts/approve/cli.mjs`'s
`defaultReadDenyActors` / `defaultReadAgentActors` — five readers that
stopped swallowing a config-read failure (issue #942, R1, R3). The
ALLOW-direction readers in the same files (`actor-check.mjs`'s own
`approvalActors` reader, `governance.ignoreList` consumers,
`approved-label.mjs`) were left unchanged, deliberately: empty is already the
strict answer for them.
