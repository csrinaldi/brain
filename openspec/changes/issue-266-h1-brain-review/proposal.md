---
status: draft
issue: 266
slice: H1
---

# Proposal — `brain:review`, the human-invoked cold reviewer (issue 266, phase H1)

## What

Track H (#266) converts the human-mediated external reviewer into an invocable **cold agent**.
Phase **H0** landed the ADR-level foundation — the reviewer protocol promoted to doctrine
(`brain/core/methodology/reviewer-protocol.md`) and the four COMMENT-only VCS port verbs on both
providers (ADR-0020, merged to the `issue-266` tracker via PR #269/#271/#272).

Phase **H1** builds the runner. `brain:review` mechanizes the external-reviewer **circuit** a
human has been running by hand — verify against the server, rule design forks against doctrine,
sequence parallel work — and stops exactly where doctrine says it must: **the human approves and
merges; the command never does** (`reviewer-protocol.md:14-17`, §12). The command produces a
`brain-review/1` verdict; the human keystroke (`status:approved`, `size:exception`, `override:*`)
stays human, structurally out of the command's reach (§2, §9).

This change dir covers **all of H1**. H1 is delivered in **5 slices** (§Delivery plan below);
this first PR is **H1-1**. Every slice is planned here so the whole of H1 is visible in one plan;
H1-2..H1-5 tasks are carried as explicit `(deferred)` groups in `tasks.md`.

The command surface:

```
npm run brain:review -- --pr <N> [--mode auto|tranche|checkpoint|ruling] [--dry-run]
npm run brain:review:queue     # the label is the mailbox: needs-review / needs-ruling, oldest first
npm run brain:review:board     # rebuild seq:* / reviewed:* labels from the verdict comments
```

**Mode is derived from repo state, never declared by the implementer** (`reviewer-protocol.md`
via issue #266 §H1): `needs-ruling` label → **ruling**; the diff touches
`openspec/changes/*/checkpoint-report.md` → **checkpoint**; else → **tranche**. `--mode` may pin a
mode for a manual run, but `auto` (the default) derives it from the tree.

## Why

The external reviewer is real and load-bearing today, but **human-mediated**: a human relays a
`checkpoint-report.md` to the reviewer and relays the verdict back
(`docs/inbox/PLAN-adapters-v3.md`). That serializes every checkpoint on a human turn. The role is
mechanizable; the judgment that must stay human is narrower than the whole role — it is the
*keystroke* that authorizes a merge (`reviewer-protocol.md:12-17`).

H0 made the sacred asymmetry **structural, not remembered**: three independent locks (§2) and the
two-key split (§3) mean even a fully-compromised reviewer process has no code path to an APPROVE
review or to `status:approved`. H1 is therefore free to build the runner *without* re-litigating
merge safety — the runner posts through `prReviewComment` (`event: 'COMMENT'` hardcoded, ADR-0020)
and carries a hardcoded deny-set for labels. The runner cannot bend a gate open; it can only
verify, rule, and sequence.

Part of #266.

## Scope

### The command and its modes

- **`brain:review --pr <N>`** — one cold review pass. Resolves the mode from repo state, boots a
  cold detached worktree at the API's `headRefOid` (§8), evaluates, emits a `brain-review/1`
  verdict, and posts it (unless `--dry-run`).
- **Tranche** (per push) — required gates green from the server's `statusCheckRollup`; the three
  detection jobs' `warn` levels quoted verbatim; budget re-derived (`diff-size-count.mjs`), never
  read from a report; Tier-2 frontier untouched by an agent author; Tier-3 hygiene.
- **Checkpoint** — the tranche checks, plus report-vs-tree drift, artifact completeness per
  `sdd-layout`, prior pins applied and cited `file:line`, TDD-RED by reversion, and
  `brain:audit` / `brain:governance-status` output quoted.
- **Ruling** — entry requires a `## FORK` section with ≥2 options each with cost and consequence;
  a fork without options is REVISE, not a ruling; output carries a `pin:` payload.

### Queue and board

- **`brain:review:queue`** — the label is the mailbox. Lists open PRs carrying `needs-review` /
  `needs-ruling`, **oldest first**.
- **`brain:review:board`** — rebuilds the `seq:*` / `reviewed:*` labels **from the verdict
  comments** (verdicts are truth, labels are the derived index — §9). The deny-set (§9) is
  hardcoded in the caller: the board never applies `status:*` / `size:exception` / `skip:*` /
  `override:*`.

### Identity and secret distribution (H1 scope addition — issue #266 comment 4992662021)

- Config gains `reviewer: { handle, tokenEnv: "BRAIN_REVIEWER_TOKEN" }` — **the name is
  committable, the value never**. Git carries the pointer, not the secret.
- The token value comes from each runtime's native mechanism: local invocation (H1) → env var /
  gitignored `.env`; CI (H2, future) → platform secrets.
- **Fail-closed with instructions** (env-limits doctrine): if the env var is absent, `brain:review`
  **refuses to run** and prints the missing variable name, the provider `patSetupUrl` link, and
  where the setup doc says to obtain it. Never silent degradation.
- A **committed setup doc** tells teammates *what* without the value: which env var, where the team
  stores it, who grants access. The goal is not everyone having the token — it is almost no one
  needing it.
- `governance.reviewActors` **ships absent** until a dedicated reviewer account exists; the lock-3
  tests keep running on **fixture identities**. Account creation is a pending human keystroke,
  decoupled from H1 implementation (`reviewer-protocol.md` §11).

## Delivery plan — 5 slices (verbatim from issue #266 comment 4992769106)

The full tranche core is ~580 production lines, so it splits. Estimates are pre-code and are
re-forecast precisely per slice at task time. Each slice ≤400 **counted** lines (`*.test.mjs` is
budget-free, `governance.ignoreList`); PRs target the `issue-266` tracker; strict TDD.

| Slice | Contents | Est. counted | 400-risk |
|---|---|---|---|
| **H1-1 · infra + identity** | fail-closed identity gate + config `reviewer:{handle,tokenEnv}` + setup doc; cold-boot (§8: resolve `headRefOid` via API, detached clone/worktree, load doctrine from `.memory/records` type decision\|architecture + prior `brain-review/1` blocks); `brain-review/1` emission enforcing the three §6 hard rules; `--dry-run` prints, posts nothing | ~350 | med |
| **H1-2 · tranche + post** | mode derivation (needs-ruling→ruling / checkpoint-report.md→checkpoint / else→tranche); tranche eval (required gates from the server rollup, detection warns verbatim, budget re-derived via diff-size-count, Tier-2 frontier, Tier-3 hygiene); post via `prReviewComment`/`issueComment` + anti-stale + anti-loop | ~320 | med |
| **H1-3 · checkpoint** | report-vs-tree drift + sdd-layout artifacts + prior pins cited file:line + TDD-RED by reversion + brain:audit/governance-status cited | ~280 | med-high |
| **H1-4 · ruling** | entry requires `## FORK` with ≥2 options+costs (else REVISE); output carries a `pin:` payload | ~150 | low |
| **H1-5 · queue + board** | `brain:review:queue` (needs-review/needs-ruling, oldest first); `brain:review:board` (rebuild seq:*/reviewed:* from verdict blocks); deny-set §9 hardcoded in the caller (status:*/size:exception/skip:*/override:*) with a test | ~230 | med |

**Divergence from the originally-suggested cut, recorded for the reviewer.** Identity is placed in
slice 1, not with queue+board — cold-boot needs the token to reach the server (resolve
`headRefOid`, clone), so the fail-closed gate is the command entry precondition and belongs beside
the cold-boot that uses it. If the owner prefers identity with queue+board (core on DI/fixtures
until then), it moves.

## Does not include (H1)

- **No APPROVE capability, ever** — the runner posts only through `prReviewComment`
  (`event: 'COMMENT'`, ADR-0020); there is no verb, flag, or path that emits an APPROVE review.
- **No loosening or unlocking labels** — the caller's deny-set is hardcoded; `status:*`,
  `size:exception`, `skip:*`, `override:*` stay human-only (§9). The reviewer never applies them.
- **No reviewer bot account** — `governance.reviewActors` ships absent; tests use fixture
  identities; account creation is a decoupled human keystroke (§11).

## H2 deferral — no watchers, crons, or hooks

H1 ships **human-invoked only**. GitHub Actions hosting — a `pull_request` workflow on
`opened`/`synchronize`/`labeled`, minimum permissions, and a per-PR `concurrency` mutex — is
**H2, deferred to evidence**, and is a **separate human-opened track**. Hosting the reviewer in CI
needs a model key in CI and an agent identity with `pull-requests: write` — a new attack surface
that must be **earned, not assumed**, on the same detection→prevention ladder ADR-0015 applies to
gates (`reviewer-protocol.md` §10 collision row; issue #266 §H2). Nothing in H1 auto-triggers a
review; every run is a human keystroke.

## Acceptance (H1, from issue #266)

- [ ] `brain:review` produces a `brain-review/1` verdict for a real PR from a cold worktree
      detached at `headRefOid`; `--dry-run` posts nothing.
- [ ] A verdict whose `head_sha` no longer matches the PR head is **not posted** (anti-stale).
- [ ] TDD-RED reversion catches a deliberately vacuous test in a fixture (H1-3).
- [ ] The command refuses to run with a clear instruction when `BRAIN_REVIEWER_TOKEN` is absent
      (fail-closed identity).
- [ ] The reviewer never applies `status:approved` / `size:exception` / `skip:*` / `override:*`;
      the deny-set refuses them before any `labelAdd` (H1-5), fixture-identity tests.
- [ ] Each slice ≤400 counted lines; no `size:exception`.
