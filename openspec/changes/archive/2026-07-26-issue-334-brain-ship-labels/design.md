---
status: draft
issue: 334
epic: 335
sequence: 313
artifact_store: hybrid
---

# Design — `brain:ship` derives PR labels from the issue (issue #334)

## Technical Approach

`runShip()` becomes a three-verb composition over injected seams: **read** the issue
(`issueViewFn`), **validate** its `type:*` label against the remote's declared set
(`labelPreflightFn`), then **write** (`mrCreateFn`). The issue's label is the single
source of truth and travels verbatim; `deriveBranchType` maps it only to the title's
conventional-commit prefix. Two new layers are added to the VCS stack: a normalized
provider read (`labelList`) and a total policy wrapper (`labelPreflight`). Satisfies
specs `vcs-issue-view-contract`, `vcs-label-preflight`, `ship-pr-label-resolution`.
Contract-test pattern per `brain/core/methodology/vcs-contract.md`.

## Architecture Decisions

### A1 — Two layers, not one provider verb

| Option | Tradeoff | Decision |
|---|---|---|
| `labelsExist()` on each provider | Forces never-throws policy into transport, where `runJson`/`gitlabApiFetch` throw by design; the spec's `{ provider, … }` input has no home | Rejected |
| `labelList` (provider) + `labelPreflight` (policy) | Two files, one extra indirection | **Chosen** |

**Rationale**: providers normalize, policy totalizes. `labelList({project,…}) -> string[]`
follows the contract's own naming grammar (`issueList`, `mrList`) and may throw like its
siblings. `labelPreflight({ provider, project, label })` dispatches on `provider` (as
`labelEvents`/`ci-context.mjs` already do) and is the only place that catches — which is
exactly what the spec's `{ exists, error? }`, never-throws requirement asks for. Renamed
from the brief's `labelsExist` for that reason; single-label shape follows the spec (which
overrides the brief's per-label map).

### A2 — Why pre-flight exists at all (the real root cause)

The two providers **disagree** on an unknown label: `gh pr create --label` hard-errors,
while GitLab's MR-create payload **silently creates** the missing label, polluting the
project taxonomy. Pre-flight converts a provider-dependent, partly-silent failure into one
uniform, local, actionable refusal before any write. No caching (spec: every call
re-checks) — deliberately unlike `capabilities()`'s memo.

### A3 — Provider-agnostic `type:*` matcher, no scoping plumbing

`findTypeLabel(labels)` matches `/^type::?/` and returns the label **verbatim**. Rejected:
threading `provider` into `runShip` to pick `type:` vs `type::` (as `approvedLabel` is
threaded into `runStart`). **Rationale**: the label comes *from* the provider, so it is
already correctly scoped; nothing is reconstructed, so there is nothing to get wrong. A
matcher accepting both forms satisfies the spec's provider-awareness with zero plumbing —
and removes the drift class the proposal flags as High risk. Co-located in
`lib/branch-type.mjs` so exactly **one** module knows the `type:` vocabulary.

Latent bug found and fixed here: `deriveBranchType` strips `/^type:/`, so GitLab's
`type::bug` yields `:bug` → no match → silent `feat` prefix. Widened to `/^type::?/`.

### A4 — Ordering: pure → gate → remote → write

`issueNumber` parse (pure, free) → `checkFn` → `issueViewFn` → `findTypeLabel` →
`labelPreflightFn` → `mrCreateFn`. Rejected: pre-flight before `checkFn` (saves developer
time on a red tree). **Rationale**: preserves REQ-S5-4's gate semantics and the stronger,
assertable invariant **zero remote interaction while the tree is red**.

### A5 — `issueView` fails by **throwing** — pin it, do not "fix" it

Both providers throw on an unreachable issue (`runJson`; `gitlabApiFetch`'s `!res.ok`), and
`brain-start.mjs:65` depends on that. So the contract test asserts `assert.rejects` — *not*
the `null`-shape used by `prView`/`prReviews`. Consequently `runShip`'s failure-path stub
must **reject**, not return `null`: a stub that returns `null` would re-commit the exact
seam infidelity this change exists to fix.

### A6 — Governance delta is additive (see Open Questions)

`ship-pr-label-resolution` states it does *not* modify REQ-S5-4's text. Plan: leave the
requirement's normative sentence intact, append a cross-reference defining "correct
labels", and add two scenarios (missing `type:*` → refusal; pre-flight rejection →
refusal). No existing scenario is reworded.

## Data Flow

    branch ──parse──→ #N
                       │
                    checkFn ──red──→ exit 1 (no remote call)
                       │ green
                 issueViewFn ──throws──→ exit 1
                       │ { labels }
              findTypeLabel ──none──→ exit 1
                       │ 'type:bug' (verbatim)
        ┌──────────────┴──────────────┐
        ▼                             ▼
  labelPreflightFn            deriveBranchType
   → labelList(remote)         → 'fix' (title prefix ONLY)
        │ exists:false → exit 1        │
        └──────────────┬──────────────┘
                       ▼
        mrCreateFn({ title:'fix: …', labels:['type:bug'] })

## Interfaces

```js
// vcs/providers/{github,gitlab}.mjs — normalized read; may throw (sibling parity)
labelList({ project /* + gitlab: apiBase, token, proxyUrl, fetchImpl */ }) => Promise<string[]>
//   GH: gh api --paginate repos/{project}/labels?per_page=100  → r.map(l => l.name)
//   GL: GET projects/{enc}/labels?per_page=100 via gitlabApiFetch → r.map(l => l.name)

// vcs/label-preflight.mjs — total: NEVER throws, NEVER caches
labelPreflight({ provider, project, label, labelListFn? })
  => Promise<{ exists: boolean, error?: string }>   // case-sensitive exact match
```

Pagination is load-bearing: a repo with >30 labels would otherwise report a real label as
missing and block a valid ship (false rejection).

## File Changes

| File | Action | Description |
|---|---|---|
| `brain/scripts/brain-ship.mjs` | Modify | `issueViewFn`/`labelPreflightFn` params, label resolution, title prefix, ordering (A4); CLI wires both seams |
| `brain/scripts/brain-ship.test.mjs` | Modify | Rewrite: assert exact `labels` array + all four error paths |
| `brain/scripts/lib/branch-type.mjs` | Modify | Add `findTypeLabel`; widen strip to `/^type::?/` |
| `brain/scripts/lib/branch-type.test.mjs` | Modify | `type::bug` → `fix`; `findTypeLabel` cases |
| `brain/scripts/vcs/label-preflight.mjs` | Create | Provider dispatch + never-throws policy |
| `brain/scripts/vcs/label-preflight.test.mjs` | Create | Never-throws, no-cache, exact-match |
| `brain/scripts/vcs/providers/github.mjs` | Modify | `labelList` (`--paginate`) |
| `brain/scripts/vcs/providers/gitlab.mjs` | Modify | `labelList` over `gitlabApiFetch` |
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Modify | `issueView` block (fixtures) + `labelList` block (inline mocks) |
| `brain/scripts/vcs/fixtures/github-issueView-happy.json` | Create | **Recorded**; MUST carry a `type:*` label |
| `brain/scripts/vcs/fixtures/github-issueView-failure.json` | Create | Derived (`throws: true`) |
| `brain/scripts/vcs/fixtures/gitlab-issueView-{happy,failure}.json` | Create | Derived — `iid`/`description`/`author.username` mapping |
| `brain/scripts/vcs/fixtures/record-fixtures.mjs` | Modify | `recordGithubIssueView` case + header endpoint docs |
| `brain/core/methodology/vcs-contract.md` | Modify | `labelList` row, label-resolution rule, adapter-status rows |
| `openspec/specs/governance/spec.md` | Modify | REQ-S5-4 additive delta (A6) |

## Error Handling

Every path returns `{ exitCode: 1, message }` — `runShip` never throws.

| Condition | Message (`brain:ship: ` prefix) |
|---|---|
| No `#N` in branch | `cannot determine the issue number from branch "X" — expected <prefix>/<number>-<slug>` |
| `issueViewFn` rejects | `issue #N not found or not accessible — {reason}` |
| No `type:*` label | `no type:* label found on issue #N.` + `Labels found: [...]` + `Add a type:* label before shipping.` |
| `exists: false` | `label "type:bug" not found in the remote label set — add it on the remote, or correct issue #N's type:* label` (`+ — {error}` when the lookup itself failed) |

Uncomputable lookup ⇒ `{ exists: false, error }` ⇒ **fail closed** (spec requirement; also
prevents A2's silent GitLab label creation).

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Contract | `issueView` shape on both providers; labels always `string[]`; failure rejects | Fixture files + existing `setSpawn`/`fetchImpl` glue |
| Contract | `labelList` normalizes to `string[]`; case-sensitive parity | Inline mocks (precedent: `labelAdd`, `prStatusRollup`) |
| Unit | `labelPreflight` never throws; no cache (two calls ⇒ two lookups) | Injected `labelListFn` counting calls |
| Unit | `findTypeLabel` / `deriveBranchType` incl. `type::` | Pure |
| Integration | `mrCreateFn` receives **exactly** `['type:bug']`; title `fix: …`; each error path calls no write; red tree makes **zero** remote calls | Spy stubs recording every seam call |

No live network or CLI spawn in any suite.

## Migration / Rollout

No migration. Single revert restores today's already-broken hardcoded label.

## Open Questions

- [ ] **A6 tension**: `ship-pr-label-resolution` says REQ-S5-4's text is *not* modified,
      while the proposal lists `governance` as a Modified Capability. Design assumes
      additive clarification + new scenarios. Confirm before `sdd-apply`.
- [ ] Which real issue to record `github-issueView-happy.json` from (must carry a `type:*`
      label and no sensitive data) — `#334` itself is the obvious candidate.
