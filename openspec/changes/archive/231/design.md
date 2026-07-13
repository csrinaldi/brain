# Design — GitLab Governance Pipeline (slice A2)

Ship the GitLab governance pipeline over the existing `ci-context` seam. A1 already built the GitLab
CONTEXT reader; A2 builds the PIPELINE that invokes the eight jobs and the Node wiring that lets two
previously-bash jobs run on GitLab. Pure evaluators stay untouched (ADR-0016 boundary). All artifacts
English (ADR-0009).

## Decision 1 — `include: local:` opt-in; brain NEVER manages the consumer root

Brain ships `brain/scripts/ci/gitlab-governance.yml` and registers it as a LITERAL in
`managed-paths.mjs` `managed[]` (managed-paths.mjs:39-51 holds literal paths only — no globs). The
consumer's root `.gitlab-ci.yml` stays LOCAL (`local[]`), consistent with how brain owns
`.github/workflows/governance.yml` but never the consumer's other CI. Adoption is one line the consumer
adds themselves: `include: { local: 'brain/scripts/ci/gitlab-governance.yml' }`.

**Alternatives considered:** (a) ship a root `.gitlab-ci.yml` — REJECTED: GitLab allows exactly one root
pipeline file, so brain would clobber the consumer's own CI (ADR-0003 core-is-read-only violation).
(b) generate the root via installer merge — REJECTED: YAML deep-merge of an arbitrary consumer pipeline
is fragile and there is no zero-dep YAML writer. **The `include:`-line adoption cost is the honest
residual F1 inherits** (argued fully in the ADR draft): the consumer must add one line, and brain cannot
verify they did — the fragment is inert until included. This is the correct trade against clobber risk.

## Decision 2 — THE GOTCHA: `issue-link`/`diff-size` CANNOT be bash on GitLab → uniform Node entrypoints

On GitHub, `issue-link` (governance.yml:28-81) and `diff-size` (:84-113) are pure bash reading the
`github.event` payload, which carries a FRESH body and labels. **GitLab has no equivalent:** there is no
`CI_MERGE_REQUEST_DESCRIPTION` predefined variable, and `CI_MERGE_REQUEST_LABELS` FREEZES at pipeline
creation (forbidden — ADR-0016:45). The MR body and fresh labels exist only behind
`loadGitlabContext()` (ci-context.mjs:120-153), which fetches them in one proxy-aware API call.

**Decision:** route ALL eight GitLab jobs through Node entrypoints. Extend `run-check.mjs` — today it
handles `memory-gate` + `decision-gate` (run-check.mjs:87-101) — with `issue-link` and `diff-size` cases
that call the ALREADY-EXISTING pure evaluators (`checks/issue-link.mjs#issueLink`,
`checks/diff-size.mjs#diffSize` — unit-tested, never CLI-wired) fed by `loadContext()`. The CLI
entrypoint (run-check.mjs:122-125) already loads `ctx` once and passes it in. This reuses the pure
evaluators, duplicates NO logic, and is uniformly fixture-testable. **This is the scope-shaping decision
for CP-A2a review: A2 is NOT "just a YAML" — it is the Node wiring that makes the seam usable end-to-end
on GitLab.**

Inputs per case:
- `issue-link` → `issueLink(ctx.body)` for the reference pattern, THEN verify the referenced issue
  carries the resolved approved label (Decision 4) via an injectable issue-fetch. On a `null` body the
  REQUIRED gate fails closed (run-check.mjs:57-71 is the established precedent).
- `diff-size` → `diffSize(numstat, ignoreList)` where `numstat = git diff --numstat baseSha...headSha`
  (from `ctx`) and `size:exception` is read from FRESH `ctx.labels`, never `CI_MERGE_REQUEST_LABELS`.

GitHub keeps its working bash for these two jobs; only the approved-label read moves to config
(Decision 4). Converting GitHub wholesale to Node is out of scope (avoids needless churn/risk).

### Decision 2 ADDENDUM (issue #231 A2 phase 2 addendum) — the Node path was base-branch-blind

**The gap:** GitHub bash's `issue-link` job (governance.yml:45-70) is base-branch-conditional —
`base==main` requires a closing keyword (Closes/Fixes/Resolves) ONLY; `base!=main` (slice) also accepts
`Part of #N`. The pure `issueLink()` evaluator is NOT base-branch-aware — by design (REQ-CIC-4, it stays
UNCHANGED). Phase 2 ported `issueLink(ctx.body)` into `run-check.mjs` unconditionally, which matches the
bash's slice-PR branch exactly but silently diverges from the bash's `base==main` branch: a
`Part of #N`-only body targeting the default branch would PASS on Node but FAIL on GitHub bash. This was
identified and documented (not hidden) in Phase 2's apply-progress and the task 2.6 parity table's scope
note, then ruled by the human to be closed now (option c), not deferred.

**RATIONALE:** the fix is default-BRANCH-conditional, not `base=='main'`-conditional. Platforms only run
closing keywords (Closes/Fixes/Resolves) on merges to the repository's DEFAULT branch — GitHub and GitLab
alike. This is where the keyword has real effect (auto-closing the referenced issue), not a naming
convention: a GitFlow repo whose default branch is `develop` needs the SAME policy applied to `develop`,
not to a branch literally named `main`. The platform already knows its own default branch (GitHub via
`github.event.repository.default_branch`, GitLab via the standard predefined `CI_DEFAULT_BRANCH`), so the
fix reads it from there — never a hardcoded literal, never a new config knob.

**Fix, in two seams:**
1. `ci-context.mjs`'s `loadContext()` gains a `defaultBranch` field (REQ-CIC-2 delta): GitHub maps it from
   `github.event.repository.default_branch` via a workflow `env:` line to a plain var (`DEFAULT_BRANCH`)
   — repo metadata, not trigger identity, coherent with ADR-0016 ruling 1 (never a raw `GITHUB_*` payload
   var read outside this module). GitLab reads the standard predefined `CI_DEFAULT_BRANCH` — free, no
   extra API call. `null` when the workflow does not map it (GitHub) or the var is absent (GitLab).
2. `run-check.mjs`'s `issue-link` case (the WRAPPER — the pure `issueLink()` evaluator stays UNCHANGED,
   REQ-CIC-4) applies `requiresClosingKeyword(ctx)`: `ctx.targetBranch === ctx.defaultBranch` → closing
   keyword required; otherwise `Part of #N` is also accepted. `ctx.targetBranch` or `ctx.defaultBranch`
   being `null` makes the conditional undecidable — the REQUIRED gate FAILS CLOSED, never falls back to
   comparing against a hardcoded `'main'` (that would silently reintroduce the rejected option (a)).

**Alternatives considered:** (a) hardcode `'main'` as the comparison target in the Node wrapper —
REJECTED (human ruling): reintroduces the exact bash limitation being fixed (a GitHub/GitLab consumer with
default≠`main` gets the wrong policy) and is explicitly what this addendum exists to avoid. (b) add a
config knob for the default branch name — REJECTED: the platform already knows it; a config knob would be
one more value to keep in sync and could silently drift from the actual repo setting. (c, RULED) —
compute it from the platform via `ci-context.mjs`, the sole sanctioned seam for pipeline context.

**Scope boundary (explicit, not implied parity):** the GitHub bash `issue-link` job itself is NOT changed
— it keeps comparing `BASE_BRANCH == 'main'` literally. A GitHub consumer whose default branch is not
`'main'` therefore still gets the WRONG policy from bash (pre-existing limitation, out of scope here,
recorded as a follow-up) while the Node path (now used by GitLab, and covered by the parity table) applies
the CORRECT platform-sourced policy. This divergence is called out explicitly in the parity table and in
`governance.yml`'s `issue-link` job comment — never silently implied as total parity.

### Decision 2 ADDENDUM 2 (issue #231 CP-A2a review, finding M1) — closing-keyword vocabulary unified, narrow→broad, by ruling

**The gap:** `issueLink()` (`checks/issue-link.mjs`) defined its own closing-keyword regex covering only
3 of GitHub's 9 documented forms (`closes|fixes|resolves`). GitHub bash (`governance.yml`'s `issue-link`
job) and `actor-check.mjs` both already used the BROAD 9-form vocabulary (`close[sd]?|fix(e[sd])?
|resolve[sd]?`). `run-check.mjs` had its own THIRD copy of the narrow pattern (`CLOSING_NUM_RE`). Result:
a body like `Fixed #42` merging to the default branch PASSED GitHub bash and would have passed
`actor-check.mjs`'s DETECTION verdict, but FAILED the REQUIRED `issue-link` gate on Node (both directly via
`issueLink()` and via `run-check.mjs`'s own duplicate) — a fail-closed parity divergence between the two
platforms, and an internal disagreement between two gates in the SAME pipeline.

**RULING (precedent for future reviews):** "pure evaluator unchanged" (REQ-CIC-4) protects
`checks/issue-link.mjs` from **refactor drift** introduced by the ci-context seam (ADR-0016) — it does NOT
protect a **pre-existing correctness bug** from being fixed. `issueLink()` accepted FEWER forms than the
platforms it gates actually honor; that is a bug that happened to survive because this repo's own commit
history uses `Closes`/`Part of` by habit. The fix widens `issueLink()`'s verdict (RULED, with tests: RED
first on `Fixed #42`/`Close #10`/`Resolved #5`, confirmed narrow-pattern failure, then widened) and unifies
all three regex copies into ONE shared pure-constant module,
`checks/issue-ref-patterns.mjs` (no `ci-context` import — REQ-CIC-4 still holds for the *seam*, just not for
a sibling pure-constants import), imported by `issue-link.mjs`, `run-check.mjs`, and `actor-check.mjs`.
Doctrine restated: never a second parser (the hasher / §4-grammar precedent) — one constant, three
importers, zero drift possible going forward.

## Decision 3 — Exit-code → GitLab mapping: REQUIRED normal, DETECTION `allow_failure: true`

Amendment 3 (adr-0016:62-80) fixes the policy: REQUIRED → fail-closed (0/1; uncomputable FAILS CLOSED);
DETECTION → degrade-to-warn (uncomputable → warn+exit0; real finding → exit1 visible). The three
detection wrappers already implement this internally (phase-order-check.mjs:372-408,
actor-check.mjs:228-254, brain-writes-reviewed.mjs:215-248). The GitLab pipeline maps the CLASS, not the
per-run outcome: REQUIRED jobs are normal (exit1 blocks the MR); DETECTION jobs carry
`allow_failure: true` (exit1 shows red but does not block). **Never flatten** the two classes into one —
a DETECTION `allow_failure` on a REQUIRED job would silently un-gate it.

## Decision 4 — `governance.approvedLabel`: additive config, provider-resolved, TOUCHES brain/core

`status:approved` is hardcoded in three places: `governance.yml:78` (bash grep), `actor-check.mjs:150`,
`brain-start.mjs:67`. Add an ADDITIVE `config-migrations.mjs` entry (all six existing entries are
additive; `mergeDefaults` structurally cannot remove a key): `governance.approvedLabel` default
`status:approved`. A resolver `resolveApprovedLabel(config, provider)` returns `status:approved` on
GitHub and the scoped `status::approved` on GitLab (GitLab scoped labels use `::`). Node sites import it;
the GitHub `issue-link` bash sources the label from a tiny node CLI (one-line change, replacing the
literal grep) so no bash config-parser is invented.

**Alternatives considered:** store both provider strings in config — REJECTED (redundant; the `:`↔`::`
mapping is mechanical). Destructive schemaVersion restructure — REJECTED (additive-only doctrine).

**Task boundary (call out in tasks.md):** this edits `brain/core/config-migrations.mjs`, so the L6
`brain-writes-reviewed` gate engages — human review of the merge, distinct from the author. This is the
FOURTH slice to touch that file (after #215 C1b, #223 C2b-1, #229 C4); all PASS+warn under the L6 gate.
No new ceremony; the edit rides the established path. **Version number is an open question** (below).

### Known gap (issue #231 CP-A2a review, finding m3) — `actor-check.mjs` is `gh`-hardcoded, degrades safe on GitLab

`actor-check.mjs`'s `defaultFetchLabeledEvents` (and `defaultFetchIssue`) call `execFileSync('gh', …)`
directly — the GitHub CLI. On GitLab there is no `gh` binary, so this call always throws; `runActorCheck`
catches the throw and returns a `warn` verdict (never `fail`), which is exactly this DETECTION job's
documented degrade-safe contract (REQ-L5-2: never false-pass, never a false block on missing evidence).
**This is intentional scope, not a bug**: A2/A3 drew the boundary at provider-agnostic VERBS
(`issueView`, MR/labels reads via `ci-context.mjs`'s provider abstraction) landing in A3, not A2.
`actor-check.mjs`'s `gh`-hardcoded I/O wrapper is the one piece of A2 that was NOT ported through that
abstraction, because the actor-check job itself is DETECTION-only (`allow_failure: true` on both
platforms) — a GitLab MR always gets a visible `warn`, never a silent false-pass and never a wrongly
blocked MR. Destined for CP-A2b/A3: swap `defaultFetchLabeledEvents`/`defaultFetchIssue` for the
provider-abstraction verbs (`getVcs()` from `vcs/cli.mjs`, already used by `run-check.mjs`'s
`defaultFetchIssue`) so GitLab gets real detection instead of a permanent warn. Not fixed in this slice
(CP-A2a review, DOCUMENT ONLY per ruling) — recorded here so it is not silently rediscovered.

## Decision 5 — Drift-guard extension: parse both YAMLs by string-slice (zero deps)

`ci-context-drift-guard.test.mjs` already string-slices `governance.yml` (drift-guard test:119-132) with
NO `yaml` dependency (zero-deps policy). Extend it to slice `gitlab-governance.yml` and assert: (a) job
names == `GOVERNANCE_JOBS`; (b) `allow_failure: true` present iff the job ∈ `DETECTION_JOBS`. This binds
Decisions 1, 3 to the registry — adding or mis-classifying a job turns the guard red.

## Data flow

    GitLab MR ─▶ pipeline (include: local: gitlab-governance.yml)
                     │  8 jobs, each: node run-check.mjs <job>
                     ▼
              loadContext() ──▶ loadGitlabContext (1 proxy-aware MR API call)
                     │            body, FRESH labels, author, baseSha, headSha
                     ▼
        pure evaluators (issueLink | diffSize | memoryPresence | adrPresence | …)  ← UNCHANGED
                     │
                     ▼   exit 0/1
        REQUIRED → blocks · DETECTION (allow_failure:true) → visible, non-blocking

## File changes

| File | Action | Description |
|------|--------|-------------|
| `brain/scripts/ci/gitlab-governance.yml` | Create | Eight-job GitLab pipeline fragment; REQUIRED normal, DETECTION `allow_failure:true`; each job runs `node run-check.mjs <job>` |
| `brain/scripts/governance/run-check.mjs` | Modify | Add `issue-link` + `diff-size` cases fed by `loadContext()`; keep memory/decision cases. **ADDENDUM:** `issue-link` case applies `requiresClosingKeyword(ctx)` — default-branch-conditional, fail-closed on null |
| `brain/scripts/vcs/ci-context.mjs` | Modify (ADDENDUM) | Add `defaultBranch` field to `loadContext()` (REQ-CIC-2 delta): GitHub from mapped `DEFAULT_BRANCH` env, GitLab from `CI_DEFAULT_BRANCH` |
| `.github/workflows/governance.yml` | Modify (ADDENDUM) | Map `DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}` into every ci-context-consuming job (`memory-gate`, `decision-gate`, `phase-order`, `actor-check`, `brain-writes-reviewed`); `issue-link` job gains a KNOWN DIVERGENCE comment |
| `brain/scripts/vcs/ci-context-drift-guard.test.mjs` | Modify (ADDENDUM) | Wiring test: assert the 5 ci-context-consuming jobs supply the mapped `DEFAULT_BRANCH` env var |
| `brain/core/config-migrations.mjs` | Modify | Additive `governance.approvedLabel` entry (L6 gate) |
| `brain/scripts/governance/approved-label.mjs` | Create | `resolveApprovedLabel(config, provider)` + CLI printer for the GitHub bash |
| `brain/scripts/vcs/actor-check.mjs` | Modify | Replace hardcoded `status:approved` with the resolved lookup |
| `brain/scripts/brain-start.mjs` | Modify | Same replacement |
| `.github/workflows/governance.yml` | Modify | `issue-link` bash sources the approved label from the node CLI |
| `brain/core/managed-paths.mjs` | Modify | Add the fragment as a literal `managed[]` entry |
| `brain/scripts/vcs/ci-context-drift-guard.test.mjs` | Modify | Parse the GitLab YAML; assert job-set + classification |

## Testing strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit | `resolveApprovedLabel` provider mapping; run-check issue-link/diff-size cases | Injected `ctx`/config fixtures; no real fetch, no real git |
| Unit | REQUIRED fail-closed on `null` body/labels | Inject `ctx` with `null` fields; assert exit 1 |
| Integration (fixture) | Drift-guard over `gitlab-governance.yml` | String-slice the real YAML; assert vs `GOVERNANCE_JOBS`/`DETECTION_JOBS` |
| E2E (DEFERRED to CP-A2b) | Real MR blocked/passing | Deferred until GitLab access + endpoint restored |

## Migration / rollout

Consumer adds one `include: local:` line (Decision 1). The config migration is additive/idempotent.
CP-A2a is the acceptance gate (fixture-tested, hard stop, PR-as-review); CP-A2b (live e2e) is deferred.

## Open questions

- [x] **Migration version number — RESOLVED (human ruling): `0.7.0`.** Version numbers are
      content-identifiers and are NEVER reused: a reused `0.6.0` would name two indistinguishable states
      depending on when it was applied — the exact ambiguity content-hashing exists to prevent — and this
      repo ran under `0.6.0`-dualWrite during the cutover window, so that window's archaeology needs the
      number to mean ONE thing. The `0.6.0` gap is not a tolerable cost; it is honest record — a hole in
      the sequence IS the visible mark of a retirement, readable in the log. DOCTRINE (fixed for all
      future retirements): retire-by-deletion includes the version slot; the sequence is monotonic-forever.
- [ ] **CP-A2b endpoint.** The live e2e is blocked on the human restoring GitLab access + a new
      endpoint; not decidable in this slice.
