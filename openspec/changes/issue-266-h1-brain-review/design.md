---
status: draft
issue: 266
slice: H1
---

# Design — `brain:review`, the human-invoked cold reviewer (issue 266, phase H1)

## 0. Binding rulings

Rows R1–R6 are re-stated from the promoted protocol (`brain/core/methodology/reviewer-protocol.md`)
and ADR-0020 — this design **implements** them, it does not reopen them. Rows D1–D3 are decisions
**this design** makes about module shape and integration; they are recommendations for the owner
where marked, and stand as the module contract otherwise.

| # | Ruling | Where it lands | Authority |
|---|--------|----------------|-----------|
| R1 | **The reviewer never approves or merges.** It posts only through `prReviewComment` (`event: 'COMMENT'` hardcoded); the human keystroke stays human. | poster (§6), no APPROVE path anywhere | protocol §1–§2, ADR-0020 |
| R2 | **Verify against the server, cold.** Detached at the API's `headRefOid`; doctrine from `.memory/records` (`type: decision\|architecture`) + prior verdict blocks; `resume.md` and branch-name anchoring are non-inputs. | cold-boot (§4) | protocol §8 |
| R3 | **The three §6 hard rules are build-time invariants.** `evidence:` on every finding, `cites:` on every blocker (else downgrade), `head_sha` mandatory. | verdict emitter (§5) | protocol §6 |
| R4 | **`rev >= 3` forces `STOP` + escalate.** No fourth REVISE. | verdict emitter (§5) | protocol §7 |
| R5 | **Verdicts are truth, labels are the derived index.** The board rebuilds `seq:*`/`reviewed:*` from verdict blocks; the deny-set is hardcoded in the caller. | board + deny-set (§7) | protocol §9 |
| R6 | **Mode is derived from repo state, never declared.** | mode derivation (§4) | issue #266 §H1 |
| D1 | **`brain/scripts/review/` mirrors the `vcs/` DI-seam house style** — pure `evaluate*` cores + `gather*Inputs(deps={})` with `default*` deps + a thin `main(deps={})`/CLI. Tests inject fakes; no network, no real clone. | module layout (§2), DI seam (§3) | this design |
| D2 | **DECIDED — `headRefOid` reaches the reviewer through a cold-boot DI-seam reader (Fork A option (a)), not a widened `prView`**, in H1-1. `prView` today returns only `{ number, labels, body, author }` (`github.mjs:157-171`); `commitStatus` cannot bridge the gap either (it requires the sha as input and returns only `check_runs[0]`). Two BINDING conditions from the owner's ruling: (1) the reader dispatches by PROVIDER from day one (github via `gh api`, gitlab via the shared `gitlabApiFetch` transport over the same `merge_requests/:iid` payload `prView` reads) — never a bare, unconditional `gh api`; (2) the port widening (`headRefOid` on `prView` + a full-rollup verb) enters H1-2's scope WITH ITS OWN ADR — this reader carries a written retirement date, tracked in tasks.md's H1-2 group, so it never calcifies into a parallel mini-port. | cold-boot reader (§4), Fork A (§8) | issue #266 comment 4993202904 |
| D3 | **DECIDED — the setup doc lives at `docs/reviewer-setup.md`** (Fork B option (1)) — teammate-facing, alongside `docs/adoption.md` / `docs/workflow-guide.md`. It **counts against budget** (`docs/**` is not in `governance.ignoreList` — hiding a durable doc in an ignored path to dodge the count was explicitly rejected); ~35 counted lines fits the H1-1 ~350 estimate. If the fine forecast gets tight, the doc ships in its own micro-PR — split before hiding, always. | setup doc (§9) | issue #266 comment 4993202904 |

**No ruling was found technically impossible.** The one honest cost (protocol §12) — the cold agent
has no accumulated conversational memory — is paid by the mandatory `pin:` → `.memory/records/`
mechanism the ruling evaluator emits (§7).

---

## 1. What H1 adds, and what stays untouched

H0-b already added the four COMMENT-only write verbs (`prReviewComment`, `issueComment`,
`labelAdd`, `labelRemove`) to both providers and wired the `governance.reviewActors` two-key split
at L6 (ADR-0020; `cli.mjs:26-32`, `brain-writes-reviewed.mjs`). H1 builds a **new consumer** of
that surface under `brain/scripts/review/`. It changes **no** existing evaluator (`actor-check`,
`brain-writes-reviewed`, `governance-checks`) — it **reads** them:

- required gate names come from `governance-checks.mjs`'s `REQUIRED_JOBS` / `DETECTION_JOBS`;
- the budget re-derivation reuses `diff-size-count.mjs`'s `parseDiffNumstat`;
- the port verbs are reached through `vcs/cli.mjs`'s `getVcs()`.

| Layer | H1-1 (this slice) | H1-2..H1-5 (deferred) |
|---|---|---|
| Identity gate | `review/identity.mjs` (config + fail-closed) | — |
| Cold boot | `review/cold-boot.mjs` (headRefOid, detached, doctrine load) | — |
| Verdict emitter | `review/verdict.mjs` (`brain-review/1` builder + §6/§7 invariants) | — |
| CLI | `review/cli.mjs` (`--pr`, `--dry-run`; mode/eval wired incrementally) | modes + queue + board dispatch |
| Mode derivation | — | `review/mode.mjs` (H1-2) |
| Evaluators | — | `review/evaluators/{tranche,checkpoint,ruling}.mjs` (H1-2/3/4) |
| Poster | — | `review/poster.mjs` (H1-2) |
| Queue / board | — | `review/queue.mjs`, `review/board.mjs` (H1-5) |
| Setup doc | `docs/reviewer-setup.md` (counts) | — |
| Config | `reviewer:{handle,tokenEnv}` documented; `reviewActors` stays absent | — |

---

## 2. Module layout — `brain/scripts/review/`

Mirrors the flat, colocated-test convention of `brain/scripts/vcs/` and `brain/scripts/memory/`
(one concern per `.mjs`, a sibling `.mjs.test`, shared helpers in a `lib/`, fixtures in `fixtures/`).

```
brain/scripts/review/
  cli.mjs                 # dispatcher: brain:review / :queue / :board; arg parse (--pr, --mode, --dry-run)
  identity.mjs            # [H1-1] config reviewer:{handle,tokenEnv} → resolve token; fail-closed gate
  cold-boot.mjs           # [H1-1] resolve headRefOid (DI reader), detached worktree, load doctrine
  verdict.mjs             # [H1-1] brain-review/1 builder + §6 hard rules + §7 rev>=3 bound
  mode.mjs                # [H1-2] derive mode from repo state (needs-ruling / checkpoint-report / tranche)
  poster.mjs              # [H1-2] post via prReviewComment/issueComment; anti-stale + anti-loop
  evaluators/
    tranche.mjs           # [H1-2] required gates from rollup, warns verbatim, budget re-derived, tiers
    checkpoint.mjs        # [H1-3] report drift, sdd-layout artifacts, prior pins, TDD-RED reversion
    ruling.mjs            # [H1-4] ## FORK ≥2 options else REVISE; §5 elimination; pin payload
  queue.mjs               # [H1-5] needs-review/needs-ruling mailbox, oldest first
  board.mjs               # [H1-5] rebuild seq:*/reviewed:* from verdict blocks
  deny-set.mjs            # [H1-5] hardcoded tightening-only allow/deny; refuses status:*/size:exception/skip:*/override:*
  lib/
    parse-verdict.mjs     # [H1-1] parse a brain-review/1 block from a review body (used by cold-boot, board, anti-loop)
  fixtures/               # [H1-1] fixture PRs, fixture records, fixture verdict threads, a vacuous-test fixture (H1-3)
  *.test.mjs              # colocated, budget-free (governance.ignoreList: **/*.test.mjs)
```

`lib/parse-verdict.mjs` is introduced in H1-1 because three consumers need it — cold-boot (load
prior blocks), the anti-loop lock (last block author + head_sha), and the board (rebuild from
blocks). Extracting it once keeps `rev` derivation and the board reading the same parser.

---

## 3. The DI-seam pattern (D1)

Every module follows the `vcs/brain-writes-reviewed.mjs` shape verified in the tree
(`brain-writes-reviewed.mjs:66,230,274,319`): a **pure** exported core takes a plain inputs object;
a `gather*Inputs({ ..., deps = {} })` defaults each side-effecting dependency to a `default*`
implementation; a thin `main(deps = {})` / CLI entry wires the real deps. Tests inject fakes and
never touch the network or a real worktree.

```js
// review/identity.mjs — pure core + gather
export function evaluateIdentity({ reviewerConfig, env, provider, patSetupUrl, setupDocPath }) {
  // returns { ok:true, handle, token } | { ok:false, missingVar, patSetupUrl, setupDocPath }
}
export async function gatherIdentity({ deps = {} } = {}) {
  const readConfig  = deps.readConfig  ?? (() => loadBrainConfig().reviewer);
  const readEnv     = deps.readEnv     ?? (() => process.env);
  const getPatUrl   = deps.getPatUrl   ?? (async (o) => (await getVcs()).patSetupUrl(o));
  // ...
}
```

Seams the H1-1 modules inject (so tests stay offline):

| Module | Injected default | What the test replaces it with |
|---|---|---|
| `identity.mjs` | `readConfig`, `readEnv`, `getPatUrl` | fixture config, fixture env (var present/absent), fake url |
| `cold-boot.mjs` | `fetchHead` (→ `headRefOid`), `cloneDetached`, `readRecords` (`readRecordObservations`), `fetchReviews` (`prReviews`) | fixture head sha, no-op clone, fixture records, fixture verdict thread |
| `verdict.mjs` | *(pure — no seams)* | direct calls with finding fixtures |
| `poster.mjs` (H1-2) | `getVcs`, `reResolveHead` | spy VCS asserting no write / no APPROVE; moved-head fixture |

`cold-boot.mjs` never opens a seam for `resume.md` or a branch ref — those inputs are absent from
the code by construction (R2), which is how "rejected boot input" is enforced rather than
remembered.

---

## 4. Cold boot (R2, R6, REQ-H1-2)

1. **Identity precedes boot.** `identity.mjs` resolves `{ handle, token }` or fails closed
   (REQ-H1-1) before any server call — the token is what lets cold-boot reach the API to resolve
   `headRefOid` and clone (this is why identity is in slice 1, beside the boot that consumes it).
2. **Resolve the anchor.** `fetchHead` returns the API's `headRefOid` for the PR. In H1-1 this is a
   cold-boot DI reader (`gh api repos/{project}/pulls/{n} --jq .head.sha`, or the provider's raw
   fetch) — **not** a widened `prView` (D2, Fork A §8).
3. **Detached checkout.** `cloneDetached` checks out the reviewer's own worktree **detached at
   `headRefOid`** — never a branch name (`git pull origin feat/...` is rejected), never a sha
   quoted in a report. `head_sha` for the run is this exact value.
4. **Load doctrine.** `readRecords` (`readRecordObservations({ recordsDir })`,
   `memory/lib/store.mjs:151`) filtered to `type: decision | architecture`, plus every prior
   `brain-review/1` block parsed by `lib/parse-verdict.mjs` from `fetchReviews` (`prReviews`).
5. **Self-review guard.** If `handle === prView.author`, abstain (REQ-H1-3).

**Mode derivation** (`mode.mjs`, H1-2, R6): `needs-ruling` label → ruling; diff touches
`openspec/changes/*/checkpoint-report.md` → checkpoint; else → tranche. Pure over `{ labels,
changedPaths }`, so it is a table-driven unit test.

---

## 5. Verdict emitter (R3, R4, REQ-H1-4, REQ-H1-6)

`verdict.mjs` is the only place a `brain-review/1` block is constructed, and it enforces the three
§6 hard rules as **build-time invariants** — a violating verdict is not representable:

- **evidence gate.** `findings.filter(f => f.evidence)` — a finding without a command the reviewer
  ran cold is dropped as inadmissible.
- **cites gate.** `severity: blocker && !cites` → the finding is emitted as `correction`.
- **head_sha gate.** No `head_sha` → the builder throws; there is no headless verdict.
- **rev bound.** `rev` is derived from the count of prior blocks; if the evaluator's conclusion is
  REVISE and `rev >= 3`, the emitter substitutes `STOP` + `escalate: human`.

The emitter is **pure** (no seams) so its invariants are tested directly with finding fixtures —
the highest-value unit surface in H1-1.

**Applies doctrine, never creates it** (§5): the evaluators (H1-2..H1-4) hand the emitter findings
that already carry `cites:` to a real authority; the emitter's cites gate is the backstop that
downgrades an uncited blocker rather than letting invented doctrine through.

---

## 6. Poster (REQ-H1-9, H1-2)

Posts through `prReviewComment` (PR verdicts) / `issueComment` (issue rulings) — the COMMENT-only
port verbs from ADR-0020. There is **no APPROVE path** to select (R1, structural). Before posting:

- **anti-stale.** `reResolveHead()`; if it ≠ the run's `head_sha`, post nothing, mark
  `reviewed:stale`.
- **anti-loop.** If the last thread `brain-review/1` block's author is this reviewer **and** its
  `head_sha` equals the current head, skip (actor lock **and** sha lock).

Both locks read the same `lib/parse-verdict.mjs` the cold-boot and board use.

---

## 7. Queue, board, and the deny-set (R5, REQ-H1-12..14, H1-5)

- **`queue.mjs`** — read-only; lists open PRs with `needs-review` / `needs-ruling`, oldest first
  (via `issueList`/`mrList` + created-date sort). Applies no labels.
- **`board.mjs`** — rebuilds `seq:*` / `reviewed:*` from the verdict blocks (verdicts are truth);
  reconciles via `labelAdd` / `labelRemove` **within those namespaces only**.
- **`deny-set.mjs`** — a hardcoded set gate every `labelAdd` passes through. **Allow** (tightening):
  `decision`, `seq:*`, `reviewed:*`, `needs-ruling`. **Deny** (loosen/unlock): `size:exception`,
  `skip:*`, `status:approved`, `override:*`. Refuses the denied label **before** it reaches the
  provider. `actor-check` at L5 is the independent backstop (the reviewer is never in
  `governance.approvalActors`, §3), so a deny-set bug is still caught — the deny-set is the first
  line, not the only one.

---

## 8. Forks for the owner — DECIDED (issue #266 comment 4993202904)

**Fork A — how `headRefOid` / `statusCheckRollup` reach the reviewer. DECIDED: option (a), the
cold-boot DI-seam reader, now — with two named conditions.** `prView` today returns only
`{ number, labels, body, author }` (`github.mjs:157-171`); neither the head oid nor the status
rollup is on the port. Re-derived cold before deciding: `commitStatus` cannot bridge the gap either
— it requires the sha as input (chicken-and-egg) and returns only `check_runs[0]`, while H1-2's
tranche needs the full rollup. So the port widening is inevitable regardless; its natural home is
H1-2, with its ADR, where it is needed for real.

- **(a) — cold-boot DI reader (DECIDED, D2).** The reviewer resolves the head via an injected
  `fetchHead` seam — github via `gh api .../pulls/{n} --jq .head.sha`, gitlab via the shared
  `gitlabApiFetch` transport over the same `merge_requests/:iid` payload `prView` already reads.
  **Cost:** a reader that is not a first-class port verb; **consequence:** no contract change,
  ships in H1-1 unblocked.
- **(b) — widen the port.** Rejected for H1-1 — deferred to H1-2 with its own ADR (condition 2
  below), not reopened here.
- **Condition 1 (binding):** the reader dispatches by PROVIDER from day one — never a bare,
  unconditional `gh api` call (the reviewer must run against self-hosted GitLab too).
- **Condition 2 (binding):** the port widening (`headRefOid` on `prView` + a full-rollup verb)
  enters H1-2's scope WITH ITS OWN ADR, explicit in tasks.md's H1-2 group — the reader carries a
  written retirement date so it never calcifies into a parallel mini-port.

**Fork B — setup doc location. DECIDED: option (1), `docs/reviewer-setup.md` (~35 counted lines,
D3).** Convention verified: `docs/` already hosts the durable team-facing docs (`adoption.md`,
`workflow-guide.md`). An ignored-path option was explicitly rejected — hiding a durable doc in an
ignored path to dodge the count is gaming the budget; the ignoreList exists for change artifacts
and tests, not for documentation to live where diff-size cannot see it. Budget note: ~385/400 with
this doc inside the H1-1 slice; if the fine forecast gets tight, the answer is the doc shipping in
its own ~35-line micro-PR — split before hiding, always.

---

## 9. package.json scripts and the setup doc

New scripts (mirroring the `brain:audit` / `brain:governance-status` prefixed convention):

```json
"brain:review":       "node ./brain/scripts/review/cli.mjs",
"brain:review:queue": "node ./brain/scripts/review/cli.mjs queue",
"brain:review:board": "node ./brain/scripts/review/cli.mjs board"
```

Setup doc — `docs/reviewer-setup.md` (D3, Fork B) — states *what without the value*: the env var
name (`BRAIN_REVIEWER_TOKEN`), where the team stores it, who grants access, and the `patSetupUrl`
the fail-closed gate prints. It never contains a token. **Counts against budget** (~30–40 lines).

---

## 10. The honest cost (protocol §12)

What is lost vs the human-mediated reviewer: **accumulated conversational context** — the human
remembers the ruling made three checkpoints ago. Paid for by the mandatory `pin:` →
`.memory/records/` mechanism the ruling evaluator emits (§7, protocol §8), which cold boot reads
back. Not recoverable, and honestly so: the human's **taste** — knowing when a rule should bend.
The agent never bends; bending is `size:exception` / `override:*` / `status:approved`, all
human-only keystrokes the deny-set refuses. A reviewer that cannot bend is exactly the reviewer you
can automate.
