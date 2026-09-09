# Amendment draft — `consolidation-protocol.md` §5, the lane replaces the branch (issue #862)

**For**: `npm run brain:promote -- openspec/changes/issue-862-memory-lane/brain-drafts/consolidation-protocol.draft.md`

> Drafted by agent, applied by the maintainer via `brain:promote` (Tier 2 doctrine).
> §3 (zone map) is already amended by #863 — not touched here.

## Why

§5 describes the flow #862 rules against: a captured record travels with the
feature branch and reaches `main` only when the feature PR does — the
sentence *"Once the MR is merged, the team absorbs the memory..."* names that
coupling and flags itself as under ruling. #862 (ADR-0034) rules it: a record
reaches `main` on its own `memory/<host>-<date>` pull request, never the
feature's.

**Sequencing, stated here rather than silently assumed.** The "Until the
memory lane (#862) exists, records still travel with the branch" caveat
above the `memory:share && git add .memory/` snippet is **not** touched by
this amendment. It stays true until the lane actually ships records — 3.1b's
first scenario ("a record does not wait for its feature") passing, **and**
#874 (record-first) landing (design.md's "Ordering constraint", L7). Dropping
that caveat is 3.1d's own amendment, sequenced after those two conditions,
not this one's.

```brain-amendment/1
target: brain/core/methodology/consolidation-protocol.md
issue: 862
```

## Act 1 — the merged-branch sentence names the lane's actual flow

The sentence described the old coupling and marked itself as pending a
ruling. The ruling exists now (ADR-0034); the sentence says what is true.

```amend-find
Once the MR is merged, the team absorbs the memory with `npm run memory:pull` or on the next `brain:day:start`. **This sentence is under ruling #862**: on the memory lane, records reach `main` on their own pull request, not the feature's — measured cost of the current flow: p50 21.6 h learn→main (#864 baseline).
```

```amend-replace
On the memory lane (#862, ADR-0034), a captured record reaches `main` on its own pull request — `memory/<host>-<date>`, built by a collector that never checks out a worktree, merged by tier (`lite`: auto on green; `standard`/`regulated`: a human approval) — never the feature's. The team absorbs it with `npm run memory:pull` or on the next `brain:day:start`, exactly as before; only the PR the record travels on changes. Measured cost of the pre-lane flow this replaces: p50 21.6 h, p90 399.7 h learn→main (#864 baseline, n=350); ratified targets on the lane: p50 ≤ 1 h, p90 ≤ 24 h at `lite` (ADR-0034 L9). The surfaces that make a record ride the feature branch today retire in 3.1d, sequenced — see the caveat above, which this amendment does not touch.
```

### Notes for the promoter

One anchor, verified to occur exactly once. The "Until the memory lane (#862)
exists..." caveat and its code fence, a few lines above this anchor, are
deliberately left alone — the draft's own "Why" section states why. A second
amendment, filed with 3.1d, removes that caveat once its two preconditions
are actually true on `main`.
