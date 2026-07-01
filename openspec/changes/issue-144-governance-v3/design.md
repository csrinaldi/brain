---
status: draft
issue: 144
---

# Design — Governance v3: harness-agnostic fail-closed loop enforcement (issue 144)

## 0. Architectural stance

Extend the v2 architecture (`.github/workflows/governance.yml` + `GOVERNANCE_JOBS`
single source of truth + drift-guard test). Every new gate is a **generic Node script
over git/PR evidence**, composed exactly like the existing `issue-link` / `diff-size`
jobs. No parallel mechanism, no harness coupling. The two structural moves are:

1. A **capability-aware substrate detector** (`brain/scripts/vcs/substrate.mjs`) that
   generalizes `brain-protect.mjs`'s `{enforced, reason, remedy}` to *all* of governance
   and reports the active rung of the degradation ladder.
2. A **two-tier job registry** in `governance-checks.mjs` (`REQUIRED_JOBS` vs
   `DETECTION_JOBS`) so a gate can *run and report* before it is *required at merge* — the
   detection→prevention flip becomes a one-line list move, not a code change.

Pure logic is separated from git/network I/O in every checker (mirroring how
`brain-audit.mjs:22-25` imports pure `checks/*.mjs`), so the whole set is unit-testable
under `node --test` with zero dependencies.

---

## 1. Capability-aware substrate detector — `brain/scripts/vcs/substrate.mjs`

**Contract.** A single, side-effect-controlled function that never crashes and never
lies about which guarantee is active:

```js
// detectSubstrate({ config, vcs, env, probes }) →
//   { rung: 1|2|3|4, enforced: boolean, reason: string, remedy: string, rungs: {...} }
export async function detectSubstrate({ config, vcs, env = process.env, probes } = {}) { … }
```

- `rung` = the **highest armed** rung the substrate currently provides.
- `enforced` = `rung <= 3` (rungs 1–3 are enforcing; rung 4 is detection-only).
- `reason` / `remedy` = why this is the ceiling and how to climb (generalized from
  `github.mjs:66-77` and `brain-protect.mjs:82-86`).
- `rungs` = per-rung `{available, active, reason, remedy}` for `brain:governance-status`.

**Probes** (each wrapped in try/catch; any failure degrades to the next-lower rung —
never throws). Injected via `probes` so tests can mock them:

| Rung | What it means | Probe | Decision |
|---|---|---|---|
| **1 — merge** | branch protection or self-hosted `pre-receive` active | `vcs.capabilities({project,branch})` **plus** a finer read of `repos/{repo}/branches/{branch}/protection`: `200` + our required contexts present → **armed**; `404` → available-but-unset; `403`/`upgrade.*pro` → tier-locked; `config.vcs.selfHostedPreReceive === true` → armed via self-hosted floor | armed only when protection returns `200` with our contexts, or self-hosted flag set |
| **2 — release** | the publish/tag path runs `brain:audit` fail-closed | presence of the release-gate workflow (`.github/workflows/release.yml`) or `config.governance.releaseGate === true`. The project *always* controls its own release, so this is available whenever wired | armed when the release gate exists |
| **3 — auto-correct** | post-merge `brain:audit` CI opens auto-revert | presence of `.github/workflows/governance-postmerge.yml` or `env.GITHUB_ACTIONS === 'true'` | armed when CI is present |
| **4 — floor** | detection + loud signal only | always true | fallback |

**Why finer than `capabilities()`.** `github.mjs:96-100` maps **both** `200` and `404`
to `hardEnforcement: 'available'` — correct for "can I call `brain:protect`?", but it
cannot tell **armed** (rung 1 active) from **available-but-unset**. The detector adds
that one distinction; it does not change the existing verb (see Conflicts §10, item D).

**Per-gate rung-1 capability (L6 code-owner review).** Rung 1 is not monolithic: some
gates have a platform-specific rung-1 mechanism the detector must probe **per provider**.
For L6, "required code-owner review" is: GitHub → needs branch protection
(`require_code_owner_reviews`) **and** a `.github/CODEOWNERS` file; GitLab → Premium+;
Bitbucket → n/a. The detector exposes this as `rungs[1].gates.brainWritesReviewed =
{available, active, reason, remedy}` feeding the same ladder, and reports **honestly**
when L6's rung-1 is unavailable — in which case the evidence checker (§6.1, active at
detection / rung 2 / rung 3) is the guarantee, and `remedy` states how to reach rung 1
(e.g. "GitHub Pro + branch protection with require_code_owner_reviews", "GitLab Premium").

**Never lie.** `brain:governance-status` (`brain-governance-status.mjs`) is extended to
call `detectSubstrate` and print the active rung + remedy. A project whose highest armed
rung is **4** is reported as **release-blocking-visible** (`RUNG 4 — DETECTION ONLY, no
enforcing guarantee`), never a bare "ok". L6 is reported as evidence-checked (rung 2/3)
with a note when its optional rung-1 CODEOWNERS enhancement is unavailable.

---

## 2. L4 phase-order checker — `brain/scripts/vcs/phase-order-check.mjs`

Sibling to `check-refs.mjs`. Generic over `openspec/changes/**` file state + git; **no
SKILL.md, no harness assumption**. Split into a **pure evaluator** (unit-tested with plain
data) and a thin **git I/O wrapper**.

```js
// Pure — fully testable with fixtures, no git:
export function evaluatePhaseOrder({
  changedFiles,   // string[]  — git diff --name-only BASE...HEAD
  changeDirs,     // [{ name, hasProposal, hasSpec, hasDesign, hasTasks, checkedTasks:int,
                  //     statusBefore, statusAfter }]
}) → { level: 'pass'|'warn'|'fail', findings: [...] }
```

### Detection rules (near-zero false positives by construction)

**Rule C — code-without-completed-phases (the enforcing core, maps proposal (c)).**
Let `impl = changedFiles.filter(f => !f.startsWith('openspec/changes/'))` minus an
allowlist (`*.md` at repo root, `docs/**`, `.memory/**`). Let `touched` = the change
dir(s) that appear in `changedFiles`.
- `impl` non-empty: for **each** `touched` change dir whose `checkedTasks === 0` → **fail**
  (one finding per offending dir): "implementation code present but
  `openspec/changes/{name}/tasks.md` has no checked item — phases not reached apply."
  Touched dirs with `checkedTasks >= 1` produce no finding.
- `impl` non-empty but **no** `touched` change dir (hotfix/docs-only-attribution
  ambiguous) → **warn** (cannot attribute → never fail). Keeps FP ≈ 0.

*Fix-first note:* the evaluator originally gated this rule on `touched.length === 1`,
which meant any diff touching 2+ change dirs (e.g. a bystander checkbox bump in an
unrelated `openspec/changes/**` dir) silently bypassed Rule C entirely — worse than the
zero-touched-dir case, which correctly warns. The per-dir evaluation above closes that
fail-open.

**Rule A — artifact completeness, gated on Rule C.** Only when Rule C sees `impl` code
for a `touched` change: that change must have `hasProposal && hasSpec && hasDesign &&
hasTasks` → else **fail** ("implementation without spec.md/design.md"). Planning-only PRs
are **not** subjected to this (they may legitimately be mid-phase — e.g. this very change
has no `spec.md` yet; see §10-A). This extends `check-refs.mjs:96-112` (S-1) which only
requires `proposal.md` + `tasks.md`.

**Rule B — monotonic status.** For each `touched` change, compare the `status:`
frontmatter value **before vs after** using git: `git show BASE:path` vs working tree.
Ladder: `draft < proposed < spec < designed < tasked < applying < verified < archived`.
- `statusAfter` earlier than `statusBefore` in the ladder → **fail** (backward phase
  jump).
- value unknown/custom, or unchanged, or frontmatter absent → **pass** (no-op). Since
  today's files only carry `status: draft` (see grep of `openspec/changes/**`), this is a
  dormant guard that never false-positives on the current convention.

### Wrapper (git I/O only)
`git diff --name-only BASE_SHA...HEAD_SHA` for `changedFiles`; `readdirSync` +
`existsSync` for artifact flags; count `- [x]` in `tasks.md` for `checkedTasks`;
`git show BASE:path` for `statusBefore`. Exit `0` on `pass`/`warn`, `1` on `fail`.

### Rollout: detection-first → required
Ship the job in `governance.yml` **and** in `DETECTION_JOBS` (runs + reports, never
blocks). Harden against the existing `openspec/changes/**` history until zero
false-positive. Promote by moving `'phase-order'` from `DETECTION_JOBS` to
`REQUIRED_JOBS` — see §7.

---

## 3. L2 — release-gate (rung 2) + post-merge auto-revert (rung 3)

Two **new, separate** workflows (the read-only PR gate must not gain write scope; see
§10-B). Both reuse `brain/scripts/brain-audit.mjs` unchanged.

**Release gate — `.github/workflows/release.yml` (rung 2, fail-closed).**
```yaml
on:
  push:
    tags: ['v*']
permissions: { contents: read }
jobs:
  audit-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - run: node brain/scripts/brain-audit.mjs origin/main..HEAD   # exit 1 blocks the tag/publish
```
`brain-audit` already exits `1` on any failing invariant (`brain-audit.mjs:235`), so a
red audit **blocks the release job** → bad state may sit on `main` but is **never
released**. This is the primary enforcing guarantee for free-tier-private repos (rung 1
unreachable). The release gate's presence is what `detectSubstrate` probes for rung 2.

**Post-merge auto-revert — `.github/workflows/governance-postmerge.yml` (rung 3).**
```yaml
on:
  push: { branches: [main] }
  schedule: [{ cron: '0 6 * * *' }]
permissions: { contents: write, pull-requests: write }   # trusted: runs post-merge on main
jobs:
  audit-and-revert:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - id: audit
        run: node brain/scripts/brain-audit.mjs "${{ github.event.before }}..${{ github.sha }}"
        continue-on-error: true
      - if: steps.audit.outcome == 'failure'
        env: { GH_TOKEN: ${{ github.token }} }
        run: |
          sha="${{ github.sha }}"
          git revert -m 1 --no-edit "$sha"
          br="auto-revert/${sha:0:7}"
          git switch -c "$br" && git push origin "$br"
          gh pr create --base main --head "$br" \
            --title "revert: governance audit failed on ${sha:0:7}" \
            --body "Automated revert — post-merge brain:audit failed. Part of #144" \
            --label size:exception
```
On audit failure it opens an auto-revert PR (bad state does not **persist**). Runs in the
trusted post-merge context (code already on `main`), which is why `contents: write` here
is safe while the PR gate stays read-only.

---

## 4. L3 — `memory-gate` + `decision-gate` jobs

The pure functions already exist and are tested: `memoryPresence`
(`governance/checks/memory-presence.mjs`) and `adrPresence`
(`governance/checks/adr-presence.mjs`). Wire them as jobs.

**Thin runner — `brain/scripts/governance/run-check.mjs <check>`**: computes inputs from
git (`git diff --name-only BASE...HEAD` for `decision-gate`; `readChunkObservations(cwd)`
for `memory-gate`, reusing `lib/chunk-reader.mjs`), calls the pure function, prints the
reason, exits `0`/`1`. Keeps the jobs one-liners and the logic unit-tested.

**`governance.yml` additions** (composed like `issue-link`):
```yaml
  memory-gate:
    name: memory-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: node brain/scripts/governance/run-check.mjs memory-gate
  decision-gate:
    name: decision-gate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - env: { BASE_SHA: ${{ github.event.pull_request.base.sha }}, HEAD_SHA: ${{ github.event.pull_request.head.sha }} }
        run: node brain/scripts/governance/run-check.mjs decision-gate
```
Both names go into `REQUIRED_JOBS` in the **same commit** as the YAML, so the drift-guard
(`governance-checks.test.mjs:30`) stays green.

---

## 5. L5 — human-approval actor check — `brain/scripts/vcs/actor-check.mjs`

Pure evaluator + gh I/O wrapper, same split.

```js
export function evaluateActor({ author, labeledEvents, botAllowlist = [], adminOverride = false })
  → { level: 'pass'|'warn'|'fail', reason }
```

**Algorithm.**
1. PR author = `github.event.pull_request.user.login`.
2. Issue number = reuse `issue-link` extraction from PR body.
3. `gh api repos/{repo}/issues/{n}/events --jq '[.[] | select(.event=="labeled" and .label.name=="status:approved")]'`.
4. Take the **most recent** `labeled` event's `actor.login` (handles re-labeling:
   remove→re-add uses the latest add).
5. Decision:
   - actor `=== author` and actor **not** in `botAllowlist` and not `adminOverride` →
     **fail** (self-approval).
   - actor in `botAllowlist` (e.g. a CI/automation bot applying a human's decision) →
     **pass**.
   - `adminOverride` label present (allowlisted `override:*`) → **pass**, logged.
   - **no** `labeled` event found (label predates events retention, or applied via
     import) → **warn**, **pass** (cannot prove self-approval → never fail; FP ≈ 0).
6. `gh` failure → warn + pass (detection mode). Never crash.

`botAllowlist` comes from `config.governance.approvalActors`. Reads use the existing
`permissions: issues: read` (`governance.yml:19`). Ships as `DETECTION_JOBS` first, then
promoted (§7).

---

## 6. L6 — brain-writes reviewed by a human (evidence-based; CODEOWNERS is an optional rung-1 enhancement)

**Why not CODEOWNERS as the mechanism.** CODEOWNERS is **platform-specific and
rung-1-dependent**: GitHub has the file but "require review from Code Owners" needs branch
protection (Pro/public); GitLab required code-owner approval is Premium+; Bitbucket has no
native CODEOWNERS; plain self-hosted git has none. Building the single Tier-2 gate on top
of CODEOWNERS would make it as fragile as rung 1 and, on brain's own free-tier-private
repo, it would not enforce at all (auto-assign only). So L6's **enforcement** is an
evidence check like L5; CODEOWNERS is retained only as an **optional rung-1
implementation** where the platform supports it.

### 6.1 Primary mechanism — `brain/scripts/vcs/brain-writes-reviewed.mjs`

Pure evaluator + VCS-adapter I/O wrapper, same split as `actor-check`. Platform-agnostic:
works on any VCS that exposes a reviews API.

```js
export function evaluateBrainWritesReviewed({
  changedFiles,   // string[] — git diff --name-only BASE...HEAD
  reviews,        // [{ state, author }] — normalized PR reviews from the VCS adapter
  author,         // PR author login
  botAllowlist = [], adminOverride = false,
}) → { level: 'pass'|'warn'|'fail', reason }
```

**Algorithm.**
1. `touchesBrain = changedFiles.some(f => f.startsWith('brain/core/') || f.startsWith('brain/project/'))`.
   If false → **pass** (no Tier-2 requirement; no false-positive).
2. Fetch PR reviews via the VCS adapter (or `gh api repos/{repo}/pulls/{n}/reviews`);
   normalize to `[{ state:'APPROVED'|…, author }]`.
3. `approvers = reviews.filter(r => r.state === 'APPROVED').map(r => r.author)`, deduped.
4. Decision (reuse actor-check bot/admin handling):
   - at least one approver whose login **≠ `author`** and not in `botAllowlist` → **pass**
     (a human other than the author reviewed the brain-writes).
   - only self-approval (`author` is the sole approver) → **fail** — enforces Tier-2 "no
     agent writes to `brain/`" (`agent-authorities.md:35`).
   - `adminOverride` label present (allowlisted `override:*`) → **pass**, logged.
   - **no reviews API / zero reviews yet** → **warn + pass** (detection; FP ≈ 0). Never
     crash on a missing/unsupported reviews API.

This does **not** need CODEOWNERS or branch protection to **detect**. Like every other
gate it climbs the substrate ladder to become fail-closed at rung 2 (release-gate) / rung
3 (auto-revert), and — where supported — rung 1 via CODEOWNERS below.

### 6.2 Optional rung-1 enhancement — `.github/CODEOWNERS` (where supported)

Where the platform + branch protection support **required code-owner review**, shipping
`.github/CODEOWNERS` upgrades L6 to **prevention-at-merge** (rung 1). This is an
enhancement, not the enforcement.

```
/brain/core/**     @<human-reviewer-team>
/brain/project/**  @<human-reviewer-team>
```
Live only once branch protection with `required_pull_request_reviews` +
`require_code_owner_reviews` is armed (`github.mjs:52-54`).

**Distribution.** Add `'.github/CODEOWNERS'` to `managed` in `core/managed-paths.mjs` as
an **exact literal**, mirroring `.github/workflows/governance.yml` and
`.github/PULL_REQUEST_TEMPLATE.md` (`managed-paths.mjs:21-24`). **Never** `.github/**` as
a glob — that would clobber the consumer's other `.github/` config. Because brain lists
only the specific files, the rest of a consumer's `.github/` tree is untouched.

**Consumer-owned-CODEOWNERS safety net.** GitHub reads a **single** CODEOWNERS file, so
brain's file cannot silently compose with a consumer's. The installer's existing
managed∩local overlap guard (`managed-paths.mjs:8-11,27-29`) is the escape hatch: a
consumer who already maintains CODEOWNERS lists `.github/CODEOWNERS` in their `local` set
→ **local wins**, the installer **skips and warns** rather than clobbering. Default
(consumer has none) → brain provides it. Because L6's enforcement is the evidence checker
(§6.1), a consumer without CODEOWNERS — or on a platform that lacks it — still gets Tier-2
enforcement at rung 2/3. See §10-C.

---

## 7. Detection→prevention flip with no code change — two-tier registry

Refactor `governance-checks.mjs` so a job can run before it is required:

```js
export const REQUIRED_JOBS  = ['issue-link', 'diff-size', 'memory-gate', 'decision-gate'];
export const DETECTION_JOBS = ['phase-order', 'actor-check', 'brain-writes-reviewed']; // run + report, not required
export const GOVERNANCE_JOBS = [...REQUIRED_JOBS, ...DETECTION_JOBS]; // full set the YAML must equal
export function checkContexts() {                                    // ← only REQUIRED become branch-protection contexts
  return REQUIRED_JOBS.map(job => `${WORKFLOW_NAME} / ${job}`);
}
```

- The **drift-guard** still asserts `YAML job names === GOVERNANCE_JOBS` (full set) — stays
  green (`governance-checks.test.mjs:30`).
- `brain:protect` (`brain-protect.mjs:65`) requires only `checkContexts()` = `REQUIRED_JOBS`.
- **The flip**: move a name from `DETECTION_JOBS` → `REQUIRED_JOBS`. The job already runs;
  the next `brain:protect` (rung 1 armed) makes its context required at merge. **No job
  code changes** *for gates that already fail closed on an uncomputable diff* (e.g.
  `decision-gate`, see `run-check.mjs`). The same running check context transparently
  becomes enforcing the moment the operator arms the substrate — exactly the "climbs to
  prevention with no code change, only the substrate" capability.
- **Promotion precondition for `phase-order` (fail-open guard).** Unlike `decision-gate`,
  `phase-order-check.mjs`'s wrapper deliberately degrades an *uncomputable* diff (missing
  `BASE_SHA`/`HEAD_SHA`, git failure) to `warn` → exit `0` while detection-only, to keep
  REQ-L4-5's zero-false-positive goal intact. Promoting it to `REQUIRED_JOBS` verbatim
  would turn that into a silent **fail-open** (a required gate passing without evaluating).
  So promotion of `phase-order` specifically is **not** a code-free flip: it MUST first
  switch the uncomputable-diff branch to fail-closed, mirroring `run-check.mjs`'s
  `decision-gate`. Track this as an explicit precondition on the promotion follow-up.
- L1 checks (`repo:check` + `brain:nav` + `npm test`) land as required jobs too
  (zero-risk), moving them out of the bypassable `pre-push` hook
  (`hooks/pre-push:52`).

---

## 8. Testing strategy (strict TDD, zero deps, `node --test`)

| Unit | How tested | Determinism |
|---|---|---|
| `phase-order` pure `evaluatePhaseOrder` | fixture objects (arrays of change-dir descriptors), no git | fully deterministic — the git I/O is isolated in the wrapper |
| `phase-order` wrapper | optional `mkdtemp` + `git init` fixture repo for one happy/one fail path | isolated temp repo, cleaned up |
| `substrate` detector | inject `probes` mock returning canned rung availability; assert highest-armed selection, graceful degradation, and **probe-throws → rung 4 (never crash)** | no network |
| `actor-check` pure `evaluateActor` | fixtures: self-approve, bot allowlist, re-label ordering, missing-event→warn | no gh calls |
| `brain-writes-reviewed` pure `evaluateBrainWritesReviewed` | fixtures: brain-write approved-by-other→pass, approved-by-author-only→fail, no-brain-write→pass, no-reviews→warn, bot/admin edge cases | no gh calls (reviews injected as plain data) |
| `run-check` L3 wiring | reuse existing `memory-presence.test.mjs` / `adr-presence.test.mjs`; add a runner smoke test | pure functions already covered |
| drift-guard | keep `governance-checks.test.mjs`; **add** a test asserting `checkContexts()` excludes `DETECTION_JOBS` and equals `REQUIRED_JOBS` contexts | reads real YAML |

Principle: every gate's decision logic is a **pure function over plain data**; git/`gh`
live only in thin wrappers. This is how `brain-audit.mjs` already achieves testability and
is the reason the whole suite needs zero new dependencies.

---

## 9. Alternatives rejected

- **Phase-order logic living in `gentle-ai`'s `SKILL.md`** — rejected. Harness-locked and
  unenforceable (a prompt is skippable). Migrating it into an in-repo evidence check is
  the whole point of L4; it *strengthens* ADR-0001/0002 rather than eroding them.
- **Forcing `gentle-ai` (or any harness) to be used** — rejected. Unverifiable and breaks
  harness-neutrality. We gate the FIN (phases happened, artifacts exist, approval is
  human), never the MEDIO (which tool produced them).
- **Depending on branch protection (rung 1) as a prerequisite** — rejected. brain's own
  repo is free-tier-private (`403` on protection). Rung 2 (release gate) is the primary
  enforcing guarantee; v3 depends on no single rung.
- **Making `phase-order` / `actor-check` required immediately** — rejected. Over-strict
  gates push developers to `--no-verify` / `size:exception`, defeating governance
  (`hooks/pre-push:21-29`). Detection-first, harden, then promote.
- **CODEOWNERS distributed via `.github/**` glob** — rejected. Would clobber every
  consumer `.github/` file. Exact-literal managed path only.
- **L6 built on CODEOWNERS as the enforcement mechanism** — rejected: platform-specific
  and rung-1-dependent (GitLab Premium, no Bitbucket, GitHub needs branch protection),
  which would make the single Tier-2 gate non-universal and inert on brain's own
  free-tier-private repo. The evidence-based `brain-writes-reviewed` checker works on any
  VCS with a reviews API and enforces at detection / rung 2 / rung 3; CODEOWNERS is
  retained only as an optional rung-1 enhancement where the platform supports it.
- **Adding write scope to the PR `governance.yml` (via `pull_request_target`)** —
  rejected. Runs untrusted PR code with secrets. Auto-revert lives in a separate,
  post-merge (trusted) workflow.
- **A single combined "governance" mega-job** — rejected. Branch protection and the
  drift-guard both key off per-job check contexts; one job destroys the granular
  detection→prevention flip.
- **Changing `capabilities()` to report armed/unset** — rejected as the primary path.
  That verb answers "can I call `brain:protect`?"; the detector adds the finer probe
  itself so the existing contract and its callers are untouched.

---

## 10. Conflicts / flags (proposal & ADR-0001/0002)

- **A — brain's own changes lack `spec.md`.** `openspec/changes/issue-144-governance-v3/`
  and `issue-138-session-start/` currently have only `proposal.md` + `tasks.md` +
  `design.md` (no `spec.md`). If L4's "spec.md AND design.md exist" were applied
  unconditionally it would flag brain's *own* history, violating the "zero false positives
  before required" success criterion. Resolved by gating Rule A on Rule C (code-bearing
  PRs only) and shipping detection-first — but this narrows the proposal's flat statement
  of rule (a). **Confirm** this scoping is acceptable.
- **B — post-merge auto-revert needs write scope.** The proposal keeps `governance.yml`
  read-only (`governance.yml:8-19`). Rung 3 requires `contents: write` +
  `pull-requests: write`; placing it in a **separate** post-merge workflow preserves the
  read-only PR gate. Structural addition, compatible with intent.
- **C — CODEOWNERS single-file tension (now non-blocking for L6).** GitHub honors one
  CODEOWNERS; a managed exact-literal overwrites a consumer's existing one on
  `brain:upgrade`. Mitigated by the local-override overlap guard, but composition is not
  automatic. Because L6's **enforcement** is the evidence checker (§6.1) and CODEOWNERS is
  only an optional rung-1 enhancement, a consumer who declines it — or is on a platform
  without it — still gets Tier-2 enforcement. **Confirm** brain ships `.github/CODEOWNERS`
  by default (as the rung-1 enhancement) with the local-override escape hatch.
- **D — `capabilities()` granularity.** The proposal implies substrate detection reuses
  the provider capability API. `capabilities()` cannot distinguish armed vs available
  (`github.mjs:96-100`); the detector adds a finer protection read. No change to the
  existing verb.
- **E — `GOVERNANCE_JOBS` refactor.** The proposal says "extend `GOVERNANCE_JOBS`". To run
  a gate as detection before requiring it, the constant is split into
  `REQUIRED_JOBS`/`DETECTION_JOBS` with `GOVERNANCE_JOBS` as their union. Backward-compatible
  (drift-guard unchanged); worth recording as a refinement of the proposal's wording.

No conflict with **ADR-0001** (3-layer, replaceable harness) or **ADR-0002** (two-layer
git-based memory): every gate inspects evidence (file state, git-blame/merge-base, PR
actor, merged diff), never the producer — which *reinforces* both ADRs.
