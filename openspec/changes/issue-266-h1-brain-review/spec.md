---
status: draft
issue: 266
slice: H1
---

# Spec — `brain:review`, the human-invoked cold reviewer (issue 266, phase H1)

Delta requirements introduced by #266 phase H1. **The promoted protocol
`brain/core/methodology/reviewer-protocol.md` is the authoritative spec** — each numbered section
(§1–§12) is a requirement. Every `REQ-H1-*` below maps to the protocol section it implements; if a
requirement here contradicts the protocol, the requirement is wrong. Each REQ is tagged with the
**slice** that lands it (`[H1-1]` … `[H1-5]`); the acceptance surface for all of H1 is fixed here
before code lands, even though only H1-1 is implemented in the first PR.

Tests follow the project's `node:test` + `assert/strict` dependency-injection house style over
injectable seams (no network, no real repo mutation, no real worktree clone). `governance.reviewActors`
ships **absent**; all identity tests use **fixture identities** (`reviewer-protocol.md` §11).

Vocabulary:

- **verdict** — a `brain-review/1` fenced-YAML block posted in a review body (protocol §6).
- **cold worktree** — the reviewer's own clone/worktree, detached at the API's `headRefOid` (§8).
- **head_sha** — the `headRefOid` the reviewer read; the staleness anchor (§6, §8).
- **the caller** — `brain:review`, the runner that owns the hardcoded deny-set (§9).

---

## REQ-H1-1 [H1-1]: Fail-closed reviewer identity gate (protocol §11; comment 4992662021)

`brain:review` MUST read the reviewer identity from config `reviewer: { handle, tokenEnv }` and
resolve the token from `env[tokenEnv]` (default env name `BRAIN_REVIEWER_TOKEN`). The token value
is **never** in git — only the pointer (`tokenEnv` name) is committable. If `env[tokenEnv]` is
absent or empty, the command MUST **refuse to run** and print: the missing variable name, the
provider `patSetupUrl` for the active provider, and where the setup doc says to obtain the token.
No silent degradation, no partial run (env-limits doctrine; mirrors `run-check.mjs` fail-closed).

#### Scenario: absent token fails closed with instructions
- **GIVEN** `reviewer.tokenEnv` is `BRAIN_REVIEWER_TOKEN` and that env var is absent
- **WHEN** `brain:review --pr 42` is invoked
- **THEN** the command exits non-zero without contacting the server
- **AND** its output names `BRAIN_REVIEWER_TOKEN`, prints the provider `patSetupUrl`, and points to the setup doc

#### Scenario: present token proceeds to boot
- **GIVEN** `env.BRAIN_REVIEWER_TOKEN` holds a non-empty value
- **WHEN** the identity gate runs
- **THEN** it returns the resolved `{ handle, token }` and the command proceeds to cold boot

---

## REQ-H1-2 [H1-1]: Cold boot — detached at the API `headRefOid`, doctrine from durable sources (protocol §8)

The reviewer MUST run in its **own** clone/worktree, checked out **detached at the `headRefOid`
returned by the API** — never a branch name, never a sha quoted in a report. Doctrine MUST load
from exactly two durable, server-side sources: (1) `.memory/records/*.jsonl` filtered to
`type: decision | architecture` (via `readRecordObservations`); (2) every prior `brain-review/1`
block on the thread (parsed from `prReviews`). `resume.md` hydration and branch-name anchoring
(`git pull origin feat/...`) MUST NOT be reachable inputs — the boot code never reads them.

#### Scenario: the anchor is the API headRefOid, detached
- **GIVEN** the API returns `headRefOid: <sha>` for PR N
- **WHEN** the reviewer boots its worktree
- **THEN** it checks out **detached** at `<sha>`, not at the branch ref
- **AND** `head_sha` for the run equals `<sha>`

#### Scenario: doctrine is only records + prior verdicts
- **GIVEN** the repo contains a `resume.md` and `.memory/records/` with `type: decision` and `type: note` records
- **WHEN** cold boot loads doctrine
- **THEN** it includes the `type: decision | architecture` records and the prior `brain-review/1` blocks
- **AND** it never reads `resume.md` and never resolves a branch name to fetch head

---

## REQ-H1-3 [H1-1]: Self-review abstention (protocol §10, Self-review row)

A reviewer whose resolved `handle` equals the PR **author** (from `prView`) MUST **abstain** — the
same rule `actor-check` enforces at L5. It emits no verdict and posts nothing.

#### Scenario: reviewer equals author → abstain
- **GIVEN** `reviewer.handle` equals the PR author login
- **WHEN** `brain:review` boots
- **THEN** it abstains, emits no verdict, and posts nothing

---

## REQ-H1-4 [H1-1]: The `brain-review/1` schema enforces the three hard rules (protocol §6)

The verdict emitter MUST build a fenced-YAML `protocol: brain-review/1` block and enforce, at
build time, the three hard rules — a verdict that violates any of them is **not emittable**:

1. **`evidence:` is mandatory on every finding.** A finding without a command the reviewer ran
   cold is **inadmissible** — dropped from `findings[]`, never emitted.
2. **`cites:` is mandatory for `severity: blocker`.** An uncited blocker is **downgraded to
   `correction`** (asserting doctrine forbids something without the citation is inventing doctrine,
   which §5 forbids).
3. **`head_sha` is mandatory.** The emitter refuses to produce a block without it; it binds the
   verdict to the exact tree read and expires with it.

#### Scenario: evidence-less finding is inadmissible
- **GIVEN** a finding with no `evidence:`
- **WHEN** the verdict is built
- **THEN** the finding is excluded from `findings[]` and does not appear in the emitted block

#### Scenario: uncited blocker downgrades to correction
- **GIVEN** a finding `severity: blocker` with no `cites:`
- **WHEN** the verdict is built
- **THEN** the finding is emitted with `severity: correction`, never `blocker`

#### Scenario: missing head_sha is not emittable
- **GIVEN** a verdict assembled without `head_sha`
- **WHEN** the emitter runs
- **THEN** it refuses to produce a block (error), never a headless verdict

---

## REQ-H1-5 [H1-1]: `--dry-run` posts nothing (issue #266 acceptance)

With `--dry-run`, `brain:review` MUST compute and **print** the verdict to stdout and MUST make
**zero** write calls to the provider — no `prReviewComment`, `issueComment`, `labelAdd`, or
`labelRemove`.

#### Scenario: dry-run prints but never posts
- **GIVEN** `--dry-run` is passed
- **WHEN** the command completes with a computed verdict
- **THEN** the verdict is written to stdout
- **AND** no provider write verb is invoked (asserted on an injected spy VCS)

---

## REQ-H1-6 [H1-1]: Bounded revision — `rev >= 3` forces STOP (protocol §7)

The emitter MUST derive `rev` from the count of prior `brain-review/1` blocks on the thread (loaded
at cold boot, REQ-H1-2). At `rev >= 3` the reviewer MUST NOT emit a fourth `REVISE`; it MUST emit
`verdict: STOP` with `escalate: human`.

#### Scenario: the fourth REVISE is impossible
- **GIVEN** the thread already holds three prior `brain-review/1` blocks (`rev` would be 3)
- **WHEN** the evaluator's conclusion would otherwise be REVISE
- **THEN** the emitted verdict is `STOP` with `escalate: human`

---

## REQ-H1-7 [H1-2]: Mode is derived from repo state, never declared (issue #266 §H1)

`brain:review` in `--mode auto` (the default) MUST derive the mode from the tree: the PR carries
`needs-ruling` → **ruling**; the diff touches `openspec/changes/*/checkpoint-report.md` →
**checkpoint**; otherwise → **tranche**. An explicit `--mode <m>` pins the mode for a manual run;
the implementer never declares the mode by any in-tree marker other than the two derivation inputs
above.

#### Scenario: needs-ruling wins
- **GIVEN** the PR carries the `needs-ruling` label
- **WHEN** the mode is derived in `auto`
- **THEN** the mode is `ruling`

#### Scenario: checkpoint-report drift wins over tranche
- **GIVEN** the PR has no `needs-ruling` and its diff touches `openspec/changes/x/checkpoint-report.md`
- **WHEN** the mode is derived
- **THEN** the mode is `checkpoint`

#### Scenario: default is tranche
- **GIVEN** neither derivation input matches
- **WHEN** the mode is derived
- **THEN** the mode is `tranche`

---

## REQ-H1-8 [H1-2]: Tranche evaluation contract (protocol §6, §8; issue #266 §H1 Express)

The tranche evaluator MUST, per push: read required gates from the server's `statusCheckRollup`
and re-derive them cold (`REQUIRED_JOBS`, `governance-checks.mjs:24`); quote the three detection
jobs' `warn` levels **verbatim** (an unquoted warn is a review defect); **re-derive the budget**
(`git diff --numstat base...head | diff-size-count.mjs`), never read it from a report; flag any
agent-authored write to the Tier-2 frontier (`brain/core`, `brain/project`); flag AI-attribution
trailers (Tier-3). If any required evidence is uncomputable (`gh` down), it MUST NOT APPROVE — it
emits `REVISE` with `conditions: [evidence uncomputable]` (fail-closed, §10).

#### Scenario: budget is re-derived, not trusted
- **GIVEN** a report claims 120 changed lines but the cold `diff --numstat` sums to 610
- **WHEN** the tranche evaluator runs
- **THEN** it uses 610 and raises a finding with `evidence:` = the diff command it ran

#### Scenario: uncomputable evidence never approves
- **GIVEN** the server rollup cannot be fetched
- **WHEN** the evaluator concludes
- **THEN** the verdict is `REVISE` with `conditions` including `evidence uncomputable`, never APPROVE

---

## REQ-H1-9 [H1-2]: Poster — port verbs, anti-stale, anti-loop (protocol §8, §10)

The poster MUST post verdicts through the H0-b port verbs `prReviewComment` (PR verdicts) and
`issueComment` (issue rulings) — never any APPROVE path. Before posting it MUST enforce:

- **Anti-stale.** Re-resolve the PR head; if it no longer equals the run's `head_sha`, **do not
  post**; mark the run `reviewed:stale`.
- **Anti-loop.** If the last `brain-review/1` block on the thread was authored by this reviewer
  **and** its `head_sha` equals the current head, **skip** (actor lock **and** sha lock, both).

#### Scenario: stale head is not posted
- **GIVEN** the PR head advanced after the run's `head_sha` was captured
- **WHEN** the poster runs
- **THEN** it posts nothing and the run is `reviewed:stale`

#### Scenario: unchanged self-verdict is skipped
- **GIVEN** the last thread verdict is this reviewer's and its `head_sha` equals the current head
- **WHEN** the poster runs
- **THEN** it skips (no duplicate comment)

---

## REQ-H1-10 [H1-3]: Checkpoint evaluation contract (issue #266 §H1 Checkpoint)

The checkpoint evaluator MUST run the tranche checks (REQ-H1-8) **plus**: report-vs-tree drift
(every number in `checkpoint-report.md` recomputed cold; a report that overstates the tree is
itself a **blocker**); artifact completeness per `sdd-layout` `REQUIRED_ARTIFACTS` with ≥1 `- [x]`
in `tasks.md`; prior pins applied and each cited `file:line`; **TDD-RED by reversion** (revert the
impl files to base, run the PR's **new** tests, require them to **fail** — a test that passes
against base never tested the change); and `brain:audit` + `brain:governance-status` output quoted.
The `decision-gate` step-2 warn MUST be converted into a ruling ("is this a decision?").

#### Scenario: a vacuous test is caught by reversion
- **GIVEN** a PR whose new test passes even when the implementation files are reverted to base
- **WHEN** the TDD-RED reversion runs
- **THEN** the evaluator raises a blocker with `evidence:` = the revert+test command it ran

#### Scenario: report overstates the tree
- **GIVEN** `checkpoint-report.md` claims a number the cold recomputation contradicts
- **WHEN** the drift check runs
- **THEN** the drift is a `blocker` finding (cited to the recomputed value)

---

## REQ-H1-11 [H1-4]: Ruling evaluation contract (protocol §5, §6)

The ruling evaluator MUST require a `## FORK` section with **≥2 options**, each with a cost and a
consequence, plus the implementer's recommendation. A fork without ≥2 options is a request to
design → **REVISE**, never a ruling. When it rules, it MUST follow §5 (enumerate constraining
authorities, eliminate options doctrine excludes **citing each**, rule only if exactly one
survives; if ≥2 survive → `STOP` + `escalate: human` — "this is an ADR, not a ruling") and emit a
`pin:` payload.

#### Scenario: a fork without options is REVISE
- **GIVEN** the PR body has a `## FORK` with a single option
- **WHEN** the ruling evaluator runs
- **THEN** the verdict is `REVISE` ("a fork without options is a request to design"), not a ruling

#### Scenario: two surviving options escalate
- **GIVEN** ≥2 options survive doctrine elimination
- **WHEN** the evaluator concludes
- **THEN** the verdict is `STOP` with `escalate: human`, never a ruling

---

## REQ-H1-12 [H1-5]: Queue lists the mailbox, oldest first (issue #266 §H1)

`brain:review:queue` MUST list the open PRs carrying `needs-review` / `needs-ruling` (the label is
the mailbox), ordered **oldest first**. It is read-only — it applies no labels and posts nothing.

#### Scenario: oldest first
- **GIVEN** three open PRs carry `needs-review` with different created dates
- **WHEN** `brain:review:queue` runs
- **THEN** they are listed oldest-created first

---

## REQ-H1-13 [H1-5]: Board rebuilds derived labels from verdicts (protocol §9)

`brain:review:board` MUST rebuild the `seq:*` / `reviewed:*` labels **from the `brain-review/1`
verdict blocks** on each thread (verdicts are truth, labels are the derived index). A label desync
is a rebuildable no-op. The board reconciles labels via `labelAdd` / `labelRemove` only within the
`seq:*` / `reviewed:*` namespaces.

#### Scenario: a desynced label is rebuilt from the verdict
- **GIVEN** a thread whose latest verdict implies `reviewed:approved` but the label is missing
- **WHEN** `brain:review:board` runs
- **THEN** it re-applies `reviewed:approved` derived from the verdict block

---

## REQ-H1-14 [H1-5, enforced everywhere labelAdd is called]: The hardcoded deny-set (protocol §9)

The reviewer MAY apply only **tightening** labels (`decision`, `seq:*`, `reviewed:*`,
`needs-ruling`) and MUST NEVER apply labels that **loosen** (`size:exception`, `skip:*`) or
**unlock** (`status:approved`, `override:*`). The deny-set MUST be **hardcoded in the caller**,
checked before every `labelAdd`, and refuse the label before it reaches the provider. `actor-check`
is the independent L5 backstop (the reviewer is never in `governance.approvalActors`, §3), so a
deny-set bug is still visible — but the deny-set is the first line.

#### Scenario: an unlock label is refused before the provider
- **GIVEN** the caller is asked to apply `status:approved`
- **WHEN** the deny-set is checked
- **THEN** the label is refused and `labelAdd` is never invoked (asserted on a spy VCS)

#### Scenario: a tightening label passes
- **GIVEN** the caller applies `seq:blocked-by-#5`
- **WHEN** the deny-set is checked
- **THEN** the label is allowed through to `labelAdd`

---

## Slice map

| Slice | REQs landed |
|---|---|
| **H1-1** | REQ-H1-1, REQ-H1-2, REQ-H1-3, REQ-H1-4, REQ-H1-5, REQ-H1-6 |
| **H1-2** | REQ-H1-7, REQ-H1-8, REQ-H1-9 |
| **H1-3** | REQ-H1-10 |
| **H1-4** | REQ-H1-11 |
| **H1-5** | REQ-H1-12, REQ-H1-13, REQ-H1-14 |

---

## Out of scope

- **GitHub Actions hosting** and the per-PR `concurrency` mutex — H2, a separate human-opened
  track, deferred to evidence from H1 usage (issue #266 §H2).
- **Any APPROVE capability** on any provider — permanently excluded (ADR-0020, REQ-266-3).
- **Minting a reviewer bot account / populating `governance.reviewActors`** — a decoupled human
  keystroke; H1 tests use fixture identities (§11).
- **Any change to L5/L6 evaluator logic** — H0-b already wired the two-key split.
