# Design — CI Context Normalization (boundary for `ci-context.mjs`)

> **Status:** Design-only (slice A0) · How the [proposal](proposal.md) is realized. The
> boundary only — no code lands this slice.
> Governed by [ADR-0015](../../../brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md)
> (Epic Invariant: gates inspect evidence, never the producing tool),
> [ADR-0014](../../../brain/project/decisions/adr-0014-workflow-governance.md)
> (400-line budget + `governance.ignoreList`),
> [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md) (docs English).

## The architectural shape

One new module — `brain/scripts/vcs/ci-context.mjs` (built in A1, **not here**) — sits
between the CI environment and every governance gate. It answers two questions and
nothing else: *which provider am I running under*, and *what is the normalized context
of this pipeline run*. Gates stop reading `process.env.*` and stop shaping provider
payloads; they read one object.

```
CI env (GitHub Actions | GitLab CI | local)
        │
        ▼
  ci-context.mjs        detectCi() → provider
        │               loadContext() → { normalized fields }
        ▼
  pure evaluators  (evaluateActor, phase-order rule, adrPresence, diffSize, …)
        │           ← UNCHANGED: consume the normalized object only
        ▼
  thin wrappers (exit code, warn/fail) ← the only layer that gains the seam in A1
```

The seam is deliberately **thin and provider-agnostic at its output**: the normalized
context object has the same shape regardless of provider, so no evaluator can branch on
"which harness produced this". That property is the whole point (Decision 4).

## Decision 1 — `detectCi() -> 'github' | 'gitlab' | 'local' | 'unknown'`

Pure provider detection from environment markers, in **strict precedence order —
`github` → `gitlab` → `unknown` → `local`** (first match wins). `'unknown'` MUST be
evaluated **before** `'local'`: otherwise a generic `CI=true` run inside a git repo would
match `'local'` on the literal reading and skip the fail-closed handling `'unknown'` requires.

| Order | Result | Detection rule |
|-------|--------|----------------|
| 1 | `'github'` | `GITHUB_ACTIONS === 'true'` (already the marker used by `substrate.mjs` L58) |
| 2 | `'gitlab'` | `GITLAB_CI === 'true'` |
| 3 | `'unknown'` | `CI === 'true'` (the de-facto CI marker) but neither `GITHUB_ACTIONS` nor `GITLAB_CI` is set — a CI we cannot read |
| 4 | `'local'` | none of the above — no CI marker at all (not even `CI`), a git repo present (developer machine / hook) |

`'unknown'` is distinct from `'local'` on purpose: `'local'` means "no CI, degrade is
expected"; `'unknown'` means "some CI we cannot read", which a REQUIRED gate must treat
as uncomputable (fail-closed), not as a benign local run.

## Decision 2 — `loadContext()` contract

```js
loadContext() -> {
  provider,          // 'github' | 'gitlab' | 'local' | 'unknown'  (= detectCi())
  prNumber,          // number | null   — PR / MR IID
  baseSha,           // string | null   — merge base of the diff
  headSha,           // string | null   — tip being evaluated
  sourceBranch,      // string | null   — head/source ref
  targetBranch,      // string | null   — base/target ref
  labels,            // string[] | null — label names; [] = genuinely none, null = uncomputable (fetch failed)
  body,              // string | null   — description; '' = genuinely empty, null = uncomputable (fetch failed)
  author,            // string | null   — PR/MR author login/username
  isMergeRequest,    // boolean         — true when this run is a PR/MR (not a bare push)
}
```

Contract rules (specified precisely in `specs/ci-context/spec.md`):
- `labels` and `body` are **value-or-`null`**, like every other field: `[]` / `''` mean
  *genuinely* no labels / an empty description, while `null` means the value was
  **uncomputable** (the API fetch failed). This distinction is load-bearing — `labels` is
  consumed by `diff-size` (`size:exception`), `memory-gate` (`skip:memory-gate`) and
  `decision-gate` (`decision`), and `body` by `issue-link` (`Closes #N`) — **all REQUIRED
  gates** (ADR-0014). A `null` collapsed to `[]` / `''` would let a REQUIRED gate exit 0
  without evaluating (e.g. `decision-gate` seeing no `decision` label after a failed fetch =
  a silent fail-open, the exact outcome the ladder forbids), so REQUIRED consumers **fail
  closed** on `null` (Decision 5).
- **This is THE deliberate exception to "extract, don't rewrite" (Decision 3).** Today
  `prView()` returns `labels: [], body: ''` on *any* failure (github.mjs L128/L137) —
  conflating "no labels" with "couldn't fetch labels". The extraction was faithful to a
  **pre-existing latent bug**; the seam is where it is corrected, by distinguishing `null`
  (uncomputable) from `[]` / `''` (empty). No other field's behavior changes.
- Every other field is likewise the value **or `null`** when the provider cannot supply it;
  a `null` in a field a gate needs triggers that gate's per-class policy (Decision 5).
- `loadContext()` itself **never throws** — an internal failure yields a context with
  the affected fields `null`, and the gate decides fail-closed vs. warn. This mirrors the
  never-throw discipline every current wrapper already follows.
- **`author` is sourced from the provider's PR/MR API payload — `author.login` (GitHub) /
  `author.username` (GitLab) — never from an environment variable.** Pipeline env
  (`GITLAB_USER_LOGIN`, `CI_MERGE_REQUEST_ASSIGNEES`, or a workflow-set `PR_AUTHOR`)
  identifies the *pipeline trigger* or an *assignee*, not the MR *author*; on a re-run or a
  foreign push they diverge. Both providers already expose the author in a payload the seam
  reads anyway — GitHub via `gh pr view --json author` (add `author` to the existing
  `prView()` `--json` fields), GitLab via the same one MR API call that fetches `body` — so
  this adds **no** extra request.

## Decision 3 — GitHub source: EXTRACT, do not rewrite

The GitHub reading already exists and is battle-tested. A0 designs `ci-context.mjs` to
**move that logic behind the seam unchanged** in A1 — same env var names, same `gh`
invocations, same fallbacks. Verified sources:

| Normalized field | Current GitHub source (extract from) |
|------------------|--------------------------------------|
| `prNumber` | `process.env.PR_NUMBER` (`brain-writes-reviewed.mjs` L215) |
| `baseSha` | `process.env.BASE_SHA` (`brain-writes-reviewed.mjs` L213, `phase-order-check.mjs` L372, `run-check.mjs` L36) |
| `headSha` | `process.env.HEAD_SHA` (`brain-writes-reviewed.mjs` L214, `phase-order-check.mjs` L373, `run-check.mjs` L37) |
| `targetBranch` | `process.env.BASE_BRANCH` (`actor-check.mjs` L221) |
| `labels`, `body` | `prView({ number })` → `gh pr view <n> --json number,labels,body` (`providers/github.mjs` L126–139) |
| `body` (env fallback) | `process.env.PR_BODY` (`actor-check.mjs` L220) |
| `author` | **PR API payload** — `gh pr view <n> --json author` → `author.login` (add `author` to the existing `prView()` fields; **not** `process.env.PR_AUTHOR`, per Decision 2). Repo still via `GITHUB_REPOSITORY`. |
| `sourceBranch` | `GITHUB_HEAD_REF` — **net-new read** (only set on `pull_request` events; no existing gate reads it) |
| `isMergeRequest` | `GITHUB_EVENT_NAME === 'pull_request'` — **net-new** (equivalently, `PR_NUMBER` present) |
| `provider`/CI marker | `GITHUB_ACTIONS` (already read by `substrate.mjs` L58) |

Label *history* fetches (`gh api .../events` in `actor-check.mjs` L138; `gh api
.../reviews` in `brain-writes-reviewed.mjs` L139) are **gate-specific evidence, not
generic pipeline context** — they stay in their gates and are **out of scope for
`ci-context.mjs`**. The seam supplies the *static* context of the run (who/what/where);
per-gate evidence queries remain the gate's own concern. A0 draws that line explicitly so
A1 does not over-absorb.

> **Three fields are not pure `process.env` extractions.** `sourceBranch` and
> `isMergeRequest` have no existing GitHub reader — A1 adds them fresh from `GITHUB_HEAD_REF`
> and `GITHUB_EVENT_NAME` (standard GitHub Actions env vars set on `pull_request` events).
> `author` **changes source** (CP-A0 ruling 1): today `actor-check.mjs` reads
> `process.env.PR_AUTHOR`, but the seam sources it from the PR API payload (`author.login`)
> in both providers — env identifies the pipeline trigger, not the MR author. Every other
> field is a true extraction.

## Decision 4 — GitLab source (designed here, built in A1)

GitLab CI exposes the same facts under different names; the seam maps them:

| Normalized field | GitLab source |
|------------------|---------------|
| `prNumber` | `CI_MERGE_REQUEST_IID` |
| `baseSha` | `CI_MERGE_REQUEST_DIFF_BASE_SHA` |
| `headSha` | `CI_COMMIT_SHA` |
| `sourceBranch` | `CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` |
| `targetBranch` | `CI_MERGE_REQUEST_TARGET_BRANCH_NAME` |
| `labels` | **MR API payload** — `labels[]` from the same single call as `author` / `body` (live state). **Not** `CI_MERGE_REQUEST_LABELS` (frozen at pipeline creation — a `size:exception` added after a failure + re-run would be invisible, an override-flow asymmetry with GitHub). Fetch failure → `null`, no stale fallback. |
| `author` | **MR API payload** — `author.username` from the same `GET /projects/:id/merge_requests/:iid` call that fetches `body` (Decision 2). **Not** `CI_MERGE_REQUEST_ASSIGNEES` (assignee ≠ author) nor `GITLAB_USER_LOGIN` (pipeline trigger, not author). |
| `isMergeRequest` | `CI_MERGE_REQUEST_IID` present |
| `body` | **MR API payload** — from that same single call (with `author`, `labels`); MR description is not in env. Fetch failure → `null`. |

**MR API call (`body`, `author`, `labels`).** GitLab does not expose the MR description as
an env var, and its `CI_MERGE_REQUEST_LABELS` freezes at pipeline creation, so the seam makes
exactly **one** API call for all three live fields:
`glab api projects/:id/merge_requests/:iid` (or the equivalent raw REST
`GET /projects/:id/merge_requests/:iid`) authenticated with `VCS_TOKEN`.

- **Proxy:** read from the standard `HTTP_PROXY` / `HTTPS_PROXY` (and `NO_PROXY`)
  environment. **Never hard-code a proxy host** — the corporate proxy is an environment
  concern, and `fetch`/`glab` honor those vars natively.
- **Failure of this call yields `body: null`, `labels: null`, `author: null`** (never throws,
  never a stale fallback). `body` and `labels` are consumed by **REQUIRED** gates —
  `issue-link` parses `body`; `diff-size` / `memory-gate` / `decision-gate` read `labels`
  (ADR-0014) — so a failed fetch makes those gates **fail closed** ("cannot fetch labels /
  description"), never exit 0 (Decision 5). Resolving to `null` rather than `[]` / `''` is
  what prevents a fabricated-empty default from silently failing a REQUIRED gate open.

## Decision 5 — Fail-closed vs. degrade, BY GATE TYPE (the load-bearing policy)

The seam does not decide the outcome — it hands the gate a context in which some fields
may be `null` — but the **policy for what a gate does with a missing field is fixed by
the gate's class** (ADR-0015's two-list split). The live constant in `governance-checks.mjs`
L27 is:

```js
REQUIRED_JOBS  = ['issue-link', 'diff-size', 'local-checks', 'memory-gate', 'decision-gate'];
DETECTION_JOBS = ['phase-order', 'actor-check', 'brain-writes-reviewed'];
```

`local-checks` (the L1 job: `repo:check` + `brain:nav` + `npm test` in CI) is REQUIRED but is
**not a `ci-context` consumer** — it runs over the checked-out tree and needs no PR/MR
metadata (no base/head SHA, labels, body, or author). The REQUIRED gates that *do* consume
the normalized context are the four in the table below. **Drift note (for CP-A0):**
ADR-0015.md's own code block (L74) still lists the pre-`local-checks` four — the doc is stale
versus `governance-checks.mjs` L27. Flagged as a doc/code drift finding; not fixed in A0.

| Consumer class | On a needed field being `null` (uncomputable context) | Verified precedent |
|----------------|-------------------------------------------------------|--------------------|
| **REQUIRED** (`issue-link`, `diff-size`, `memory-gate`, `decision-gate`) | **FAIL CLOSED** — the gate fails, never exits 0 | `run-check.mjs` L74: `cannot compute diff — failing closed` |
| **DETECTION** (`phase-order`, `actor-check`, `brain-writes-reviewed`) | **DEGRADE to `warn` + a documented reason** — exit 0, but visibly | `phase-order-check.mjs` L382, `actor-check.mjs` L227, `brain-writes-reviewed.mjs` L226 |

**Never a silent `exit 0` in a REQUIRED gate.** That is the one outcome the whole ladder
exists to prevent — a required gate that passes without ever evaluating (ADR-0015's
"Never do" list, the `phase-order` promotion precondition). The seam's job is to make the
uncomputable state *explicit* (a `null`) so the gate can apply the right policy; it must
never paper over a missing variable with a fabricated default.

This split is exactly why `ci-context.mjs` returns `null` (not a throw, not a guess) for
absent fields: `null` is the neutral signal each gate class interprets under its own
policy. A0 does not add a new degrade mechanism — it routes the *existing* per-gate
behavior through one context source.

## The central invariant — pure evaluators do NOT change

This is the evidence the boundary is drawn correctly, and it is stated as a testable
requirement in the spec (REQ-CIC-4):

> Introducing `ci-context.mjs` MUST NOT change any pure governance **evaluator**. The
> evaluators (`evaluateActor`, the phase-order rule, `adrPresence`, `memoryPresence`,
> `diffSize`, `issueLink`) already take their inputs as **plain arguments**, not from the
> environment. `ci-context.mjs` changes only *how the thin wrapper gathers those
> arguments* — it centralizes the `process.env` / `gh` reads the wrappers do today. The
> evaluator signatures, bodies, and fixtures are untouched.

This ties directly to **ADR-0015's Epic Invariant**:

> "Every gate inspects **evidence**, never the **producing tool** — no gate branches on
> which harness, agent, or human authored a commit."

Because the normalized context object has **one shape across all providers**, no evaluator
can (or needs to) branch on provider. The seam *strengthens* the Epic Invariant: today a
gate could, in principle, read a GitHub-specific env var and drift toward tool-coupling;
after A1 the only provider-aware code is `ci-context.mjs` itself, and it normalizes
*away* the provider before any evaluator sees the data. The evaluators consuming an
identical object regardless of `github`/`gitlab`/`local` is the observable proof that the
boundary holds.

## Design questions investigated

**Where does the GitHub context logic live today?** Duplicated across five files —
`providers/github.mjs` `prView()` (L126–139, the only `gh pr view` reader), and direct
`process.env.*` reads in `actor-check.mjs` (L219–223), `brain-writes-reviewed.mjs`
(L213–216), `phase-order-check.mjs` (L372–373), and `governance/run-check.mjs` (L36–37).
Cited per field in Decision 3. This duplication is the concrete motivation for the seam.

**Is there a canonical DEFAULT `ignoreList` shipped to consumers that ALSO omits
`.memory/**`?** **No — the consumer-shipped default is complete.**
`brain/core/config-migrations.mjs` (L52–60) defines the migration default that ships to
every consumer, and it already includes `.memory/**`, `openspec/changes/**`,
`package-lock.json`, `pnpm-lock.yaml`, and `yarn.lock`. So the drift Deliverable 5 fixes
was **only** in brain's own hand-maintained `brain.config.json`, which had diverged
*downward* from its own migration default. The local fix is therefore **sufficient for
consumers** — no consumer-facing change is needed, and none is in A0's scope.

**Does ADR-0014's ignore list mention lock files, and does the config still omit them?**
Yes and yes — a **secondary drift, out of scope.** The canonical migration default (above)
lists the three lock-file globs, but brain's own `brain.config.json` after the Deliverable
5 edit still contains only `["**/*.test.mjs", ".memory/**", "openspec/changes/**"]` — it
omits `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` and adds a non-default
`**/*.test.mjs`. This is a real drift of brain's own config from its own migration
default, but A0's Deliverable 5 is scoped to adding `.memory/**` only. Flagged for a
follow-up; **not fixed here.**

## Open questions (updated with CP-A0 reviewer rulings)

- [x] **GitLab/GitHub `author` source — RESOLVED (ruling 1).** Neither env option is
  correct; `author` comes from the PR/MR **API payload** (`author.login` / `author.username`)
  in both providers, never from env. Folded into Decision 2, Decisions 3–4, and the spec
  (REQ-CIC-2 / REQ-CIC-5).
- [ ] **Drift-guard test for the seam — APPROVED for A1 (ruling 2).** A1 adds a test
  asserting no gate reads `process.env` pipeline context directly (all context flows through
  `ci-context.mjs`), keeping the seam from being bypassed.
- [ ] **brain.config.json reconciliation — SPLIT (ruling 3).**
  **(a)** Lockfile globs — alignment with the already-shipped `config-migrations.mjs`
  default (same nature as Deliverable 5): fold into A1, **no `decision` label**.
  **(b)** `**/*.test.mjs` — a **policy** decision, not the agent's to make: its own
  micro-slice with a `decision` label + an ADR-0014 amendment, on human approval. Recorded
  as an **intentional divergence** until then.
- [ ] **`baseSha` semantics parity — verify in A1 (Rev 2 ruling 4).** `baseSha` is "the commit
  the diff is computed against" (the merge base). A1 must verify against a real pipeline that
  GitHub's `BASE_SHA` and GitLab's `CI_MERGE_REQUEST_DIFF_BASE_SHA` satisfy that *same*
  semantics — `diff-size` is REQUIRED, so a per-provider divergence would give different
  budgets for the same change.
