# brain — Master Plan (1.0 cut → 1.1 line)

> ## ⚠️ SNAPSHOT — not the source of truth
>
> This file was written **before the v1.0.0 cut** and frozen at commit `c85386a`
> (2026-07-24 14:19). The cut happened at 22:01 the same day; decisions taken after that
> point are **not** reflected in the sections below except where explicitly patched.
>
> **The source of truth is issue #313** (the epic body). On any conflict, #313 wins.
> Do not plan from this file alone — open #313 first, then use this file for the detail
> it links to (audit, epic breakdown, reviewer comparison).

> Consolidated record of the 2026-07-24 audit + planning session. Single entry point so nothing is
> lost. Detailed docs linked inline; decisions and tickets captured here in full.

---

## 1. Where we are (audit verdict)

v2.0.0 is **mergeable** — the substance is sound and heavily tested (~1.6x test-to-src). The debt
is **integrity of wiring/docs + install/update hardening**, not deep code defects. Full audit:
[`brain-v2-merge-audit.md`](./brain-v2-merge-audit.md).

### Design-conformance scorecard (7 product premises vs code) — avg ~63%

| # | Premise | % | Verdict |
|---|---------|---|---------|
| 1 | Harness-agnostic | 60 | Real port; default not neutral; doesn't reach `day:start` |
| 2 | SDD-agnostic + stage config | 40 | **Weakest** — engine routes only `init`; stages hardcoded |
| 3 | External reviewer + refuter | 45 | Boundary sound; flow guarantees **inert in prod** (#317) |
| 4 | Memory-agnostic | 90 | **Strong** — engram+plainfiles, portable, integrity |
| 5 | VCS-agnostic | 75 | Cleanest port; rung-2/3 GitHub-only |
| 6 | Project-flow visibility | 55 | Pieces exist; `brain:status` (#280) not built |
| 7 | Evolutive memory in repo | 85 | **Strong** — `.memory/records` git-native |
| 8 | Minimize tokens | 50 | Design intent; **unmeasured** (no `brain:metrics`) |

Strong axes (already product-grade): memory (4), evolutive memory (6), VCS (5).
Weakest: SDD stage configuration (2) and reviewer flow (3).

---

## 2. Release strategy (decided)

**Cut 1.0 now, adopted by a controlled pilot** (own repos / Sinergia). Because the environment is
controlled, auto-update-safety does NOT block 1.0 — the upgrade risk is self-owned and closes in
1.1. Numbering: public tag starts at **1.0**; next line is **1.1** (not 2.1 — `v2.0.0` was the
internal branch name).

```
[trim G4 + ADR-0024 + KNOWN-LIMITATIONS]  ← this PR
        → merge feature/v2.0.0 → main + tag 1.0   ← maintainer action
        → 1.1 line = the epic (M2…M8), chained PRs
        → [GATE: auto-update-safety] → open to external adopters
```

**Hard gate before external adoption:** rollback/atomic-write, clobber-safety, corrupt-file lockout.
Until then, each adopter is hand-held.

---

## 3. The epic (1.1 line) — milestones

Full plan: [`brain-v2-epic-plan.md`](./brain-v2-epic-plan.md). Epic tracking issue: **#313**.

| M | Milestone | Tickets |
|---|-----------|---------|
| M0 | Housekeeping | close #217/#222, #314 (dup 267 dir), `.gitignore` chunks (#247) |
| M1 | Merge-integrity gates (G1–G4) | G3 #305 ADR-0024 ✓ + G4 trim ✓ **landed in 1.0** · G1 #210 + G2 #94 **still open — deferred to 1.1** |
| M2 | Decoupling reaches the user | #123, #315 (hook dedup), #316 (.env unify) |
| M3 | Reviewer = real code-review (the moat) | #284, **#317** (CRITICAL), inline per-line comments |
| M4 | Distribution + self-update to product bar | npx init, registry, adopt S2, upgrade-safety (rollback/clobber/lockout) |
| M5 | Role-as-port (C) | #312 — owns the decision record; `0023` reserved, unpromoted draft at `brain-drafts/adr-0023-sdd-role-port.md` |
| M6 | Provider parity | #130, #124, #131, #129 |
| M7 | Backlog & scope | #268, #280, #263, #256, #247, #117 (close/defer), test brain-to-engram |
| M8 | Per-stage SDD engine routing | **no ticket yet** — amends/supersedes ADR-0019; depends on M5 |
| M9 | Governance observability | **no ticket yet** — `brain:metrics`; premise #8 scores 50% because nothing is measured |

Suggested 1.1 order (patched after the cut — supersedes the line originally published here):

`#210 → M2 → M3 → M4 → M5 → M8 → M9 → M6(rest) → M7`, with M0 running in parallel.

**#210 leads the line**: at the v1.0.0 cut `release.yml` returned `failure` because it fires on the
tag *after* the tag already exists, so it cannot block — the release-integrity gate is decorative
until this is fixed. M9 has no dependency and may start any time; an earlier start buys a longer
measurement window.

---

## 4. Key decisions (this session)

1. **Role-as-port then reference roles (C→B).** brain owns a role *contract* (a port), gentle-ai +
   plain implement it with a parity test; a first-party reference role set (B) is a later third
   implementer, not a replacement. #312 · number `0023` reserved for it; the only artifact today is
   the unpromoted draft `brain-drafts/adr-0023-sdd-role-port.md`.
2. **Per-stage engine routing (M8).** A configurable `stage → engine` map (e.g. `sdd-new →
   gentle-ai`, `sdd-verify → brain-sdd`). This is the alternative ADR-0019 rejected → needs a new
   ADR consciously superseding it. Artifact contract stays fixed.
3. **Reviewer gets inline per-line comments** (`brain-review/2` `comments[]`, GitLab discussions
   parity, stays `event:COMMENT` per ADR-0020). M3 · see [`reviewer-mechanisms-comparison.md`](./reviewer-mechanisms-comparison.md).
4. **Hybrid → 1.0/1.1 split** (superseded the earlier "cut after M1+M2" plan).

---

## 5. Reviewer mechanisms: judgment-day vs brain-reviewer

They are **complementary**: judgment-day is a *confidence* mechanism (dual blind consensus kills
false positives, ephemeral, can fix); brain-reviewer is a *flow* mechanism (persistent, provider-
neutral, non-authoritative). A judgment-day run over the reviewer **confirmed (2 judges)** that the
reviewer's flow guarantees are inert in prod (#317) — the strongest argument for adding a **panel
mode** (dual consensus) to the reviewer for high-stakes verdicts. Detail:
[`reviewer-mechanisms-comparison.md`](./reviewer-mechanisms-comparison.md).

---

## 6. Ticket map (created / referenced this session)

- **#313** epic · **#312** role-as-port · **#317** reviewer CRITICAL
- **#314** dup 267 dir · **#315** hook dedup · **#316** .env unify
- Gates: **#210** (G1) · **#94** (G2) · **#305** (G3+G4 — ADR-0024 + trim landed in this PR)
- Backlog: #123, #124, #129, #130, #131, #247, #256, #263, #268, #280, #117 (scope decision)
- Housekeeping: close #217, #222 (code merged; open only due to non-default-branch no-autoclose)

---

## 7. This PR (1.0 release-prep)

- `ADR-0024` — three-axis decoupling (G3) + `HOME.md` index entry.
- Trim the phantom `openai/opencode/pi` platform allow-list (G4).
- `docs/KNOWN-LIMITATIONS.md` — honest 1.0 pilot scope.
- This master plan + the three detailed docs (audit, epic, reviewer comparison).

*Persistent memory mirror of all of the above lives in engram under topic keys
`architecture/v2-*`, `review/*`, `architecture/*-routing`.*
