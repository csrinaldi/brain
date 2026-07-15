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
| Estimated changed lines | PR1 ≈155 · PR2 ≈85 · PR3 ≈100 · PR4 ≈235 · PR5 ≈105 (counted; tests + `openspec/changes/**` excluded per `governance.ignoreList`) |
| Total across chain | ≈680 counted lines, none of it in one PR |
| 400-line budget risk | **Low for every PR.** Largest is PR4 at ~235/400 (~59%) — comfortable headroom even after a further review finding. |
| Chained PRs recommended | **Yes — mandatory** (owner ruling #901). Feature-branch-chain rejected: the tracker's single integration diff would be ~700 lines, needing the `size:exception` the proposal forbids. |
| Chain strategy | **stacked-to-main**, 5 PRs, each merging to `feature/v2.0.0` in order (owner ruling #901) |
| Decision needed before apply | **No** — chain strategy and no-exception constraint are already owner-adjudicated (#901). Apply proceeds directly against the 5-PR split. |

### Dependency diagram

```
feature/v2.0.0
   └── PR 1  cursor core (git-seam + cursor state machine + CAS)         ~155  [git-seam.mjs, cursor.mjs, GitLab draft]
        └── PR 2  revert resolution (tree effect)                         ~85  [resolution.mjs — security-critical]
             └── PR 3  brain-audit: emission + skip classes + exit-2     ~100  [parse-failures.mjs, brain-audit.mjs]
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

- [ ] 1.1.1 RED: `git-seam.test.mjs` — `gitTry(argv)` never throws on non-zero exit; returns
      `{ status, stdout, stderr }` for a command that exits 0, a command that exits with a documented
      non-zero code (e.g. `ls-remote --exit-code` against a ref that does not exist → status 2), and a
      command that exits with an unrelated failure code (e.g. unreachable remote → 128).
- [ ] 1.1.2 GREEN: implement `gitTry(argv)` as a thin `execFileSync` wrapper that captures `status` instead
      of throwing.
- [ ] 1.1.3 RED: `gitOrThrow(argv)` — returns stdout on status 0; throws an `Error` carrying `.status` when
      non-zero.
- [ ] 1.1.4 GREEN: implement `gitOrThrow` on top of `gitTry`.

### Phase 1.2 — `postmerge/cursor.mjs` tri-state read (REQ-D2-2, REQ-D2-11)

- [ ] 1.2.1 RED: `syncCursor({ git })` — asserts the exact refspec
      `git fetch --prune origin '+refs/governance/*:refs/governance/*'` is issued via the injected `git`
      seam before any state read.
- [ ] 1.2.2 GREEN: implement `syncCursor`.
- [ ] 1.2.3 RED (**fixture B1** — the tautological-test trap, reproduced): construct a **bare "origin" repo
      with the cursor ref SET on it**, clone it with a **plain `git clone`** (which, exactly like
      `actions/checkout`, fetches only `refs/heads/*` + tags). **First assert the local `git rev-parse`
      against the unfetched ref FAILS** — this proves the fixture reproduces the real production shape,
      not a strawman. **Then** run `readCursor` (which calls `syncCursor` first) and assert it returns
      `{ state: 'present', sha }`.
- [ ] 1.2.4 RED (**fixture B2**): a bare origin with **no** cursor ref at all. Assert `readCursor` returns
      `{ state: 'absent' }` (from `ls-remote --exit-code` status 2 — git's documented "no matching refs").
- [ ] 1.2.5 RED (**fixture B3**): an origin URL pointing at a **nonexistent path** (unreachable — any
      `ls-remote` status other than 0 or the documented 2). Assert `readCursor` returns
      `{ state: 'unknown' }` and explicitly assert it is **NOT** `absent`.
- [ ] 1.2.6 RED: origin reports the ref present via `ls-remote`, but the local ref fails to resolve **after**
      a successful fetch (an inconsistency). Assert `{ state: 'unknown' }` — never silently downgraded to
      `absent`.
- [ ] 1.2.7 GREEN: implement `readCursor({ git })` as the tri-state machine (§2.1) satisfying 1.2.3–1.2.6.

### Phase 1.3 — `resolveWindow` always `cursor..HEAD` (REQ-D2-1)

- [ ] 1.3.1 RED: `resolveWindow({ git, head })` on a `present` cursor at `C` with `head = H` returns
      `{ state: 'present', base: C, range: 'C..H', head: H }` — **regardless of any `eventName`/`before`
      argument passed** (there must be no push/schedule branch left to pass).
- [ ] 1.3.2 RED (**fixture B6**): a cursor sha that is **NOT an ancestor of HEAD** (simulates a rewritten
      `main`). Assert `resolveWindow` returns `{ state: 'unknown', reason: 'cursor is not an ancestor of HEAD' }`.
- [ ] 1.3.3 RED: cursor state is `absent`/`unknown` (from Phase 1.2). Assert `resolveWindow` propagates the
      state without computing a range.
- [ ] 1.3.4 GREEN: implement `resolveWindow` (§2.2) satisfying 1.3.1–1.3.3.

### Phase 1.4 — `advanceCursor` as atomic CAS (REQ-D2-15)

- [ ] 1.4.1 RED (**fixture B4**): a repo with **NO** cursor ref. Call `advanceCursor({ git, from: <40-hex>, to })`.
      Assert it **throws** (no `from` validation bypass) and the ref **does not exist** afterward, asserted
      directly against the core (not the YAML).
- [ ] 1.4.2 RED: `advanceCursor` called with a non-40-hex `from` (e.g. `undefined`, short sha). Assert it
      throws before touching git.
- [ ] 1.4.3 RED: `advanceCursor` with `from` that is not an ancestor of `to`. Assert it throws (the cursor
      only ever moves forward).
- [ ] 1.4.4 RED (**fixture B5**): two `advanceCursor` calls issued with the **same `from`**, the second
      **after** the first has already succeeded. Assert the second **fails** (local CAS mismatch via
      `git update-ref <ref> <to> <from>`, which fails when the ref's current value ≠ `from`).
- [ ] 1.4.5 GREEN: implement `advanceCursor` (§2.3) — local `update-ref <ref> <to> <from>` CAS, then remote
      `git push --force-with-lease=<ref>:<from> origin <to>:<ref>` — satisfying 1.4.1–1.4.4.
- [ ] 1.4.6 RED + GREEN: `acceptManually({ git, from, to, reason })` — throws/refuses when `reason` is
      empty; otherwise reads the current cursor as `from`, echoes `reason` to stdout, and performs the
      SAME CAS advance as 1.4.5 (§2.4). Note: `from` is *read* by `acceptManually`, not caller-supplied —
      assert it fetches the live cursor value, not a stale one.
- [ ] 1.4.7 RED + GREEN: CLI mode — `node postmerge/cursor.mjs window` prints exactly one of
      `PRESENT <base> <head>` / `ABSENT` / `UNKNOWN <reason>` and exits `0` (present) or `2` (absent/unknown);
      `node postmerge/cursor.mjs accept <sha> --reason "<text>"` invokes `acceptManually`; missing
      `--reason` exits non-zero with a usage message.

### Phase 1.5 — GitLab-porting constraint draft (REQ-D2-9, survives verbatim from old Phase 6)

- [ ] 1.5.1 Write/re-confirm `openspec/changes/issue-259-d2/brain-drafts/gitlab-porting-constraint.md`
      stating rung-3 auto-revert must not port to GitLab until D2's fixes land, and that the GitLab port
      covers PR-time gates (`GOVERNANCE_JOBS`) only.
- [ ] 1.5.2 Confirm (no code): no ADR / `brain/core/` / PLAN file is touched by this PR — human co-promotes
      the draft separately (pattern #216). Confirm via `git status` before commit.

### Phase 1.6 — PR 1 gate

- [ ] 1.6.1 `npm test` — the **full suite**, green. No scoping restriction: on this (reset) branch,
      `release-postmerge-workflows.test.mjs` is the clean 145-line base — no `probeScript`, no
      identity-poisoning `spawnSync`, no execution of extracted workflow lines. That hazard was introduced
      by D2's OWN now-discarded v1 work (`scrap/d2-v1-broken`), not by anything on this branch or in the
      environment (owner Ruling 1, engram #902 — verified with file:line git evidence). Running the full
      suite from the real worktree is safe in this PR.
- [ ] 1.6.2 Budget check: `git-seam.mjs` + `cursor.mjs` counted lines ≈155 (test files and
      `openspec/changes/**` excluded per `governance.ignoreList`) — confirm ≤400, no `size:exception`.
- [ ] 1.6.3 `memory:share` before push, per house convention.
- [ ] 1.6.4 Push, open PR 1 into `feature/v2.0.0`. Dependency diagram in the PR body marks PR 1 with 📍.

---

## PR 2 — Revert resolution: tree effect (`resolution.mjs`), ~85 counted lines

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

- [ ] 2.1.1 RED: `changedPaths(rev, { git })` returns the set of paths from
      `git diff --no-renames --name-only -z <rev>^1 <rev>` for a synthetic commit touching 2 files.
- [ ] 2.1.2 GREEN: implement `changedPaths`.
- [ ] 2.1.3 RED (**fixture A4** — anti-vacuity): a merge `M` with a genuinely **empty diff** (zero changed
      paths). Assert `isResolvedAt` returns `{ resolved: false, reason: 'offender has no changed paths' }`
      — never a vacuous pass.
- [ ] 2.1.4 GREEN: implement the anti-vacuity guard as the first branch of `isResolvedAt`.

### Phase 2.2 — `isResolvedAt` — the tree-effect predicate (§3.2, REQ-D2-10)

- [ ] 2.2.1 RED (**fixture A1** — the security-critical fixture, reddens against `eff4560`): construct
      offender `M` on `main` (adds a payload file at path `P`). Then construct an **ordinary commit `X` on
      the same lineage** — a REAL descendant of `M` (forked AFTER `M`, the realistic linear-main shape,
      never forked before `M`) — whose commit body contains `This reverts commit <M>.` and whose diff
      **does not touch `P`**. Assert `isResolvedAt(M, X)` is **`false`**. **Then run the identical fixture
      against `scrap/d2-v1-broken`'s `cursor.mjs` (`eff4560`) and record that it goes RED there** (`X` is a
      descendant of `M`, so `merge-base --is-ancestor` wrongly passes and `eff4560` skips `M`) — this
      RED-against-the-prior-fix result is the actual proof this task exists to produce, not merely
      "fails on unfixed code."
- [ ] 2.2.2 GREEN: implement `isResolvedAt(offender, tip, { git })` per §3.2 — `P = changedPaths(offender)`,
      `D = changedPaths` between `offender^1` and `tip`, `resolved ⟺ P ∩ D = ∅`, reading **no** commit body.
      Confirm 2.2.1's assertion (against the new code) now passes: `M` stays flagged.
- [ ] 2.2.3 RED (**fixture A2** — liveness): offender `M`, then a **real `git revert -m 1 M`** merged onto
      `main`. Assert `isResolvedAt(M, tip)` is `true` — the mechanism must not pin on a genuine revert.
- [ ] 2.2.4 RED (**fixture A3**): `M` touches paths `P1` and `P2`. A revert restores **only `P1`**. Assert
      `isResolvedAt` is `false` — partial reverts do not resolve.
- [ ] 2.2.5 RED (**fixture A5**): `M` reverted by `R` (genuine, `A2`-shaped), then a **later commit re-adds
      the payload** to the same path. Assert `isResolvedAt(M, <that later tip>)` is `false` — the predicate
      is anchored at the tip and sees the re-introduction. (This is a liveness property the trailer approach
      could never have had.)
- [ ] 2.2.6 GREEN: confirm 2.2.2's implementation already satisfies 2.2.3–2.2.5 with no further code (these
      are properties of the same `P ∩ D = ∅` predicate, not separate branches) — if any fails, the
      implementation is wrong, not the test.
- [ ] 2.2.7 Drift-guard: assert `isRevertedInRange`, `findTrailerCandidates`, `trailerRegex` do **not** exist
      anywhere under `governance/postmerge/` (grep-based static assertion) — a mechanical trip-wire against
      the exact regression this PR exists to prevent.

### Phase 2.3 — `isReverterOf` — the reverter-skip (§3.3, REQ-D2-10a)

- [ ] 2.3.1 RED (**fixture A6**): construct an `adrPresence`-shaped offender `M` (adds an ADR file without
      `brain/HOME.md`) and its genuine tree-effect-verified auto-revert `R` (which would otherwise itself
      fail `adrPresence`, since removing an ungoverned ADR without `HOME.md` re-triggers the XOR), landing
      in the SAME window. Assert `isReverterOf(M, R, { git })` is `true`. **Also** construct a merge that
      merely **claims** (via commit message) to be a revert of `M` but has **no tree effect** on `M`'s
      paths; assert `isReverterOf` is `false` for it.
- [ ] 2.3.2 GREEN: implement `isReverterOf(offender, candidate, { git })` reusing `isResolvedAt` — per
      §3.3: `isResolvedAt(offender, candidate)` is true AND `isResolvedAt(offender, candidate^1)` is false
      (the candidate is demonstrably what removed the payload). No new mechanism, no forgeable signal.

### Phase 2.4 — Checkpoint gate: violation-class → mechanism mapping (REQ-D2-10a, design §3.5)

This is the mandatory checkpoint named in the design's owner ruling. **This PR does not pass its gate
without it.**

- [ ] 2.4.1 RED + GREEN: **`diffSize`-shaped scenario** — a synthetic offender `M` whose own diff exceeds
      the line budget; a genuine revert of `M` restores its paths. Assert `isResolvedAt` returns `true`
      (mechanism **B — tree-effect skip**). Assert with code evidence (a comment or an assertion message
      citing design §3.5) that this is the SAME predicate used for every class, not a `diffSize`-specific
      branch.
- [ ] 2.4.2 RED + GREEN: **`adrPresence` forward-fix — THE OWNER'S CASE.** Offender `M` flagged for
      `adrPresence` (`M`'s own changed path is `P`, an ADR file). A **later commit adds the missing
      `brain/HOME.md`** at a DIFFERENT path `Q` (a forward-fix, never touching `P`). Assert
      `isResolvedAt(M, <that later tip>)` is **`false` forever** — `P` is still on disk, so `P ∩ D ≠ ∅`.
      This is the explicit code-level proof that tree-effect **fails closed** on a forward-fix class: it
      must NEVER be marked resolved, and the only path that clears `M` is the human gate
      (`accept --reason`), which is **outside** `resolution.mjs`'s concern (it lives in `cursor.mjs`, PR 1).
- [ ] 2.4.3 Confirm (no code, assertion of design intent): write a short table-driven test or a comment
      block in `resolution.test.mjs` enumerating all 4 classes (`diffSize`, `issueLink`, `adrPresence`,
      `memoryPresence`) against the mechanism each maps to (tree-effect | re-eval | human-gate | exit-2),
      citing design §3.5's table, so a future reader sees the mapping is deliberate, not incidental.
      `memoryPresence`'s "never tree-effect, re-eval only" claim is a repo-global property outside
      `resolution.mjs`'s per-offender predicate — this task documents that boundary explicitly rather than
      writing a test resolution.mjs cannot meaningfully express; the cross-file wiring proof (memoryPresence
      is never even evaluated against a reverted offender) lands in PR 3 (§ Phase 3.2).

### Phase 2.5 — PR 2 gate

- [ ] 2.5.1 `npm test` — the **full suite**, green (no scoping restriction — see PR 1's 1.6.1 note: the
      harness leak does not exist on this branch until D2's own PR 4 authors new workflow-extracting tests,
      and PR 4 authors them born isolated).
- [ ] 2.5.2 Budget check: `resolution.mjs` counted lines ≈85 — confirm ≤400, no `size:exception`.
- [ ] 2.5.3 Independent-review flag: this PR's description must explicitly ask the reviewer to confirm
      each A-series fixture matches design §7.1's attack shape (doctrine #900 — the patch author should
      not be the sole confirming authority on their own adversarial fixtures).
- [ ] 2.5.4 `memory:share` before push.
- [ ] 2.5.5 Push, open PR 2 against `feature/v2.0.0` (stacked after PR 1). Dependency diagram marks PR 2
      with 📍.

---

## PR 3 — `brain-audit.mjs` wiring: emission, skip classes, exit-2 (~100 counted lines)

**Depends on:** PR 1 (cursor core, unused directly here) and PR 2 (`resolution.mjs`, now imported).
**End state:** the core goes **live via the CLI** — `npm run brain:audit` now emits `[FAIL-SHA]`, skips
genuinely-reverted offenders via `isResolvedAt`, skips reverter merges via `isReverterOf`, and reports
uncomputable states honestly (exit 2, message on stdout). **No workflow (YAML) change yet.**
**REQs bound:** REQ-D2-3 (emission), REQ-D2-5.
**Fixtures:** A1–A6 (end-to-end, through `brain-audit.mjs` rather than unit-level on `resolution.mjs`), C3,
C6.

### Phase 3.1 — `parse-failures.mjs` (REQ-D2-5, re-derived from `scrap/d2-v1-broken`, never cherry-picked)

- [ ] 3.1.1 RED: `parse-failures.test.mjs` — `parseFailingShas(text)` extracts full 40-hex shas from
      `[FAIL-SHA] <sha>` lines using the **F5 regex** `^\[FAIL-SHA\] ([0-9a-f]{40})$` (re-read from
      `scrap/d2-v1-broken`, re-typed fresh — not `git cherry-pick`ed, to avoid importing the
      `github-actions[bot]` mis-authorship). Order-preserving, deduped via `Set`, ignores
      malformed/short (sha7) lines.
- [ ] 3.1.2 GREEN: implement `parseFailingShas`.
- [ ] 3.1.3 RED + GREEN: CLI mode reads stdin, prints deduped full-sha list one per line; tested against
      synthetic stdin, zero real process spawn in the assertion itself.

### Phase 3.2 — `brain-audit.mjs`: emission + resolved-skip + reverter-skip (REQ-D2-3, REQ-D2-10, REQ-D2-10a)

- [ ] 3.2.1 RED: emission test — a synthetic offending merge produces both `[FAIL] <sha7> ...` (unchanged)
      and the new `[FAIL-SHA] <full-sha>` line.
- [ ] 3.2.2 GREEN: add the additive `[FAIL-SHA]` print at the existing `[FAIL]` emission site.
- [ ] 3.2.3 RED (**A1–A5 end-to-end**): re-run fixtures A1, A2, A3, A5 (Phase 2.2/2.1) through
      `brain-audit.mjs`'s actual CLI/module entry point rather than calling `resolution.mjs` directly —
      proves the wiring, not just the predicate. A1 must again be shown to redden against
      `scrap/d2-v1-broken`'s equivalent `brain-audit.mjs` wiring (which used `isRevertedInRange`).
- [ ] 3.2.4 GREEN: import `isResolvedAt` from `resolution.mjs` and add the pre-evaluation skip class
      (symmetric to the existing pre-baseline skip), reporting `[SKIP] <sha7> — resolved by revert`.
- [ ] 3.2.5 RED (**A6 end-to-end**): the reverter-skip fixture (Phase 2.3) run through `brain-audit.mjs` —
      an `adrPresence` offender `M` and its genuine auto-revert `R` in the same window; assert `R` is
      `[SKIP] revert of M`.
- [ ] 3.2.6 GREEN: import `isReverterOf`, wire the reverter-skip evaluation (only for merges that already
      failed one of the four checks — zero cost on the happy path).
- [ ] 3.2.7 RED: **memoryPresence skip-precedence proof** (closes Phase 2.4.3's cross-file note) — a
      reverted offender `M` in a window where `memoryPresence` would also fail repo-globally; assert `M`
      is skipped via tree-effect **before** `memoryPresence` runs on it, while a **different, un-reverted**
      merge in the same window still gets a real `memoryPresence` evaluation (the pre-evaluation skip is
      per-offender, not a global bypass).
- [ ] 3.2.8 GREEN: confirm/adjust evaluation ordering so tree-effect skip precedes the four checks
      per-offender, per §3.5's skip-precedence note.

### Phase 3.3 — Fail-closed catch and salvaged exit-2 (REQ-D2-6, REQ-D2-12)

- [ ] 3.3.1 RED (**fixture C3**): inject a top-level throw in `brain-audit.mjs` (e.g. a crashing `git log`
      for the range load — the salvaged `gitOrThrow` site from the prior branch). Assert exit code is
      **2** (not 1, not 0), and the uncomputable message is written to **stdout** (not stderr).
- [ ] 3.3.2 GREEN: change the top-level catch to `process.exit(2)` with the message on stdout; confirm the
      salvaged `gitOrThrow` range-load site (from `scrap/d2-v1-broken`, re-derived not cherry-picked) still
      produces exit 2 against the new `git-seam.mjs`.
- [ ] 3.3.3 RED (**fixture C6**): `brain-audit.mjs` would exit 1, but the emission path is made to produce
      **zero** `[FAIL-SHA]` lines (a crash mid-emission). Assert the cross-check treats this as
      uncomputable (exit 2), never a silent no-op that goes green with nothing reverted.
- [ ] 3.3.4 GREEN: add the count cross-check — `code === 1` requires `≥1` parsed offender or the run is
      itself uncomputable.

### Phase 3.4 — PR 3 gate

- [ ] 3.4.1 `npm test` — the **full suite**, green (no scoping restriction — see PR 1's 1.6.1 note).
- [ ] 3.4.2 Budget check: `parse-failures.mjs` + `brain-audit.mjs` diff counted lines ≈100 — confirm ≤400,
      no `size:exception`.
- [ ] 3.4.3 `memory:share` before push.
- [ ] 3.4.4 Push, open PR 3 against `feature/v2.0.0` (stacked after PR 2). Dependency diagram marks PR 3
      with 📍.

---

## PR 4 — Workflow wrapper rewrite (`.github/workflows/governance-postmerge.yml`), ~235 counted lines

**Depends on:** PR 1–3 (the core is fully live via the CLI; this PR makes the workflow call it).
**End state:** **the mechanism is live and correct end-to-end.** This is the **only GitHub-coupled PR** in
the chain — a GitLab wrapper becomes a pure translation of this one file.
**REQs bound:** REQ-D2-3/4 (dedup + orphan cleanup), REQ-D2-6 (workflow-side normalization + terminal-state
assertion), REQ-D2-12, REQ-D2-13; REQ-D2-14 (fixture C1 + the D1/D2 harness-isolation fix, since this is
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

### Phase 4.1 — Explicit cursor fetch + window CLI (REQ-D2-1, REQ-D2-2, REQ-D2-11)

- [ ] 4.1.1 Edit the window-resolution step to run `git fetch --prune origin '+refs/governance/*:refs/governance/*'`
      then call `node postmerge/cursor.mjs window`, replacing the old `git describe --tags --abbrev=0` /
      push-vs-schedule branch entirely.
- [ ] 4.1.2 Edit the `ABSENT` branch: exit 2, open/update a `governance:cursor-missing`-labeled issue
      containing the exact `git update-ref ...` + `git push ...` init command; never auto-create, never
      revert.
- [ ] 4.1.3 Edit the `UNKNOWN` branch: exit 2, open/update a `governance:cursor-unknown`-labeled issue with
      **no** init command (bootstrapping on a guess is refused); never auto-create, never revert.
- [ ] 4.1.4 RED + GREEN (**fixture C2**): inject a crash / kill / garbage-output scenario for the window
      step's node process. Assert the wrapper's `case … *)` catch-all treats any unrecognized output as
      `UNKNOWN` → exit 2 — **never** an inferred empty range that could pass as a clean audit.

### Phase 4.2 — Skip-over integration proof (REQ-D2-1, the theorem made concrete)

- [ ] 4.2.1 RED (**fixture C1**, against v1 behavior on `scrap/d2-v1-broken`): cursor at `C`. Offender `M`
      lands (exit 1, cursor pinned at `C`). Then a **clean merge `P2`** lands. Assert the window for the
      `P2` run is exactly `C..P2` (still containing `M`) — the run exits 1 again and the cursor does **not**
      advance past `M`. Against `scrap/d2-v1-broken`'s workflow, this fixture demonstrates the cursor
      jumping to `P2`, skipping `M` — record that RED explicitly as the regression proof.
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
  PR 1, not assumed — if the forge rejects the lease form on a non-`refs/heads` namespace, the local
  `update-ref` CAS still holds and the race falls back to the `concurrency:` group, but this MUST be
  discovered by a PR 1 test, not in production.

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
