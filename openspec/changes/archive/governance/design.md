# Design — Workflow Governance Layer

> How the [proposal](proposal.md) is implemented. Technical decisions.
> **Canonical design document:** [`docs/inbox/workflow-governance-layer.md`](../../../docs/inbox/workflow-governance-layer.md) — authoritative for the full architectural narrative. This file records implementation decisions and file-level design.
> Establishes [ADR-0014](../../../brain/project/decisions/adr-0014-workflow-governance.md) (authored in S1 ✅).

## The architectural shape

The v2 model is **floor + additive hard gate + golden path** — three composed layers that do NOT substitute for one another.

```
GENERIC CHECKS (node/git, tool-independent)
   │
   ├─►  FLOOR  (brain-core, ALWAYS ON, every repo/tier/platform):
   │       • client git hooks (commit-msg, pre-commit, pre-push)  → prevent-by-default, local, fast
   │       • brain:audit  → re-verify the merged history          → detection + attribution  ← the teeth
   │
   └─►  HARD GATE  (VCS adapter, ADDITIVE, capability-aware):
           • protectBranch()  → platform server-side enforcement WHERE the tier allows
           • if unavailable → reports {enforced:false, reason, remedy}; NEVER simulates it with client hooks
```

**Why the layers compose but do not fall back:**
- The floor exists and runs **independently of the adapter** — on every repo, tier, and platform.
- The hard gate binds platform server-side enforcement where supported; it reports the gap otherwise.
- The adapter does NOT "fall back to hooks." Client hooks are bypassable, so they are not equivalent to a server gate. They are the *floor*, not a *substitute*. Even when the hard gate IS available, the floor still runs.

| Point | When | Strength |
|---|---|---|
| client hook (pre-push) | before the push leaves the machine | soft (bypassable), universal |
| platform gate | at the merge to the protected branch (server) | hard, conditional |
| `brain:audit` | after, over the merged history | detection + attribution, universal |

The **golden path** (`brain:start/check/save/ship/next`) makes compliance the path of least resistance for human and agent alike, and self-gates step order.

## Slices

| Slice | Adds | State |
|-------|------|-------|
| **S1** Foundation | ADR-0014, PR template, `governance.ignoreList` migration, two managed paths | ✅ Done |
| **S2** Platform adapter | `governance.yml` `issue-link` + `diff-size` (one additive adapter) | ✅ Done |
| **S3** Capability-aware adapter | `protectBranch → {enforced,reason,remedy}`, `capabilities()`, `brain:governance status` | Pending |
| **S4** The floor | Generic checks library + client-hook suite (commit-msg/pre-commit/pre-push) + `brain:audit` | Pending |
| **S5** Golden path | `brain:start/check/save/ship/next` + `--no-verify` policy | Pending |
| **Phase 3** | GitLab/Bitbucket/self-hosted `protectBranch` + `pre-receive`; rulesets; full session_summary check | Deferred |

---

## S1 — Foundation ✅ (paperwork, zero enforcement)

### `governance.ignoreList` config migration (schemaVersion → `0.4.0`)

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

### Two managed paths (specific files, NEVER `.github/**`)

```js
export const managed = [
  'brain/core/**',
  'scripts/**',
  '.gitattributes',
  '.github/workflows/governance.yml',
  '.github/PULL_REQUEST_TEMPLATE.md',
];
```

---

## S2 — Platform CI (one additive enforcement adapter) ✅

`governance.yml` with `issue-link` + `diff-size` is understood as **one additive enforcement adapter** — conditional on GitHub and the repo's tier. It is not the universal guarantee; the floor (S4) provides that. The two jobs remain as-is.

**Check-name single source of truth:**

```js
// scripts/vcs/governance-checks.mjs
export const WORKFLOW_NAME = 'governance';
export const GOVERNANCE_JOBS = ['issue-link', 'diff-size'];
export const checkContexts = () => GOVERNANCE_JOBS.map((j) => `${WORKFLOW_NAME} / ${j}`);
```

`GOVERNANCE_JOBS` **stays at two entries through S4** — S4 does NOT add new CI jobs (the checks move to the floor layer). The drift-guard test (S3) asserts `GOVERNANCE_JOBS === YAML job names`; the S4 atomic-commit discipline from the old design is removed.

---

## S3 — Capability-aware adapter

### `protectBranch()` — returns `{enforced, reason, remedy}`, never crashes

```js
// scripts/vcs/providers/github.mjs
export async function protectBranch({ project, branch = 'main', checks, requiredReviews = 1 }) {
  const payload = {
    required_status_checks: { strict: true, checks: checks.map((context) => ({ context })) },
    enforce_admins: false,
    required_pull_request_reviews: { required_approving_review_count: requiredReviews },
    restrictions: null,
    allow_force_pushes: false,
    allow_deletions: false,
  };
  const result = run(
    'gh',
    ['api', '-X', 'PUT', `repos/${project}/branches/${branch}/protection`, '--input', '-'],
    { input: JSON.stringify(payload) },
  );
  if (result.ok) return { enforced: true };
  // 403 = tier does not support this; surface the gap honestly
  const reason = result.exitCode === 403 ? 'tier' : 'unsupported';
  const remedy = reason === 'tier'
    ? 'Upgrade to GitHub Pro/Team/Enterprise for private repos, or make the repo public.'
    : 'Check provider support for branch protection.';
  return { enforced: false, reason, remedy };
}
```

GitLab stub:

```js
export async function protectBranch() {
  throw new Error('protectBranch: not yet implemented for gitlab (Phase 3 — see vcs-contract.md).');
}
```

### `capabilities()` — probed, not hardcoded

```js
export async function capabilities() {
  // Attempt a read of the protection endpoint — 403 = tier blocks it.
  const result = run('gh', ['api', `repos/${project}/branches/main/protection`]);
  if (result.ok || result.exitCode === 404) {
    return { hardEnforcement: 'available', detail: 'Branch protection API accessible.' };
  }
  if (result.exitCode === 403) {
    return { hardEnforcement: 'unavailable', detail: '403 — tier does not support this endpoint.' };
  }
  return { hardEnforcement: 'unknown', detail: `Unexpected exit ${result.exitCode}.` };
}
```

**Probe, don't hardcode the matrix** — capabilities differ per platform AND change over time; a hardcoded matrix rots. The adapter attempts + caches the 403/result.

### `brain:governance status`

Reports per-consumer, explicitly:

```
Your repo: github · private · free
  ✓ hooks (commit-msg/pre-commit/pre-push)  → ON  [universal]
  ✓ brain:audit                              → ON  [universal]
  ✗ platform hard gate                       → unavailable  (remedy: GitHub Pro for private, or make public)
```

Implementation: new `scripts/brain-governance-status.mjs` script. Reads `vcs.provider` + `project` from `brain.config.json`, calls `capabilities()`, reports the three layers. Exposed as `brain:governance status` (`npm run brain:governance-status`).

### Check-name single source and `scripts/brain-protect.mjs`

`brain:protect` imports `checkContexts()` from `governance-checks.mjs`. The drift-guard test parses `governance.yml` job names and asserts they equal `GOVERNANCE_JOBS`. The unit test is the binding — names cannot silently diverge.

---

## S4 — The floor (tool-independent guarantee)

### Generic checks library (`scripts/governance/checks/`)

Extract the four invariant checks into pure functions over git/PR data. `diff-size-count.mjs` already exists and is the template. Each function:
- Takes structured input (git data or PR metadata)
- Returns `{ pass: boolean, reason?: string }`
- Zero side effects — pure, unit-testable in isolation

```
scripts/governance/checks/
  diff-size.mjs        — parseDiffNumstat (already exists in scripts/vcs/diff-size-count.mjs; extract/re-export)
  issue-link.mjs       — parse PR body for Closes|Fixes|Resolves #N; verify status:approved via VCS adapter
  adr-presence.mjs     — diff contains brain/project/decisions/adr-NNNN-*.md AND brain/HOME.md change
  memory-presence.mjs  — diff touches .memory/ (the .memory/-changed proxy; same honest residual as before)
```

Single source of truth for *what* a check means; the three points (hooks, CI adapter, audit) only differ in *where/when* they run.

### Client-hook suite (always on via `core.hooksPath = scripts/hooks`)

The existing `pre-push` hook materializes memory and runs a basic push guard. S4 wires the full check library:

**`scripts/hooks/commit-msg`** (new):
- Conventional commit format validation (`^(feat|fix|docs|chore|refactor|test|style|perf|ci|build|revert)(\(.+\))?: .+`)
- Ticket ref presence (must contain `#N` or be a merge commit / initial commit)
- Non-blocking on minimal environments (no node → exit 0)

**`scripts/hooks/pre-commit`** (new):
- `repo:check` execution (the existing prohibited-reference engine)
- Block direct commit to `main` / `master`
- Non-blocking on minimal environments

**`scripts/hooks/pre-push`** (extend existing):
- Add calls to all four generic checks from `scripts/governance/checks/`
- Memory materialization (already exists)
- Block push if any check fails; advise how to fix or label-exempt
- Emergency bypass: `git push --no-verify` (caught by `brain:audit`)

**Installation:** `core.hooksPath = scripts/hooks` is set by `bootstrap.sh` / `env:init` (already done for pre-push/post-merge). No new installation step required.

### `brain:audit` (the universal teeth)

Re-verifies the four invariants over the **merged history** — forge-proof (verifies the *outcome*, not a marker). ~90% pure git + a thin READ via the VCS adapter for PR/issue metadata.

```
scripts/brain-audit.mjs
  → reads brain.config.json (project, vcs.provider, governance.ignoreList)
  → determines audit range: --since=<date> | --from=<sha> | last N merges (configurable)
  → for each merge commit in range:
      1. diff-size check (git diff against merge base, apply ignoreList)
      2. issue-link check (parse commit message or PR body via VCS adapter)
      3. adr-presence check (git diff for ADR file if PR had decision label)
      4. memory-presence check (git diff for .memory/ changes)
  → emits: [PASS|FAIL] <sha> <short-msg> — <which invariants failed>
  → exit non-zero if any violation found
```

Flags + **attributes** every violation (SHA + commit message + which invariant) regardless of whether a hook was bypassed. In an org, visible + attributed violations deter almost as well as prevention — this is the tool-independent backbone of the guarantee.

**Cadence:** on-demand (`npm run brain:audit`), callable from pre-push (optional), and from CI as a scheduled job. Same code, different invocation points.

---

## S5 — The golden path

### Self-gating verb sequence

```
brain:start <issue>  → verify issue exists + status:approved → branch/worktree   [gate: no approved ticket → refuse]
   … work …
brain:check          → run the generic checks + tests + repo:check               [fast feedback]
brain:save           → capture session summary + materialize memory              [gate before close]
brain:ship           → re-verify invariants → open PR (template + Closes #N + labels)   [gate: refuse if unmet]
   … merge (platform gate where available) …
brain:audit          → re-verify merged history                                  [continuous]
brain:next           → state machine: "your next step is X"                      [agent-like guidance for humans]
```

**Self-gating:** each verb verifies the prior step's output → step order cannot be skipped *within* the flow.

**Implementation:**

```
scripts/brain-start.mjs    → reads issue from VCS adapter; asserts status:approved; calls branchCreate
scripts/brain-check.mjs    → calls all four generic checks + npm test + npm run repo:check
scripts/brain-save.mjs     → calls memory:share; asserts session_summary was captured; commits .memory/
scripts/brain-ship.mjs     → re-runs brain-check; calls mrCreate with template + Closes #N + labels
scripts/brain-next.mjs     → derives current state from (git branch + open PRs + .memory/ + brain.config); emits the next command
```

`brain:next` state derivation:
- No branch? → `brain:start <issue>`
- Branch exists, checks failing? → `brain:check`
- Checks pass, no .memory/ changes? → `brain:save`
- .memory/ committed, no open PR? → `brain:ship`
- Open PR exists? → "waiting for review / merge"

**Unification:** one golden path traversed by human and agent. The agent is additionally bound by the harness (§ --no-verify policy) + instruction; the human is guided by `brain:next` + the verbs' self-gating. Same outcomes, verified the same way.

### `--no-verify` policy

- **brain's own scripts** never use `--no-verify` / `git commit -n` → make it a **prohibited reference** in `repo:check` (the check-refs engine, ADR-0007, already does prohibited-reference detection). Enforceable + tool-independent.
- **The agent** → a **harness PreToolUse hook** (Claude Code `.claude/settings.json` or equivalent) blocks any Bash command containing `--no-verify` or `git commit -n`. Harness-specific but it is the sanctioned harness for brain.
- **What slips through** → caught by `brain:audit`.
- **Precondition:** hooks MUST be reliable (zero false positives) or bypass is *rational*. Trustworthy hooks are a prerequisite of the policy.

Implementation:
- Add `--no-verify` and `git commit -n` to `brain/core/check-config.json` (or equivalent) `prohibitedRefs` list.
- Ship `.claude/settings.json` (or the applicable harness config) as a managed path with the PreToolUse hook rule.

---

## File changes

| File | Action | Slice |
|------|--------|-------|
| `brain/project/decisions/adr-0014-workflow-governance.md` | Created | S1 ✅ |
| `brain/HOME.md` | Modified | S1 ✅ |
| `.github/PULL_REQUEST_TEMPLATE.md` | Created | S1 ✅ |
| `brain/core/config-migrations.mjs` | Modified (`0.4.0`) | S1 ✅ |
| `brain/core/managed-paths.mjs` | Modified | S1 ✅ |
| `.github/workflows/governance.yml` | Created | S2 ✅ |
| `scripts/vcs/diff-size-count.mjs` | Created | S2 ✅ |
| `scripts/vcs/governance-checks.mjs` | Create — single-source check-name constant | S3 |
| `scripts/vcs/providers/github.mjs` | Modify — `protectBranch()` returns `{enforced,reason,remedy}` | S3 |
| `scripts/vcs/providers/gitlab.mjs` | Modify — `protectBranch` "not yet implemented" stub | S3 |
| `scripts/brain-protect.mjs` | Create — `brain:protect` verb | S3 |
| `scripts/brain-governance-status.mjs` | Create — `brain:governance status` | S3 |
| `brain/core/methodology/vcs-contract.md` | Modify — add `protectBranch` + `capabilities` to verb table | S3 |
| `brain/core/methodology/workflow-governance.md` | Create — L3 in-context doc | S3 |
| `scripts/governance/checks/diff-size.mjs` | Create (extract from diff-size-count.mjs) | S4 |
| `scripts/governance/checks/issue-link.mjs` | Create | S4 |
| `scripts/governance/checks/adr-presence.mjs` | Create | S4 |
| `scripts/governance/checks/memory-presence.mjs` | Create | S4 |
| `scripts/hooks/commit-msg` | Create | S4 |
| `scripts/hooks/pre-commit` | Create | S4 |
| `scripts/hooks/pre-push` | Modify — wire four checks | S4 |
| `scripts/brain-audit.mjs` | Create — `brain:audit` | S4 |
| `scripts/brain-start.mjs` | Create | S5 |
| `scripts/brain-check.mjs` | Create | S5 |
| `scripts/brain-save.mjs` | Create | S5 |
| `scripts/brain-ship.mjs` | Create | S5 |
| `scripts/brain-next.mjs` | Create | S5 |
| `brain/core/check-config.json` (or equivalent) | Modify — add `--no-verify` prohibited refs | S5 |
| `.claude/settings.json` (or harness config) | Create/modify — PreToolUse hook for `--no-verify` | S5 |

## Testing strategy

| Layer | What | How |
|-------|------|-----|
| Unit | `parseDiffNumstat` excludes ignoreList, sums additions+deletions | `node --test` (already done — S2 ✅) |
| Unit | Config migration `0.4.0` idempotent | `node --test` (already done — S1 ✅) |
| Unit | `managed-paths` two specific entries, no `.github/**` glob | `node --test` (already done — S1 ✅) |
| Unit | `protectBranch()` returns `{enforced,reason,remedy}` on 200/403/other via `setSpawn` seam | `node --test` (S3) |
| Unit | `capabilities()` returns correct shape on 200/403/other via seam | `node --test` (S3) |
| Unit | `gitlab.protectBranch()` throws "not yet implemented" | `node --test` (S3) |
| Unit | Drift-guard — parse `governance.yml` job names, assert equals `GOVERNANCE_JOBS` | `node --test` (S3) |
| Unit | Each generic check function: correct pass/fail on fixture data | `node --test` (S4) |
| Unit | `brain:audit` parses merge history, flags correct violations | `node --test` with git fixture (S4) |
| Integration | `brain:start` refuses unapproved issue; creates branch on approved | test with stub VCS adapter (S5) |
| Integration | `brain:ship` refuses if checks fail; succeeds with correct PR body | test with stub (S5) |
| Integration | `brain:next` returns correct next step for each state | test state machine with fixture inputs (S5) |
| Manual | `brain:protect` activates protection; idempotent; `DELETE` disables | one-time admin action (S3) |
| Manual | Hook suite fires correctly on commit/push | installed on dev machine (S4) |

## Self-hosting activation sequence

```
S1 merge   → foundation in main; no CI, no protection           ✅ Done
S2 merge   → governance.yml in main; runs NON-BLOCKING           ✅ Done
S3 merge   → brain:protect + capability-aware adapter in main
   ↓ operator runs `npm run brain:protect`  ← protection ACTIVATES here, one-time admin
S4 merge   → floor: generic checks + hook suite + brain:audit
S5 merge   → golden path verbs + --no-verify policy; brain is now FULLY governed
```

**i18n branch coordination (operator step, NOT automated):** `feature/issue-11-cli-i18n` predates compliance. Before running `brain:protect`, the operator coordinates (brings into compliance, merges, or documents exception). `brain:protect` does NOT inspect or rewrite open branches.

## Open questions

- [ ] `brain:audit` cadence — on-demand only vs. also as a CI scheduled job? (Probably both — same code, different invocation.)
- [ ] `brain:next` state source — derive from git + `brain.config.json` + open PRs/issues? What is the canonical state representation?
- [ ] Harness hook shipping — does brain ship `.claude/settings.json` as a managed path (mirrors the `governance.yml` managed-path decision)?
- [ ] Full session_summary memory check — engram schema spike + `session/{issue}` convention — deferred to Phase 3.
- [ ] GitHub rulesets — classic branch protection is sufficient for P1; rulesets are a future swap behind the same `protectBranch` verb.
