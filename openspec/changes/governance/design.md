# Design — Workflow Governance Layer

> How the [proposal](proposal.md) is implemented. Technical decisions.
> Establishes [ADR-0014](../../../brain/project/decisions/adr-0014-workflow-governance.md).

## The architectural shape

brain governs a workflow that humans **and** agents share. A *guide* floor is the
least-disciplined participant; a *gate* floor is uniform. So the design enforces the
observable **OUTPUTS** of each invariant at a server-side wall (L1) and *guides* the
irreducible **JUDGMENT** (L3). The wall is **author-agnostic** — a PR check enforces the
output of a PR regardless of who opened it, which is exactly why "agents can't skip" works.

| Layer | Mechanism | Guarantee | Bypass |
|---|---|---|---|
| **L1 — server-side** | `.github/workflows/governance.yml` PR checks + branch protection on `main` | **Real** — human & agent alike cannot merge without it | repo-admin override (logged; `enforce_admins:false`) |
| **L2 — local hooks** | existing `pre-push` (materializes `.memory/`) / `post-merge` | Partial (fast feedback) | `--no-verify` → L1 is the true gate |
| **L3 — in-context** | `workflow-governance.md` + skills + low-friction commands | Soft (probability) | agent can forget |

The hard line this design draws: **L1 enforces outputs; L1 does NOT enforce judgment.**
Good capture, recognizing an *unlabeled* decision, and slicing *well* (vs merely under 400)
stay L3 + audit. Naming that boundary honestly is part of the design, not a gap to close.

## Slices (chained-PR epic, feature-branch-chain — only the tracker merges to `main`)

| Slice | Adds | CI state | Protection |
|-------|------|----------|------------|
| **S1** Foundation | ADR-0014, PR template, `governance.ignoreList` migration, two managed paths | none | off |
| **S2** Hard gates I+II | `governance.yml` `issue-link` + `diff-size` | runs **non-blocking** | off |
| **S3** Protect | `branchProtect` verb + `brain:protect` + single-source check names + L3 doc | active | **operator activates post-merge** |
| **S4** Gates III+IV | `memory-gate` (proxy) + `decision-gate` (hard + heuristic warning) | fully governed | on |

## S1 — foundation (paperwork, zero enforcement)

### `governance.ignoreList` config migration (additive, bumps schemaVersion → `0.4.0`)

Appended to `brain/core/config-migrations.mjs`. Additive `defaults` — `mergeDefaults`
preserves any consumer-set list (idempotent, never clobbers; same rule as ADR-0006).

```js
{
  version: '0.4.0',
  description: 'Add governance.ignoreList: globs excluded from the diff-size gate (ADR-0014).',
  defaults: {
    governance: {
      ignoreList: [
        '.memory/**',
        'openspec/changes/**',
        'package-lock.json',
        'pnpm-lock.yaml',
        'yarn.lock',
      ],
    },
  },
},
```

The gate reads this list from the **committed** `brain.config.json` in the consumer repo
(it is a `local` path — owned and tuned per consumer), so each org tunes its own exclusions
without editing the workflow.

### Two managed paths (specific files, NEVER `.github/**`)

`brain/core/managed-paths.mjs` `managed` gains exactly two entries:

```js
export const managed = [
  'brain/core/**',
  'scripts/**',
  '.gitattributes',
  '.github/workflows/governance.yml',     // the L1 gate travels with brain
  '.github/PULL_REQUEST_TEMPLATE.md',     // the Closes/Fixes scaffold the gate parses
];
```

**Why two literals and not `.github/**`:** `copyManaged` (installer.mjs `globToRegExp`) would
match a consumer's *own* `.github/workflows/ci.yml`, issue templates, CODEOWNERS, Dependabot
config — and **overwrite** them on `brain:upgrade`. Two exact paths add the gate without
clobbering a single consumer file. A consumer that wants a custom PR template adds
`.github/PULL_REQUEST_TEMPLATE.md` to its `local[]` override (local always wins in `copyManaged`).

`scripts/**` is already managed, so `brain-protect.mjs`, `governance-checks.mjs`, and the
`github.mjs` change (S3) travel for free; `config-migrations.mjs` rides `brain/core/**`.

## S2 — `governance.yml` hard gates I + II

One workflow, one job per invariant. **The job `name:` is the GitHub check context** —
reported as `governance / <job-name>` — so the job names are load-bearing (see S3 single-source).

```yaml
name: governance
on:
  pull_request:
    types: [opened, synchronize, reopened, edited, labeled, unlabeled]

permissions:
  contents: read
  pull-requests: read
  issues: read

jobs:
  issue-link:                         # Invariant 1
    name: issue-link
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Verify approved issue link
        env:
          GH_TOKEN: ${{ github.token }}
          PR_BODY: ${{ github.event.pull_request.body }}
        run: |
          set -euo pipefail
          num=$(printf '%s' "$PR_BODY" \
            | grep -oiE '(close[sd]?|fix(e[sd])?|resolve[sd]?) +#[0-9]+' \
            | grep -oE '[0-9]+' | head -n1 || true)
          if [ -z "$num" ]; then
            echo "::error::PR body has no Closes/Fixes/Resolves #<issue> reference."; exit 1
          fi
          labels=$(gh api "repos/${{ github.repository }}/issues/${num}" --jq '.labels[].name')
          if ! printf '%s\n' "$labels" | grep -qx 'status:approved'; then
            echo "::error::Issue #${num} is not labeled status:approved."; exit 1
          fi

  diff-size:                          # Invariant 2
    name: diff-size
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Enforce diff size budget
        env:
          LABELS:   ${{ join(github.event.pull_request.labels.*.name, ' ') }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          if printf '%s' "$LABELS" | grep -qw 'size:exception'; then
            echo "size:exception present — skipping diff-size gate."; exit 0
          fi
          mapfile -t IGNORE < <(jq -r '.governance.ignoreList[]? // empty' brain.config.json)
          pathspec=(':(top)')
          for g in "${IGNORE[@]}"; do pathspec+=(":(top,exclude)$g"); done
          changed=$(git diff --numstat "$BASE_SHA"..."$HEAD_SHA" -- "${pathspec[@]}" \
            | awk '{ add+=$1; del+=$2 } END { print add+del+0 }')
          echo "Changed lines (ex-ignore-list): $changed"
          if [ "$changed" -gt 400 ]; then
            echo "::error::PR changes $changed lines (>400) without size:exception."; exit 1
          fi
```

**YAML / shell gotchas the exploration flagged (all load-bearing):**

- **Block scalars (`run: |`)** so the `:` inside `gh api repos/...:` and git pathspec magic
  do not break YAML parsing.
- **`set -euo pipefail` + `|| true`** on every `grep` that may *legitimately* match nothing —
  `grep` exits `1` on no-match, which `-e` would turn into a step failure. The no-issue and
  no-match branches are handled explicitly *after* the `|| true`.
- **git pathspec exclusion** is `:(top,exclude)<glob>`, each entry **single-quoted in the
  array** so the shell does not glob/expand `*` and `!`. `:(top)` anchors at repo root so the
  exclusions read the same regardless of the runner's CWD.
- **Label flattening:** `${{ join(github.event.pull_request.labels.*.name, ' ') }}` turns the
  label array into a space-string for a `grep -qw` test (GitHub Actions has no array env).
- **`pull_request` (not `pull_request_target`)** — the gate needs no write token and must not
  run untrusted PR code with secrets; `${{ github.token }}` read scopes suffice.

S2 is the **first self-governing PR**: it must itself carry an approved issue and stay <400
lines. It is **non-blocking** until S3 turns protection on — GitHub runs a PR's workflow from
the base branch, so a brand-new `governance.yml` does not gate the very PR that introduces it.

## S3 — `branchProtect` verb, `brain:protect`, single-source check names

### VCS-contract verb (extends the verb table in `vcs-contract.md`)

| Verb | Signature | Normalized return |
|------|-----------|-------------------|
| `branchProtect` | `({ project, branch, checks, requiredReviews }) -> { protected }` | Require the named checks + ≥N reviews + no direct push on `branch`. Idempotent. |

`checks` is an array of check-context strings; `branch` defaults to `'main'`,
`requiredReviews` to `1`.

### GitHub impl (`scripts/vcs/providers/github.mjs`) — classic protection, idempotent PUT

Placed alongside `issueView`. `PUT` overwrites the protection object wholesale, so re-running
is a clean no-op-equivalent (idempotent). Body sent via `gh api --input -` (stdin), mirroring
`authLogin`'s `{ input }` pattern.

```js
export async function branchProtect({ project, branch = 'main', checks, requiredReviews = 1 }) {
  const payload = {
    required_status_checks: { strict: true, checks: checks.map((context) => ({ context })) },
    enforce_admins: false,                  // leave a logged admin override for lockout recovery
    required_pull_request_reviews: { required_approving_review_count: requiredReviews },
    restrictions: null,                     // no push allow-list (org-agnostic)
    allow_force_pushes: false,
    allow_deletions: false,
  };
  const ok = run(
    'gh',
    ['api', '-X', 'PUT', `repos/${project}/branches/${branch}/protection`, '--input', '-'],
    { input: JSON.stringify(payload) },
  ).ok;
  return { protected: ok };
}
```

### GitLab stub (`scripts/vcs/providers/gitlab.mjs`) — Phase 3

```js
export async function branchProtect() {
  throw new Error('branchProtect: not yet implemented for gitlab (Phase 3 — see vcs-contract.md).');
}
```

The verb enters the contract **now** so the door is open; GitLab parity
(`POST /projects/{id}/protected_branches` + required-pipeline) is explicitly deferred.

### Check-name single source of truth (resolves explore Risk 5 — drift)

The status-check **contexts** that `brain:protect` requires MUST equal the workflow **job
names**. If they drift, protection requires a check that never reports → `main` deadlocks. So
both derive from **one** module:

```js
// scripts/vcs/governance-checks.mjs
export const WORKFLOW_NAME = 'governance';
export const GOVERNANCE_JOBS = ['issue-link', 'diff-size', 'memory-gate', 'decision-gate'];
export const checkContexts = () => GOVERNANCE_JOBS.map((j) => `${WORKFLOW_NAME} / ${j}`);
```

`brain:protect` imports `checkContexts()` for the payload. The workflow YAML is static text and
**cannot** import JS, so the binding is closed by a **unit test** that parses
`.github/workflows/governance.yml`, reads each job's `name:`, and asserts the set equals
`GOVERNANCE_JOBS`. The constant is the source; the test fails closed on any drift — the names
**cannot** silently diverge.

### `scripts/brain-protect.mjs` (rides the managed `scripts/**`)

Reads `vcs.provider` + `project` from `brain.config.json`, dispatches through the VCS adapter,
calls `branchProtect({ project, branch: 'main', checks: checkContexts() })`, prints the result.
Exposed as `brain:protect` (one-time admin action). `env:init` points the operator to run it.

### `workflow-governance.md` (the L3 in-context source of truth)

New `brain/core/methodology/workflow-governance.md`: the four invariants, each mapped to its
gate + its label escape hatch, and the explicit enforce-outputs/guide-judgment boundary.

## S4 — `memory-gate` + `decision-gate`

```yaml
  memory-gate:                        # Invariant 3 — PROXY (see residual below)
    name: memory-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: Verify memory was materialized
        env:
          LABELS:   ${{ join(github.event.pull_request.labels.*.name, ' ') }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          if printf '%s' "$LABELS" | grep -qw 'skip:memory-gate'; then
            echo "skip:memory-gate present — pure-docs exemption."; exit 0
          fi
          if [ -z "$(git diff --name-only "$BASE_SHA"..."$HEAD_SHA" -- '.memory/' | head -n1)" ]; then
            echo "::error::No .memory/ changes — run memory:share before closing."; exit 1
          fi

  decision-gate:                      # Invariant 4 — hard (label) + heuristic (warning)
    name: decision-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: ADR required for decision-labeled PRs
        env:
          LABELS:   ${{ join(github.event.pull_request.labels.*.name, ' ') }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          if printf '%s' "$LABELS" | grep -qw 'decision'; then
            files=$(git diff --name-only "$BASE_SHA"..."$HEAD_SHA")
            adr=$(printf '%s\n'  "$files" | grep -E '^brain/project/decisions/adr-[0-9]{4}-.*\.md$' || true)
            home=$(printf '%s\n' "$files" | grep -xF 'brain/HOME.md' || true)
            if [ -z "$adr" ] || [ -z "$home" ]; then
              echo "::error::decision PR must add adr-NNNN-*.md AND update brain/HOME.md."; exit 1
            fi
          fi
      - name: Architectural-surface heuristic (WARNING only)
        env:
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          HEAD_SHA: ${{ github.event.pull_request.head.sha }}
        run: |
          set -euo pipefail
          files=$(git diff --name-only "$BASE_SHA"..."$HEAD_SHA")
          surfaces=$(printf '%s\n' "$files" \
            | grep -E '(^scripts/.*/providers/|^brain/core/|config-migrations\.mjs$|^package\.json$)' || true)
          adr=$(printf '%s\n' "$files" | grep -E '^brain/project/decisions/adr-' || true)
          if [ -n "$surfaces" ] && [ -z "$adr" ]; then
            echo "::warning::Touches architectural surfaces with no ADR — consider the 'decision' label."
          fi
          exit 0                        # heuristics MUST NOT hard-fail
```

The heuristic step ends with an explicit **`exit 0`** (belt-and-braces over `|| true`): a
heuristic that can be wrong must never block a merge.

## Invariant-3 residual (the honest weak link)

Invariant 3 has two parts: **(a) materialization** (engram → `.memory/`, mechanical) and
**(b) capture quality** (did the right things get saved — irreducibly soft). S4 ships the
**proxy**: `.memory/` changed in the diff ⇒ `memory:share` ran. It proves the *step happened*,
**not** that a `session_summary` was written nor that it was good.

The **full** check (`gunzip -c .memory/chunks/*.jsonl.gz | grep <session_summary type>` scoped
to this issue) is a documented **Phase-2 prerequisite**, blocked on two things that do not yet
exist:

1. **Engram JSONL schema spike** — confirm the observation-type field name inside the gzipped
   chunks (the engram binary owns the schema; it is not versioned in brain).
2. **`session/{issue}` topic_key convention** — a stable way for a `session_summary` to
   reference its issue, so CI can scope the grep to *this* PR's issue.

We do **not** pretend to enforce capture quality. The proxy + the `skip:memory-gate` escape
(pure-docs PRs) is the honest P1 line.

## Self-hosting activation sequence (precise order + lockout mitigation)

```
S1 merge   → foundation in main; no CI, no protection
S2 merge   → governance.yml in main; runs NON-BLOCKING (protection still off)
S3 merge   → brain:protect + single-source checks in main
   ↓ operator runs `npm run brain:protect`  ← protection ACTIVATES here, one-time admin
S4 merge   → memory + decision gates; brain is now FULLY governed
```

- **Why the paradox is mild:** S2 does not need CI that does not exist yet; S3 is the first PR
  that both *adds* the protect capability and *must pass* the S2 gates. Clean.
- **Lockout window:** between S2-merge and `brain:protect`, protection is intentionally absent
  (a documented bootstrap seam). Once on, if CI goes red, all merges block. Mitigated by
  (1) `enforce_admins:false` → a **logged** admin override exists, and (2) a single idempotent
  disable call `gh api -X DELETE repos/<project>/branches/main/protection` — protection is a
  *setting*, not a file, so S3 rollback has **two** surfaces: revert the files **and** turn
  protection off explicitly.
- **`feature/issue-11-cli-i18n` coordination (operator step, NOT automated):** that branch
  predates compliance. **Before** running `brain:protect`, the operator brings it into
  compliance (approved issue, <400, memory, ADR-if-needed) **or** merges it. This is a USER
  decision recorded in `workflow-governance.md` and the S3 PR description — `brain:protect`
  does **not** inspect or rewrite open branches.

## File changes

| File | Action | Slice |
|------|--------|-------|
| `brain/project/decisions/adr-0014-workflow-governance.md` | Create — the ADR | 1 |
| `brain/HOME.md` | Modify — index ADR-0014 (Tier 2, fail-safe append) | 1 |
| `.github/PULL_REQUEST_TEMPLATE.md` | Create — `Closes #` scaffold the gate parses | 1 |
| `brain/core/config-migrations.mjs` | Modify — `0.4.0` `governance.ignoreList` migration | 1 |
| `brain/core/managed-paths.mjs` | Modify — add the two `.github/...` literals to `managed` | 1 |
| `.github/workflows/governance.yml` | Create — `issue-link` + `diff-size` | 2 |
| `brain/core/methodology/vcs-contract.md` | Modify — add `branchProtect` to the verb table | 3 |
| `scripts/vcs/providers/github.mjs` | Modify — implement `branchProtect` | 3 |
| `scripts/vcs/providers/gitlab.mjs` | Modify — `branchProtect` "not yet implemented" stub | 3 |
| `scripts/vcs/governance-checks.mjs` | Create — single-source check-name constant | 3 |
| `scripts/brain-protect.mjs` | Create — the `brain:protect` verb | 3 |
| `brain/core/methodology/workflow-governance.md` | Create — L3 in-context source of truth | 3 |
| `.github/workflows/governance.yml` | Modify — add `memory-gate` + `decision-gate` | 4 |

## Testing strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `migrateConfig` adds `governance.ignoreList` at `0.4.0`, preserves a consumer-set list | `node --test`, strict TDD |
| Unit | `copyManaged` copies the two `.github/...` literals and **skips** a consumer's other `.github/**` files | inject `managed`/`local` into `copyManaged` |
| Unit | `branchProtect` builds the exact PUT payload + endpoint (mock `run`) | spy on `run` args/stdin |
| Unit | **drift guard** — parse `governance.yml` job `name:`s, assert `=== GOVERNANCE_JOBS` | `node --test` (the single-source binding) |
| Integration | gate scripts on synthetic diffs: <400 passes, >400 fails, `size:exception` skips, missing/unapproved issue fails | run the `run:` bodies under `bash` with fixture env |
| Manual | `brain:protect` activates protection; second run is idempotent; `DELETE` disables | one-time admin action, not headless-tested |

## Migration / rollout

No data migration. Chained-PR epic (feature-branch-chain); only the tracker merges to `main`.
S1 is additive and revertible (no behavior). S2's workflow is non-blocking until S3. S3 is the
only slice with a **non-file** surface (the protection setting) — rollback reverts files **and**
calls the idempotent disable. S4 gates each carry a per-PR label escape hatch
(`skip:memory-gate`, the `decision` label condition).

## Open questions

- [ ] None blocking. The full Invariant-3 `session_summary` check stays Phase 2, gated on the
  engram JSONL schema spike + the `session/{issue}` topic_key convention (documented above).
- [ ] GitHub is migrating org-level protection toward **rulesets**; classic branch protection
  is sufficient and simpler for P1. Rulesets are a future swap behind the same `branchProtect`
  verb — no caller change.
