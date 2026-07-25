# Design — GitLab Substrate Ladder Awareness (slice A4)

Make the governance substrate ladder LEGIBLE and HONEST on GitLab. Two dishonesty seams close: the
`gh`-hardcoded rung-1 probe (`brain-governance-status.mjs:45-63`) that can never DETECT GitLab merge
protection, and the `selfHostedPreReceive` short-circuit (`substrate.mjs:98-100`) that reports a
non-remotely-detectable hook as if it were verified. The fix reuses two proven precedents verbatim — the
per-provider sub-gate pattern (`evalBrainWritesReviewedGate` `:149-203`) and the `gitlabApiFetch`/`glab`-CLI
transport discipline — and adds ONE new load-bearing read. `selectRung()` (`:207-212`) is untouched; the
pure orchestrator stays pure; the OR-composition is localized to `evalRung1`'s return. All artifacts English
(ADR-0009). Binding owner ruling: [[sdd/issue-244-a4/constraints]] (#565).

## Decision 1 — Rung-1 modeled as three parallel sub-gates, provider-aware, OR-composed in `evalRung1`

The overloaded rung-1 boolean splits into `rungs[1].gates.{pipelineMustSucceed, protectedBranches,
preReceive}`, each carrying the SAME six-field shape, sitting alongside the existing
`gates.brainWritesReviewed` (untouched). The `verifiable`/`mechanism` pair is the honesty signal that rides
ON each sub-gate — the durable lesson `[[workflow/env-limits-not-world-properties]]` encoded as data.

**Locked field shape (`rungs[1].gates`, GitLab mirror scenario — `pipelineMustSucceed` armed, the CP-A2b
evidence):**

```js
gates: {
  pipelineMustSucceed: {           // MERGE gate — GitHub required_status_checks analog
    available: true,
    active: true,                  // GitLab: only_allow_merge_if_pipeline_succeeds === true
    verifiable: true,              // API-read — a real endpoint reports the truth
    mechanism: 'branch-merge-gate-api',
    reason: null,
    remedy: null,
  },
  protectedBranches: {             // PUSH gate — blocks direct pushes, complementary NOT equivalent
    available: true,
    active: false,                 // mirror: default branch not protected (404) — honestly inactive
    verifiable: true,              // API-read (GET .../protected_branches/:name)
    mechanism: 'protected-branch-api',
    reason: 'no protected-branch push gate configured for the default branch',
    remedy: 'run npm run brain:protect to protect the default branch (push_access_level=0)',
  },
  preReceive: {                    // server hook — NOT remotely detectable
    available: true,
    active: false,                 // config self-declaration only (vcs.selfHostedPreReceive)
    verifiable: false,             // THE honesty flag: no endpoint reports a bare-repo hook
    mechanism: 'pre-receive-config-declared',
    reason: 'self-hosted pre-receive not declared (vcs.selfHostedPreReceive !== true)',
    remedy: 'install the server hook (docs/inbox/self-hosted-pre-receive.md) and set vcs.selfHostedPreReceive=true',
  },
  brainWritesReviewed: { /* UNCHANGED — evalBrainWritesReviewedGate, merged in by detectSubstrate */ },
}
```

**`verifiable`/`mechanism` semantics (per the ruling):**
- `pipelineMustSucceed`, `protectedBranches` → `verifiable: true`. A live API read reports the ground truth;
  absence of the property is a real absence, not a limit of our vantage point.
- `preReceive` → `verifiable: false`, `mechanism: 'pre-receive-config-declared'`. No endpoint
  reports whether a server-side hook is installed on a bare repo. Its `active` reflects the CONFIG
  self-declaration only; the report must NEVER render it as verified.

**Three tiny provider-aware evaluators, mirroring `evalBrainWritesReviewedGate` EXACTLY.** Each is a pure
function `(provider, probeResult, config) -> gate`. Provider-branching lives INSIDE the evaluator (the
sanctioned house pattern), never leaking to `selectRung`. Behavior-preservation is the load-bearing
constraint — the existing rung-1 tests (`substrate.test.mjs:111-178`) pass NO `provider`, so the
`else`/unset branch MUST reproduce today's contexts-based logic verbatim:

- **`evalPipelineMustSucceedGate({ provider, status, hasOurContexts, result })`**
  - `provider === 'gitlab'` → `active = result?.pipelineMustSucceed === true`; `available: true` (the project
    setting is API-readable on every tier); `mechanism: 'branch-merge-gate-api'`.
  - **else (github / unset)** → `active = (status === 200 && hasOurContexts)`; `available`/`reason`/`remedy`
    from the EXISTING `200-missing-contexts` / `404-unset` / `403-tier-locked` / `unknown` ladder verbatim.
    This preserves every current no-provider test (`{200,OUR}` armed, `{200,other}` not, `{404}` unset,
    `{403}` unavailable).
- **`evalProtectedBranchesGate({ provider, status })`**
  - `provider === 'gitlab'` → `active = (status === 200)` (push gate present); `404` → available/not-armed;
    `403` → `available: false` (tier/permission).
  - **else (github / unset)** → `active: false`, `available` mirrors `status` (`403` → false, else true).
    On GitHub the push gate and merge gate are the SAME branch-protection object; governance arming is keyed
    on required checks (`pipelineMustSucceed`), so a bare protected branch does NOT independently arm rung-1.
    This is why `{200, some-other-check}` (no provider) must stay `rung !== 1` — `protectedBranches` cannot
    rescue it.
- **`evalPreReceiveGate({ config })`** (provider-agnostic) → `active = config?.vcs?.selfHostedPreReceive ===
  true`; always `verifiable: false`. This REPLACES the `:98-100` short-circuit — same arming truth, now
  carrying the honest `verifiable:false` signal instead of masquerading as a verified probe result.

**OR-composition, localized to `evalRung1`'s return (`selectRung` untouched):**

```js
const gates = {
  pipelineMustSucceed: evalPipelineMustSucceedGate({ provider, status, hasOurContexts, result }),
  protectedBranches:   evalProtectedBranchesGate({ provider, status }),
  preReceive:          evalPreReceiveGate({ config }),
};
const active = gates.pipelineMustSucceed.active || gates.protectedBranches.active || gates.preReceive.active;

if (active) return { available: true, active: true, reason: null, remedy: null, gates };

// Not armed by ANY sub-gate → surface the primary (merge-gate) blocker, preserving today's exact strings.
const primary = gates.pipelineMustSucceed;
return {
  available: active || primary.available,   // 403-without-preReceive stays available:false (test :160)
  active: false,
  reason: primary.reason,
  remedy: primary.remedy,
  gates,
};
```

`detectSubstrate` changes ONE line: `rungs[1].gates.brainWritesReviewed = await evalBrainWritesReviewedGate(
…)` (mutate-add, not overwrite), because `evalRung1` now OWNS the `gates` object. Every existing assertion
holds:
- `{200,OUR}` (no provider) → `pmts.active=true` → rung 1, `reason:null`, `remedy:null`. ✓
- `{200,other}` → `pmts.active=false`, `pb.active=false`, `pr.active=false` → `rung !== 1`. ✓
- `{404}` → `available:true`, `active:false`, reason `/unset|not configured|not armed/`. ✓
- `{403}` → `available:false` (`active=false`, `primary.available=false`). ✓
- `{ selfHostedPreReceive:true }` + `{403}` → `pr.active=true` → rung 1, `enforced:true`. ✓ (short-circuit
  removed, sub-gate takes over — NO test change).

**Alternatives rejected.** (a) Approach B alone (one `verifiable` boolean on the single rung-1 result) —
REJECTED by ruling: GitLab has THREE independently-armable mechanisms; collapsing them reinstalls the
illegibility A4 kills, and would falsely report rung-1 ABSENT on the mirror where `pipelineMustSucceed` is
the sole armed gate. (b) Presence-alone (protected-branch presence = rung-1) — REJECTED with the owner's own
CP-A2b evidence: the mirror's protected branches are UNCONFIGURED, yet MR-A was blocked — by
`only_allow_merge_if_pipeline_succeeds`. Presence-alone reports the working case as broken.

## Decision 2 — One new load-bearing read in `gitlab.mjs`: the project-level merge gate

`only_allow_merge_if_pipeline_succeeds` lives on the PROJECT object (`GET /projects/:id`), NOT on
`protected_branches` — so `capabilities()`/`branchProtect()` (which only touch `protected_branches`) cannot
surface it. Add ONE thin verb, sibling of `capabilities()`, using the `glab` session like its siblings (NO
pipeline-env read — `gitlab.mjs` is a GATE_FILE; the CLI session is the sanctioned local-command path, same
as `capabilities()`/`branchProtect()`):

```js
/**
 * projectMergeSettings — the project-level merge gate with no protected-branch
 * equivalent. only_allow_merge_if_pipeline_succeeds is GitLab's analog of GitHub
 * required_status_checks and the load-bearing signal that actually blocks MRs
 * (CP-A2b). Uses the glab session like capabilities()/branchProtect() — no
 * pipeline-env read (GATE_FILE). null = uncomputable (read failed), NEVER a
 * fabricated false.
 *
 * @param {{ project?: string }}
 * @returns {{ onlyAllowMergeIfPipelineSucceeds: boolean|null }}
 */
export async function projectMergeSettings({ project = '' } = {}) {
  const enc = encodeURIComponent(project);
  const r = run('glab', ['api', `projects/${enc}`]);
  if (!r.ok) return { onlyAllowMergeIfPipelineSucceeds: null };
  try {
    return { onlyAllowMergeIfPipelineSucceeds: Boolean(JSON.parse(r.stdout).only_allow_merge_if_pipeline_succeeds) };
  } catch {
    return { onlyAllowMergeIfPipelineSucceeds: null };
  }
}
```

**Scope of the read (the ruling's "surface anything else?" question).** It surfaces ONLY
`onlyAllowMergeIfPipelineSucceeds`. The push-gate signal (`protectedBranches`) does NOT come from
`/projects/:id` — it comes from the per-branch protected-branch read (Decision 3). Keeping this verb to one
field keeps it a thin, honest, single-purpose I/O wrapper (same class as `capabilities()` — not unit-tested
directly; the parse SHAPE is pinned by a `derived` fixture, Decision 5). `null`-on-failure mirrors
`labelEvents`' null-vs-`[]` discipline: a failed read is uncomputable, never a fabricated `false`.

**Alternative rejected.** Extend `capabilities()` to also return the pipeline setting — REJECTED:
`capabilities()` is a shared contract function (consumed by the `platform` line and elsewhere); widening its
return shape for one probe's need couples unrelated consumers. A dedicated verb is the smaller, clearer diff.

## Decision 3 — Provider-branched probe + the substrate↔governance-status honesty contract

`realBranchProtectionProbe` (`brain-governance-status.mjs:45-63`) provider-branches on
`config?.vcs?.provider`, mirroring `realBrainWritesReviewedProbe:78-111`. The GitHub branch is the existing
`gh api …/branches/:branch/protection` read, unchanged. The GitLab branch reads the PER-BRANCH protected
endpoint inline (parity with how GitHub inlines its `gh` read) for honest `200/404/403` semantics, then calls
the new `projectMergeSettings` verb, and normalizes BOTH into the shape `evalRung1` already consumes, plus
the new `pipelineMustSucceed` field:

```js
async function realBranchProtectionProbe({ config }) {
  const provider = config?.vcs?.provider;
  const project = config?.project?.slug;
  const branch = config?.project?.defaultBranch ?? 'main';
  if (!project) return { status: undefined, contexts: [] };

  if (provider === 'gitlab') {
    const gl = await import('./vcs/providers/gitlab.mjs');
    const enc = encodeURIComponent(project);
    // per-branch protection: 200 protected / 404 not-protected — parity with the gh probe.
    const rb = run('glab', ['api', `projects/${enc}/protected_branches/${encodeURIComponent(branch)}`]);
    let status;
    if (rb.ok) status = 200;
    else if (rb.stderr.includes(': 404')) status = 404;
    else if (rb.stderr.includes(': 401') || rb.stderr.includes(': 403')) status = 403;
    const { onlyAllowMergeIfPipelineSucceeds } = await gl.projectMergeSettings({ project });
    return { status, contexts: [], pipelineMustSucceed: onlyAllowMergeIfPipelineSucceeds === true };
  }

  /* … existing GitHub gh-api read, unchanged … */
}
```

**Why the per-branch read instead of reusing `capabilities()`.** `capabilities()` reads the
`protected_branches` COLLECTION and maps `200` (API reachable) → `'available'` — it returns `'available'`
even when the collection is EMPTY. On the mirror (no protected branches) that would FALSELY report
`protectedBranches` armed, contradicting the very CP-A2b evidence the ruling rests on. The per-branch
endpoint `404`s when the default branch isn't protected, giving an honest push-gate signal with the same
`200/404/403` vocabulary the GitHub probe already speaks. This is an honesty-driven divergence from the
proposal's "reuse `capabilities()`" hint, recorded here for the reviewer (open question for tasks.md).

**The honesty contract — data (substrate) and presentation (governance-status) change together.**

| Layer | File | Owns | Change |
|-------|------|------|--------|
| DATA | `substrate.mjs` | the `verifiable`/`mechanism`/`active` SIGNAL | `preReceive.verifiable=false`; `pipelineMustSucceed`/`protectedBranches`.`verifiable=true` |
| PRESENTATION | `brain-governance-status.mjs` | the CAVEAT TEXT, driven by the signal | `printSubstrateReport` renders per-armed-gate lines; caveat IFF a rendered active gate has `verifiable===false` |

`printSubstrateReport` gains a rung-1 sub-gate breakdown. For each of the three gates that is `active`:
- `verifiable === true` → render as DETECTED, e.g.
  `  merge gate     armed  [only_allow_merge_if_pipeline_succeeds / required checks]`
  `  push gate      armed  [protected branch — direct pushes blocked]`
- `verifiable === false` → render with the exact caveat, driven SOLELY by the flag (never hardcoded
  independent of data):
  `  pre-receive    armed (config-declared) — not remotely detectable; verify via install runbook (npm run brain:protect-server)`

The unconditional static line 191 (`'  pre-receive available  [bypass-proof self-hosted hard gate …]'`) is
REMOVED from the universal block: pre-receive is NOT universal — it is a rung-1 mechanism armed only when
config-declared, and its honesty now lives in the gate-driven rendering. Tests assert the caveat text appears
IFF a rendered active gate carries `verifiable:false`, and NEVER the word "verified" for pre-receive.

## Decision 4 — `diff-size` stays OUT of the pre-receive hook (recorded rationale, constraint 2)

`diff-size` is a WHOLE-MR delta-vs-base measurement: `parseDiffNumstat` sums additions+deletions across the
full changed-file set of an MR versus its base, filtered by `governance.ignoreList` globs (`**/*.test.mjs`,
`.memory/**`, `openspec/changes/**`, lockfiles) tuned for whole-file-type exclusions. A `pre-receive` hook
sees only a PUSH-BATCH (`git rev-list oldrev..newrev`) — it has no "MR base" and no way to apply the
ignoreList's intended whole-diff scope. Enforcing a per-push budget would double/under-count relative to the
real MR diff and DIVERGE from the CI `diff-size` `REQUIRED_JOBS` check (`governance-checks.mjs:24`) — a
different enforcement point producing different verdicts = FALSE REJECTIONS. Therefore `diff-size` stays a
CI/MR gate; the hook stays commit-format + ticket-ref ONLY, already self-contained `sh`+`git`+`grep`
(zero-Node contract, its header mandate). A4 adds NO new hook binary and NO new evaluator — "extend, not
sibling" is satisfied by augmenting `substrate.mjs` / `brain-governance-status.mjs` / the existing test
harness.

## Decision 5 — CP-A4a: reuse the bare-repo harness; offline governance-status fixtures

**Rejection demo (`hooks/pre-receive.test.mjs`).** Reuse `setupFixture`/`commitAndPush` (`git init --bare`
→ install hook → push → assert exit). The existing new-file cases prove addition-rejection; the CP-A4a case
adds the APPEND variant (recommended per exploration) — first push a compliant commit that CREATES a tracked
file, then APPEND to that same file with a non-compliant message and push → REJECTED, output mentions
`pre-receive`. This demonstrates rejection on a realistic modification, not only on new-file addition, and
is the fixture-tested GitLab-server-hook acceptance evidence (the hook is provider-agnostic pure
git-server mechanics — no GitLab, no network, `GIT_AVAILABLE`-gated). A small `appendAndPush(cloneDir, file,
message)` helper sits beside `commitAndPush`.

**Offline governance-status fixtures (`brain-governance-status.test.mjs`).** Four new cases inject the
normalized probe return (existing seam — `probes.branchProtection` override + fake `providerModule`), config
`{ vcs: { provider: 'gitlab' } }`:

| Case | Injected probe / config | Expected report |
|------|-------------------------|-----------------|
| `pipelineMustSucceed`-armed | `{ status: 404, contexts: [], pipelineMustSucceed: true }` | RUNG 1; merge gate armed; push gate inactive; NO pre-receive caveat |
| `protectedBranches`-armed | `{ status: 200, contexts: [], pipelineMustSucceed: false }` | RUNG 1; push gate armed; merge gate inactive |
| `preReceive`-declared-only | `{ status: 404, contexts: [], pipelineMustSucceed: false }` + `selfHostedPreReceive: true` | RUNG 1; pre-receive caveat renders (`verifiable:false`); never "verified" |
| none | `{ status: 404, contexts: [], pipelineMustSucceed: false }`, no `selfHostedPreReceive` | rung falls below 1; no false arming |

**Fixture provenance.** One committed fixture `brain/scripts/vcs/fixtures/gitlab-project.json` documents the
raw `GET /projects/:id` shape (the `only_allow_merge_if_pipeline_succeeds` field name) stamped
`_provenance: { endpoint: 'GET /projects/:id', date, provenance: 'derived', note: 'live-verifiable via curl
against the mirror once exercised' }` — `derived`, NEVER `recorded` (the mirror endpoint is not exercised in
this fixture-phase slice; CP-A3a precedent). It pins the field name the parse depends on. The ladder LOGIC
is exercised entirely by injected normalized probe returns (no live `glab`, offline), matching the
established `substrate.test.mjs` / `brain-governance-status.test.mjs` seam.

## Decision 6 — Extend, do not duplicate, `docs/inbox/self-hosted-pre-receive.md`

The GitLab `custom_hooks/` server-install path is ALREADY documented there (lines 55-76) as the deferred
manual SCIT step. A4 adds a short subsection cross-referencing it from the ladder-awareness angle: how
`brain:governance-status` reports the pre-receive rung as "armed (config-declared) — not remotely
detectable", and that the runbook is how you VERIFY what the ladder cannot probe. No recreation of the
install steps.

## Data flow

    brain:governance-status (local CLI)
      └─ realBranchProtectionProbe({ config })              ── provider-branched (mirrors realBrainWritesReviewedProbe)
           ├─ github:  gh api …/branches/:branch/protection   → { status, contexts }        (unchanged)
           └─ gitlab:  glab api …/protected_branches/:name     → status (200|404|403)
                       gitlab.projectMergeSettings({ project }) → onlyAllowMergeIfPipelineSucceeds
                       normalize → { status, contexts: [], pipelineMustSucceed }
                                                   │
                                                   ▼
      detectSubstrate({ config, probes }) ─ evalRung1 ─ evalPipelineMustSucceedGate  (verifiable:true)
                                                       ├ evalProtectedBranchesGate    (verifiable:true)
                                                       └ evalPreReceiveGate           (verifiable:FALSE)
                                                   │  active = OR(three)   [selectRung UNTOUCHED]
                                                   ▼
      printSubstrateReport(substrate) ─ per armed gate: verifiable? DETECTED : CAVEAT
                                        caveat text driven SOLELY by verifiable===false

## File changes

| File | Action | Description |
|------|--------|-------------|
| `brain/scripts/vcs/substrate.mjs` | Modify | 3 pure sub-gate evaluators (`evalPipelineMustSucceedGate`/`evalProtectedBranchesGate`/`evalPreReceiveGate`); `evalRung1` OR-composes + owns `gates`; remove `:98-100` short-circuit; `detectSubstrate` merges `brainWritesReviewed` into `gates`. `selectRung` UNTOUCHED |
| `brain/scripts/vcs/providers/gitlab.mjs` | Modify | New `projectMergeSettings({ project })` (~15 lines) over `glab api projects/:id`; `null` on failure; GATE_FILE-safe |
| `brain/scripts/brain-governance-status.mjs` | Modify | Provider-branch `realBranchProtectionProbe` (GitLab: per-branch read + `projectMergeSettings`, normalized shape); `printSubstrateReport` sub-gate rendering + `verifiable`-driven caveat; remove static line 191 |
| `brain/scripts/vcs/substrate.test.mjs` | Modify | RED-first: GitLab `pipelineMustSucceed`/`protectedBranches`/`preReceive` arming + `verifiable`/`mechanism` assertions; existing rung-1 tests stay green |
| `brain/scripts/brain-governance-status.test.mjs` | Modify | 4 offline GitLab fixtures (table above); caveat-IFF-`verifiable:false` assertions |
| `brain/scripts/hooks/pre-receive.test.mjs` | Modify | CP-A4a append-rejection case + `appendAndPush` helper; reuse `setupFixture` |
| `brain/scripts/vcs/fixtures/gitlab-project.json` | Create | `derived` + `_provenance` fixture pinning the `GET /projects/:id` field shape |
| `docs/inbox/self-hosted-pre-receive.md` | Modify | Extend with the ladder-awareness cross-reference (no duplication) |

## Testing strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | rung-1 sub-gate arming + `verifiable`/`mechanism`, both providers | Injected normalized probe returns, offline; existing tests re-green (behavior-preservation) |
| Unit | honesty rendering — caveat IFF `verifiable:false`, never "verified" | `captureLog` + injected probes + fake `providerModule` |
| e2e (local) | bare-repo append rejection | `setupFixture`/`commitAndPush`/`appendAndPush`, `GIT_AVAILABLE`-gated, no network |
| Shape | `GET /projects/:id` field name | `derived` fixture, `_provenance`-stamped, live-verifiable by curl once the endpoint is exercised |
| e2e (DEFERRED to SCIT) | real MR block on self-hosted GitLab with `custom_hooks/` hook | Gitaly host-fs admin — Track A closing, not this slice |

## Budget plan

Non-test COUNTED diff (ignoreList excludes `**/*.test.mjs`, `.memory/**`, `openspec/changes/**`, lockfiles →
all three test files, `substrate.test.mjs`, and this design.md are UNCOUNTED):

| Counted file | Est. lines |
|--------------|-----------:|
| `substrate.mjs` (3 evaluators + evalRung1 restructure − removed short-circuit) | ~55 |
| `gitlab.mjs` (`projectMergeSettings` + doc) | ~25 |
| `brain-governance-status.mjs` (probe branch + render + remove line 191) | ~40 |
| `fixtures/gitlab-project.json` | ~10 |
| `docs/inbox/self-hosted-pre-receive.md` | ~15 |
| **Total** | **~145** |

Well under 400. No `size:exception`, no split. Single feature branch `feat/issue-244-a4`, additive rung
fields, no migrations — revert restores GitHub-only detection.

## Open questions for tasks.md

- [ ] **Per-branch read vs `capabilities()` reuse (Decision 3).** Design chose the per-branch
      `protected_branches/:name` read for honest `200/404` semantics, diverging from the proposal's
      "reuse `capabilities()`" hint (which false-positives on an empty collection). Confirm the divergence at
      review, or accept `capabilities()`'s coarse signal with a documented caveat.
- [ ] **Exact rendered strings.** The `merge gate armed` / `push gate armed` / pre-receive caveat wording is
      proposed here; tasks.md locks the final copy (en+es i18n only if any string is user-facing CLI — these
      are diagnostic report lines, English-only per current `printSubstrateReport` convention).
- [ ] **`mechanism` string values.** `'branch-merge-gate-api'` / `'protected-branch-api'` /
      `'config-declared; verify via install runbook'` proposed; confirm before implementation (the last is
      ruling-mandated verbatim).
