# Design: memory-gate receives the PR context and reads the default branch (#1024)

## Technical Approach

The work is one PR with four parts:

1. **Wiring.** The `memory-gate` job gets `VCS_TOKEN`, `PR_NUMBER` and `PR_BODY`, in the same form as `issue-link` (`governance.yml:61-71`).
2. **Default-branch read.** A new port-free module, `brain/scripts/governance/default-branch-records.mjs`, fetches `origin/<default>` and reads `.memory/records/*.jsonl` through git plumbing, without a checkout. `runMemoryGateCheck` merges those records with the PR tree only when the PR tree alone is not a clean hit.
3. **Override.** A new pure module, `brain/scripts/governance/memory-gate-override.mjs`, decides whether `skip:memory-gate` is honored. `run-check.mjs` and `brain-metrics.mjs` share it, so the rule has one implementation.
4. **Output.** The result carries a `path` and a `pathDetail`. `main` prints both on every run.

The evaluators `memoryPresence` and `memoryRetrieval` do not change.

**Correction to the proposal: `ci-context.mjs` needs no change.** `loadGithubContext` already copies `pr.labels` into `ctx.labels` (`ci-context.mjs:65-73`). GitHub `prView` already returns label names (`providers/github.mjs:408,419`). `defaultFetchMr` already returns `labels` (`ci-context.mjs:152,165`). In every case `null` means uncomputable and `[]` means genuinely empty (`ci-context.mjs:196-200`).

## Architecture Decisions

| # | Decision | Rejected | Rationale |
|---|---|---|---|
| D1 | **The reader runs a targeted fetch:** `git fetch --no-tags --depth=1 origin +refs/heads/<b>:refs/remotes/origin/<b>` | `fetch-depth: 0` on the job | The fetch works on GitHub's depth-1 checkout and on GitLab's `GIT_DEPTH` clone without editing any YAML. It moves one commit, not the whole history. There is a further reason: on `pull_request`, checkout uses the merge ref frozen at event time, so `GITHUB_SHA` does not move on a re-run. Only a live fetch lets the proposal's "manual re-run heals the PR" actually work. `fetch-depth: 0` would also bring in the frozen `origin/<b>`, but only on the next event. |
| D2 | **Plumbing without a checkout.** One `git ls-tree -r -z --name-only refs/remotes/origin/<b> -- .memory/records/` lists the files. One `git cat-file --batch` reads them, with stdin lines of the form `refs/remotes/origin/<b>:<path>`. | `git show` per file; `git archive` piped to `tar` | This repo holds hundreds of per-record files (`.memory/records/2026-07-rec-*.jsonl`), so spawning one process per file is not acceptable. `tar` is not guaranteed on every runner image. The batch output is parsed by byte size. |
| D3 | **Lazy union.** The PR tree is read first. If the result is a clean HIT (a scoped `session_summary`), the fetch never runs. Otherwise the reader fetches, and the check evaluates `unionRecordsById(prTree, defaultBranch)`. | Always fetch | Most runs make no network call. A fetch failure can matter only when the PR tree alone does not suffice. |
| D4 | **Dedupe by `id`, first wins, PR tree first.** Records without an `id` pass through. Corrupt lines are skipped. | Refactor `store.mjs#readRecords` into a shared parser | These are the rules in `store.mjs:339-343` and `:374-383`. `store.mjs` is the memory core and stays untouched. A parity test pins the copy against `readRecords` on the same fixture. |
| D5 | **Degradation fails closed on a miss.** If the default branch is unreadable and the PR tree hits, the gate passes. If the PR tree misses, the result is `uncomputable:true`, which exits 2 at **every** tier. | Soften to a warning at `lite` | `mapDetectionToWarning` never downgrades an uncomputable result (`detection-policy.mjs:50`). That is ratified policy, so it is not bypassed here. |
| D6 | **The PR description is uncomputable (Q1).** The condition is `ctx.prNumber != null` and `ctx.body` is not a string. At `standard`/`regulated` the result is `uncomputable`, exit 2. At `lite` the check degrades to `path=presence (PR description uncomputable)`. | Degrade to presence at every tier | `issue-link` already fails closed on a null body (`run-check.mjs:324-330`). A required tier's evidence (`issue-linked-*`, `governance-tiers.mjs:175-176`) cannot be approximated by presence. At `lite` the evidence form is `coverage-report`, which presence does approximate. `prNumber == null` (no PR context) keeps today's presence fallback, and the output names it. |
| D7 | **Override authorization (Q3).** See the next section. | — | — |
| D8 | **`regulated` PARTIAL coverage (Q2) is out of scope and made visible.** At `regulated`, a PARTIAL pass appends: `evidence gap: the "regulated" tier declares issue-linked-session-summary; partial coverage passes until that is enforced`. | Enforce it now | Enforcing it would change the evaluator. The proposal lists this as out of scope. |
| D9 | **`memory-gate` now reaches the port.** `SUBCOMMAND_PORT_REACH['memory-gate']` becomes `true`. The `getVcs` call lives in a named function declaration, `defaultFetchPrLabelEvents`, that the handler calls. | Keep it `false` | The applier can only be read through `labelEvents`. The T7b static analysis (`run-check.test.mjs:694-828`) resolves handlers by declared name. Those mutation tests are retargeted from `memory-gate` to `decision-gate`, which is still `false`. |

### D7: Who may apply `skip:memory-gate`

| Option | Trade-off |
|---|---|
| A: anyone who can label (GitHub triage and above) | The PR author can waive their own PR. That is the hole `actor-check` closes at `standard` (`actor-check.mjs:606-613`). |
| B: a named list (`governance.approvalActors` or a new key) | This needs config before the override works. `approvalActors` already means both "bot allowlist" and "honored `override:*` labels" (`actor-check.mjs:1196-1198`), and a third meaning would conflate it further. |
| **C: the applier differs from the PR author, is not in `reviewActors` or `agentActors`, and the tier honors the label** | **Chosen.** It mirrors `actor-check`'s distinct-actor rule and its deny set (`:593-601`). It needs no new config. |

- **Where the applier comes from.** The latest `add` event for `skip:memory-gate` returned by `labelEvents`.
  - GitHub: `repos/{o}/{r}/issues/{n}/events`. This is valid for a PR number, and `brain-metrics.mjs:494-516` already relies on it. It needs `issues: read`.
  - GitLab: today `labelEvents` is issues-only (`gitlab.mjs:409`, `:766`). The smallest port change is an optional `kind: 'issue'|'mr'` parameter, defaulting to `'issue'`. For `'mr'` the path becomes `merge_requests/:iid/resource_label_events`. This also fixes `brain-metrics.mjs:511`, which today reads issue events for an MR number on GitLab.
- **Whether the label is present** comes from `ctx.labels`, the fresh API labels. The events only identify who applied it.
- **The tier** comes from `tierParams(tier).honorSkipMemoryGate` (`governance-tiers.mjs:295,309,321`), which is `false`, `true` and `false` for `lite`, `standard` and `regulated`.
- **Degradation.** Each case below leaves the label unhonored, and evaluation runs:

| Case | Outcome |
|---|---|
| `ctx.labels === null` | Never read as "skip" and never as "no label". If evaluation then fails, the reason adds `labels uncomputable — a skip:memory-gate override could not be checked`. |
| Events `null` while the label is present | Evaluation runs. If it fails, the result is `uncomputable` with `skip:memory-gate present but its applier could not be read — not honored`. |
| The applier is the author or deny-listed | Evaluation runs. If it fails, the reason names the refusal. |

**Resolved by the maintainer on 2026-09-18: follow `TIER_PARAMS`.** The first draft of the proposal said the override short-circuits "at every tier"; the proposal and REQ-L3-5 now follow the table below. The ratified `TIER_PARAMS` honors it at `standard` only. It refuses the label at `regulated`, just as `regulated` refuses `size:exception` and `override:*`. At `lite` the flag is `false` with the comment "nothing to skip". This design follows `TIER_PARAMS`:

- At `regulated`, the refusal is stated in the style of REQ-TIER-6 (`run-check.mjs:461-467`).
- At `lite`, the label is noted in the output and not consulted.

Following the proposal instead would be a doctrine change to `TIER_PARAMS`. Success criterion 7 should read "passes at `standard`".

## Data Flow

```
loadContext ── prNumber, body, labels, defaultBranch
   │
runMemoryGateCheck(ctx, deps)
   ├─ override? (labels + labelEvents(kind) + tier + deny lists) ── honored ─→ path=skipped
   ├─ prNumber && body uncomputable ── standard/regulated ─→ uncomputable (exit 2)
   │                                  └─ lite ─→ path=presence
   ├─ no issue in body ─→ path=presence (PR tree)
   └─ issue #N ─→ PR tree HIT? ─yes─→ path=retrieval
                    └─no─→ fetch origin/<b> → ls-tree → cat-file → union → memoryRetrieval
                             └─ unreadable: HIT on PR tree already handled; miss ─→ uncomputable
main: prints "memory-gate: path=<p> (<detail>)", then the tier-policied reason
```

## Output contract (stdout, one path line on every run)

| Situation | Path line | Verdict line |
|---|---|---|
| No PR context | `memory-gate: path=presence (no PR context — PR_NUMBER not provided)` | Pass: none. Fail: the evaluator's reason. |
| No issue reference | `memory-gate: path=presence (no issue reference in the PR description)` | Same as above |
| Description uncomputable, `lite` | `memory-gate: path=presence (PR description uncomputable)` | Same as above |
| Description uncomputable, required tier | `memory-gate: path=uncomputable (PR description uncomputable)` | `memory-gate: PR description uncomputable (context API fetch failed) — cannot scope to an issue; failing closed at the "<tier>" tier` |
| Retrieval | `memory-gate: path=retrieval #N (records: pr-tree)` or `(records: pr-tree+origin/<b>)` | The evaluator's reason. At `lite` a miss becomes `::warning::…` through `mapDetectionToWarning`. |
| Default branch unreadable | `memory-gate: path=retrieval #N (records: pr-tree only — default branch unreadable: <cause>)` | On a miss: `memory-gate: no record scoped to #N on the PR tree and origin/<b> is unreadable (<cause>) — failing closed` |
| Honored | `memory-gate: path=skipped (skip:memory-gate applied by @<login>, not the PR author, honored at the "standard" tier)` | `::notice::memory-gate: skipped by override (@<login>)` |

Causes, verbatim: `DEFAULT_BRANCH not mapped`, `git fetch origin <b> failed: <first stderr line>`, `git ls-tree failed: …`, `git cat-file failed: …`. An absent `.memory/records/` on the default branch is readable and empty, not a failure.

## File Changes

| File | Change | Governed lines (est.) |
|---|---|---|
| `.github/workflows/governance.yml` | Add three env keys to `memory-gate` and a comment | ~12 |
| `brain/scripts/governance/default-branch-records.mjs` | New: `readDefaultBranchRecords`, `unionRecordsById` | ~95 |
| `brain/scripts/governance/memory-gate-override.mjs` | New, pure: `decideMemoryGateOverride` | ~45 |
| `brain/scripts/governance/run-check.mjs` | Handler, path fields, `main` path line, manifest, header | ~80 |
| `brain/scripts/vcs/providers/gitlab.mjs`, `github.mjs` | `labelEvents` `kind` param (github: documentation only) | ~10 |
| `brain/scripts/brain-metrics.mjs`, `lib/metrics-aggregate.mjs`, `lib/merge-walk.mjs` (`fetchPrMeta` returns `prAuthor`) | Honored count and by-author rows | ~35 |
| `brain/scripts/vcs/contributor-scaffold.mjs` (`:110-113`, `:130`, `:277-280`) | Update, then regenerate `.github/PULL_REQUEST_TEMPLATE.md` and `.gitlab/merge_request_templates/Default.md` | ~16 |
| `memory-presence.mjs` header (`:29-34`), `governance-tiers.mjs:306-308` comment | Update stale text | ~8 |
| `CHANGELOG.md` | An Unreleased entry naming the env block and the override rule | ~12 |
| Tests and `brain-drafts/**` | Create or modify | not governed |

**Metrics (item 7).** The `skip:memory-gate` column becomes `raw/honored`. "Honored" means `decideMemoryGateOverride` returned `honored` for that merge, using the PR's label events (from the existing `bypassAuthorCache`), `prAuthor` and the current tier. The label is also added to the by-author table. `memory-gate` is not in `PER_PERIOD_GATES`, so there is no enforced failure count to subtract from. The caveat at `brain-metrics.mjs:319-322` is rewritten.

**Permissions (item 8).** The workflow-level grant is `contents: read`, `pull-requests: read` and `issues: read` (`governance.yml:18-21`). That covers `prView`, `labelEvents` and the git fetch. The persisted checkout credential authenticates the fetch. A fork PR receives a read-only token with the same scopes, which is enough, because every call here is a read. No `pull_request_target`.

## Testing Strategy (STRICT TDD: every row is written RED first)

| RED test | What it proves |
|---|---|
| `ci-context-drift-guard.test.mjs` `#1024: the memory-gate job supplies every input the scoped check consumes` | Checks `VCS_TOKEN`, `PR_NUMBER`, `PR_BODY` and `DEFAULT_BRANCH` in the style of `:477-494`. Fails on `02896d69`. |
| `default-branch-records.test.mjs` (new, injected git runner) | The exact fetch, ls-tree and cat-file argv; batch parsing of several blobs, including one with embedded newlines and a `missing` line; each cause string; empty listing gives `[]`; corrupt line skipped; `unionRecordsById` gives PR-first-wins, a shared `id` counted once and id-less records kept; a parity case against `store.mjs#readRecords`. |
| `default-branch-records.integration.test.mjs` (new, real git in `t.tmpdir`) | This is the empirical proof. Build a bare origin whose `main` has a record, then `git clone --depth 1 --branch feature file://<origin>` (the `file://` form is required, otherwise `--depth` is ignored). The reader finds the record. A second case, where the branch is absent on the origin, returns the fetch cause. |
| `memory-gate-override.test.mjs` (new) | Honored at `standard` with a distinct applier. Refused for the author, a `reviewActors` login and an `agentActors` login. The latest `add` event wins. `events === null` means not honored. `labels === null` never skips. Not consulted at `lite`. Refused at `regulated` with the reason text. |
| `run-check.test.mjs` (T2.1 block, around line 1760) | A record only on the default branch passes. A record in both trees yields a PARTIAL count of 1. A PR-tree HIT means the injected default-branch reader is never called. Unreadable plus a miss exits 2 at `standard` **and** at `lite`. Body uncomputable exits 2 at `standard`, and at `lite` gives `path=presence`. The `regulated` PARTIAL suffix. The manifest is `true`. T7b mutations are retargeted. `:175` now expects the path line. |
| `providers/gitlab.test.mjs` | `labelEvents({kind:'mr'})` requests `merge_requests/…/resource_label_events`. The default is unchanged. |
| `metrics-aggregate.test.mjs`, `brain-metrics.test.mjs` | Raw/honored counting and by-author rows. |
| `contributor-scaffold.test.mjs` | The template no longer says "no gate reads it". The emitted templates match. |

**Empirical fetch check (item 1): not run in this phase.** This executor had no shell. The integration test above is the check, and apply runs it first. The manual equivalent, in the scratchpad: `git clone --depth 1 --branch <feature> file:///home/gandalf/IA/brain-issue-1024 c && cd c && git fetch --no-tags --depth=1 origin +refs/heads/main:refs/remotes/origin/main && git ls-tree -r -z --name-only refs/remotes/origin/main -- .memory/records/ | head -c 200`.

## Doctrine drafts (Tier 2)

The draft is `brain-drafts/workflow-governance-memory-gate.draft.md`, a `brain-amendment/1` contract with `target: brain/core/methodology/workflow-governance.md` and `issue: 1024`. It is a non-ADR target, so the only keys are `target` and `issue`, plus ordered `amend-find`/`amend-replace` pairs. Acts that quote backticked code use `~~~` fences.

| Passage | Change |
|---|---|
| `:23` Invariant 3 row | Tier-dependent evidence. Skip label: `skip:memory-gate`, honored at `standard` only, by a non-author. |
| `:42-49` "repo-scoped and permanently satisfied" and "Nothing enforces per-change capture" | Becomes: repo-scoped only when no issue is detectable; otherwise issue-scoped over the PR tree plus the default branch. |
| `:55-57` "does not exist in code" | Replaced by the D7 rule. |
| `:59-62` the #529 paragraph | Add "step 2 done (#1024); recency remains". |
| `:236`, `:262-267` metrics rows | Raw/honored. |

`brain-drafts/README.md` notes that `AGENTS.md` must be regenerated after promotion. It also notes that ADR-0014 `:66` and `evidence-reader-empty-on-failure.md:14` are historical, so no edit.

## Review Workload Forecast

`brain.config.json:23-34` excludes tests, `openspec/changes/**`, `AGENTS.md` and `.memory/**`.

- Governed lines: about 310, against the `lite` budget of 1000 and the default of 400.
- Decision needed before apply: No (the D7 tier-honor conflict was resolved on 2026-09-18: follow TIER_PARAMS)
- Chained PRs recommended: No
- 400-line budget risk: Low

## Migration / Rollout

There is no data migration. The CHANGELOG is the rollout: it tells consumers with a diverged `governance.yml` which block to copy. Rollback is a revert.

## Open Questions

- [x] **Blocking tasks:** D7's tier scope for the override — resolved 2026-09-18: follow `TIER_PARAMS`.
- [ ] Should a consumer that already runs `fetch-depth: 0` receive `--depth=1`? It adds a shallow boundary only for new commits. The job runs nothing after it, so the risk is accepted.
