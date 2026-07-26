---
status: draft
issue: 317
epic: 313
artifact_store: hybrid
proposal: openspec/changes/issue-317-prreviews-empty-body/proposal.md
---

# Design — `prReviewBodies` read verb (issue #317)

## Technical Approach

One new read verb per provider, mirroring `prReviewComment`'s **write** target on each
side (GH: `pulls/N/reviews`; GL: `merge_requests/N/notes`). All normalization —
filtering, ordering, `''`-vs-`null` discipline — lives **inside** the provider
functions, exactly like `labelEvents`. The two callers (`cold-boot.mjs:80`,
`board.mjs:80`) swap one verb name and keep their existing `?? []` fallback;
`prReviews` and `brain-writes-reviewed.mjs` are not touched.

## Architecture Decisions

### D1 — Filter GitLab system notes in the normalizer, not the caller

**Choice**: `prReviewBodies` drops `system: true` notes before mapping.
**Rejected**: filtering in `cold-boot`/`board`.
**Rationale**: `labelEvents` already sets the precedent (it drops non-label events
provider-side). Caller-side filtering would need a `system` field the normalized
shape does not expose, re-leaking provider concepts into the review layer. Cost is
one boolean check per note. Human non-verdict comments are NOT filtered — `parseVerdict`
already returns `null` for them; a body-content filter would duplicate the parser.

### D2 — Order ascending by `at`, sorted in the normalizer

**Choice**: normalizer sorts ascending, null-safe (`Date.parse(x.at ?? '') || 0`).
**Rejected**: relying on API-native order; dropping `at` entirely.
**Rationale**: order is **load-bearing** — `poster.mjs:72` reads
`priorVerdicts[length - 1]` for the anti-loop lock and `board.mjs:105` reads
`verdicts[length - 1]` as "latest wins". GitHub returns ascending; GitLab notes
default to **descending**. Leaving order to the provider would make the board pick
the OLDEST verdict on GitLab. Sorting provider-side makes both contracts identical.
`priorRevCount` (`cli.mjs:207`) uses `.length` only, so it is order-insensitive.

### D3 — Shape is `{ author, body, at }`, nothing else

**Choice**: drop the proposal's optional `source`; do not carry `state`.
**Rejected**: `{ ...prReviews, body }` (a superset).
**Rationale**: `parseVerdict({ body, author })` consumes exactly two fields; `at` is
the ordering key (D2). Carrying `state` would re-merge the two semantics this change
exists to split, and GitLab notes have no state to carry. `source` is debug-only
noise with no consumer. `body` is `''` when genuinely empty, never `null` — matching
`prView.body`.

### D4 — GitLab fetches `sort=desc&per_page=100`, then reverses locally

**Choice**: `...notes?per_page=100&order_by=created_at&sort=desc`, sorted ascending
after normalization.
**Rejected**: `sort=asc`; adding pagination to `gitlabApiFetch`.
**Rationale**: `gitlabApiFetch` does not paginate (shared limitation with
`labelEvents`) and GitLab's default page is 20 notes. With `sort=asc`, truncation
silently drops the **newest** notes — precisely the ones the anti-loop lock and the
board read. With `sort=desc` truncation drops the **oldest**, so both guardrails stay
correct and only `priorRevCount` under-counts past 100 notes. Safest failure mode at
zero extra request cost. GitHub needs none of this: `--paginate` is kept verbatim.

## Data Flow

    prReviewBodies (provider)          cold-boot.mjs / board.mjs
    ─────────────────────────          ────────────────────────
    GH: gh api --paginate reviews  ─┐
    GL: GET notes?sort=desc        ─┤
        drop system:true            ├─→ [{author, body, at}]  ─→ parseVerdict(r)
        body ?? ''                  │     (ascending by at)       └→ priorVerdicts[]
        sort ascending by at       ─┘                                └→ [len-1] = latest
        fetch failure → null              caller: `?? []`

## File Changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/vcs/providers/github.mjs` | Modify | Add `prReviewBodies` next to `prReviews`; `--paginate` verbatim |
| `brain/scripts/vcs/providers/gitlab.mjs` | Modify | Add `prReviewBodies` over notes via `gitlabApiFetch`; D1 + D4 |
| `brain/scripts/vcs/cli.mjs` (`VERBS`, ~line 30) | Modify | Register verb — drift guard fails otherwise |
| `brain/core/methodology/vcs-contract.md` (Required verbs) | Modify | New row; amend `prReviews` row to "approval state only" |
| `brain/scripts/review/cold-boot.mjs:79-87` | Modify | `defaultFetchReviews` → `prReviewBodies`; delete the H1-2 NOTE |
| `brain/scripts/review/board.mjs:78-87` | Modify | Same swap; update the mirror comment |
| `brain/scripts/vcs/fixtures/{github,gitlab}-prReviewBodies-{happy,failure}.json` | Create | 4 fixtures with `_provenance` (derived for gitlab) |
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Modify | Parity block (shape, ordering, `null` vs `[]` vs `''`) |
| `brain/scripts/vcs/providers.test.mjs` | Modify | GH `--paginate` source assert; GL query-string + `system` filter asserts |
| `brain/scripts/review/verdict-thread.integration.test.mjs` | Create | Real normalizer output → `parseVerdict` → non-null verdict |
| `brain/scripts/review/{cold-boot,board}.test.mjs` | Modify | Replace fabricated `{state, author, body}` fixtures with real shape |

## Interfaces / Contracts

```js
/**
 * @returns {Promise<Array<{ author: string|null, body: string, at: string|null }>|null>}
 *   null = uncomputable (fetch failed); [] = genuinely no review bodies;
 *   body === '' = successfully-empty. Ascending by `at`. Never throws.
 */
prReviewBodies({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? })
```

GH mapping: `body ?? ''`, `user.login ?? null`, `submitted_at ?? null`.
GL mapping: `body ?? ''`, `author.username ?? null`, `created_at ?? null`, after
`.filter(n => n.system !== true)`.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Contract (parity) | Same shape/order/`null`-vs-`[]` on both providers | Parameterized block in `vcs.contract.test.mjs` over 4 new fixtures |
| Unit (provider) | GH `--paginate` in source; GL query string + `system` filter | `providers.test.mjs`, source-read + `fetchImpl` stub |
| Unit (drift) | Verb in all 3 sources of truth | `verb-contract-drift-guard.test.mjs` — no edit needed, it fails automatically |
| Integration | Normalizer output survives `parseVerdict` | New `verdict-thread.integration.test.mjs` — **no hand-written `body` in any fixture** |
| Regression | `prReviews` path unchanged | `brain-writes-reviewed.test.mjs` / `actor-check` stay green, byte-identical |

## Slices

| Slice | Scope | Est. lines | Risk |
|---|---|---|---|
| A1 | GH verb + `VERBS` + contract-doc row + 2 GH fixtures + contract-test block | ~180 | Low |
| A2 | GL verb (D1 + D4) + 2 GL fixtures + provider-specific asserts | ~150 | Medium |
| A3 | Wire `cold-boot`/`board`, replace caller fixtures, integration test | ~130 | Low |

A1 must land first: it introduces the shared contract-test block A2 parameterizes over.
A3 is a pure caller swap and is the only slice that can regress live behavior.

## Migration / Rollout

No migration. No feature flag: `priorVerdicts` is `[]` in production today, so the
worst outcome of a bad rollout is the current behavior. Revert is a single commit.

## Open Questions

- [ ] GitHub `PENDING` (draft) reviews carry a body and are visible to their own
      author. Not filtered by this design — assumed unreachable for the bot token.
      Revisit only if a draft verdict ever leaks into `priorVerdicts`.
- [ ] GitLab threads above 100 notes under-count `rev`. Accepted (D4); a paginating
      `gitlabApiFetch` is a separate change that would also fix `labelEvents`.
