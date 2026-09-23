---
status: draft
issue: 509
---

# Tasks — #509

- [x] **T1** Read the oracle before writing anything: `be2d143` and `be2d143^`, the #473 draft,
      §1c/§1d, ADR-0028, and both stopgap scripts as specs.
- [x] **T2** Measure the reconstruction is even possible: the #473 draft's signed section is
      **byte-identical** to the section `be2d143` appended, once the `**Signed**:` line is
      stamped. Confirmed before a line of the applier was written.
- [x] **T3** `brain-amendment/1` contract — parser and pure planner in
      `brain/scripts/lib/amendment-draft.mjs` (design D1, D2). Unknown keys refuse.
- [x] **T4** Dispatch inside `runPromote` (design D4), not a sibling verb: one TTY check, one
      argument parse, one typed word, one git seam, one staging step.
- [x] **T5** The golden test — the tree at `be2d143^` plus the #473 draft, staged byte-identical
      to `be2d143`, zero commits, printed command run through the real `commit-msg` hook.
- [x] **T6** Red-proof, six mutations, each read back off disk before the suite ran:
      | # | mutation | result |
      |---|---|---|
      | M1 | §1c act 2 in-place annotation skipped | RED — ADR byte-identity + 2 anchor cases |
      | M2 | §1c act 1 Status line computed but not applied | RED — ADR byte-identity |
      | M3 | `brain/HOME.md` marker planned but not written | RED — HOME identity + staged set |
      | M4 | §1d act 3 `AGENTS.md` regeneration skipped | RED — AGENTS identity + staged set |
      | M5 | ISO date stamp instead of `DD/MM/YYYY` | RED — all three files + 2 unit cases |
      | M6 | non-literal replacement (`$&` expands) | RED — unit case |
- [x] **T7** The methodology shape end to end — the #529 case — including the assertion that
      failed there: the amended text is INSIDE the regenerated `AGENTS.md`.
- [x] **T8** ADR-0028's four locks re-proven on the amendment branch (real non-TTY child process,
      flag aborts before the prompt, refusing answers, zero commits).
- [x] **T9** `compileAgentsMd` no longer fails open (design D6), plus the test that shows why the
      gutted output was invisible: same banner, same five section headers.
- [x] **T10** `promote-529.sh` and `promote-516.sh` deleted, with a test keeping them deleted.
- [x] **T11** Idempotence, including the case an anchor-count check alone cannot see: an anchor
      that is a prefix of its own replacement. Found by a real double-apply while testing.
- [x] **T12** Both `brain-drafts/` amendments DRY-RUN in a throwaway copy of the real tree —
      anchors live, plan correct, `brain/HOME.md` marker generated. Not promoted: Tier 2.
- [x] **T13** `npm test` (3262 after merging `main`), `repo:check`, `brain:nav`, `brain:check`.
- [x] **T14** The first CI run reported `# skipped 13` — the whole golden suite. The fallback
      fetch was wrong: an abbreviated sha is read as a ref name (`couldn't find remote ref`).
      Reproduced in a real `git clone --depth 1`, fixed with the full 40-char sha, and the suite
      now runs 13/13 in a shallow clone that starts without the commit.

## Micro-decisiones en caliente

- **The contract declares content; the verb generates shape.** Every stamp, marker and format is
  produced by the verb from the target's own current state, so a draft cannot get them wrong.
  The amendment number is *verified* against the Status line, not trusted.
- **`.draft.md` is required in addition to the contract block.** A file that merely quotes a
  contract — a design doc — must never be promotable.
- **AGENTS.md is always recompiled, written only when it differs.** Staging a byte-identical
  file would report a path the human cannot find in `git diff --cached`.
- **The golden fixture's inputs come from the pre-tree and the #473 draft only.** A test asserts
  the constructed draft contains none of the three strings the verb is supposed to generate.

## Cold review round (two reviewers, disjoint halves, isolated worktrees)

- [x] **T15** BLOCKER 1 — the three-exit `alreadyPromoted` replaced by `assessCascade`: every act
      read, three dispositions, mixed refuses. RED-proved by restoring the body-heading exit.
- [x] **T16** BLOCKER 2 — the presence key replaced by the free-anchor algebra (design D8), with
      both directions pinned in one table and the unbreakable tie documented where it is decided.
- [x] **T17** BLOCKER 3 — repo-wide unmerged-path refusal; `status` added to the git allowlist and
      the lock's property re-asserted by name. RED-proved against a real conflicted merge.
- [x] **T18** BLOCKER 4 — an UNSKIPPED assertion that the oracle is reachable. Measured: shallow
      clone + unreachable origin now exits **1** where it exited **0** with 13 silent skips.
- [x] **T19** Rollback on a failed write, proven twice — a deterministic seam and a real
      `chattr +i` EPERM, with the capability probed rather than silently skipped.
- [x] **T20** Symlinked target refused (`realpath` + `lstat`), out-of-repo file byte-identical.
- [x] **T21** Staged-only edits refused; worktree-only edits disclosed above the prompt.
- [x] **T22** Lock 2's structural guard now derives its file list from the verb's own imports and
      fails on an unclassified module.
- [x] **T23** Self-overlapping occurrence counting; single-line splice instead of split/join, so
      one stray CRLF no longer rewrites every line; act 3 shows the WHOLE appended section;
      unterminated fence reported as malformed; shape refusal ordered before `user.name`.
- [x] **T24** Both Tier 2 drafts corrected — the "cannot happen" claim, the "four locks untouched"
      claim, and two more accepted losses (partial cascades, whole-file staging).
- [x] **T25** Split into two PRs at the module boundary (design D11): 784 + 639 counted.

### Red-proofs for the review round

| # | mutation | result |
|---|---|---|
| R1 | restore the body-heading `alreadyPromoted` exit | RED — 2 tests |
| R2 | restore `includes(replace)` as the idempotence key | RED — 3 tests |
| R3 | drop the unmerged-paths refusal | RED — the conflicted-merge e2e |
| R4 | oracle unreachable (real shallow clone, bad origin) | RED — exit 1, was exit 0 |
| R5 | drop the rollback restore | RED — both rollback e2e tests |
| R6 | drop the symlink refusal | RED — the out-of-repo write e2e |
