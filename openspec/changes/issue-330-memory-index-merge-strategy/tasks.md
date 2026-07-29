---
status: tasked
issue: 330
epic: 313
artifact_store: openspec
topic_key: sdd/issue-330-memory-index-merge-strategy/tasks
---

# Tasks — `.memory/index.jsonl` merge strategy (issue 330)

Strict TDD: RED before GREEN on every code-bearing phase. Branch:
`fix/issue-330-fixmemory-memoryindexjsonl-has-no-merge`, worktree
`/home/gandalf/IA/brain-issue-330`, base `main`.

## Phase 1 — RED: the merge regression tests

- [x] 1.1 Add `brain/scripts/memory/lib/index-merge.integration.test.mjs` with test 1 (clean union
      merge) and test 2 (negative control), modelled on `records-merge.integration.test.mjs`.
      Test 1 must fail-as-designed only through the fixture, so at this point both tests describe
      real git behaviour and should already pass — record their output as the baseline evidence.
      **Observed:** both pass. The negative control fails the merge with conflict markers, which is
      what makes test 1 causal evidence rather than a coincidence.
- [x] 1.2 Add test 3, the repo tripwire, reading the real `.gitattributes`.
      **This is the RED test** — it fails until Phase 2 lands. Capture the failure output.
      **Observed RED:** `pass 3 / fail 1`, failing on
      `index-merge.integration.test.mjs:220` — "the shipped .gitattributes must declare a merge
      strategy for /.memory/index.jsonl". `false !== true`.

TASK BOUNDARY: 1.2 must be observed RED before Phase 2. ✔ observed.

## Phase 2 — GREEN: the fix

- [x] 2.1 Add `/.memory/index.jsonl merge=union` to `.gitattributes`, mirroring the records rule's
      comment shape and noting that `union` is a git built-in needing no per-clone registration.
      The comment also records the full-rewrite distinction (D1), so the next reader does not
      infer append-only semantics from the neighbouring records line.
- [x] 2.2 Re-run the suite — test 3 goes GREEN, tests 1 and 2 stay GREEN. **Observed:** `pass 4 / fail 0`.

## Phase 3 — doc (Tier 2 draft)

- [x] 3.1 Draft the `memory-format.md` update into
      `openspec/changes/issue-330-memory-index-merge-strategy/brain-drafts/memory-format-index-merge.md`.
      **Do not edit `brain/core/**` directly** — `agent-authorities.md` Tier 2: the agent drafts,
      the human promotes. The draft covers REQ-330-3: the strategy, the full-rewrite distinction,
      and the reindex remedy.
- [ ] 3.2 Note in the PR body that the draft awaits human promotion, so `brain-writes-reviewed`
      and `decision-gate` see the intent explicitly.

## Phase 4 — gates

- [x] 4.1 `npm run brain:repo:check` — ✓ no prohibited references, artifact structure valid.
- [x] 4.2 Full unit suite via the repo verb `npm test` (`node --test "brain/scripts/**/*.test.mjs"`)
      — **2036/2036 pass, 0 fail**. Note: `node --test <dir>` is NOT the repo's invocation and
      fails with MODULE_NOT_FOUND; always use the `test` script's glob.
- [x] 4.3 `npm run brain:change:verify` — ✓ repo + scripts scope, both green.
- [ ] 4.4 `npm run memory:share && git add .memory/` before pushing (memory-gate invariant 3).

## Phase 5 — delivery (human-gated)

- [ ] 5.1 Commit as one work unit: fix + tests + draft together.
- [ ] 5.2 **BLOCKED ON HUMAN**: issue #330 carries `type:bug, priority:high` but **not**
      `status:approved`. Invariant 1 (`issue-link`) fails the PR without it, and per
      `agent-authorities.md` / issue #124 the agent must never apply that label. Human signs, then
      push + open PR into `main`.

## Live micro-decisions

- **Tracker is `main`, not `feature/v2.0.0`.** The epic #313 body still names `feature/v2.0.0` as
  the integration base; `git rev-list --left-right --count origin/feature/v2.0.0...origin/main`
  reports `0 32` — it is fully absorbed and 32 behind. The epic body is stale on this point and
  should be re-synced (it declares itself source of truth, so a doc PR is the right correction).
- **Three verified findings reshaped the design** — index is a full rewrite not an append-only log;
  nothing reads it; self-healing is backend-asymmetric. All three are in design.md D1 with
  file:line citations.
- **Follow-up to file:** `engram.share()` reindexes only when it appended a record
  (`engram.mjs:315-318`) and `engram.pull()` never reindexes (`engram.mjs:589-619`), while
  `plainfiles` reindexes unconditionally on all four verbs. Backend asymmetry in index
  self-healing. Deferred out of this slice deliberately (proposal, Out of scope).

## Review workload forecast

- Estimated changed lines: ~150 (one `.gitattributes` line, ~110 test lines, ~40 draft doc lines).
- 400-line budget risk: **Low**. Single PR, no chaining needed.
- Decision needed before apply: **No** — but delivery is blocked on the `status:approved` signature
  (5.2), which is a human gate, not a sizing decision.
