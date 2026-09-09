---
status: tasked
issue: 886
epic: 864
---

# Proposal — #886 `mrAutoMerge`: the port learns to arm a merge, and to refuse one

Parent: #864 (memory 2.0), task 2.5 — Wave 3. Slice of the #862 ruling (ADR-0034 L2).

## What is wrong today

The VCS port can open a merge request and it cannot finish one. Every merge in this repository
is a human clicking a button. The memory lane (#862) is a PR nobody should have to read: its
diff is additions under `.memory/records/` only, its checks are the whole review, and at `lite`
(`requiredReviews: 0`) the tier already says no human signature is required. Without a port verb
the lane stops at "PR opened" and memory keeps arriving on `main` when someone remembers to
click — the 21.6 h p50 the epic exists to kill.

The dangerous half is the other tier. At `standard`/`regulated` the same collector must NOT
merge. Whatever ships must refuse **audibly**, never silently pretend.

## What lands

`mrAutoMerge` on both providers, in `cli.mjs`'s `VERBS`, in the contract doc, with its contract
tests. Nothing calls it yet.

## Decisions

### D1 — Where the tier refusal lives

| option | what it means | cost |
|---|---|---|
| (a) caller pre-check | the verb always arms; #888 resolves the tier and never calls it above `lite`. design.md's literal signature | the invariant "never merge without the review the tier demands" is re-implemented in every future caller; a caller that forgets merges unreviewed records to `main` |
| **(b) explicit `requiredReviews` parameter** | `mrAutoMerge({ ..., requiredReviews = 1 })` refuses before touching the provider. Mirrors `branchProtect` (github.mjs:263) — the one precedent verb that needs tier data and takes it as a parameter instead of reading config | design.md's signature snippet gains a parameter; the slice records the delta |
| (c) the verb reads `brain.config.json` | no parameter at all | the port stops being pure w.r.t. config, and a test would need a config fixture to prove a refusal |

**Recommendation: (b), defaulting to `1`.** The default is the argument: an omitted
`requiredReviews` REFUSES. A verb whose forgotten parameter merges without review is a verb
whose safe behaviour depends on everyone remembering. `branchProtect` already defaults to `1`
for the same reason.

**Delta recorded against archived `design.md:152`** — the signature becomes
`mrAutoMerge({ project, number, requiredReviews = 1, apiBase?, token?, proxyUrl?, fetchImpl? })`.
It is an addition and a removal (D3), not a reinterpretation. ADR-0034 L2's wording
("`mrAutoMerge` refuses") is what (b) implements literally.

### D2 — What `unsupported` covers

Measured on `csrinaldi/brain` (2026-09-09): `allow_auto_merge: false`. **Today, on this repo,
`gh pr merge --auto` fails.** `unsupported` is a live outcome, not a hypothetical.

| option | what it means | cost |
|---|---|---|
| **(a) `unsupported` = the forge refuses the operation itself** | GitHub: stderr matching the "auto-merge is not allowed for this repository" class. GitLab: `gitlabApiFetch` throws `GitLab API failed: <status> (<path>)` (gitlab-api.mjs:65) — `405`/`406` (MR not mergeable / merge-when-pipeline-succeeds unavailable) classify here. Everything else — network, 5xx, `401`/`403` — is `transport`, with the cause in `error` | one regex per provider, pinned to a REAL captured string |
| (b) fold it into `transport` | two reasons instead of three | a caller cannot tell "retry later" from "this repository will never do this"; the second needs a maintainer, not a retry |

**Recommendation: (a).** Classification by stderr / API-status regex, exactly `branchProtect`'s
discipline (github.mjs:283). **The fixture string must be CAPTURED from the live failure during
TDD, never invented** — an invented pattern is green in test and inert in production.

### D3 — `method`

| option | what it means | cost |
|---|---|---|
| **(a) squash, hardcoded** | no parameter. GitHub `--squash`; GitLab `squash: true` in the payload. Precedent: `prReviewComment`'s event is hardcoded `COMMENT` (REQ-266-3 lock 2) | design.md's `method = 'squash'` parameter is dropped — a second recorded delta |
| (b) parameter defaulting to `'squash'` | future flexibility | nothing sets it; it is a way for a future caller to put a merge commit of raw records on `main` without a ruling |

**Recommendation: (a).** The lane's PR contract (design.md:146) says squash unconditionally. A
parameter no caller uses is an unlocked door, not flexibility.

### D4 — Outcome vocabulary

```
-> Promise<{ enabled: true, url } | { enabled: false, reason, error? }>
   reason ∈ 'requires-human-approval' | 'unsupported' | 'transport'
```

- **`enabled: true` means AUTO-MERGE IS ARMED. It never means merged.** The forge merges later,
  if and when the required contexts go green (6 on `main` today). A caller that reads it as
  "merged" will report memory on `main` that is not there.
- Fixed key set, pinned by `Object.keys(result).sort()` like `branchProtect`
  (vcs.contract.test.mjs:2217). No `merged`, no `sha`, no provider field survives.
- `url` is `string | null`. GitLab's merge response carries `web_url`; **GitHub's
  `gh pr merge --auto` prints a confirmation line, not a URL** (to be confirmed in TDD). Where
  the provider reports none, `url` is `null` — never constructed from `project` + a guessed host
  (that is `repoCloneUrl`'s recorded latent defect, and `prView`'s `null` = uncomputable rule).
- Never throws, on any path.

### D5 — The Tier-2 doc row, and the guard that will not wait for it

**Measured**: `verb-contract-drift-guard.test.mjs:30` reads the COMMITTED
`brain/core/methodology/vcs-contract.md`. It is bidirectional:

- check 3 (`:120`) — both providers export `mrAutoMerge` ⇒ it MUST be in `VERBS`;
- check 2 (`:82`) — it is in `VERBS` ⇒ it MUST be a row in the doc table;
- check 1 (`:74`) — a doc row ⇒ it MUST be in `VERBS`.

**Consequence: code and doc row are inseparable in BOTH directions.** A doc-first promotion PR
breaks check 1; a code-first PR breaks check 2. A `brain-drafts/` file alone leaves the branch
red, because the guard does not read drafts. And consolidation-protocol.md:102 forbids an agent
committing to `brain/core/**`.

| option | what it means | cost |
|---|---|---|
| **(a) one PR, two authors** | the agent writes code, tests, and `brain-drafts/vcs-contract.draft.md` (`brain-amendment/1`, `amend-find`/`amend-replace` on the `mrCreate` row + the adapter table, validated by `planAmendment`, amendment-draft.mjs:681). The maintainer runs `brain:promote` **on this branch**, authoring the commit that lands the row. CI goes green only after the human signature | the branch is red until the promotion commit; the maintainer's sitting is inside this PR, not after it |
| (b) allowlist the verb in `DOCUMENTED_BUT_NOT_REQUIRED` | green without the row | records that a contract verb is a probe — a lie in the guard, and the removal is a thing to forget |
| (c) ship one provider only | check 3 never fires | breaks port parity and the ruling; leaves the port half-implemented |

**Recommendation: (a).** The red branch is the feature: it makes the human gate a
**precondition of the merge**, not a follow-up. Both #862's and #863's promotions worked this
way.

### D6 — Scope

**In**: `mrAutoMerge` in `github.mjs` and `gitlab.mjs`; `'mrAutoMerge'` in `cli.mjs`'s `VERBS`
(:38-46); an `MR_AUTO_MERGE_PROVIDERS` block in `providers/vcs.contract.test.mjs`; the
`brain-drafts/vcs-contract.draft.md` (verb row + Phase-3 adapter row).

**Out / non-goals**: the caller (#888, lane push + PR); the collector (#887/3.1a); flipping
`allow_auto_merge` on the repository and any production enablement (#805 gates ENABLING
auto-merge, not building the verb); the `lane-paths`/`lane-scrub` contexts (#889/3.1c); any
change to `mrCreate` or to an existing verb; any `brain:*` npm verb.

**Capabilities (spec contract)**: none new, none modified under `openspec/specs/**` — this repo
keeps that tree empty; the normative surface is `brain/core/methodology/vcs-contract.md`.

## Impact on #888

#888 receives a verb that answers three ways and never throws. Its contract:

- pass `tierParams(resolveTier(loadBrainConfig())).requiredReviews` — do not compute the refusal;
- treat `{enabled:true}` as **armed**, and report the lane as "waiting on checks", not "merged";
- treat `{enabled:false, reason:'requires-human-approval'}` as the normal `standard`/`regulated`
  outcome — a state to report, never an error;
- treat `unsupported` as "tell the maintainer", `transport` as "retry".

## STRICT TDD

Tests first, in this order:

1. `brain/scripts/vcs/providers/vcs.contract.test.mjs` — `MR_AUTO_MERGE_PROVIDERS` mirroring
   `BRANCH_PROTECT_PROVIDERS` (:2168-2228): armed → `{enabled:true,url}`; **tier refusal with the
   provider seam asserted UNCALLED**; `unsupported` from the captured failure string; `transport`;
   fixed key set; never throws. GitHub via `setSpawn`, GitLab via injected `fetchImpl` — no
   network, no fixture files for a mutating verb.
2. `verb-contract-drift-guard.test.mjs` — not edited; it must go from red to green by itself.
3. Then `github.mjs`, `gitlab.mjs`, `cli.mjs`, then the draft.

## Changed-line estimate (400-line budget)

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**` from the counted
diff (`diff-size-count.mjs`).

| path | counted lines |
|---|---|
| `brain/scripts/vcs/providers/github.mjs` | ~40 |
| `brain/scripts/vcs/providers/gitlab.mjs` | ~45 |
| `brain/scripts/vcs/cli.mjs` | ~2 |
| `brain/core/methodology/vcs-contract.md` (promotion commit) | ~4 |
| **counted total** | **~90 — Low risk** |
| uncounted but reviewer-visible: contract tests ~140, draft ~40 | ~180 |

One PR. No chaining needed.

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| The GitHub `unsupported` regex is invented and never matches in production | Med | capture the live stderr from this repo (`allow_auto_merge:false`) into the fixture during TDD; do not write the pattern first |
| A caller reads `enabled:true` as "merged" | Med | the word is in the contract row, the doc, and a test name; #888's contract above states it |
| The branch sits red waiting for the promotion commit | High (by design) | expected; D5 makes the human gate a merge precondition. Do not "fix" it by allowlisting the verb |
| GitLab's merge endpoint merges IMMEDIATELY when no pipeline exists | Med | the lane's required contexts are the precondition; document it as a residual and let #889 supply them. Same footnote applies to GitHub's `--auto` |
| `gh pr merge` resolves the repo from the git remote, like `mrCreate` | Low | pass `--repo {project}` explicitly — a design-phase detail, flagged here |

## Rollback

Revert the PR. The verb has no callers, no config key, no migration, and no state: removing the
export, the `VERBS` entry and the doc row in one revert leaves the drift guard green and every
other verb untouched. Nothing on the repository (`allow_auto_merge`) was changed by this slice.

## Success criteria

- [ ] `npm test` green, including `verb-contract-drift-guard.test.mjs` unmodified.
- [ ] Both providers return the three refusal reasons and never throw, proven by contract tests.
- [ ] `requiredReviews: 1` refuses WITHOUT calling the provider seam (asserted, not assumed).
- [ ] The `unsupported` fixture is a string captured from a real failure.
- [ ] `vcs-contract.md` carries the verb row and the adapter row, in a commit authored by the
      maintainer.
