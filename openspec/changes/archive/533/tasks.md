---
status: draft
issue: 533
---

# Tasks — #533

- [x] **T1** Probe the live endpoints BEFORE designing (#335): GitHub `dependencies/blocking`,
      `dependencies/blocked_by` and `sub_issues` all answer 200; `assignees` is present on every
      live entry. Recorded in the proposal.
- [x] **T2** `normalizeAssignees` in `vcs/lib/normalize.mjs` — one rule, `string[] | null`.
- [x] **T3** `assignees` on `issueView`/`issueList`, both providers; `VERBS`, the drift-guard
      and `vcs-contract.md` kept in sync.
- [x] **T4** `issueRelations` on both providers — GitHub's two dependency endpoints, GitLab's
      links; sub-issues and `relates_to` deliberately unread; cross-repo counted in `foreign`.
- [x] **T5** `issueUpdate` on both providers — `body` only, never-throws, `ok:true` on an
      unparseable echo of a landed write.
- [x] **T6** `buildGraph` takes the UNION and reports `divergences` /
      `relationsUnreadable` / `foreignRelations`; `sources` replaces `declared` as what places
      a node.
- [x] **T7** `outsideRegion` + the refusal in `brain:epic:map`, and the write through
      `issueUpdate`.
- [x] **T8** 36 new guards — 21 on the graph/render/CLI, 13 on the providers, 2 in the
      parameterized contract suite — plus 2 new derived fixtures.
- [x] **T9** Full suite: **3091 tests, 0 failures**.
- [x] **T10** Ten mutations, nine RED. One survived and was closed; one is equivalent.
- [x] **T11** ADR-0029 drafted under `brain-drafts/` — Tier 2, the human signs.
- [x] **T12** End-to-end against the real GitHub API: `brain:epic:map 313 --dry-run` over 47
      open issues, live assignees rendered, relation endpoints answering for every issue.

## Recorded

- [x] **R1** **Slice 1's four expectations that slice 2 changes were updated, not deleted.**
      `edges` gained `sources`; `parseArgs` gained `relations`; *"Sin declarar"* became
      *"Sin ubicar"* because the condition is no longer "has a block" but "any source places
      it"; and the test asserting the map NAMES what it cannot see was replaced by the test
      asserting it SHOWS what it can, with the three outcomes kept apart.
- [x] **R2** **M2 survived the first mutation pass.** The `?? []` collapse at the CLI layer had
      no coverage — the port was guarded and the layer above it was not. That is the shape of
      #335 in miniature: the rule was defended where it was written and not where it is used.
- [x] **R3** **A comment was wrong and a surviving mutation is what found it.** `??` vs `||` in
      the assignee chain is a distinction without a difference, because `[]` is truthy. The
      mutation survived because the two are equivalent, not because a guard was missing; the
      comment claiming otherwise was corrected rather than the code.
- [x] **R4** **The recorded `issueList` fixtures were trimmed and carry no assignee field**, so
      every entry in them is the `null` case. Rather than edit a fixture marked `recorded`,
      two new fixtures marked `derived` were added for the populated / genuinely-empty /
      legacy-singular / absent outcomes, mirrored entry-for-entry across the providers so one
      assertion set runs over both.
- [x] **R5** **`vcs-contract.md`'s `issueList` row said neither provider paginates.** That
      expired when #459 paginated both. Corrected while the row was open — a contract doc that
      describes the code as it was is a doc a reader will act on.
- [x] **R6** **The refusal to write has a real failure mode, not a hypothetical one.** A body
      carrying a stray `BEGIN` with no `END` makes the append leave the stray marker first, so
      the NEXT run would swallow the prose between it and the real `END`. That is the case the
      guard is tested on.
- [x] **R7** **`0 of 47` open issues declare a graph block, and `0` carry a native relation.**
      Both sources are empty today. The union rule had to survive one source being silent
      because that is the only state it has ever been observed in.
