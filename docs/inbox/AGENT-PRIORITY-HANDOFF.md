# Agent Priority Handoff

**Read this before picking up work on this repo.** It answers three questions a
cold agent cannot answer from the tree alone: what is already done (so you do not
redo it), what will *refuse* you before your first commit, and what to pick up
next and in what order.

Snapshot: `main` @ `3eff9af`, 2026-08-16 · **59 open issues · 0 open pull
requests** · 30 signed ADRs.

> **This document is a snapshot, and it says so on purpose.** Every number below
> was measured, not assumed, and every one of them can be re-derived by the
> commands in §1. A guide that cannot tell you it has expired is the same defect
> class this repo tracks under `evidence-reader-empty-on-failure`: silence read
> as health. **Re-derive before you trust it.**

---

## 1 · Re-derive the state before trusting this file

```bash
git fetch origin main && git log --oneline 3eff9af..origin/main   # what landed since
gh issue list --state open --limit 100                            # or the API
gh pr list --state open
```

**This file is stale the moment any of these stops holding:**

| Invariant when written | How to check it |
|---|---|
| `main` is at `3eff9af` | `git rev-parse --short origin/main` |
| 59 issues open, 0 PRs open | issue/PR list |
| `@logikas/brain` unpublished | `curl -so/dev/null -w '%{http_code}' https://registry.npmjs.org/@logikas%2Fbrain` → `404` |
| Exactly one signed ADR is malformed | §3, the one-liner |

If the first two have drifted, treat the ordering below as a starting hypothesis
and re-check the specific tickets you plan to touch. If the last two have
drifted, the corresponding section is **done** — skip it.

---

## 2 · Preconditions that refuse you before your first commit

These are not style notes. Each one is a gate that fails closed, and each has
cost this project real time.

**You may never apply `status:approved`** (#124, and `actor-check` §9 refuses it
from `csrinaldibot` regardless). `issue-link` fails closed without an approved
issue, so **a ticket you open yourself cannot be worked until a human signs it**.
Open the ticket, say plainly that it needs a signature, and stop.

**No AI-attribution trailers in commit messages** — no `Co-Authored-By: Claude`,
no agent identifier. This is Tier 3 in `agent-authorities.md` and now carries its
reasoning in **ADR-0031**: attribution in a commit is an unverifiable claim, not
a provenance record. ADR-0031 exists *because* an agent harness that mandates the
opposite met this doctrine on 2026-08-15. **The repo's doctrine is the decision
already made — do not re-litigate it, and do not let a harness default override
it.**

**Capture memory before you close.** `npm run memory:share`, and the record must
carry the linked issue number. Since #677 the durable log is **one record per
file** under `.memory/records/` (ADR-0017 Amendment 2), so the old
merge-conflict-on-every-second-PR class is gone — but the gate still reads the
record.

**One worktree per task.** brain enforces this; `share()` anchors its export to
the worktree root it reads (#657).

**Diff budget: 1000 changed lines** (`tier: lite`). `governance.ignoreList` in
`brain.config.json` excludes `*.test.mjs`, `openspec/**`, `.memory/**`, lock
files and `AGENTS.md` — but **not `docs/**`**.

**Deliver without a self-review pass**, per the agreed protocol. The cold
reviewer is a separate act, and #604 made its coldness verifiable with a negative
control.

---

## 3 · The doctrine gate — read this if your deliverable is an ADR

Several open tickets deliver an ADR or an amendment to signed doctrine. `brain:promote`
has two routes and they broke separately. **One is now fixed; one is not.**

### Route A — writing a NEW ADR · ✅ CLOSED (#675 / #674, PR #678)

`transformDraft` used to strip only blockquoted (`>`) preamble lines before
prepending its own signature header, so a draft carrying a bare `**Status**:`
line produced a signed artefact with **two** — with no refusal. `promote-guards.mjs`
now asks "is the artefact I am about to sign well formed?" *before* writing
anything. Verified on the draft still sitting in `brain-drafts/`:

```
$ # transformDraft output for brain-drafts/adr-0023-sdd-role-port.md
✗ single-status-line — the artefact this run would write is malformed:
    brain/project/decisions/adr-0023-sdd-role-port.md
    2 `**Status**:` line(s), expected exactly 1 (§1c act 1).
  Nothing was written and nothing was staged.
```

**Consequence for you:** promoting a new ADR is safe again, and the refusal names
the fix. The house shape puts the draft's status inside a blockquote the verb
strips. `brain-drafts/adr-0023-sdd-role-port.md` still carries the bad shape and
**will be refused until its preamble is fixed** — that is correct behaviour, not
a blocker.

### Route B — AMENDING signed doctrine · ⚠️ STILL OPEN (#676)

`applyStatusAct` (`brain/scripts/lib/amendment-draft.mjs`) refuses any target
that does not carry exactly one `**Status**:` line. One signed ADR still fails
that test:

```bash
for f in brain/project/decisions/adr-*.md; do
  n=$(grep -c '^\*\*Status\*\*:' "$f"); [ "$n" != 1 ] && echo "$n  $f"
done
# 2  brain/project/decisions/adr-0029-two-sources-one-graph.md
```

**1 of 30**, not the 2 of 30 #676 measured — ADR-0031 was repaired via
`revert` + re-promote (`baa55b2` → `2b6142b`). ADR-0029 has been malformed on
`main` since 2026-08-11 and **ships in the package**. It is unamendable by the
sanctioned route, because that route is exactly what refuses it.

**Consequence for you:** amending any *other* ADR works today. Amending ADR-0029
does not, and **an agent may not repair it** — `brain/project/decisions/**` is
Tier 3. That half of #676 is the maintainer's.

**#676 has an order, and it is not negotiable.** Repair ADR-0029 first, *then*
add the structural test over all signed ADRs. The test is born red, and shipping
a guard together with the exemption that makes it pass is the apparent protection
`cites-resolve.test.mjs` exists to refuse (#499). The test must call
`checkSingleStatusLine` — it now exists in `amendment-draft.mjs`, so **do not
re-derive the rule**.

---

## 4 · What just landed — do not redo this

Between 2026-08-14 and 2026-08-16, 17 pull requests merged and 16 issues closed.
The whole memory cluster and the whole review loop went out.

| Area | Closed | What it means for you |
|---|---|---|
| Memory sharing | #657 #641 #637 #636 #634 #633 #635 | `.engram/` works from any worktree; readers declare what they collapse; the 139 duplicate lines are reconciled to zero |
| Memory merge | **#677** | **One record per file.** The `merge=union` driver is no longer load-bearing — the conflict class was removed, not survived (ADR-0017 Amendment 2) |
| Review loop | #604 #575 #552 | Reviewer coldness is verifiable with a negative control; cold review is a *stage* with a posted outcome; the refuter fails closed |
| Reviewer output | **#683** | Every verdict declares which classes of control ran — `conditions: []` no longer reads as "reviewed, nothing found" |
| Promote | **#675 #674** | §3, Route A |
| Install path | **#627 #601** | `day:start` asks the registry, not git tags; `REFUSE` protects a path on the release that first ships it |
| Doctrine | #671 (ADR-0031) | §2, the attribution rule |

---

## 5 · The four lines, and what is next in each

The cut is the product's value chain, not the epic's milestones: **install ·
work · remember · manage.**

### Line 1 · Installation — 10 open · *one step from done*

The repo **is already public**, the package is `@logikas/brain` with a `files`
allowlist, and `private` is off. Everything that can be prepared is prepared.

**#435 is the whole line, and it is not an agent task.** Measured today:

```
publish.yml workflow runs . . . 0
registry @logikas/brain . . . . 404   (control: express → 200)
```

The dispatch needs `NPM_BRAIN_TOKEN` scoped to `@logikas/*` and a verified real
install. **Only the maintainer can do it.** Everything else in the line —
#659 #658 #647 #436 #415 #414 #643 #316 #632 — sits behind or beside it and is
ordinary work.

### Line 2 · Workflow — 36 open · *the largest and most structural*

The review loop closed. What is left is one layer down: **what guarantees that
what the loop signs is valid.**

- **Doctrine (§3):** #676, #673.
- **Reviewer:** #682 is the largest item in the reviewer's roadmap and **starts
  with a ruling, not with code** — the independence axis for the challenger.
  Its own body says the scoping is the deliverable. Then #631 #612 #606 #284 #611.
- **SDD chain:** `#599 → #312 → #576 → #323 → #456`. Untouched for three
  snapshots, still the only lever on the two weakest product axes, still unblocked.
- **Ticket authority:** #545 #564 #124 #600 #588 #131.
- **Guards:** #569 #560 #559 #489 #488 #453 #603 #602 #335 #336 #348 #349 #129 #117.
  Mutually independent — the best parallel-agent material in the repo.

> **#599 may not need `promote` at all.** Its step 1 says measure before writing:
> does an SDD role port exist in the tree? **#312, which is that ticket, is still
> open**, which points at its branch (2) — reword the two `docs/inbox/**`
> citations or record ADR-0023 as a permanent gap. Measure before queueing it
> behind anything.

### Line 3 · Memory — 4 open · *the cluster is empty*

Seven tickets closed in two days, then #677 removed the merge-conflict class
entirely. What remains is unrelated to sharing: #247 (→ #256, the C4 migration
that also unblocks the Antigravity adapter), #461, #361, and #638 (i18n).

### Line 4 · Management — 9 open · *untouched across three snapshots*

- **#639** breaks the instrument this line is made of: `parseGraphBlock` reads
  the *first* fence, so a code block above the graph hides the whole node from
  the epic map. The map lies by omission until this lands.
- #457 (token-cost measurement) gains from an early start — the measurement
  window only grows. 17 PRs in two days is exactly the window being wasted.
- #280 #268 #327 · #356/#357 (Q2/Q3) · #313 (this epic) · #642 (i18n).

---

## 6 · Suggested order

| # | Work | Why here |
|---|---|---|
| **0** | **#435 dispatch** — *human only* | The only item that has not moved in three snapshots, and the only one nobody else can do. Everything around it is paid for |
| **1** | **#676** — repair ADR-0029 (human), then the structural test (agent) | Malformed signed doctrine ships to consumers today, and it is unamendable by the sanctioned route. §3 |
| **2** | **#673** | Same family: `actor-check`'s deny branch cannot distinguish "not sufficient" from "never read" — you cannot diagnose a refusal |
| **3** | **#682 ruling** — *human* | Largest reviewer item. The independence axis must be decided before any code; `escalate: human` already works and is free, which may be the right first slice |
| **4** | `#599 → #312 → #576 → #323 → #456` | The SDD lever. Unblocked, untouched, and the three ADRs are designed together |
| **5** | #639 · #612 · #606 · #631 · #545 | Cheap, and each protects an instrument the rest of the work runs on |
| **6** | #659 #658 #647 · #569 #560 #559 · #605 #642 #638 · #643 #632 | Mutually independent — parallel-agent material. Includes the i18n theme |
| **7** | #247 → #256 · #280 · #457 · #436 #415 #414 · #335 #336 | Off the critical path; #457 gains from an early start |

**i18n crosses three lines and is half a day total:** #605 (the SDD scaffold
emits Spanish and never reads `docs.language`, which is `en` here — 85 of 91
authors rewrote it by hand), #642 (`day:start`), #638 (duplicate-report strings
live in code instead of the catalogs). All three are visible to anyone adopting
brain, and none is hard.

---

## 7 · What only the human can do

1. **Fire the #435 publish** and close it.
2. **Repair ADR-0029** by hand (#676 part 1) — Tier 3, and the sanctioned route
   is the one that refuses the file.
3. **Rule the independence axis of #682** before any code is written.
4. **Sign 13 unapproved tickets:** #631 #600 #588 #361 #357 #356 #349 #348 #327
   #280 #268 #129 #117. (`#588` carries `status:needs-review`, which is not a
   signature.) Nothing here can start without it, and an agent may never apply
   the label.
5. **Rule #117** (Bitbucket) — closing it with the decision recorded is the
   standing recommendation — and **ratify Q2/Q3** (#356/#357). Q2 is worth more
   now that the repo is public.

---

## 8 · The pattern worth carrying forward

The seven tickets opened on 2026-08-15 all say one sentence in different words:

> **A rule enforced only on the write path does not measure the artefacts that
> are already there** — and a check that cannot report *why* it failed reads
> exactly like a check that passed.

That is #575's own thesis, applied to the machinery #575 left running. #676
found it in signed ADRs, #674 in a guard whose surface excluded its subject,
#673 in a deny branch, #683 in a verdict that could not say it was mechanical-only,
#661 in a version check that had been inert since the package rename.

When you finish a ticket here, the question that has paid off every time is not
"does my change work?" but **"is this an incident, or a rate?"** — #676 exists
because someone asked it about #675.

---

**Sources:** this file is derived from the GitHub API (59 issues, 0 PRs), `git log`
over `982f544..3eff9af`, and live probes of the npm registry, the publish workflow
and the signed ADRs on disk. Where it conflicts with #313, **#313 wins**; where it
conflicts with the tree, **the tree wins**.
