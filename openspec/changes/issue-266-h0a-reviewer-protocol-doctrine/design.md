---
status: draft
issue: 266
slice: H0-a
---

# Design — Reviewer protocol as doctrine + VCS port verbs (issue 266, phase H0)

## 0. Binding rulings (litigated on the issue thread; APPROVED rev 2 — design implements, does not reopen)

| # | Ruling | Where it lands |
|---|--------|----------------|
| R1 | **The sacred asymmetry is structural, not remembered.** The reviewer cannot become a merge authorizer — enforced by three independent locks, not by a rule the model must recall. | §2 |
| R2 | **No key feeds two gates.** The reviewer registers in a NEW `governance.reviewActors` (L6-only); it is NEVER in `governance.approvalActors` (L5-only). | §3 |
| R3 | **No APPROVE capability, ever.** The port gains write verbs, but none can emit an APPROVE review; `prReviewComment` hardcodes `event: 'COMMENT'`. | §2 lock 2, §4 |
| R4 | **Verify against the server, cold.** The reviewer runs detached at the API's `headRefOid`, never a branch name, never a sha quoted in a report; doctrine loads from `.memory/records/` + the verdict thread. | §5 |
| R5 | **Verdicts are truth; labels are the derived index.** Sequencing lives in `seq:*`/`reviewed:*`; a label desync is a rebuildable no-op. `status:*` stays human-only. | §7 |

**No ruling was found technically impossible.** One carries a real, honest cost (§9): a cold agent
has no accumulated conversational memory — paid for by mandatory `pin:` records (§5).

---

## 1. What H0 adds, and what stays untouched

`brain`'s VCS port has **16 verbs today** (`brain/scripts/vcs/cli.mjs:22-27`) and **none of them
writes to the review/comment/label surface**. `mrCreate` and `branchProtect` do write — to the MR
and branch-protection surfaces — and therefore enter the deny-set threat model as *existing* write
surface, but neither touches reviews, comments, or labels. H0 adds four verbs to that surface (§4).

The L5/L6 evaluators are **not rewritten**. The only behavioral change to them is that L6's
botAllowlist config read **moves** from `governance.approvalActors` to `governance.reviewActors` in
H0-b — it does not union them (R2: no key feeds two gates); L5 is untouched. Everything else in H0-a
is doctrine and records — no executable behavior changes in this slice.

| Layer | H0-a (this slice) | H0-b (deferred) |
|---|---|---|
| Doctrine | `brain/core/methodology/reviewer-protocol.md` (ADR draft → human promote) + `brain/HOME.md` index | — |
| SDD artifacts | proposal / spec / design / tasks | — |
| Design-off record | both source docs under `design-off/` | — |
| Durable records | lock-3 decision + meta-finding in `.memory/records/` | — |
| Port verbs | — | 4 verbs × 2 providers + `VERBS` + `vcs-contract.md` + drift-guard |
| Gate wiring | — | `governance.reviewActors` read at L6; the two mandatory tests |

---

## 2. The three structural locks (R1)

The reviewer becomes a merge authorizer only if it can produce the one thing L6 counts as the
human review: a non-author, non-allowlisted `state === 'APPROVED'` review
(`brain-writes-reviewed.mjs:98-118`) — which `main`'s `required_approving_review_count: 1` also
consumes. Three independent locks each make that impossible; any one holds if the other two fail.

**Lock 1 — COMMENT-state verdicts.** Verdicts post as COMMENT-state reviews. L6's approver set is
built only from `reviews.filter(r => r.state === 'APPROVED')` (`brain-writes-reviewed.mjs:99`); a
`COMMENTED` review contributes nothing. A verdict cannot be miscounted as an approval **by
construction of the counter**, not by a rule the reviewer follows.

**Lock 2 — no approve capability in the adapter.** The verb that posts a verdict,
`prReviewComment`, hardcodes `event: 'COMMENT'`. There is no APPROVE sibling verb, no APPROVE
argument, no branch that selects a different event (REQ-266-3). Even a fully compromised reviewer
process has no code path to reach an APPROVE.

**Lock 3 — key separation (see §3 for the hazard it defuses).** The reviewer handle registers in
`governance.reviewActors`, read ONLY by L6, whose sole meaning is "these identities do not count as
the human reviewer." It is NEVER in `governance.approvalActors`, read ONLY by L5, whose meaning is
"these identities may apply `status:approved`." No key feeds two gates.

> Three independent locks. Lock 1 defends against a config regression that mis-registers the
> reviewer; lock 2 against a bug that posts the wrong event; lock 3 against the dual-semantics
> coupling. Removing any one leaves the other two standing.

---

## 3. The two-key split and the hazard it dissolves (R2, finding H0-LOCK3-DUAL)

### The hazard — verified in the tree, not inferred

`governance.approvalActors` is read as the `botAllowlist` by **both** gates, with **opposite
semantics**:

- **L5 — permissive.** `actor-check.mjs` reads `governance.approvalActors`
  (`actor-check.mjs:223-232`) into `botAllowlist`; when the approving actor is in it,
  `evaluateActor` returns `{ level: 'pass', reason: 'the approved label was applied by allow-listed
  automation identity "…" ' }` (`actor-check.mjs:90-94`). Being in the list **authorizes** you to
  apply `status:approved`.
- **L6 — restrictive.** `brain-writes-reviewed.mjs` reads the same
  `governance.approvalActors` (`brain-writes-reviewed.mjs:165-174`) into `botAllowlist`; the human
  approver is `approvers.find(a => a !== author && !botAllowlist.includes(a))`
  (`brain-writes-reviewed.mjs:111`). Being in the list **excludes** you from counting as the human
  reviewer.

One key, two opposite effects. A single registration of the reviewer in `governance.approvalActors`
would simultaneously **de-authorize it at L6** (correct — we want that) **and authorize it to
self-apply `status:approved` at L5** (catastrophic — that is the merge keystroke). The two
requirements pull the same key in opposite directions; you cannot satisfy both with one
registration.

### The resolution — split the key

L6 reads a **new** `governance.reviewActors`. The reviewer registers there and **never** in
`governance.approvalActors`. The coupling is dissolved by construction:

| Gate | Key it reads | Reviewer in it? | Effect on the reviewer |
|---|---|---|---|
| L5 `actor-check.mjs` | `governance.approvalActors` | **No** | Not admitted by the allow-listed branch → cannot self-approve |
| L6 `brain-writes-reviewed.mjs` | `governance.reviewActors` (new) | **Yes** | Excluded from the human-approver count → verdict never counts as review |

**Two mandatory tests make this executable** (spec REQ-266-6; rev-2 binding condition):
`t1` — the reviewer identity does NOT pass `actor-check` when applying `status:approved`;
`t2` — the reviewer identity IS excluded from the L6 human-approver count. Both ship with H0-b.

> **Live-tree note the promoter must know.** `governance.approvalActors` is **not currently
> populated** in `brain.config.json` (only `governance.ignoreList` exists, lines 15-28). Both L5 and
> L6 read it defensively and default to `[]` when absent. The split still holds — `reviewActors` is
> genuinely new and `approvalActors` genuinely L5-only *in code* — but formalizing both keys in the
> shipped config is part of H0-b, not an existing given. Do not assume `approvalActors` is set.

---

## 4. The four port verbs (R3)

Added to `VERBS` (`cli.mjs:22-27`), the `vcs-contract.md` required-verbs table, and both providers
(`brain/scripts/vcs/providers/{github,gitlab}.mjs`). Normalized returns match the port's existing
`{ url }|{ url: null, error }` / never-throws discipline (`vcs-contract.md`).

| Verb | Signature | Note |
|---|---|---|
| `prReviewComment` | `({ project, number, body })` | `event: 'COMMENT'` **hardcoded** — no APPROVE path exists in code (lock 2) |
| `issueComment` | `({ project, number, body })` | rulings on issues |
| `labelAdd` | `({ project, number, labels })` | **caller** enforces the deny-set (§7), not the verb |
| `labelRemove` | `({ project, number, labels })` | monotonic-tightening removals only |

**Drift-guard.** The parameterized contract suite `providers/vcs.contract.test.mjs` runs one
assertion set over `['github', 'gitlab']`; adding the four verbs to `VERBS` turns it red until both
providers implement them with the normalized shapes. Adding verbs to the port is a decision →
`decision` label + ADR, by this protocol's own rule.

> **Contract-doc drift to fix in H0-b.** `vcs-contract.md:61` still says providers export "the 15
> verbs", and its required-verbs table omits `capabilities` (present in `VERBS`, so 16). Adding four
> verbs means correcting the count prose **and** the table in the same MR — the doc is already one
> verb behind the array.

---

## 5. Cold boot (R4)

The reviewer runs in its **own** clone/worktree, checked out **detached at the `headRefOid`
returned by the API** — never a branch name (a moving pointer the implementer controls), never a
sha quoted in a report. Every verdict is bound to that sha via the mandatory `head_sha` field and
expires with it: if head moved mid-run, the verdict is not posted (`reviewed:stale`).

Doctrine loads from two durable, server-side sources, neither authored to persuade a reviewer:

1. `.memory/records/*.jsonl` filtered to `type: decision|architecture`;
2. every prior `brain-review/1` block on the thread.

**The memory trade (paid cost of coldness).** A cold agent has none of the human reviewer's
accumulated conversational context. The trade: every REVISE or ruling that establishes doctrine
emits a `pin:` payload, and the implementer commits it as a `.memory/records/` record
(`type: decision`, `issue`, `source: "CP-X verdict"`). The reviewer never writes to the repo — the
asymmetry holds — but its memory does, and cold boot reads it back. This slice's own lock-3 decision
and meta-finding are the first two such records, and the rev-2 verdict binds them to the first push.

**Rejected boot inputs** (documented, §10): `resume.md` hydration (imports the implementer's
assumptions — the exact contamination the external reviewer exists to avoid); branch-name anchoring
(violates verify-against-the-server).

---

## 6. Verdict schema `brain-review/1`

A fenced YAML block in the review body:

```yaml
protocol: brain-review/1
verdict: APPROVE | REVISE | STOP
head_sha: <mandatory — the staleness anchor>
rev: <n>
gates: { required: [...], detection: [...] }   # detection levels quoted verbatim
findings:
  - id: <id>
    severity: blocker | correction | editorial
    evidence: "<a command the reviewer actually ran>"   # MANDATORY — no evidence ⇒ inadmissible
    cites: "<authority>"                                 # MANDATORY iff severity: blocker
conditions: [ ... ]
pin: { ... }          # optional — the durable-record payload
sequencing: { ... }   # optional
escalate: human | null
```

- **`evidence:` is mandatory** on every finding — a finding without a command the reviewer ran cold
  is inadmissible.
- **`cites:` is mandatory for `severity: blocker`** — an uncited blocker is downgraded to
  `correction`. This is the lock against doctrine drift: the reviewer applies doctrine, it never
  invents it. New doctrine is only reachable via `STOP` + escalate.

**Applies doctrine, never creates it.** On a fork the reviewer enumerates the constraining
authorities (ADR / REQ / record id / gate name), eliminates the options doctrine excludes citing
each, and rules only if exactly one survives. If ≥2 survive, the choice is a new decision →
`STOP` + `escalate: human` ("this is an ADR, not a ruling").

---

## 7. Bounded revision + monotonic labels (R5)

**Bounded revision.** At `rev >= 3` the reviewer is forbidden from a fourth REVISE; it emits
`STOP` + `escalate: human`. No infinite revise loop by construction.

**Monotonic label tightening + deny-set.** The reviewer may apply labels that make a gate
*stricter* (`decision`, `seq:*`, `reviewed:*`, `needs-ruling`) and never ones that *loosen*
(`size:exception`, `skip:memory-gate`) or *unlock* (`status:approved`). The deny-set is **hardcoded
in the caller**, not left to the model. Defense in depth: `actor-check` independently catches a
misapplied `status:approved` from any identity not in `governance.approvalActors` — and the reviewer
is never in `governance.approvalActors` — so even a deny-set bug is still visible at L5.

**Sequencing = verdicts are truth, labels are the derived index** — the same inversion the memory
format teaches (records are truth, `index.jsonl` is regenerable). Namespace `seq:*` / `reviewed:*`;
a label desync is a no-op, rebuilt from the verdict comments. `status:*` stays human-only, and the
deny-set enforces it — the rejected `status:*` sequencing namespace (§10) would have put one typo
between the reviewer and self-approving an issue.

---

## 8. Deliverables of H0-a (what a human promotes)

- ADR draft → `brain-drafts/` for `brain/core/methodology/reviewer-protocol.md`, with
  `brain/HOME.md` co-promoted (REQ-266-1).
- `design-off/reviewer-protocol-{claude-code,antigravity}.md` — both source documents unmodified,
  under the change dir (not `design-docs/` at the root: `governance.ignoreList` covers
  `openspec/changes/**` but not `design-docs/**`, `brain.config.json:16-27`; committing at the root
  would put ~600 counted lines against the 400 budget and force a `size:exception` the plan forbids).
- Durable records in `.memory/records/`: the lock-3 two-key decision and the meta-finding — bound to
  the first push by the rev-2 verdict.

> The `design-off/` subdirectory, `brain-drafts/`, and `.memory/` are **owner-managed** — this
> planning slice only authors the four `openspec/changes/**` artifacts.

---

## 9. The honest cost

What is lost vs the human-mediated reviewer: **accumulated conversational context** — the human
remembers the ruling made three checkpoints ago and that this fork was already litigated. Paid for
by the mandatory `pin:` → `.memory/records/` mechanism (§5), which was de-facto practice already and
is now protocol.

Not recoverable, and honestly so: the human's *taste* — knowing when a rule should bend. The agent
never bends. Bending is `size:exception` / `override:*` / `status:approved`, all human-only
keystrokes. **A reviewer that cannot bend is exactly the reviewer you can automate.**

---

## 10. Rejected alternatives (documented, not silently dropped)

- **`resume.md` hydration** — rejected: violates coldness. `resume.md` is the implementer's
  working-memory artifact; reading it imports the implementer's own assumptions and documented
  compromises — the contamination the external reviewer exists to avoid. Doctrine comes from
  `.memory/records/` and the verdict thread, both durable and server-side.
- **Branch-name anchoring** (`git pull origin feat/...`) — rejected: violates
  verify-against-the-server. A branch name is a moving pointer the implementer controls. The anchor
  is the API's `headRefOid`, checked out detached; every verdict expires with its sha.
- **`status:*` namespace for sequencing** — rejected: collides with the sacred label.
  `status:approved` is the L5 human-approval token (`actor-check.mjs`, `governance.approvedLabel`).
  Giving an agent write access to `status:*` puts one typo, one prefix bug, or one prompt injection
  between the reviewer and self-approving an issue. Sequencing lives in `seq:*`/`reviewed:*`;
  `status:*` stays human-only, and the deny-set enforces it.
- **One key with dual semantics** (the status quo) — rejected: §3. It cannot express "de-authorize
  at L6" and "do not authorize at L5" simultaneously; the split is the only registration that
  satisfies both.

---

## 11. Forks for the owner (recommend, don't decide)

**Fork A — where `governance.reviewActors` and `governance.approvalActors` are formalized.** Neither
is populated in `brain.config.json` today (§3 note). Recommendation: populate both in the shipped
config in H0-b, alongside the L6 read and the two mandatory tests, so the split is real config, not
just code that defaults to `[]`.

**Fork B — H1/H2 sequencing.** H0 is doctrine + port only. Recommendation: land H0-a (this slice)
and H0-b before any `brain:review` runner (H1); defer Actions hosting (H2) to evidence from H1
usage, per the same detection→prevention ladder ADR-0015 applies to gates.
