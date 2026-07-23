# Tasks — Rung-3 Auto-Revert Guardrails (Track D / slice D2)

> **Regenerated against design v2 (`design.md`, engram `sdd/issue-259-d2/design` #881) and spec v2
> (`spec.md`, engram `sdd/issue-259-d2/spec` #880)**, per the owner ruling that REPLACED R-1
> (engram `decision/issue-259-d2-R1-replacement-tree-effect` #901): automatic resolution is proved by
> **TREE EFFECT ONLY** — never a commit trailer, never ancestry (`merge-base --is-ancestor`). The
> **only** other resolution path is the recorded human gate. Chain = **5 PRs, stacked to
> `feature/v2.0.0`**, each <400 counted lines, **no `size:exception`** (owner ruling #901, design §9.2).
>
> **Strict TDD Mode is ACTIVE for this project.** Test runner: `npm test`. Every code task below is
> RED (failing test, committed or at least run-and-recorded) → GREEN (minimal implementation) → committed
> as one work-unit commit, per `work-unit-commits` and `chained-pr` skills.
>
> **Adversarial-test doctrine is binding** (engram `doctrine/adversarial-test-derivation` #900, REQ-D2-14):
> every fixture below is a SHAPE TO CONSTRUCT copied from design §7, not an assertion to invent at apply
> time. Each resolution fixture (A1–A6, C1) **MUST be run against `scrap/d2-v1-broken`'s `cursor.mjs`
> (the shipped ancestry-only fix, commit `eff4560`) and shown to REDDEN there** before it counts as
> coverage — a fixture that stays green against `eff4560` is not a proof, it is the same self-confirming
> failure the review caught. **Fixtures MUST be derived from the attack shapes documented in design §7
> verbatim, never reverse-engineered from `resolution.mjs`'s own implementation after the fact** — write
> the fixture's assertions before writing the predicate's body wherever the ordering is achievable, and
> flag every A/C-series fixture for an independent reviewer's confirmation before merge (doctrine #900
> rule 3: the patch author must not be the sole author of its own adversarial fixtures).
>
> Docs English (ADR-0009). GitLab-port discipline: platform-neutral core under
> `brain/scripts/governance/postmerge/`, thin GitHub-coupled wrapper stays in the YAML only.

---

## 0. What is invalidated from the prior `tasks.md`, and what survives (design §10)

| Old phase | Disposition |
|---|---|
| **Phase 1** (cursor core: `readCursor`/`resolveWindow`/`advanceCursor`/`isRevertedInRange`/`acceptManually` v1 shape) | **INVALIDATED.** `isRevertedInRange`, `findTrailerCandidates`, `trailerRegex` are deleted from the design as discriminators (§3.0). `resolveWindow`'s `eventName`/`before` branching is replaced by always-`cursor..HEAD`. Superseded by **PR 1** below. |
| **Phase 2** (`parse-failures.mjs`) | **SURVIVES**, content re-derived (never `git cherry-pick`ed — see §9.3 note below), lands in **PR 3**. |
| **Phase 3** (`brain-audit.mjs` emission + `isRevertedInRange`-based skip + narrow R-2 exit-2) | **INVALIDATED** in its resolution mechanism (trailer-based skip is gone), but the emission print and the `gitOrThrow` range-load exit-2 site are salvaged into **PR 3** against the new `isResolvedAt` predicate. |
| **Phase 4** (workflow wiring: v1 dual-path cursor resolution, sha7-keyed dedup) | **INVALIDATED.** Rewritten wholesale as **PR 4** against the tri-state cursor + PR-keyed dedup + per-offender boundary. |
| **Phase 5** (synthetic fixtures for the v1 bug shapes: tag-move, multi-merge, repeated-cycle, missing-cursor, uncomputable-range, human-accept) | **INVALIDATED as a fixture set** (built for the v1 mechanism) but the **underlying bug shapes they targeted are re-expressed** as B1–B6 / C1–C6 below, now proven against tree-effect + tri-state cursor instead of trailer + `rev-parse`. |
| **Phase 6** (GitLab-porting draft) | **SURVIVES verbatim.** Re-lands in **PR 1** (0 counted lines — `openspec/changes/**` is ignored). |
| **Phase 7** (Slice 1 gate) | **SUPERSEDED** by the per-PR gates below (one gate per PR, not one per 2-slice half). |
| **Phase 8** (`exit-codes.mjs`) | **SURVIVES**, unchanged design, lands in **PR 5**. |
| **Phase 9** (`run-check.mjs` wiring) | **SURVIVES**, unchanged design, lands in **PR 5**. |
| **Phase 10** (`brain-audit.mjs` general top-level catch → 2) | **SURVIVES**, folded into **PR 3**'s brain-audit work (the catch-to-2 change is now part of the same file's rewrite, not a separate later phase). |
| **Phase 11** (workflow numeric exit capture + 0/1/2 branch) | **SURVIVES** in substance, folded into **PR 4**'s wholesale workflow rewrite. |
| **Phase 12** (drift-guard, both-fixtures) | **SURVIVES**, unchanged design, lands in **PR 5**, joined by the STANDING harness-isolation registry that generalizes PR 4's D1/D2 fix (see PR 4/PR 5 split note in design.md §14, Plan Deviation, 2026-07-14). |
| **Phase 13** (Slice 2 gate) | **SUPERSEDED** by the per-PR gates below. |

**On `scrap/d2-v1-broken` (the preserved 8-commit tip, forensic reference only — engram #893):** two
things are confirmed clean and are **re-derived by reading the branch, never by `git cherry-pick`**
(cherry-picking would import the `github-actions[bot]` mis-authorship and drag the contaminated
trailer/ancestry shape into the new commits):

- **F1 pattern** — route `AUDIT_STDOUT` via `env:`, never splice `${{ }}` into a `run:` block (the CWE-94
  fix from `5a6ee2b`). Re-lands inside **PR 4**'s workflow rewrite.
- **F5 regex** — `^\[FAIL-SHA\] ([0-9a-f]{40})$`, full-sha only, from the original `parse-failures.mjs`.
  Re-lands inside **PR 3**'s `parse-failures.mjs`.

Also salvaged from `5a6ee2b` into **PR 4** (design §9.3): the full-sha dedup branch key. **Dropped
entirely**: `eff4560` (the ancestry-only theater — its tests are self-confirming and are not ported), the
`cursor-precheck` step and duplicate push-path loud-issue step (obsoleted by the unified
always-`cursor..HEAD` window + core CAS).

---

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | PR1 ≈155 · PR2 ≈150 · **PR2b ≈100–140** (net-tip-effect amendment to `resolution.mjs` ONLY, owner ruling #957) · PR3 ≈100 · PR4 ≈235 · PR5 ≈105 (counted; tests + `openspec/changes/**` excluded per `governance.ignoreList`) |
| Total across chain | ≈780–820 counted lines, none of it in one PR |
| 400-line budget risk | **Low for every PR, including PR2b.** Largest remains PR4 at ~235/400 (~59%). PR2b is the smallest code-bearing slice in the chain — a single-file amendment (`resolution.mjs` only; `resolution.test.mjs` is `governance.ignoreList`d), forecast ~100–140/400 (~25–35%) — comfortable headroom. |
| Chained PRs recommended | **Yes — mandatory** (owner ruling #901). The PR2b insertion itself is **doctrinal, not a budget call** (owner ruling #957) — foundation-before-consumer and an isolated hostile review for the invariant, independent of line count. Feature-branch-chain rejected: the tracker's single integration diff would be ~800 lines, needing the `size:exception` the proposal forbids. |
| Chain strategy | **stacked-to-main**, 6 PRs (PR1 · PR2 · PR2b · PR3 · PR4 · PR5), each merging to `feature/v2.0.0` in order (owner ruling #901, extended by #957) |
| Decision needed before apply | **No** — chain strategy, no-exception constraint, and the PR2b insertion shape are already owner-adjudicated (#901, #957). Apply proceeds directly against the 6-PR split, PR2b next. |

### Dependency diagram

```
feature/v2.0.0
   └── PR 1  cursor core (git-seam + cursor state machine + CAS)         ~155  [git-seam.mjs, cursor.mjs, GitLab draft]
        └── PR 2  revert resolution (diff-inversion)                     ~150 [resolution.mjs — security-critical]
             └── PR 2b  net-tip-effect amendment (owner ruling #957)  ~100–140  [resolution.mjs ONLY — still unused]
                  └── PR 3  brain-audit: emission + skip classes + exit-2 (rebased onto PR2b)  ~100  [parse-failures.mjs, brain-audit.mjs]
                       └── PR 4  workflow wrapper (only GitHub-coupled PR)     ~235  [governance-postmerge.yml rewrite]
                            └── PR 5  0/1/2 contract across all evaluators     ~105  [exit-codes.mjs, run-check.mjs, drift-guards]
```

Each PR's own section below states: start state, end state, prior dependency, what remains out of scope,
and rollback scope — per the `chained-pr` output contract.

---

## PR 1 — Cursor core (`git-seam.mjs` + `cursor.mjs`), ~155 counted lines

**Depends on:** nothing (first PR in the chain; base = `feature/v2.0.0`).
**End state:** the core is tested and **unused** — no other file imports it yet. The pre-D2 workflow is
untouched and behaves exactly as it does today. Rollback = revert this PR alone; nothing downstream exists
yet to be affected.
**REQs bound:** REQ-D2-1, REQ-D2-2, REQ-D2-11, REQ-D2-15; REQ-D2-9 (draft re-lands here, 0 counted).
**Fixtures:** B1–B6 (design §7.2).

### Phase 1.1 — `postmerge/git-seam.mjs` (NEW, design §4)

- [x] 1.1.1 RED: `git-seam.test.mjs` — `gitTry(argv)` never throws on non-zero exit; returns
      `{ status, stdout, stderr }` for a command that exits 0, a command that exits with a documented
      non-zero code (e.g. `ls-remote --exit-code` against a ref that does not exist → status 2), and a
      command that exits with an unrelated failure code (e.g. unreachable remote → 128).
- [x] 1.1.2 GREEN: implement `gitTry(argv)` as a thin `execFileSync` wrapper that captures `status` instead
      of throwing.
- [x] 1.1.3 RED: `gitOrThrow(argv)` — returns stdout on status 0; throws an `Error` carrying `.status` when
      non-zero.
- [x] 1.1.4 GREEN: implement `gitOrThrow` on top of `gitTry`.

### Phase 1.2 — `postmerge/cursor.mjs` tri-state read (REQ-D2-2, REQ-D2-11)

`readCursor` is **remote-authoritative and single-call**: exactly one
`git ls-remote --exit-code origin refs/governance/audit-cursor`. There is no fetch step, no local
`rev-parse`, and no `syncCursor` helper — the remote's own answer is the entire state machine.

- [x] 1.2.1 RED (**fixture B1** — the tautological-test trap, reproduced): construct a **bare "origin" repo
      with the cursor ref SET on it**, clone it with a **plain `git clone`** (which, exactly like
      `actions/checkout`, fetches only `refs/heads/*` + tags). **First assert the local `git rev-parse`
      against the unfetched ref FAILS** — this proves the fixture reproduces the real production shape,
      not a strawman. **Then** run `readCursor` — a single `ls-remote --exit-code` call, nothing else —
      and assert it returns `{ state: 'present', sha }`, with `sha` parsed directly from `ls-remote`'s own
      stdout (`<sha>\t<ref>`), never from the (still-unfetched, still-unresolved) local ref.
- [x] 1.2.2 RED (**fixture B2**): a bare origin with **no** cursor ref at all. Assert `readCursor` returns
      `{ state: 'absent' }` (from `ls-remote --exit-code` status 2 — git's documented "no matching refs").
- [x] 1.2.3 RED (**fixture B3**): an origin URL pointing at a **nonexistent path** (unreachable — any
      `ls-remote` status other than 0 or the documented 2). Assert `readCursor` returns
      `{ state: 'unknown' }` and explicitly assert it is **NOT** `absent`.
- [x] 1.2.4 RED: `ls-remote --exit-code` returns status 0, but the sha parsed from its own stdout is
      malformed/missing (a corrupted or unexpected answer). Assert `{ state: 'unknown' }` — never silently
      downgraded to `absent`, and never a crash.
- [x] 1.2.5 GREEN: implement `readCursor({ git })` as the tri-state machine (§2.1) — one `ls-remote
      --exit-code` call, sha parsed from its stdout on status 0 — satisfying 1.2.1–1.2.4.

### Phase 1.3 — `resolveWindow` always `cursor..HEAD` (REQ-D2-1)

- [x] 1.3.1 RED: `resolveWindow({ git, head })` on a `present` cursor at `C` with `head = H` returns
      `{ state: 'present', base: C, range: 'C..H', head: H }` — **regardless of any `eventName`/`before`
      argument passed** (there must be no push/schedule branch left to pass).
- [x] 1.3.2 RED (**fixture B6**): a cursor sha that is **NOT an ancestor of HEAD** (simulates a rewritten
      `main`). Assert `resolveWindow` returns `{ state: 'unknown', reason: 'cursor is not an ancestor of HEAD' }`.
- [x] 1.3.3 RED: cursor state is `absent`/`unknown` (from Phase 1.2). Assert `resolveWindow` propagates the
      state without computing a range.
- [x] 1.3.4 GREEN: implement `resolveWindow` (§2.2) satisfying 1.3.1–1.3.3.

### Phase 1.4 — `advanceCursor` as atomic CAS, REMOTE ONLY (REQ-D2-15)

`advanceCursor` writes **only** via `git push --force-with-lease`. There is no local `update-ref` step: a
plain checkout has no local governance ref to CAS against, and a local CAS would only mask the remote
lease's own guarantee (§2.3).

- [x] 1.4.1 RED (**fixture B4**): a repo with **NO** cursor ref on origin. Call
      `advanceCursor({ git, from: <40-hex>, to })`. Assert it **throws** (the remote lease rejects a
      `from` that cannot match an absent ref's null OID — never auto-creates) and the ref **still does not
      exist on origin** afterward, asserted directly against the core (not the YAML).
- [x] 1.4.2 RED: `advanceCursor` called with a non-40-hex `from` (e.g. `undefined`, short sha). Assert it
      throws before touching git.
- [x] 1.4.3 RED: `advanceCursor` with `from` that is not an ancestor of `to`. Assert it throws (the cursor
      only ever moves forward).
- [x] 1.4.4 RED (**fixture B5** — two-clone cross-runner race): two **independent clones** of the same
      origin both observe the cursor at `C0`. Clone A advances `C0→C1` and wins. Clone B, still holding the
      stale `C0`, calls `advanceCursor({ from: C0, to: C2 })`. Assert clone B's call **fails**, that the
      rejection comes from the **push** itself (never a local ref — there is none to check), and that the
      remote cursor is unchanged at `C1` (the winner) afterward.
- [x] 1.4.5 GREEN: implement `advanceCursor` (§2.3) — remote-only CAS via
      `git push --force-with-lease=<ref>:<from> origin <to>:<ref>`, no local `update-ref` — satisfying
      1.4.1–1.4.4.
- [x] 1.4.6 RED + GREEN: `acceptManually({ git, from, to, reason })` — throws/refuses when `reason` is
      empty or `from` is not 40-hex; otherwise echoes `reason` to stdout and performs the SAME remote-only
      CAS advance as 1.4.5 (§2.4), using the **caller-supplied `from`** (the human's own assertion of the
      cursor value they reviewed — never read from the live cursor). Include a fixture on a **plain
      checkout with no local governance ref at all**: assert `acceptManually` still succeeds via the remote
      lease alone — this is the production shape the human escape hatch must work on.
- [x] 1.4.7 RED + GREEN: CLI mode — `node postmerge/cursor.mjs window` prints exactly one of
      `PRESENT <base> <head>` / `ABSENT` / `UNKNOWN <reason>` and exits `0` (present) or `2` (absent/unknown);
      `node postmerge/cursor.mjs accept <sha> --reason "<text>"` invokes `acceptManually`; missing
      `--reason` exits non-zero with a usage message.

### Phase 1.5 — GitLab-porting constraint draft (REQ-D2-9, survives verbatim from old Phase 6)

- [x] 1.5.1 Write/re-confirm `openspec/changes/issue-259-d2/brain-drafts/gitlab-porting-constraint.md`
      stating rung-3 auto-revert must not port to GitLab until D2's fixes land, and that the GitLab port
      covers PR-time gates (`GOVERNANCE_JOBS`) only.
- [x] 1.5.2 Confirm (no code): no ADR / `brain/core/` / PLAN file is touched by this PR — human co-promotes
      the draft separately (pattern #216). Confirm via `git status` before commit.

### Phase 1.6 — PR 1 gate

- [x] 1.6.1 `npm test` — the **full suite**, green. No scoping restriction: on this (reset) branch,
      `release-postmerge-workflows.test.mjs` is the clean 145-line base — no `probeScript`, no
      identity-poisoning `spawnSync`, no execution of extracted workflow lines. That hazard was introduced
      by D2's OWN now-discarded v1 work (`scrap/d2-v1-broken`), not by anything on this branch or in the
      environment (owner Ruling 1, engram #902 — verified with file:line git evidence). Running the full
      suite from the real worktree is safe in this PR.
- [x] 1.6.2 Budget check: `git-seam.mjs` + `cursor.mjs` counted lines ≈155 (test files and
      `openspec/changes/**` excluded per `governance.ignoreList`) — confirm ≤400, no `size:exception`.
- [x] 1.6.3 `memory:share` before push, per house convention.
- [x] 1.6.4 Push, open PR 1 into `feature/v2.0.0`. Dependency diagram in the PR body marks PR 1 with 📍.

---

## PR 2 — Revert resolution: whole-commit diff-inversion (`resolution.mjs`), ~150 counted lines

**Depends on:** PR 1 merged (uses `git-seam.mjs`'s `gitTry`/`gitOrThrow`).
**End state:** `resolution.mjs` is tested and **still unused** by `brain-audit.mjs` (that wiring is PR 3).
This is deliberate: design calls this **"the entire security thesis of this change"** and wants it isolated
for a hostile review that answers exactly one question — *can this be forged?*
**REQs bound:** REQ-D2-10, REQ-D2-10a. **This PR is the checkpoint gate for REQ-D2-10a** (task requirement
5 below) — the violation-class table (design §3.5) must be verified with code evidence before this PR's
gate passes.
**Fixtures:** A1–A6 (design §7.1).
**Fixture-authorship caveat (doctrine #900, binding):** every A-series fixture below is copied verbatim
from design §7.1's shape column — do not derive a fixture from `resolution.mjs`'s own implementation after
writing it. Flag this PR for an independent reviewer to confirm each fixture matches the attack shape
before merge.

### Phase 2.1 — `changedPaths` and the anti-vacuity guard (§3.2)

- [x] 2.1.1 RED: `changedPaths(rev, { git })` returns the set of paths from
      `git diff --no-renames --name-only -z <rev>^1 <rev>` for a synthetic commit touching 2 files.
      **[STALE-SUPERSEDED — net-parity, `49fd4dd → 29ca6dc → 5987840`]**: `changedPaths`'s path-set diff
      read no longer exists under that name; the read it fed was replaced by whole-diff-TEXT comparison.
      Current home: `normDiff` (`resolution.mjs:140`).
- [x] 2.1.2 GREEN: implement `changedPaths`.
      **[STALE-SUPERSEDED]**: rewritten as `normDiff` (`resolution.mjs:140`) under the net-parity design
      (design §15.3); path-set diffing was replaced by whole-diff-text comparison to close the #916
      rename-bypass (proof at `resolution.test.mjs:184`).
- [x] 2.1.3 RED (**fixture A4** — anti-vacuity): a merge `M` with a genuinely **empty diff** (zero changed
      paths). Assert `isResolvedAt` returns `{ resolved: false, reason: 'offender has no changed paths' }`
      — never a vacuous pass.
      **[STALE-SUPERSEDED]**: the F-1 anti-vacuity guard now keys on `dO === ''` (offender's own
      first-parent `normDiff`), not a changed-paths set. Current home: `resolution.mjs:269-273`
      (`isResolvedAt`'s first branch) and `resolution.test.mjs:150` (`'F-1 — an empty-diff offender is
      refused by the anti-vacuity guard, never a vacuous pass'`).
- [x] 2.1.4 GREEN: implement the anti-vacuity guard as the first branch of `isResolvedAt`.
      **[STALE-SUPERSEDED]**: still the first branch of `isResolvedAt` today, but gated on the `dO === ''`
      first-parent-contribution condition, not a `changedPaths` empty set. Current home:
      `resolution.mjs:269-273`; duplicated on the exported `netPresent`/`sign` primitives per F-1's
      export-surface contract (`resolution.mjs:197-204,237-241`).

### Phase 2.2 — `isResolvedAt` — the tree-effect predicate (§3.2, REQ-D2-10)

- [x] 2.2.1 RED (**fixture A1** — the security-critical fixture, reddens against `eff4560`): construct
      offender `M` on `main` (adds a payload file at path `P`). Then construct an **ordinary commit `X` on
      the same lineage** — a REAL descendant of `M` (forked AFTER `M`, the realistic linear-main shape,
      never forked before `M`) — whose commit body contains `This reverts commit <M>.` and whose diff
      **does not touch `P`**. Assert `isResolvedAt(M, X)` is **`false`**. **Then run the identical fixture
      against `scrap/d2-v1-broken`'s `cursor.mjs` (`eff4560`) and record that it goes RED there** (`X` is a
      descendant of `M`, so `merge-base --is-ancestor` wrongly passes and `eff4560` skips `M`) — this
      RED-against-the-prior-fix result is the actual proof this task exists to produce, not merely
      "fails on unfixed code."
      **[STALE-SUPERSEDED — net-parity, `49fd4dd → 29ca6dc → 5987840`]**: the `P ∩ D = ∅` path-set
      predicate this fixture proved sound against `eff4560` was itself superseded by whole-diff-TEXT
      net-parity after judgment-round-1 (#916) found a rename bypass against `P ∩ D = ∅`. The A1
      security-critical role is carried today by `resolution.test.mjs:184`
      (`'pure rename does NOT resolve the offender (the #916 bypass shape)'`), proved against
      `isResolvedAt` (`resolution.mjs:269`).
- [x] 2.2.2 GREEN: implement `isResolvedAt(offender, tip, { git })` per §3.2 — `P = changedPaths(offender)`,
      `D = changedPaths` between `offender^1` and `tip`, `resolved ⟺ P ∩ D = ∅`, reading **no** commit body.
      Confirm 2.2.1's assertion (against the new code) now passes: `M` stays flagged.
      **[STALE-SUPERSEDED]**: `isResolvedAt` no longer computes `P ∩ D = ∅` — it was rewritten to the
      net-parity predicate `netPresent(offender, tip) ≤ 0` by Phase 2b.2.5. Current home:
      `resolution.mjs:269-273` (`isResolvedAt`), built on `netPresent` (`resolution.mjs:237`) and `sign`
      (`resolution.mjs:197`).
- [x] 2.2.3 RED (**fixture A2** — liveness): offender `M`, then a **real `git revert -m 1 M`** merged onto
      `main`. Assert `isResolvedAt(M, tip)` is `true` — the mechanism must not pin on a genuine revert.
- [x] 2.2.4 RED (**fixture A3**): `M` touches paths `P1` and `P2`. A revert restores **only `P1`**. Assert
      `isResolvedAt` is `false` — partial reverts do not resolve.
- [x] 2.2.5 RED (**fixture A5**): `M` reverted by `R` (genuine, `A2`-shaped), then a **later commit re-adds
      the payload** to the same path. Assert `isResolvedAt(M, <that later tip>)` is `false` — the predicate
      is anchored at the tip and sees the re-introduction. (This is a liveness property the trailer approach
      could never have had.)
      **[C-e AUDIT — false-at-merge, now covered]**: this checkmark was false at PR2 merge time — no A5
      fixture existed in `resolution.test.mjs` (confirmed by Phase 2b.1's own finding note above). A5
      predicate coverage EXISTS TODAY at `resolution.test.mjs:763`
      (`'A5 — a fresh re-add after a genuine revert is NET-PRESENT: offender NOT resolved at the re-add
      tip'`), closed by Phase 2b.1.1/2b.1.2's `netPresent`-based rewrite, not by the code this task
      originally claimed. This false-at-merge checkmark is the named class the C-e ledger audit
      (governance issue #297) exists to catch.
- [x] 2.2.6 GREEN: confirm 2.2.2's implementation already satisfies 2.2.3–2.2.5 with no further code (these
      are properties of the same `P ∩ D = ∅` predicate, not separate branches) — if any fails, the
      implementation is wrong, not the test.
- [x] 2.2.7 Drift-guard: assert `isRevertedInRange`, `findTrailerCandidates`, `trailerRegex` do **not** exist
      anywhere under `governance/postmerge/` (grep-based static assertion) — a mechanical trip-wire against
      the exact regression this PR exists to prevent.

### Phase 2.3 — `isReverterOf` — the reverter-skip (§3.3, REQ-D2-10a)

- [x] 2.3.1 RED (**fixture A6**): construct an `adrPresence`-shaped offender `M` (adds an ADR file without
      `brain/HOME.md`) and its genuine tree-effect-verified auto-revert `R` (which would otherwise itself
      fail `adrPresence`, since removing an ungoverned ADR without `HOME.md` re-triggers the XOR), landing
      in the SAME window. Assert `isReverterOf(M, R, { git })` is `true`. **Also** construct a merge that
      merely **claims** (via commit message) to be a revert of `M` but has **no tree effect** on `M`'s
      paths; assert `isReverterOf` is `false` for it.
- [ ] 2.3.2 GREEN: implement `isReverterOf(offender, candidate, { git })` on the **same normDiff base** as
      `isResolvedAt` (§3.3, redesigned): `isReverterOf` is true iff `normDiff(candidate, candidate^1) ===
      normDiff(offender^1, offender)` (both non-empty) — the candidate's own first-parent contribution is the
      exact patch-inverse of the offender's. No new mechanism, no forgeable signal. A **pure rename's**
      contribution is not `¬O`, so it is **not** crowned reverter → no self-exempt `[SKIP]` (closes C5).

### Phase 2.4 — Checkpoint gate: violation-class → mechanism mapping (REQ-D2-10a, design §3.5)

This is the mandatory checkpoint named in the design's owner ruling. **This PR does not pass its gate
without it.**

- [x] 2.4.1 RED + GREEN: **`diffSize`-shaped scenario** — a synthetic offender `M` whose own diff exceeds
      the line budget; a genuine revert of `M` restores its paths. Assert `isResolvedAt` returns `true`
      (mechanism **B — tree-effect skip**). Assert with code evidence (a comment or an assertion message
      citing design §3.5) that this is the SAME predicate used for every class, not a `diffSize`-specific
      branch.
- [x] 2.4.2 RED + GREEN: **`adrPresence` forward-fix — THE OWNER'S CASE.** Offender `M` flagged for
      `adrPresence` (`M`'s own changed path is `P`, an ADR file). A **later commit adds the missing
      `brain/HOME.md`** at a DIFFERENT path `Q` (a forward-fix, never touching `P`). Assert
      `isResolvedAt(M, <that later tip>)` is **`false` forever** — the forward-fix commit's contribution is
      not the patch-inverse of `M` (`normDiff(fix, fix^1) !== normDiff(M^1, M)`), and no other merge inverts
      `M` either. This is the explicit code-level proof that the mechanism **fails closed** on a forward-fix class: it
      must NEVER be marked resolved, and the only path that clears `M` is the human gate
      (`accept --reason`), which is **outside** `resolution.mjs`'s concern (it lives in `cursor.mjs`, PR 1).
- [x] 2.4.3 Confirm (no code, assertion of design intent): write a short table-driven test or a comment
      block in `resolution.test.mjs` enumerating all 4 classes (`diffSize`, `issueLink`, `adrPresence`,
      `memoryPresence`) against the mechanism each maps to (tree-effect | re-eval | human-gate | exit-2),
      citing design §3.5's table, so a future reader sees the mapping is deliberate, not incidental.
      `memoryPresence`'s "never tree-effect, re-eval only" claim is a repo-global property outside
      `resolution.mjs`'s per-offender predicate — this task documents that boundary explicitly rather than
      writing a test resolution.mjs cannot meaningfully express; the cross-file wiring proof (memoryPresence
      is never even evaluated against a reverted offender) lands in PR 3 (§ Phase 3.2).

### Phase 2.5 — PR 2 gate

- [x] 2.5.1 `npm test` — the **full suite**, green (no scoping restriction — see PR 1's 1.6.1 note: the
      harness leak does not exist on this branch until D2's own PR 4 authors new workflow-extracting tests,
      and PR 4 authors them born isolated).
- [ ] 2.5.2 Budget check: `resolution.mjs` counted lines ≈150 (149 added vs HEAD) — confirm ≤400, no `size:exception`.
- [ ] 2.5.3 Independent-review flag: this PR's description must explicitly ask the reviewer to confirm
      each A-series fixture matches design §7.1's attack shape (doctrine #900 — the patch author should
      not be the sole confirming authority on their own adversarial fixtures).
- [ ] 2.5.4 `memory:share` before push.
- [ ] 2.5.5 Push, open PR 2 against `feature/v2.0.0` (stacked after PR 1). Dependency diagram marks PR 2
      with 📍.

---

## PR 2b — Net-tip-effect amendment (`resolution.mjs` ONLY), ~100–140 counted lines

**Owner ruling #957 (Option 2), doctrinal not budgetary:** a dedicated amendment PR reopens the MERGED PR2
surface at its source — foundation-before-consumer, source-not-shim. The invariant earns its own isolated
hostile review the same way PR2 did; PR3 REBASES onto this PR's merged output next and is never developed
in parallel against the superseded pairwise predicate.

**Depends on:** PR 2 merged (reopens `resolution.mjs` on `feature/v2.0.0`, Fork A — design §15.4: fixed
inside the predicate's own module, never a downstream wiring gate).
**End state:** `resolution.mjs`'s resolution/exemption primitives are anchored to the NET tree state at
HEAD (net-parity, design §15.3) instead of a single pairwise `∃`-inverse match. `resolution.mjs` is
**still unused** by `brain-audit.mjs` — that rebase is PR3's next unit of work, not this PR's. `normDiff`
and the F-1 anti-vacuity guard are preserved **byte-for-byte** (the kernel is untouched; only the
aggregation changes).
**REQs bound:** **REQ-D2-16** (new — net-tip anchor); **REQ-D2-10** (amended — net-parity replaces the
single pairwise inverse match). REQ-D2-14 binds cross-cutting: every fixture below is finder-authored (not
the patch author) and MUST redden against the **MERGED PR2 pairwise predicate** — the new mutation bar this
PR introduces — not merely against `eff4560`.
**Fixtures:** A5 (amended semantics — closes a real gap, see 2b.1), A7 (THE CRITICAL), A8 (liveness), C3
(4 range-boundary sub-fixtures) — all design §15.7/§15.8.
**Out of scope for this PR (deferred to PR3's rebase):** any `brain-audit.mjs` change —
`reverterSkipLine`, the `isOffender` gate deletion, `[FAIL-SHA]` class-filtering + newest-carrier dedup,
the `failCount`/tree-keyed⟺`[FAIL-SHA]` bidirectional coherence guard, and fixture **A9** (class-filtered
emission is a brain-audit-level property, not a predicate-level one).
**Fixture-authorship caveat (doctrine #900, binding, same as PR2's 2.5.3):** every fixture below is copied
from design §15.7/§15.8's shape columns, not reverse-engineered from this PR's own implementation after
writing it. Flag this PR for an independent reviewer to confirm each fixture matches the attack shape
before merge.

### Phase 2b.1 — Close the A5 gap: fresh (non-revert-structured) re-add after a genuine revert (REQ-D2-10, design §15.7)

**Finding surfaced while mapping this PR:** the prior tasks.md Phase 2.2.5 claimed an "A5" fixture (`M`
reverted by `R`, then a later commit re-adds the payload; assert `isResolvedAt(M, later)` is `false`) was
completed — but **no such fixture exists in `resolution.test.mjs` today** (verified: zero matches for
"A5"/"re-add"/"fresh" in the file). Under the MERGED PR2 pairwise predicate this fixture actually reddens
the OPPOSITE way from what Phase 2.2.5's prose claimed: the loop finds `R` (whose reverse diff matches
`pO`) and returns `resolved: true` **regardless of the later re-add**, because the `∃`-existence check never
re-examines whether the match still holds at the tip. This is exactly the A5 semantic FLIP owner condition
1/5 (C5) requires naming in the PR body: **"O resolved, re-add flagged" → "O NOT-resolved."**

- [ ] 2b.1.1 RED (**A5, gap-closing, finder-authored**): construct `M` (adds payload at path `P`),
      `R = git revert -m1 M` (merged `--merge`, genuine), then `F` — an ORDINARY later merge that re-adds
      the SAME payload to `P` (NOT itself `git revert`-structured, just a fresh commit reintroducing the
      content). Assert `isResolvedAt(M, F)` is `{ resolved: false }`. **First run this identical fixture
      against the MERGED PR2 predicate (current `resolution.mjs`, pre-amendment) and record that it returns
      `{ resolved: true }`** — this RED-against-the-merged-predicate result, not merely a RED against
      un-fixed code, is the proof this task exists to produce (mirrors 2.2.1's `eff4560` proof, one
      predicate generation later).
- [x] 2b.1.2 GREEN: implemented by 2b.2's `netPresent`-based rewrite of `isResolvedAt` (no A5-specific
      branch — this is a property of net-parity, matching PR2's 2.2.6 precedent). Confirm 2b.1.1 passes
      against the amended code with no dedicated implementation. (A5 frozen fixture now GREEN: `isResolvedAt(M, F)`
      = `{ resolved: false }`; was `{ resolved: true }` under the merged PR2 pairwise predicate.)

### Phase 2b.2 — `netPresent` / rewritten `isResolvedAt` — directional net-parity (design §15.3, REQ-D2-16, REQ-D2-10)

- [x] 2b.2.1 RED (patch-author white-box, below the frozen block): `sign(W, s)` (or an equivalent internal helper) — given candidate merge `W`'s own
      first-parent contribution `fW` and a target signature `s`: `fW === s` → `+1`; `fW === inverse(s)` →
      `-1`; otherwise `0`. Unit-test directly against three synthetic merges (re-add, invert, unrelated
      rename) — do not fold this into an end-to-end-only assertion. (Implemented as `sign(fW, s, sInv)`;
      `sInv` passed precomputed since a diff's exact reverse is a distinct git computation, not a textual reversal.)
- [x] 2b.2.2 GREEN: implement `sign`. (Exported `sign(fW, s, sInv)` in `resolution.mjs`; white-box test GREEN.)
- [x] 2b.2.3 RED (patch-author white-box): `netPresent(O, tip, { git })` on a bare offender `O` (no candidates after it) returns `1`
      (O's own base term, no cancellation) — `isResolvedAt(O, O, { git })` is `{ resolved: false }`.
- [x] 2b.2.4 RED (patch-author white-box): `netPresent(O, tip)` on `O, R` (single genuine revert, PR2's A2 shape) returns `0` —
      `isResolvedAt(O, R)` is `{ resolved: true }` (liveness re-run of A2 against the amended code — confirm
      no regression).
- [x] 2b.2.5 GREEN: implement `netPresent(offender, tip, { git }) = 1 + Σ_{W ∈ (offender, tip]} sign(W,
      dOffender)`, and rewrite `isResolvedAt` to: keep the F-1 anti-vacuity guard **byte-for-byte** as the
      first branch; then `resolved: netPresent(offender, tip) <= 0`. Confirm 2b.1.1, 2b.2.3, 2b.2.4 all
      pass. Re-run PR2's existing fixtures unmodified (F-1, C2, pure-rename, rename+modify, copy-launder,
      partial-revert, invert+extra, drift-liveness, F-2 binary ×2, whitespace, F-4 ×3, blast-radius ×4,
      diffSize-shaped, adrPresence-forward-fix, HOSTILE-ENV ×2) — **every one MUST still pass**, since
      net-parity is a strict refinement of the pairwise check (a single inverse candidate still yields
      `netPresent ≤ 0` when nothing re-adds afterward); a failure here is a bug in the rewrite, not the
      fixture. (All 37 frozen/pre-existing tests GREEN; full `npm test` 1541/1541.)
- [x] 2b.2.6 Update the module header doc comment and `isResolvedAt`'s docstring: replace the `∃ R`
      existence description with the net-parity aggregation (design §15.3) — the kernel (`normDiff`) prose
      is UNCHANGED; only the aggregation-level description changes. Cite design §15.3/REQ-D2-16.

### Phase 2b.3 — `netAddFull` — full-window primitive for the reverter-skip (design §15.3, groundwork for PR3's `reverterExempt`)

This PR only builds and unit-tests the **primitive**; wiring it into `brain-audit.mjs`'s `reverterSkipLine`
(replacing `isReverterOf`/`isOffender`) is PR3's rebase work, not this PR's.

- [x] 2b.3.1 RED (patch-author white-box): `netAddFull(candidate, { git, from, to })` (full-window signed count of `candidate`'s OWN
      payload signature: `|{W ∈ [from,to] : fW == dCandidate}| − |{W ∈ [from,to] : fW == inverse(dCandidate)}|`)
      on a bare `R` with nothing else in the window returns `0` when `R` is the sole genuine revert of an
      offender inside the window — the A6 shape (PR2's reverter fixture), re-expressed as a net-parity
      count instead of a pairwise match. (`[from, to]` is a CLOSED interval — window base at/before O
      inclusive — so the offender behind R is counted.)
- [x] 2b.3.2 RED (patch-author white-box, **A7 core primitive assertion** — see 2b.4 for the full end-to-end fixture): on the
      `O, R, R2` chain (`R2` re-adds `O`'s exact payload via `git revert -m1 R`), `netAddFull(R2, { git,
      from: O, to: R2 })` is `+1` (NOT exempt).
- [x] 2b.3.3 GREEN: implement `netAddFull`. Decide and document (comment, citing design §15.9's "or expose
      the primitive brain-audit.mjs composes") whether it fully owns window enumeration internally or
      exposes a lower-level enumeration primitive for PR3 to compose — either is acceptable; the invariant
      (full-window signed count) must live in `resolution.mjs`, not be re-derived by the caller. (Decision:
      `netAddFull` OWNS its window enumeration internally via `firstParentMergesInclusive` — the full-window
      signed count lives entirely in `resolution.mjs`; PR3 composes `reverterExempt` on top of it, adding
      the `dC ≠ ''` guard + `TREE_KEYED_CHECKS` restriction. Documented in the JSDoc.)
- [x] 2b.3.4 Retire the PAIRWISE `isReverterOf` export: either delete it and its dedicated test
      (`resolution.test.mjs`'s "isReverterOf — a genuine auto-revert is a reverter..." test) in favor of an
      equivalent `netAddFull`-based assertion, or explicitly mark it superseded with a comment pointing to
      `netAddFull`. **Do not leave two divergent reverter predicates alive and both exported** — one must be
      canonical. (A drift-guard proving `brain-audit.mjs` no longer imports the retired export is only
      meaningful after PR3 rebases — record as a PR3 follow-up note here, not implemented in this PR since
      `brain-audit.mjs` is out of scope.) (Decision: MARKED SUPERSEDED, not deleted — the `isReverterOf`
      export, its frozen import, and its pre-existing dedicated test are FROZEN for this PR and cannot be
      edited; a `⚠ SUPERSEDED by netAddFull` JSDoc block now points to the canonical primitive. PR3
      FOLLOW-UP: delete `isReverterOf` + its test and add the `brain-audit.mjs` no-import drift-guard once
      the wiring rebase lands. Canonical reverter predicate is `netAddFull`.)

### Phase 2b.4 — Fixture A7 (THE CRITICAL — revert-of-revert re-adds the payload), design §15.8, REQ-D2-16

- [ ] 2b.4.1 RED (**A7, finder-authored per REQ-D2-14 — not the patch author**): construct `O` = an
      `adrPresence`-shaped offender (ADR file, no `brain/HOME.md`, valid issue ref — the exact path shape
      design §15.8 specifies, so the predicate-level proof is faithful to the real attack even though
      `resolution.mjs` itself never evaluates `adrPresence`). `R = git revert -m1 O` (merged `--merge`) —
      genuine, its own contribution is `O`'s exact inverse. `R2 = git revert -m1 R` (merged `--merge`) —
      re-adds `O`'s EXACT payload. Assert, at HEAD = `R2`: `isResolvedAt(O, R2)` is `{ resolved: false }`
      (`netPresent(O, R2) = 1 + (−1) + (+1) = 1`); `netAddFull(R2, { git, from: O, to: R2 })` is `+1` (NOT
      exempt — the reverter-skip must not crown `R2`). **MUTATION BAR (hard, REQ-D2-16 binding):** run this
      identical fixture against the MERGED PR2 pairwise `isResolvedAt` (the code as it stands before this
      PR's Phase 2b.2 GREEN) and record it returns `{ resolved: true }` for `O` — proving the CRITICAL
      exists in the predicate this PR amends, not only in `eff4560`. Without this exact `O, R, R2` forge,
      the redesign is UNPROVEN (owner condition 2, #955/#957).
- [x] 2b.4.2 GREEN: confirm 2b.2.5/2b.3.3's implementation already satisfies 2b.4.1 with no A7-specific
      branch (net-parity is a general aggregation, not a special case for this chain shape) — if it fails,
      the implementation is wrong, not the fixture. (A7 frozen fixture GREEN: `isResolvedAt(O, R2)` =
      `{ resolved: false }` — `netPresent(O, R2) = 1 + (−1) + (+1) = 1`; `isResolvedAt(R, R2)` =
      `{ resolved: true }`; `isResolvedAt(R2, R2)` = `{ resolved: false }`. White-box `netAddFull(R2, {from:O, to:R2})`
      = `+1` (NOT exempt). Was `{ resolved: true }` for O under the merged PR2 predicate — mutation bar confirmed RED→GREEN.)
- [ ] 2b.4.3 Independent-reviewer flag: this fixture is the probative core of the entire PR — call it out
      explicitly in the PR description for a second pair of eyes (doctrine #900 rule 3), distinct from the
      general PR2b-gate flag in Phase 2b.7.

### Phase 2b.5 — Fixture A8 (liveness — an even revert chain settles), design §15.8

- [ ] 2b.5.1 RED (**A8**): construct `O, R, R2, R3`, each a genuine `--merge` revert of the prior (`R`
      reverts `O`, `R2` reverts `R`, `R3` reverts `R2`). Assert at HEAD = `R3`: `isResolvedAt(O, R3)` is
      `{ resolved: true }` (`netPresent(O, R3) = 1 + (−1+1−1) = 0`). **Mutation bar:** include a second
      assertion/comment demonstrating a NAIVE over-correction ("any re-add ⟹ never resolved") wrongly
      returns `false` here — so a future author cannot "fix" A7 by banning all re-adds.
- [x] 2b.5.2 GREEN: confirm no further code needed (same predicate, liveness property). (A8 frozen fixture
      GREEN: `isResolvedAt(O, R3)` = `{ resolved: true }` — `netPresent(O, R3) = 1 + (−1+1−1) = 0`; no
      A8-specific branch.)

### Phase 2b.6 — C3 range-boundary fixtures (4 sub-fixtures, design §15 REQ-D2-16 scenarios, directional vs full-window asymmetry)

- [ ] 2b.6.1 RED (**C3-a, off-by-one at both range ends**): position `R` (the exact inverter of `O`) (i)
      immediately adjacent to `O`'s own commit boundary and (ii) exactly at `tip`. Assert `netPresent(O,
      tip)` in both placements correctly includes `O`'s own `+1` base term exactly once (never
      double-counted) and the HEAD-most inverter exactly once (never dropped) — `isResolvedAt` resolves
      `true` in both placements.
- [ ] 2b.6.2 RED (**C3-b, offender exactly at HEAD is never wholesale-skipped**): `O` positioned exactly at
      `tip` (`(O, tip]` is empty by construction). Assert `isResolvedAt(O, O)` is `{ resolved: false }` (the
      directional range excludes `O` as its own canceller — the merge-HEAD case named in design §15).
      Separately, assert `O` positioned exactly at the window start is still fully counted as the `+1` base
      (not silently dropped).
- [ ] 2b.6.3 RED (**C3-c, live re-add at HEAD reaches the checks — predicate-level half**): the HEAD-most
      merge is itself a live re-add (net-present). Assert `isResolvedAt` on the ORIGINAL offender it re-adds
      is `{ resolved: false }` at that tip — a live re-add at HEAD is never retroactively resolved away.
      **(The companion half — that `memoryPresence`/other checks then run on the un-skipped HEAD merge — is
      a `brain-audit.mjs` wiring property and is explicitly OUT OF SCOPE here; deferred to PR3.)**
- [ ] 2b.6.4 RED (**C3-d, revert-cleanup at HEAD still sees the offender behind it — full-window
      asymmetry**): construct a legit cleanup revert `R` sitting at `tip` (nothing after it) with offender
      `O` behind it in the window. Assert `netAddFull(R, { git, from: <window base at/before O>, to: R })`
      is `≤ 0` (exempt) — the FULL-WINDOW range sees `O` behind `R`, unlike the directional range used by
      `isResolvedAt`. Pair this with an explicit assertion that a DIRECTIONAL-ONLY count (counting only
      `(R, tip]`, which is empty) would wrongly NOT exempt `R` — demonstrating why the two ranges must
      differ (design §15.3's "why the ranges differ" note).
- [x] 2b.6.5 GREEN: confirm 2b.2.5/2b.3.3 satisfy all four C3 sub-fixtures with no additional branches —
      each is a property of the already-implemented directional/full-window range definitions, not new
      logic. (C3(a)/(b)/(c)/(d) frozen fixtures all GREEN; white-box range-asymmetry test GREEN:
      `netAddFull(R, {from:O, to:R}) = 0` (full-window exempt) vs `netPresent(R, R) = 1` (directional
      net-present) — the two ranges correctly differ.)

### Phase 2b.7 — Drift guards, doc housekeeping, and PR2b gate (owner conditions 4/5, #955/#957)

- [ ] 2b.7.1 RED + GREEN: extend the existing drift-guard (`resolution.test.mjs`'s
      "isRevertedInRange/findTrailerCandidates/trailerRegex are absent" test) with a BEHAVIORAL regression
      guard against the old pairwise wording being silently reintroduced — the living guard is 2b.1.1's A5
      gap fixture itself (a textual grep for "existence" wording is too brittle); confirm it stays in the
      permanent suite, not a throwaway proof.
- [ ] 2b.7.2 Confirm `normDiff` and `firstParentMergesAfter` are UNCHANGED byte-for-byte from the merged
      PR2 version — diff the function bodies explicitly in the PR description as evidence (design §15's
      "kernel preserved verbatim" claim, code-verified not just asserted).
- [ ] 2b.7.3 PR body MUST NAME the A5 semantic FLIP explicitly: **"O resolved, re-add flagged" → "O
      NOT-resolved"** — with the reason (owner condition 5/C5: the prior assumption that the re-add is
      independently caught as a new offender via its own audit is FALSE for revert-structured re-adds,
      where the reverter-crowning exempts it; net-parity fixes this at the invariant's source). Also record
      the diagnosis (design §15's "seventh mechanism-present-function-hollow instance," a LOCAL
      `∃`-predicate answering a GLOBAL "present at HEAD?" question) and the doctrine ("a merged predicate
      that turns out forgeable is amended at its source, never patched downstream — merged ≠ correct,
      merged = passed the gates we had").
- [x] 2b.7.4 Own judgment-day for PR2b before push (owner condition 4, #957): a dedicated adversarial review
      round, brief centered on (a) the range asymmetry (C3, all four boundaries), (b) the bounded soundness
      claim (REQ-D2-16's "do NOT inflate" clause — net-parity proves net-absence under exact-`normDiff`
      accounting, never a whole-tree-disk claim), and (c) the three forges: `O,R,R2` (A7), `O,R,R2,R3` (A8),
      and the global-gap worked example (design §15.3's table row — predicate-level only; the
      `memoryPresence` half is PR3's).
- [ ] 2b.7.5 `npm test` — full suite, green.
- [x] 2b.7.6 Budget check: `resolution.mjs` diff counted lines (≈100–140 forecast; `resolution.test.mjs`
      excluded per `governance.ignoreList`) — confirm ≤400, no `size:exception`. Measured after the 3
      post-judgment doc/guard fixes: **+185/−38 = 223** counted vs `feature/v2.0.0` (above the 100–140
      forecast, driven by the exported-vacuity F-1 contract JSDoc + guards; ~56% of the 400 budget). No
      `size:exception` needed.
- [ ] 2b.7.7 Independent-review flag (doctrine #900): this PR's description must explicitly ask the
      reviewer to confirm A5/A7/A8/C3 each match design §15.7/§15.8's attack shapes verbatim — the patch
      author is not the sole confirming authority.
- [ ] 2b.7.8 `memory:share` before push.
- [ ] 2b.7.9 Push, open PR 2b against `feature/v2.0.0` (stacked after PR 2, ahead of PR 3's rebase).
      Dependency diagram in the PR body marks PR 2b with 📍, and explicitly states: PR 3 is NOT yet rebased
      onto this PR — that rebase is the next unit of work after this PR merges (owner ruling #957 sequence:
      PR2b apply → judgment-day → push+PR → owner cold review → human merge → PR3 rebase → wiring).

---

## PR 3 — `brain-audit.mjs` wiring: emission, skip classes, exit-2 (~100 counted lines)

**Depends on:** PR 1 (cursor core, unused directly here) and PR 2 (`resolution.mjs`, now imported).
**End state:** the core goes **live via the CLI** — `npm run brain:audit` now emits `[FAIL-SHA]`, skips
genuinely-reverted offenders via `isResolvedAt`, skips reverter merges via `isReverterOf`, and reports
uncomputable states honestly (exit 2, message on stdout). **No workflow (YAML) change yet.**
**REQs bound:** REQ-D2-3 (emission), REQ-D2-5.
**Fixtures:** A1–A6 (end-to-end, through `brain-audit.mjs` rather than unit-level on `resolution.mjs`), C3,
C6.

> **DEFERRED REWORK NOTE (owner ruling #957, added by this tasks pass — NOT detailed here):** this PR's
> checklist below (Phases 3.1–3.4) was written BEFORE the PR2b net-tip-effect amendment and reflects the
> now-superseded pairwise predicate (`isReverterOf` retired in PR2b §2b.3.4; REQs bound must gain
> REQ-D2-10a's amended class filter and REQ-D2-6(b)'s amended coherence guard, per spec.md's Gate table
> PR3 row). PR3 REBASES onto PR2b's merged `resolution.mjs` and gets its OWN judgment-day round (the NEW
> bidirectional `crossCheck`, C4) before this checklist is trusted again — do not resume Phase 3.x work
> directly from the checkboxes below without that rebase + review pass first. Full rework of this section
> is a separate `sdd-tasks` pass, out of scope for the PR2b slice this update maps.

### Phase 3.0 — HARD GATE (BLOCKING — PR3 CANNOT SHIP WITHOUT THIS): net-parity reverter-skip, design §15.3, REQ-D2-16, REQ-D2-10a

> **BLOCKING GATE — recorded from PR2b's own judgment-day (owner ruling #964, judge forge #963).**
> PR2b's net-parity `resolution.mjs` invariant forged CLEAN in isolation, but Judge A forged an
> end-to-end catastrophe that survives THROUGH `brain-audit.mjs`'s `reverterSkipLine`, which still
> composes the direction-blind PAIRWISE `isReverterOf` (retired in PR2b §2b.3.4): `isReverterOf(R,O) ==
> isReverterOf(R,R2) == true` crowns BOTH `O` and `R2` as "revert of R" → all `[SKIP]`, exit 0, with the
> offending file LIVE on disk at HEAD. The catastrophe is PR3-scoped (the `reverterSkipLine` wiring is
> absent from `feature/v2.0.0`; PR2b does not introduce it), so it is a HARD PR3 GATE, not a PR2b defect.
> **These two tasks SUPERSEDE the now-invalid `isReverterOf` wiring recorded as done in Phase 3.2.6 and
> MUST be closed before PR3 opens. Do NOT mark PR3's gate (Phase 3.4) green while either remains open.**

- [ ] 3.0.1 **Rewrite `reverterSkipLine` from the direction-blind `isReverterOf` → the directional
      full-window `netAddFull`** (BLOCKING). Replace the pairwise `isReverterOf` composition in
      `brain-audit.mjs`'s `reverterSkipLine` with the FULL-WINDOW `netAddFull` primitive from
      `resolution.mjs` — exempt ⟺ `dC ≠ '' AND netAddFull(C, { git, from, to }) ≤ 0`, restricted to
      `TREE_KEYED_CHECKS`, supplying the inclusive window base `from` per design §15.3's range-asymmetry
      note — and delete the `isReverterOf` / `isOffender` pairwise enumeration (plus the `brain-audit.mjs`
      no-import drift-guard promised in PR2b §2b.3.4).
      **Named RED proof (Judge A forged exactly this — engram #963):** add a **diffSize-shaped A7
      end-to-end fixture** to `brain-audit.test.mjs`: `O` adds a **>400-line file**, `R = git revert -m1 O`,
      `R2 = git revert -m1 R` (re-adds O's exact payload). At `HEAD = R2` the audit **MUST NOT** emit
      all-`[SKIP]` / exit 0 — the ungoverned >400-line file is LIVE on disk, so `O`/`R2` must be reported
      (`[FAIL-SHA]`); only `R` may legitimately be `[SKIP]`.
      **Mutation bar (non-negotiable):** this fixture MUST redden against the CURRENT `isReverterOf`-based
      `reverterSkipLine` (all `[SKIP]`, exit 0) and go GREEN only after the `netAddFull` rewrite.
- [ ] 3.0.2 **Fix the A6 test's lying title** (BLOCKING — documentary-lie family). `brain-audit.test.mjs`'s
      A6 test is titled "closes the revert-of-revert loop" but only exercises `O + R + claim` — the title
      claims MORE than the test proves (another "the title claims more than the test" instance the owner
      flags). EITHER extend the A6 test to a REAL `O, R, R2` chain (proving the revert-of-revert loop is
      actually closed end-to-end), OR retitle it honestly to describe what it truly asserts (a single
      `O + R` reverter skip). Do not leave the mismatched title in place.

### Phase 3.1 — `parse-failures.mjs` (REQ-D2-5, re-derived from `scrap/d2-v1-broken`, never cherry-picked)

- [ ] 3.1.1 RED: `parse-failures.test.mjs` — `parseFailingShas(text)` extracts full 40-hex shas from
      `[FAIL-SHA] <sha>` lines using the **F5 regex** `^\[FAIL-SHA\] ([0-9a-f]{40})$` (re-read from
      `scrap/d2-v1-broken`, re-typed fresh — not `git cherry-pick`ed, to avoid importing the
      `github-actions[bot]` mis-authorship). Order-preserving, deduped via `Set`, ignores
      malformed/short (sha7) lines. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.1.2 GREEN: implement `parseFailingShas`. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.1.3 RED + GREEN: CLI mode reads stdin, prints deduped full-sha list one per line; tested against
      synthetic stdin, zero real process spawn in the assertion itself. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)

### Phase 3.2 — `brain-audit.mjs`: emission + resolved-skip + reverter-skip (REQ-D2-3, REQ-D2-10, REQ-D2-10a)

- [ ] 3.2.1 RED: emission test — a synthetic offending merge produces both `[FAIL] <sha7> ...` (unchanged)
      and the new `[FAIL-SHA] <full-sha>` line. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.2.2 GREEN: add the additive `[FAIL-SHA]` print at the existing `[FAIL]` emission site. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.2.3 RED (**A1–A5 end-to-end**): re-run fixtures A1, A2, A3, A5 (Phase 2.2/2.1) through
      `brain-audit.mjs`'s actual CLI/module entry point rather than calling `resolution.mjs` directly —
      proves the wiring, not just the predicate. A1 must again be shown to redden against
      `scrap/d2-v1-broken`'s equivalent `brain-audit.mjs` wiring (which used `isRevertedInRange`). (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.2.4 GREEN: import `isResolvedAt` from `resolution.mjs` and add the pre-evaluation skip class
      (symmetric to the existing pre-baseline skip), reporting `[SKIP] <sha7> — resolved by revert`. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.2.5 RED (**A6 end-to-end**): the reverter-skip fixture (Phase 2.3) run through `brain-audit.mjs` —
      an `adrPresence` offender `M` and its genuine auto-revert `R` in the same window; assert `R` is
      `[SKIP] revert of M`. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.2.6 GREEN: import `isReverterOf`, wire the reverter-skip evaluation (only for merges that already
      failed one of the four checks — zero cost on the happy path). **Apply-time hardening beyond the
      literal task text**: an unrestricted "any merge in the window" candidate search let a NEW, illegitimate
      re-add offender (A5's shape) get wrongly exempted by matching a clean, non-offending, legitimate revert
      merge as its "M" (a real gap, caught by the A5 fixture below, not a test artifact — see apply-progress).
      Fixed by gating the matched `M` on an independent `isOffender` check (does `M`'s own diff fail >=1 of
      the four checks, computed commit-body-only) before accepting the skip. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.2.7 RED: **memoryPresence skip-precedence proof** (closes Phase 2.4.3's cross-file note) — a
      reverted offender `M` in a window where `memoryPresence` would also fail repo-globally; assert `M`
      is skipped via tree-effect **before** `memoryPresence` runs on it, while a **different, un-reverted**
      merge in the same window still gets a real `memoryPresence` evaluation (the pre-evaluation skip is
      per-offender, not a global bypass). (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.2.8 GREEN: confirm/adjust evaluation ordering so tree-effect skip precedes the four checks
      per-offender, per §3.5's skip-precedence note. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)

### Phase 3.3 — Fail-closed catch and salvaged exit-2 (REQ-D2-6, REQ-D2-12)

- [ ] 3.3.1 RED (**fixture C3**): inject a top-level throw in `brain-audit.mjs` (e.g. a crashing `git log`
      for the range load — the salvaged `gitOrThrow` site from the prior branch). Assert exit code is
      **2** (not 1, not 0), and the uncomputable message is written to **stdout** (not stderr). (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.3.2 GREEN: change the top-level catch to `process.exit(2)` with the message on stdout; confirm the
      salvaged `gitOrThrow` range-load site (from `scrap/d2-v1-broken`, re-derived not cherry-picked) still
      produces exit 2 against the new `git-seam.mjs`. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.3.3 RED (**fixture C6**): `brain-audit.mjs` would exit 1, but the emission path is made to produce
      **zero** `[FAIL-SHA]` lines (a crash mid-emission). Assert the cross-check treats this as
      uncomputable (exit 2), never a silent no-op that goes green with nothing reverted. Implemented as a
      direct RED/GREEN unit test on the exported, pure `crossCheckExit(anyFail, failShaCount)` — the same
      function the real CLI uses at its one call site (not a spawn-level reconstruction of a mid-emission
      crash, which has no natural single-process trigger distinct from C3). (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.3.4 GREEN: add the count cross-check — `code === 1` requires `≥1` parsed offender or the run is
      itself uncomputable. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.3.5 RED (**root-commit fail-closed, structured — closes point 7 / C5**): construct a window whose
      offender is (pathologically) the **root commit** — it has no first parent, so `normDiff(offender^1, …)`
      cannot be computed. Assert the offender is treated as **uncomputable → exit 2** (a loud, honest
      not-resolved), **not** an unhandled exception and **never** a silent skip. The predicate MUST NOT
      resolve a commit whose contribution it cannot even read. **Documented deviation**: verified empirically
      (see apply-progress) that git's shallow/graft/commit-tree machinery makes a `--merges`-qualified commit
      with a genuinely unresolvable `^1` unconstructible without the WHOLE range-load itself throwing first
      (indistinguishable from C3) — `--merges`/`--min-parents=2` classification is itself computed via the
      SAME graph-walk machinery that zeroes a shallow-boundary commit's effective parent count, and
      `commit-tree` eagerly validates parent existence, refusing a forged bogus parent. The RED/GREEN test is
      therefore written directly against the exported `resolvedSkipLine` wiring function (the actual per-merge
      call site) using a real shallow-fetch-created offender whose `^1` is genuinely unresolvable, proving the
      throw propagates un-swallowed rather than reconstructing the (unconstructible) full `--merges` path. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.3.6 GREEN: make the missing-parent case a **structured fail-closed** outcome, not an ad-hoc
      `try/catch` swallow: `resolution.mjs` returns an uncomputable/`{ resolved: false }` signal on a missing
      `^1` (the `git-seam` non-zero status is surfaced, not collapsed), and `brain-audit.mjs` maps it to the
      same exit-2 uncomputable path as 3.3.2 — the fail-closed principle (design §5) applies structurally, so
      the root-commit case cannot become a sixth fail-open. Cite design §4 (seam returns status, never a
      vacuous verdict) in the assertion message. **No `resolution.mjs` change made**: it already surfaces the
      uncomputable state by THROWING (git-seam's non-zero status attached, never collapsed) rather than
      returning a `{resolved:false}` value — that throw IS the surfacing this task calls for. `brain-audit.mjs`
      does not try/catch it locally; `resolvedSkipLine` deliberately propagates, so the throw reaches the
      general top-level fail-closed catch (3.3.2) and maps to exit 2. The separate, pre-existing "no parent1"
      branch (used by the four-checks' own diff inputs) was ALSO hardened from a silent `[SKIP] — no parent`
      to a loud `exit(2)` for defense-in-depth, even though it is now provably unreachable via this exact
      throw path (resolvedSkipLine's throw fires first for any sha whose `^1` cannot be read). (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)

### Phase 3.4 — PR 3 gate

- [ ] 3.4.1 `npm test` — the **full suite**, green (no scoping restriction — see PR 1's 1.6.1 note).
      Measured: 1523/1523 GREEN. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.4.2 Budget check: `parse-failures.mjs` + `brain-audit.mjs` diff counted lines — measured 48 + 127 =
      **175** counted lines (above the ≈100 forecast, due to the additional `isOffender` hardening in
      3.2.6 and dense fail-closed rationale comments matching this file's existing house style) — confirm
      ≤400: **yes, comfortably** (~44% of budget). No `size:exception` needed. (SIGNED DEBT — impl lives only on archive/d2-pr3-superseded-9233880, never merged to feature/v2.0.0; rebuilt greenfield by PR3)
- [ ] 3.4.3 `memory:share` before push.
- [ ] 3.4.4 Push, open PR 3 against `feature/v2.0.0` (stacked after PR 2). Dependency diagram marks PR 3
      with 📍.

---

## PR 4 — Workflow wrapper rewrite (`.github/workflows/governance-postmerge.yml`), ~235 counted lines

**Depends on:** PR 1–3 (the core is fully live via the CLI; this PR makes the workflow call it).
**End state:** **the mechanism is live and correct end-to-end.** This is the **only GitHub-coupled PR** in
the chain — a GitLab wrapper becomes a pure translation of this one file.
**REQs bound:** REQ-D2-3/4 (dedup + orphan cleanup), REQ-D2-6 (workflow-side normalization + terminal-state
assertion), REQ-D2-11 (the shallow-clone `merge-base` constraint, Phase 4.1.5 — binding, owner ruling),
REQ-D2-12, REQ-D2-13; REQ-D2-14 (fixture C1 + the D1/D2 harness-isolation fix, since this is
the first PR that touches workflow YAML and therefore the first PR that must touch the test harness which
extracts and executes it).
**Fixtures:** C1, C2, C4, C5, D1, D2.

### Phase 4.0 — Workflow-extracting tests are BORN ISOLATED (design §7.4; owner Ruling 1, engram #902)

On this (reset) branch, `release-postmerge-workflows.test.mjs` is the clean 145-line base: no `probeScript`,
no execution of extracted workflow lines, no identity-poisoning `spawnSync`. That hazard existed only in
D2's own now-discarded v1 work (`scrap/d2-v1-broken`) and is **not present here**. This PR is the FIRST
place any workflow-extracting test is authored on this branch, because it is the first PR that touches
`.github/workflows/governance-postmerge.yml` (design §7.4) — there is no workflow to extract from before
now, and consequently no leaking harness to "fix." **Isolation is therefore an acceptance criterion of the
test task itself, not a separate later phase or follow-up fix**: every
`spawnSync('bash', <extracted workflow script>)` this PR adds MUST pass `cwd: mkdtempSync(...)` and
`env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', HOME: <same temp dir> }`
(no inherited `GH_TOKEN`) from its FIRST RED — never written un-isolated and patched afterward. Rationale: a
known hazard is not introduced in one slice to be isolated in a later one (the same principle as R-2: a new
mechanism is never born fail-open).

- [ ] 4.0.1 RED + GREEN (**fixture D1** — meta-test/drift-guard over the test file itself, proven with
      teeth): seed a deliberately NON-compliant stub extracted-script assertion (missing `cwd`/env
      overrides) alongside the real, already-isolated workflow-extracting tests this PR adds to
      `release-postmerge-workflows.test.mjs`; assert the drift-guard fails on the stub and passes on every
      real assertion in the file. Remove the stub once the guard is proven to have teeth — this is a proof
      device, not a step toward an un-isolated test.
- [ ] 4.0.2 GREEN: author every extracted-script execution this PR adds (window step, revert loop,
      terminal-state assertion, etc.) already isolated per the contract stated above, at the moment each is
      first written.
- [ ] 4.0.3 RED + GREEN (**fixture D2**): run the full suite twice in sequence (a meta-test invoking
      `npm test` as a subprocess, or an equivalent harness-level check); assert the **real repository's**
      `git config user.name`/`user.email` are **unchanged** before and after both runs.
- [ ] 4.0.4 No sequencing restriction to lift: PRs 1–3 already run the full suite normally (see their
      1.6.1/2.5.1/3.4.1 gates), and this PR's own new tests carry no hazard window because they are born
      isolated (4.0.1–4.0.2). `npm test` (full suite) runs safely from the real worktree throughout this PR
      and the rest of the chain.

**PR 4/PR 5 split (owner-confirmed, Plan Deviation logged in design.md §14, 2026-07-14):** this phase FIXES
the isolation and PROVES it for the one test file this PR touches. It does not attempt to guard every
future workflow-extracting test file that might ever be added — that generalization is PR 5's Phase 5.4
(the standing registry), not a duplicate of this phase.

### Phase 4.1 — Window CLI, no governance-ref fetch, and the history depth PR4 owes (REQ-D2-1, REQ-D2-2, REQ-D2-11)

- [ ] 4.1.1 Edit the window-resolution step to call `node postmerge/cursor.mjs window` directly, replacing
      the old `git describe --tags --abbrev=0` / push-vs-schedule branch entirely. **No
      `refs/governance/*` fetch step is needed or added here**: `readCursor` is a single remote
      `git ls-remote --exit-code` call (§2.1) — it never reads, requires, or benefits from a local
      governance ref, fetched or not.
- [ ] 4.1.2 Edit the `ABSENT` branch: exit 2, open/update a `governance:cursor-missing`-labeled issue
      containing the exact `git update-ref ...` + `git push ...` init command; never auto-create, never
      revert.
- [ ] 4.1.3 Edit the `UNKNOWN` branch: exit 2, open/update a `governance:cursor-unknown`-labeled issue with
      **no** init command (bootstrapping on a guess is refused); never auto-create, never revert.
- [ ] 4.1.4 RED + GREEN (**fixture C2**): inject a crash / kill / garbage-output scenario for the window
      step's node process. Assert the wrapper's `case … *)` catch-all treats any unrecognized output as
      `UNKNOWN` → exit 2 — **never** an inferred empty range that could pass as a clean audit.
- [ ] 4.1.5 **BINDING (REQ-D2-1, REQ-D2-11 — the shallow-clone trap; owner ruling, Round-2 judge finding):**
      `resolveWindow` and `advanceCursor` both call **local** `git merge-base --is-ancestor` against the
      cursor sha and `to` (§2.2, §2.3) — this reads local commit OBJECTS, unlike `readCursor`'s remote-only
      `ls-remote` read. `actions/checkout@v4`'s default `fetch-depth: 1` (a SHALLOW clone) will not have the
      cursor commit locally once the cursor is more than one commit behind HEAD, so `merge-base` fails and a
      LEGITIMATE accept/window dies with a FALSE "not an ancestor" diagnosis — the same failure class as the
      earlier CRITICAL where the cursor ref itself was never fetched. The workflow checkout step MUST set
      `fetch-depth: 0` (full history) OR perform an explicit `git fetch` of the commits the ancestry check
      needs. This MUST be asserted by a workflow-extracting test in **this PR** (fixture, born isolated per
      §7.4/Phase 4.0) that FAILS if the checkout step uses a shallow clone that starves `merge-base` — never
      assumed from the YAML alone.

### Phase 4.2 — Skip-over integration proof (REQ-D2-1, the theorem made concrete)

- [ ] 4.2.1 RED (**fixture C1**, SELF-CONTAINED — corrected per `I304-C1-TARGET-ABSENT`, #304 rev 1): the
      fixture MINTS its own temp repo (`mkdtemp`, no live server branch) with the skip-over topology —
      cursor at `C`; offender `M` lands (exit 1, cursor pinned at `C`); then a **clean merge `P2`** lands.
      Assert the window for the `P2` run is exactly `C..P2` (still containing `M`) — the run exits 1 again
      and the cursor does **not** advance past `M`. The RED baseline is the **v1 range behavior reproduced
      inside the fixture** (a `github.event.before..HEAD`-style window that jumps to `P2`, skipping `M`) —
      constructed locally, never read from a server branch. The historical `scrap/d2-v1-broken` (local-only,
      never on origin) is **provenance prose**: the demonstration that v1 let the cursor skip `M`; preserve
      it as an `archive/` tag (per the `9233880` precedent) if warranted, but the test never reads it.
- [ ] 4.2.2 GREEN: confirm the always-`cursor..HEAD` resolution (already implemented in PR 1's
      `resolveWindow`) satisfies 4.2.1 once wired through the workflow's window step (4.1.1) — this task is
      integration wiring, not new core logic.

### Phase 4.3 — Fail-closed branching, terminal-state assertion (REQ-D2-6, REQ-D2-12)

- [ ] 4.3.1 Edit the audit step to capture the numeric exit code via `set +e; ...; code=$?; set -e`,
      dropping `continue-on-error`/`steps.audit.outcome` (which flattens 1 and 2 into a boolean).
- [ ] 4.3.2 Edit the branch: `0` → advance cursor via `cursor.mjs accept`/CAS path; `1` → revert parsed
      offenders (Phase 4.4); `2` → loud infra issue, never revert/advance; **any other code** →
      normalize to `2` before branching.
- [ ] 4.3.3 RED + GREEN (**fixture C4**): `brain-audit` exits with an unmapped code (e.g. `3`) or is
      SIGKILLed (`137`). Assert the code is normalized to `2` **and** the terminal-state assertion step
      (`if: always()`) fails the job unless the captured code is exactly `0`, `1`, or `2` — including the
      case where the audit step was killed and wrote no output at all.
- [ ] 4.3.4 RED + GREEN: a synthetic run with a stray `[FAIL-SHA]`-like string in stdout but exit code `2` —
      assert no revert occurs (the numeric code, never text pattern-matching, is authoritative).

### Phase 4.4 — Per-offender revert loop, PR-keyed dedup, orphan cleanup (REQ-D2-3/4, REQ-D2-13)

- [ ] 4.4.1 Edit the revert step: `mapfile` the parser's stdout (never inline grep — REQ-D2-5), revert
      exactly the parsed full-sha offenders inside a **per-offender subshell with its own trap**.
- [ ] 4.4.2 Edit the dedup check: key on the **PR**, not the branch — `gh pr list --head "auto-revert/<full-sha>" --state all`.
      A closed-without-merge PR is never reopened or duplicated (`--state all` semantics).
- [ ] 4.4.3 Edit the failure boundary: a `git revert` conflict triggers `git revert --abort`, resets to a
      clean detached HEAD (`git checkout --detach "$HEAD_SHA"` per offender — never `git checkout main; git
      reset --hard`), records the offender as failed, and **continues to the next offender**.
- [ ] 4.4.4 RED + GREEN (**fixture C5**): `parse-failures.mjs` fails while `code == 1`. Assert the job fails
      — `mapfile` reading from a plain command substitution (never a banned process substitution
      `< <(…)`) trips `set -e`, never silently yielding an empty array.
- [ ] 4.4.5 Edit `gh pr create` failure handling: if it fails after the branch was pushed, delete the
      pushed branch (`git push origin --delete`) so no orphan branch can permanently suppress a retry.
- [ ] 4.4.6 Edit the post-loop policy: if any offenders are in `failed[]`, open exactly one loud, labeled
      `governance:revert-blocked` issue naming every offender that could not be auto-reverted, with the
      manual revert command, and exit 1; the cursor stays pinned.
- [ ] 4.4.7 Replace the parent-count check: `git show -s --format=%P <sha>` (parents only), never
      `grep -c '^parent '` against `git cat-file -p` (which also matches message lines beginning with
      `parent `).

### Phase 4.5 — Loud paths, labels, concurrency (REQ-D2-12, §5.3)

- [ ] 4.5.1 Edit every loud-issue call site: `gh label create "$LABEL" --color B60205 --description "…" --force`
      (idempotent, no `|| true`); untrusted body text via `$RUNNER_TEMP/body.md` (never argv-spliced);
      `gh issue create ... --body-file`. Remove every `|| true` on a loud path.
- [ ] 4.5.2 Add the F1 pattern (re-derived from `scrap/d2-v1-broken`, never cherry-picked): route
      `AUDIT_STDOUT` via `env:`, never `${{ }}`-spliced into a `run:` block (the CWE-94 fix).
- [ ] 4.5.3 Add alert-fatigue guard: `gh issue list --label "$LABEL" --state open` before creating — if one
      is already open, comment on it instead of minting a duplicate.
- [ ] 4.5.4 Add `concurrency: { group: governance-postmerge, cancel-in-progress: false }` to the workflow
      as defense-in-depth (the CAS in `cursor.mjs` is the actual guarantee).
- [ ] 4.5.5 RED + GREEN: every loud path (`gh label create`/`gh issue create` failure) causes the step
      itself to fail — assert no `|| true` remains anywhere on a loud path.

### Phase 4.6 — PR 4 gate

- [ ] 4.6.1 `npm test` **full suite**, green — consistent with PRs 1–3, which already run the full suite
      safely (see 1.6.1). `brain:repo:check` green.
- [ ] 4.6.2 Budget check: `.github/workflows/governance-postmerge.yml` diff counted lines ≈235 — confirm
      ≤400, no `size:exception`.
- [ ] 4.6.3 Confirm `git config user.name`/`user.email` on the real worktree are unchanged after this PR's
      full test run (re-verify Phase 4.0.3's D2 property empirically, not just by inspection).
- [ ] 4.6.4 `memory:share` before push.
- [ ] 4.6.5 Push, open PR 4 against `feature/v2.0.0` (stacked after PR 3). Dependency diagram marks PR 4
      with 📍.

---

## PR 5 — Cross-evaluator 0/1/2 contract (`exit-codes.mjs` + `run-check.mjs` + drift-guards), ~105 counted lines

**Depends on:** PR 1–4 (the mechanism is fully live; this PR generalizes the exit contract across every
evaluator, not just `brain-audit.mjs`, and stands up the permanent drift-guards).
**End state:** the 0/1/2 contract holds across **every** evaluator (`decision-gate`, `diff-size`,
`issue-link`, `memory-gate`, `brain-audit`), enforced by a standing guard, not by convention.
**REQs bound:** REQ-D2-6 (cross-evaluator contract), REQ-D2-7; REQ-D2-14 (the standing harness-isolation
drift-guard, generalized from PR 4's D1 fix).

### Phase 5.1 — `postmerge/exit-codes.mjs` (REQ-D2-6)

- [ ] 5.1.1 RED: `exit-codes.test.mjs` — `resultToExit({ uncomputable: true }) === 2`;
      `resultToExit({ pass: true }) === 0`; `resultToExit({ pass: false }) === 1`.
- [ ] 5.1.2 GREEN: implement `EXIT = { PASS: 0, VIOLATION: 1, UNCOMPUTABLE: 2 }` and `resultToExit(result)`.

### Phase 5.2 — `run-check.mjs` wiring across all evaluators (REQ-D2-6, REQ-D2-7)

- [ ] 5.2.1 RED: `decision-gate`/`diff-size` runners — inject a throwing `defaultDiffNameOnly`/
      `defaultDiffNumstat`; assert `uncomputable: true` on the returned result.
- [ ] 5.2.2 GREEN: add `uncomputable: true` to the existing infra fail-closed returns for those two runners.
- [ ] 5.2.3 RED: `issue-link` runner — inject a non-string body / uncomputable `defaultBranch` / a
      throwing `fetchIssue`; assert `uncomputable: true`.
- [ ] 5.2.4 GREEN: wire the same flag into `runIssueLinkCheck`'s fail-closed paths.
- [ ] 5.2.5 RED (memory-gate genuine → 2): inject a throwing `readRecords` (IO/permission failure) vs. an
      empty-array `readRecords`; assert the throw maps to `uncomputable: true` (→2) and the empty array
      stays a real violation (→1) — this is the concrete code-level proof of `memoryPresence`'s "re-eval
      only, never tree-effect, never a false resolved" property named in design §3.5/REQ-D2-10a.
- [ ] 5.2.6 GREEN: wrap the memory-gate's `readRecords` call at the runner boundary per the throw/empty
      distinction.
- [ ] 5.2.7 RED + GREEN: `main()` in `run-check.mjs` uses `resultToExit(result)` for `process.exit`,
      replacing any ad-hoc 0/1 mapping.

### Phase 5.3 — Both-fixtures drift-guard (REQ-D2-7)

- [ ] 5.3.1 RED: `exit-code-contract-drift-guard.test.mjs` — define the `CHECKS` registry (`decision-gate`,
      `diff-size`, `issue-link`, `memory-gate`, `brain-audit`); assert each drives to both
      `resultToExit === 1` (violation fixture) and `resultToExit === 2` (uncomputable fixture).
- [ ] 5.3.2 GREEN: wire each check's real runner into the registry so 5.3.1 passes for all 5.
- [ ] 5.3.3 RED + GREEN: a hypothetical evaluator exiting only 0/1 (no 2 path) fails the guard, naming the
      missing evaluator — prove the guard's teeth via a deliberately incomplete stub before trusting it
      against the real 5.
- [ ] 5.3.4 RED + GREEN: an evaluator missing its → 2 fixture (but with correct logic) fails the guard,
      naming the missing fixture.

### Phase 5.4 — Standing harness-isolation drift-guard (REQ-D2-14, generalizes PR 4's D1)

PR 4's Phase 4.0.1 fixed and guarded the **one currently-known** test file that extracts and executes
workflow scripts. This phase promotes that guard into the **same kind of standing registry** as Phase
5.3's `CHECKS` registry, so a future author adding a NEW test file that extracts a workflow script cannot
silently regress the isolation contract. This PR4 (fix+prove) / PR5 (generalize-to-registry) split is the
house detection→prevention ladder, owner-confirmed and logged as a Plan Deviation in design.md §14
(2026-07-14) — `design.md` and `spec.md` are reconciled to state it identically.

- [ ] 5.4.1 RED: a repo-wide meta-test globbing all `*.test.mjs` files for `spawnSync`/`execFileSync` calls
      that pass a `run:`-derived script string; assert every match sets the four isolation properties from
      §7.4 (`cwd` outside repo, `GIT_CONFIG_GLOBAL`/`GIT_CONFIG_SYSTEM`/`GIT_CONFIG_NOSYSTEM`, isolated
      `HOME`). Seed the test with a deliberately non-compliant stub file first to prove the guard has teeth
      (mirrors 5.3.3's pattern), then confirm it passes against the real (now-fixed) test suite.
- [ ] 5.4.2 GREEN: register `release-postmerge-workflows.test.mjs` (fixed in PR 4) as the first compliant
      entry; remove the deliberately non-compliant stub.
- [ ] 5.4.3 No new isolation-fixing code expected here — if 5.4.1 reds against the real suite, that is a
      signal PR 4's fix (4.0.2) was incomplete and must be revisited, not patched locally in PR 5.

### Phase 5.5 — PR 5 gate

- [ ] 5.5.1 `npm test` full suite green (including both drift-guards) · `brain:repo:check` ·
      `brain:change:verify` (note the pre-existing, out-of-scope `chunk-reader.mjs` dangling-reference
      failure per design §12 R-6 — confirm it is still the ONLY failure and still pre-existing on the base
      branch, not introduced by this change).
- [ ] 5.5.2 Budget check: `exit-codes.mjs` + `run-check.mjs` + drift-guard diffs ≈105 counted lines —
      confirm ≤400, no `size:exception`.
- [ ] 5.5.3 `memory:share` before push.
- [ ] 5.5.4 Push, open PR 5 against `feature/v2.0.0` (stacked after PR 4, the last in the chain). Dependency
      diagram marks PR 5 with 📍.

---

## Open items where spec/design left a choice for apply time

- **Loud-issue label strings** (Phase 4.1.2/4.1.3, 4.4.6): `governance:cursor-missing` /
  `governance:cursor-unknown` / `governance:audit-uncomputable` / `governance:revert-blocked` are
  recommendations from the design — confirm exact strings against existing label conventions before
  merging PR 4.
- **Acceptance audit-trail sink** (Phase 1.4.6): `acceptManually`'s `reason` is echoed to stdout; whether
  it is additionally persisted to an issue comment/PR description is an apply-time choice.
- **R-1 window-growth hardening** (design §12): an optional `maxWindowMerges` guard for PR 3, exceeding it
  is exit-2-uncomputable-and-loud. Not required for this chain; flag for a follow-up if the owner wants it
  in-scope.
- **`--force-with-lease` on `refs/governance/*`** (design R-4): must be verified against the real remote in
  PR 1, not assumed. **There is no local fallback** — `advanceCursor` has no local `update-ref` CAS; the
  remote lease is the sole guarantee. PR 1's local-bare-repo two-clone race test (fixture B5, Phase 1.4.4)
  proves git's own lease semantics, but whether GitHub itself honors the rejection identically on a
  non-`refs/heads` namespace remains to be confirmed against the real remote, not assumed from the local
  test alone.

## Out of scope

- **Porting rung-3 auto-revert to GitLab.** D2 unblocks it, does not do it.
- **D1 and D3.** Sibling Track-D slices, no dependency edge.
- **Rewriting evaluator semantics.** `diffSize`/`issueLink`/`adrPresence`/`memoryPresence` decisions are
  unchanged; only the resolution/exit contract is added.
- **Committing the GitLab constraint into the doc zone.** Draft only (Phase 1.5).
- **Using real fossil PRs as fixtures.** Re-measured to zero (168 closed PRs, 0 `auto-revert/*` heads); all
  fixtures synthetic (REQ-D2-8).
- **`brain-audit.mjs`'s chunk-reader drift** (`brain:change:verify` failure on a dangling
  `chunk-reader.mjs` reference, pre-existing on the base branch, design §12 R-6). Not D2's to fix.
