---
status: draft
issue: TBD
epic: 335
milestone: M10
phase: 2
rank: 2
artifact_store: hybrid
---

# Design — branchProtect contract-parity coverage (M10 Phase 2, rank 2)

## Technical Approach

Two additions to `brain/scripts/vcs/providers/vcs.contract.test.mjs`, nothing else. (1) A
parameterized parity block over `['github','gitlab']` asserting the shared
`{ enforced, reason?, remedy? }` contract. (2) A **function-scoped** source scan pinning that
GitLab's `branchProtect` never touches an approval-rules endpoint and never reads its own
`requiredReviews` parameter. Provider modules stay read-only.

    setSpawn(fake) ──→ run('gh'|'glab') ──→ branchProtect ──→ { enforced, reason?, remedy? }
                                                                        ▲
    readFileSync(gitlab.mjs) ──→ slice branchProtect body ──→ assert absence (drift lock)

## Architecture Decisions

### D1 — Pin the GitLab `requiredReviews` no-op; do not fix it here

**Choice**: option (c) of the proposal's fork — **pin now, ratify later**. This slice makes the
no-op executable and opens a tracking issue for the (a) implement / (b) report fork.

| Option | Tradeoff | Decision |
|---|---|---|
| (a) Implement GitLab approval-rules API + feature detect | Provider code change, needs a Premium tier probe and a live GitLab mirror this environment does not have; unverifiable in CI today | Rejected for this slice |
| (b) Make the verb report the limitation (new `reason` on success) | Changes the return contract for a *successful* call; ripples into `brain-protect.mjs` and `vcs-contract.md`; blows the 400-line budget | Rejected for this slice |
| (c) Pin current behaviour with a scoped source scan | Test-only, zero runtime risk, converts a code comment into a falsifiable statement | **Chosen** |

**Rationale**: test-driven discovery before investment. We do not yet know whether (a) is wanted —
that is a governance call about whether `brain:protect` may claim a review floor it never armed.
Fixing first would encode that answer silently. The lock is deliberately bidirectional: if someone
later adds the approvals call, **this test fails** and forces the decision into the open. That is
the feature, not a defect.

### D2 — One spawn-seam glue for both providers (no `fetchImpl` split)

**Choice**: both `branchProtect` impls go through `run()` from `lib/exec.mjs`, so a single
`setSpawn`-based `ok`/`fail` glue serves both — unlike `WRITE_VERB_PROVIDERS`, which needs a
GitLab `fetchImpl` branch. Keep the `BRANCH_PROTECT_PROVIDERS` map shape anyway (per-provider
`fail` stderr flavours: GitHub `403 … upgrade to Pro`, GitLab `: 403`), so the block reads like
its neighbours.

### D3 — Source scan scoped by string slice, not AST

**Choice**: `indexOf('export async function branchProtect')` → `indexOf('\n}\n', start)`, then
assert on that slice.

| Option | Tradeoff | Decision |
|---|---|---|
| File-wide `doesNotMatch(/approvals/)` | **Broken**: `gitlab.mjs:271` legitimately calls `merge_requests/:iid/approvals` for `prReviews`. Instant false positive | Rejected |
| AST parse of `gitlab.mjs` | Robust to formatting, but adds a parser dependency to a zero-dep test suite | Rejected |
| Slice by column-0 `}` terminator | Fragile to reformatting *inside* the function — which is exactly the event we want to be told about | **Chosen** |

**Rationale**: matches the REQ-266-3 lock-2 precedent (`vcs.contract.test.mjs:587`). Fragility to
body edits is acceptable *because the body is the thing under lock*. The slice starts at the
`export` line, so the JSDoc above (which does say "approval rules") is excluded — no comment
stripping needed. A load-bearing comment must state why the scope is narrow.

**Two assertions, not one**: (i) the slice matches no `/approval/i`; (ii) `requiredReviews` occurs
**exactly once** in the slice — the signature — proving it is declared and never referenced.

### D4 — Assert shape and type, never provider vocabulary

`reason` legitimately differs (`'tier'` is GitHub-only; `'auth'`/`'permission'` are GitLab-only).
Parity assertions check `enforced === false`, `typeof reason === 'string'`,
`typeof remedy === 'string'`. Per-provider vocabulary stays in `providers.test.mjs`.

### D5 — Two separate blocks

The parity loop and the source scan are conceptually different (behaviour vs. structure). The scan
goes next to the existing REQ-266-3 source-scan section at the file tail, not inside the loop.

## File Changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Modify | +`BRANCH_PROTECT_PROVIDERS` glue + parity loop (~50-70 lines) after `LABEL_LIST_PROVIDERS`; + scoped source scan (~30-50 lines) in the tail section |
| `openspec/specs/vcs-branch-protect-contract/spec.md` | Create | Owned by sdd-spec |
| `providers/{github,gitlab}.mjs`, `brain-protect.mjs` | Untouched | Read-only |

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Contract | `{enforced:true}` on success, both providers | Inline `setSpawn` ok glue, `checks: ['ci']` |
| Contract | `{enforced:false}` + string `reason`/`remedy` | Inline `setSpawn` fail glue, per-provider stderr |
| Contract | Never throws on transport failure | `assert.doesNotReject` |
| Structural | GitLab body has zero approval refs; `requiredReviews` unreferenced | Function-body slice + `doesNotMatch` + occurrence count |

Verification: `npm test` — existing 15 `providers.test.mjs` branchProtect tests must stay green
(`afterEach(() => setSpawn(spawnSync))` already prevents seam leakage).

## Migration / Rollout

None. Additive, test-only. Rollback = revert one commit. Single PR, ~80-120 lines.

## Open Questions

- [ ] **Discovered divergence (out of scope, must be filed)**: `github.branchProtect` calls
      `checks.map()` with no default, so it **throws a TypeError** when `checks` is omitted;
      `gitlab.branchProtect` guards with `Array.isArray`. The never-throws guarantee therefore
      holds only for well-formed input. Do not widen this slice to cover it — file it.
- [ ] Tracking issue for the D1 fork ((a) implement vs (b) report) must exist before this PR merges.
- [ ] Issue iid still `TBD`; rename the change folder to `issue-{iid}-m10-phase2-branchprotect`.
