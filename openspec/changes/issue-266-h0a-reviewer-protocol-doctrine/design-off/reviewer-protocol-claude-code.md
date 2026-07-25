# External Reviewer Protocol — automated, repo-as-bus (harness: claude-code)

> **Status:** design draft, not implemented. **Scope:** turn the human-mediated external
> reviewer into an invocable cold agent. **Authority:** subordinate to
> `brain/core/methodology/agent-authorities.md`, ADR-0014, ADR-0015. Where this doc and an
> ADR disagree, the ADR wins.

## 0. The finding that shapes everything

`brain-protect` sets `required_approving_review_count: 1` on `main`
(`brain/scripts/vcs/providers/github.mjs:62`), and the L6 gate counts any review with
`state === 'APPROVED'` from a non-author, non-allowlisted login as *the* human review of a
`brain/**` write (`brain/scripts/vcs/brain-writes-reviewed.mjs:99-111`). So a reviewer agent
that ran `gh pr review --approve` would, in one call, satisfy branch protection **and** the
brain-writes gate — it would become a merge authorizer. The sacred asymmetry is therefore not
a policy the agent must remember; it must be **structurally impossible**:

1. The verdict is posted as a **COMMENT-state review** (`gh pr review --comment`). L6 ignores
   `COMMENTED` by construction — it cannot be miscounted.
2. The VCS adapter never gains an `approve` capability. The proposed verb hardcodes
   `event: 'COMMENT'`; there is no code path to APPROVE.
3. The reviewer's handle goes in `governance.approvalActors` in `brain.config.json` (the key
   is absent today; it feeds `botAllowlist` at `brain-writes-reviewed.mjs:169` and
   `actor-check.mjs:90`). Even a hand-posted APPROVE from that identity is not counted.

Three independent locks. Any one of them failing leaves the other two.

## 1. Cold boot (every invocation, no exceptions)

The reviewer owns a clone at `~/brain-review`, never the implementer's tree. It has no working
memory across runs; the repo is its memory.

```bash
cd ~/brain-review && git fetch origin --prune
gh pr view <N> --repo csrinaldi/brain \
   --json number,headRefOid,baseRefName,author,labels,body,statusCheckRollup,files
git worktree add -f ../rev/pr-<N> <headRefOid>     # detached at the SERVER sha
```

`headRefOid` from the API is the only accepted anchor. A sha quoted in a report or a chat
message is evidence *about* the PR, never the PR. **Doctrine load** (this is what replaces the
human's accumulated context — see §6):

```bash
rg '"type":"(decision|architecture)"' .memory/records/*.jsonl   # pins, rulings, lessons
gh pr view <N> --json comments   # every prior brain-review/1 block on this thread
```

## 2. Three modes, three checklists

Mode is derived from the repo, not declared by the implementer:
`needs-ruling` label → **ruling**; diff touches `openspec/changes/*/checkpoint-report.md` →
**checkpoint**; otherwise → **tranche**.

### 2.1 Express (tranche) — per push, mechanical, cheap

1. **Gate rollup, from the server**: `statusCheckRollup` must show all five REQUIRED_JOBS green
   (`issue-link`, `diff-size`, `local-checks`, `memory-gate`, `decision-gate` —
   `brain/scripts/vcs/governance-checks.mjs:24`). The three DETECTION jobs (`phase-order`,
   `actor-check`, `brain-writes-reviewed`, `:33`) exit 0 on `warn`; a `warn` is **not** a
   blocker but MUST be quoted verbatim in the verdict. An unquoted warn is a review defect.
2. **Re-derive, don't read**: in the cold worktree, `npm ci && npm test`, `npm run repo:check`,
   `npm run brain:nav`. Budget is recomputed, never trusted:
   `git diff --numstat <base>...<head> | node brain/scripts/vcs/diff-size-count.mjs`.
3. **Tier-2 boundary**: `git diff --name-only <base>...<head> -- brain/core brain/project` must
   be empty when the author is an agent. Non-empty → blocker (agent-authorities Tier 2; drafts
   belong in `brain-drafts/`).
4. **Scope**: every path in `--name-only` must be justified by the change's `tasks.md`/`spec.md`.
   Unattributable production code is what `phase-order` rule C only *warns* about — here it is
   ruled on.
5. **Commit hygiene**: `git log --format='%s%n%b' <base>..<head> | rg -i 'co-authored-by|claude'`
   must be empty (Tier 3).
6. Verdict: APPROVE / REVISE / STOP.

### 2.2 Checkpoint (CP) — everything above, plus

7. **Report-vs-tree drift**: every number in `checkpoint-report.md` (diffstat, test counts,
   budget) is recomputed in the cold tree. A report that overstates the tree is itself a
   blocker, independent of the code — the report is a claim, and claims are verified.
8. **Artifact completeness**: the change dir carries `proposal.md`, `spec.md`, `design.md`,
   `tasks.md` (`brain/scripts/lib/sdd-layout.mjs`, `REQUIRED_ARTIFACTS`) and `tasks.md` has
   ≥1 `- [x]` (the L4 rule-C condition).
9. **Pin application**: for every pin record from a prior CP on this track, cite the
   `file:line` where it landed. An unapplied pin is a blocker with no discussion.
10. **The judgment L1 refuses**: `decision-gate` step 2 warns on architectural surfaces touched
    without the `decision` label and always exits 0 (`.github/workflows/governance.yml:176-194`,
    `workflow-governance.md`). The reviewer converts that warn into a ruling: *is* this a
    decision? If yes → REVISE requiring an ADR + `brain/HOME.md` + the `decision` label. This
    is the single highest-value thing the agent does that no gate can.
11. `npm run brain:audit -- origin/main..HEAD` and `npm run brain:governance-status` — output
    quoted in the verdict.

### 2.3 Ruling (design fork)

Entry condition: the issue carries `needs-ruling` **and** its body has a `## FORK` section with
≥2 options, each with cost and consequence, plus the implementer's recommendation. A fork
without options is not a fork; it is a request to design — verdict REVISE, no ruling.

The reviewer then, in this order:
1. Enumerates the authorities that constrain the fork (ADR ids, spec REQ ids, pin record ids,
   gate names). This is a lookup, not an opinion.
2. Eliminates every option excluded by existing doctrine, citing it.
3. If exactly one survives → rule, and emit a `pin:` payload (§3).
4. If ≥2 survive, the choice is a **new decision** → verdict `STOP`, `escalate: human`, "this is
   an ADR, not a ruling."

**The reviewer applies doctrine; it never creates doctrine.** That line is the asymmetry
expressed at the design layer, and it is why an agent can hold this role at all.

## 3. Verdict format (machine-parseable) and where it lands

One fenced YAML block, inside a COMMENT-state PR review (`gh pr review <N> --comment
--body-file verdict.md`) for PR-scoped verdicts, or `gh issue comment` for rulings. The marker
line makes it greppable; the schema makes it checkable.

```yaml
# <!-- brain-review/1 -->
protocol: brain-review/1
verdict: REVISE                  # APPROVE | REVISE | STOP
mode: checkpoint                 # tranche | checkpoint | ruling
reviewer: brain-reviewer[bot]    # MUST be in governance.approvalActors
target: { pr: 261, head_sha: 9f2a1c4, base_sha: 04ae992, checkpoint: CP-B2, rev: 2 }
reviewed_at: 2026-07-13T18:22:11Z
gates:                           # quoted from statusCheckRollup + local re-derivation
  required: { issue-link: pass, diff-size: "pass (356/400 re-derived)", local-checks: pass,
              memory-gate: pass, decision-gate: pass }
  detection: { phase-order: "warn — unattributable: brain/scripts/x.mjs", actor-check: pass,
               brain-writes-reviewed: pass }
findings:
  - id: R1
    severity: blocker            # blocker | correction | editorial
    where: brain/scripts/vcs/ci-context.mjs:142
    claim: "PR_AUTHOR env fallback reintroduced."
    evidence: "rg -n 'PR_AUTHOR' brain/scripts/vcs/ci-context.mjs → 142"   # a command that ran
    cites: ADR-0016#never-do-3                                             # required if blocker
    ruling: "Source author from prView; delete the fallback."
conditions:                      # must hold before the HUMAN merges
  - "R1 applied and pushed"
  - "governance/local-checks green on the new head"
pin:                             # optional: doctrine to persist as a .memory record
  type: decision
  content: "**CP-B2 ruling — ...**\n\n..."
sequencing: { merge_next: [261], rebase_onto: { 263: 261 } }
escalate: null                   # human | null
```

Hard schema rules: a finding with no `evidence` (a command the reviewer actually ran) is
inadmissible. A `blocker` with no `cites` is downgraded to `correction`. `head_sha` is
mandatory — it is what makes a verdict expire (§5).

## 4. Invocation — the label is the mailbox

No orchestrator, no service. Events are repo state; the reviewer polls or is hand-invoked.

| Trigger | Meaning |
|---|---|
| PR opened / synchronized carrying `needs-review` | tranche or CP (auto-detected, §2) |
| `needs-ruling` on an issue | fork ruling |
| `reviewed:stale` (set by CI, §5) | the PR moved under a live verdict |

```bash
npm run brain:review:queue          # gh pr/issue list over needs-review|needs-ruling → work list
npm run brain:review -- --pr 261    # cold-boot, review, post the verdict in the same thread
npm run brain:review -- --pr 261 --dry-run   # print the verdict, post nothing
```

**New VCS verbs required** (the contract has 16 today and none of them write —
`brain/scripts/vcs/cli.mjs` `VERBS`; `vcs-contract.md`): `prReviewComment` (with
`event: 'COMMENT'` hardcoded), `issueComment`, `labelAdd`, `labelRemove`. Adding verbs to the
port is an ADR-level change — it carries the `decision` label and an ADR, by its own rules.

**Label-write rule — monotonic tightening only.** The reviewer may apply a label that makes a
gate *stricter* (`decision`, `needs-ruling`, `seq:*`, `reviewed:*`). It may never apply one that
*loosens* (`size:exception`, `skip:memory-gate`) or one that *unlocks* (`status:approved`). The
deny-set is hardcoded in the caller, not left to the model's judgment — and `actor-check`
(`brain/scripts/vcs/actor-check.mjs`) independently catches a `status:approved` applied by the
wrong actor, so a bug in the deny-set is still visible at L5.

## 5. Sequencing as repo state

Truth lives in the newest checkpoint verdict's `sequencing:` block. Labels on issues are the
**derived index** — exactly the records/index inversion the memory format already teaches
(`memory-format.md`: records are truth, `index.jsonl` is regenerable):

| Label | Meaning |
|---|---|
| `seq:merge-next` | cleared to merge now; at most one per file-domain |
| `seq:blocked-by-#N` | waits on #N |
| `seq:rebase-onto-#N` | must rebase after #N merges (instructions in the verdict) |
| `reviewed:approve` / `reviewed:revise` / `reviewed:stop` | last verdict, denormalized |
| `reviewed:stale` | head moved after the last verdict |

Any agent queries the board with `gh issue list --label seq:merge-next --json number,title`.
`npm run brain:review:board` rebuilds the labels from the verdict comments and `--fix-labels`
reconciles them — a label desync is a no-op, like an `index.jsonl` conflict: discard and
reindex.

## 6. Failure modes and their locks

| # | Failure | Lock |
|---|---|---|
| 1 | **False APPROVE** — reviewer believes the implementer's report | Every finding carries `evidence:` = a command the reviewer ran in its own cold worktree. Budget/tests/diffstat are re-derived, never quoted from the report. Report-vs-tree drift is itself a blocker (§2.2.7). |
| 2 | **Reviewer becomes merge authorizer** | Three locks in §0: COMMENT-state review, no `approve` capability in the adapter, handle in `governance.approvalActors`. |
| 3 | **Stale verdict** — implementer pushes after APPROVE | Verdict is bound to `head_sha`. A new `verdict-freshness` job (DETECTION tier first, per the v3 promotion discipline) compares the newest `brain-review/1` block's `head_sha` against the PR head; mismatch → `reviewed:stale`. An APPROVE on a dead sha authorizes nothing. |
| 4 | **REVISE loop** — revise → push → revise forever | `rev:` counter. At `rev >= 3` the reviewer is forbidden from issuing a 4th REVISE: it MUST emit `STOP` + `escalate: human`. Bounded by construction. (The real CP-A0 history converged at Rev 2.) |
| 5 | **Uncomputable evidence** — `gh` down, fetch fails | Follows the repo's own split: the reviewer may **never** emit APPROVE on uncomputable evidence. It emits REVISE with `conditions: [evidence uncomputable]`. Fail-closed, mirroring `run-check.mjs`. |
| 6 | **Doctrine drift** — the reviewer invents a rule | A `blocker` requires `cites:` (ADR / REQ / record id / gate name). Uncited → downgraded to `correction`. New doctrine is only creatable by the STOP+escalate path (§2.3). |
| 7 | **Two reviewers collide** on one sha | Verdicts are keyed by `(pr, head_sha, reviewer)`; nothing merges them. Two disagreeing verdicts are a human decision, never auto-resolved. A reviewer whose handle equals the PR author MUST abstain — the same self-approval rule `actor-check` enforces at L5. |
| 8 | **Board lies** | Labels are derived; `brain:review:board --fix-labels` regenerates them from the comments. |

## 7. What is lost, and what pays for it

The human-mediated reviewer carries **accumulated conversational context**: it remembers that a
ruling was made three checkpoints ago, that this fork was already litigated, that this
implementer tends to over-claim in reports. A cold agent has none of that. Three mitigations,
in descending strength:

1. **Pins become durable records.** Every REVISE or ruling that establishes doctrine emits a
   `pin:` payload in the verdict; the *implementer* commits it as a `.memory/records/` record
   (`type: decision`, `issue`, `source: "CP-X verdict"`). The reviewer never writes to the repo —
   asymmetry preserved — but its memory does. This is already the de-facto practice (records for
   "C1b design pin", "C2 pin", "a correct re-derivation does not license overriding an accepted
   ADR"); the protocol makes it mandatory instead of incidental. Cold boot reads them (§1).
   **The reviewer's memory is the repo's memory. That is the whole trade.**
2. **The thread is the conversation.** All prior `brain-review/1` blocks on the PR/issue are
   loaded before ruling. Rev history is explicit in the verdict (`rev:`), as it already is in the
   CP reports.
3. **Not recoverable, and honestly so:** the human's *taste* — knowing when a rule should bend.
   The agent never bends: bending is `size:exception` / `override:*` / `status:approved`, and all
   three are human-only keystrokes. A reviewer that cannot bend is exactly the reviewer you can
   automate. The cost is that a legitimate exception now needs a human turn — that is the price,
   and it is the right one.

## 8. Open questions

- Should `verdict-freshness` be a CI job (needs a way to read PR comments from the gate) or a
  reviewer-side re-check on re-invocation? The CI job is stronger but adds a `pull-requests: read`
  consumer of the comment stream.
- Hosting the reviewer in Actions (an in-repo workflow, so still "repo as bus") would need a model
  key in CI and an agent identity that can post reviews. It buys automatic triggering and costs a
  new attack surface. Deliberately deferred: start human-invoked, promote only with evidence —
  the same detection→prevention ladder ADR-0015 uses for gates.
