---
status: draft
issue: 967
---

# Proposal — an epic's tracker (and the epic itself) as data (#967)

H1 + H2 + H3 of the accepted hardening doc
(`~/.claude/projects/-home-gandalf-IA-brain/design-docs/tracker-enforcement-hardening.md:37-60`):
the `brain-graph/1` block carries `kind`, `tracker` and `parent`; `brain:ticket:start`
resolves the base from the epic instead of defaulting to `main`; a `base-branch` gate
refuses a slice PR against `main`. #564 owns the written rule and is cited, never
duplicated.

## Intent

**The problem, measured.** PR 1 of #881 (Brain UI, epic #878) was about to open against
`main` on 2026-09-14 and the maintainer stopped it by hand; slice 2 (#953) had already
landed on `main` the same way. Four independent gaps produced that
(`tracker-enforcement-hardening.md:10-33`):

| # | Gap | Owner |
|---|---|---|
| 1 | Doctrine is prose in a table cell, not data — `harness-contract.md:28` says `<tracker>` "is the integration base … not `main`, while an epic is in flight", and #878's block declares `track: UI` and no tracker. Nothing to read. | **this change (H1)** |
| 2 | The verb defaults to `main` regardless of the issue's epic — `brain/scripts/lib/ticket-args.mjs:60-61`, `--base` absent → `'main'`. #881's body says `Parent: #878`; the verb does not look. | **this change (H2)** |
| 3 | The Claude Code backend emits no doctrine, so the session that needed the rule never loaded it. | #968 (H4) |
| 4 | The orchestrator asks which chain strategy to use, and an auto-memory had cached `stacked-to-main` from the #557 precedent. A precedent became a default and beat the rule. | #564's rule text (H5) |

Gaps 3 and 4 live outside this repository's code. That is exactly why H3 exists: a gate
is the backstop that holds whatever the engine loaded or cached.

**Who suffers.** The maintainer, who is currently the only control — "no puedo yo
recordarte siempre como trabajar, cuando brain ya lo establece" (#967). And every agent
that reads the tickets as data: an epic is recognisable today only by an `epic(...)`
title prefix and a child only by a `Parent: #N` line in prose, neither read by any code
(#967, comment 2026-09-16). The Brain UI cannot group by epic on that.

**Why now.** The #881 chain is the live instance, #879 shipped the snapshot that carries
the fields, and the same leak has now happened twice in three days.

**Success.** `brain:ticket:start -- 881` creates the worktree off `feature/brain-ui`
and says who declared it; a PR from that slice to `main` fails `base-branch` by name;
`brain:snapshot --json` shows #878 as `kind: epic` with its tracker and #881 pointing at
it.

## Scope

### In

| Deliverable | Shape |
|---|---|
| Block keys `kind`, `tracker`, `parent` | Parsed by `epic-graph.mjs` alongside `track` (:259-273), landing on the node literal (:394-407) |
| Parsed prose parent | A line-initial `Parent: #N` when the block declares none; the node states `parentSource: 'block' \| 'prose'` |
| Snapshot carries all four | Node fields plus the unreadable-node reset (`snapshot.mjs:211-212`), covered by the fake-port test (`snapshot.test.mjs:133-215`) |
| `--base` disambiguation | `parseTicketArgs` gains the ability to say "the caller asked for `main`" vs "nobody asked"; `--off-tracker` override |
| A testable seam in the verb | An exported pure resolver leaf so "the verb's test" in the acceptance can exist at all |
| `base-branch` governance gate | Linked issue → parent → epic's declared tracker → the PR's base must equal it; required at `lite` (ruling 1) |
| Doctrine drafts | Under `openspec/changes/issue-967-tracker-as-data/brain-drafts/`, never a commit to `brain/core/**` |

### Out

| Deferred | Owner / reason |
|---|---|
| Writing the umbrella + feature-branch rule in prose, and teaching it in `issue-link`'s message | #564 |
| Any change to which keyword `issue-link` demands on which target | refused in #564 and refused here |
| Noticing a chain that stopped one PR short of `main` | #713 — landed as `brain/scripts/status/stranded.mjs`; the complement, not a duplicate |
| Changing `stranded.mjs`'s `feature/` oracle | out; this change reconciles the two definitions in writing (Approach) without touching it |
| `brain-ship.mjs:259` (`base: config?.project?.defaultBranch ?? 'main'`) | **out, with a follow-up ticket.** Verified: this is not a one-line fix — it needs the same epic resolution, refusal path, messages and tests as H2, in a second verb. H3 catches its output at PR time |
| `memory/lane/ship.mjs:206` (`base: 'main'`) | **out, and correct.** A memory-lane PR has no epic; `main` is its right base. It becomes the standing regression case for "no epic → passes untouched" |
| Doctrine emit as part of the backend contract | #968 (H4) |
| The harness-contract sentence about where a chain's base comes from | #564's rule text (H5) |
| Forge identity resolved from cwd rather than `--root` | #981 — adjacent (touches `snapshot`/`ui` plumbing), informed, not owned |
| UI grouping and drift marks | #881 slice 4 / #882 (H6) — free once these fields exist |
| Editing every existing ticket body to declare `parent`/`kind` | out; the fields are inert until declared, and that is acceptable (see Risks) |

## Rulings (maintainer, 2026-09-16)

1. **The `base-branch` gate is REQUIRED at `lite`, not detection-only.** A slice PR
   against `main` fails in this repository. This is a deliberate exception to "lite only
   detects" for this one gate: detection at `lite` would have *warned* on the #881 PR,
   which is the outcome the ticket exists to prevent. The gate matrix is code
   (`GATE_MATRIX`, `governance-tiers.mjs:151-235`); the doctrine sentence naming the
   exception is the maintainer's to write under `brain/core/**` and ships here as a draft.
2. **Parent source.** A `parent:` key in the `brain-graph/1` block wins. When absent, a
   line-initial `Parent: #N` is read and the node SAYS its parent came from prose
   (`parentSource`). GitHub sub-issues are refused: they would cost a new port verb on two
   providers, and `github.mjs:183-187` (ADR-0029 D2) rules them out of the graph.
3. **The verb refuses an explicit `--base main`** on an issue whose epic declares a
   tracker: it names the tracker and requires an explicit `--off-tracker`. With no
   `--base` it resolves the tracker and says so.
4. **A parent that does not declare `kind: epic` is a SAID divergence** in the graph (the
   existing `divergences` output), shown by the UI, never inferred as an epic, never a
   gate failure.

Scope addition from the issue comment of the same date: `kind: epic` on the block,
`tracker: feature/<name>` on the epic, `parent` per node, all three carried by the
snapshot (#879) so the UI (#878) can group by epic.

## Approach

**Data first — the block grows three keys, and nothing else changes.** `scalar()` reads
only the keys a caller names and no unknown-key validation exists anywhere
(`brain/scripts/review/lib/yaml-block.mjs:65-68`), so a body carrying the new keys is
invisible to an older brain and an issue carrying none of them parses exactly as today.
`^track:` cannot match `tracker: feature/x`, so the two keys do not collide
(explore.md:21). The node gains `kind`, `tracker`, `parent`, `parentSource` beside
`track`; `snapshot.mjs:211-212`'s hand-enumerated unreadable-node reset must null all
four, or an unreadable node would carry a tracker it never declared — the
`evidence-reader-empty-on-failure` shape that comment exists to close.

**Parent resolution is one hop, never a walk.** Block key, else a line-initial
`Parent: #N`, else null. The `needs`-edge fallback floated in the issue comment is
**dropped**: measured, #881 declares `needs: [879]`, a sibling, and #878 declares
`needs: []` (explore.md:42) — it resolves to the wrong node in the only instance we have.
A parent that is not an epic yields no tracker and a divergence (ruling 4); the verb then
behaves as today and says why.

**The verb.**

| Caller | Epic declares a tracker | Result |
|---|---|---|
| no `--base` | yes | base = the tracker, printed with its source ("base: feature/brain-ui, declared by epic #878") |
| no `--base` | no epic / parent not an epic / no tracker | `main`, with the reason stated |
| explicit `--base main` | yes | **refuse**, name the tracker, point at `--off-tracker` |
| `--base main --off-tracker` | yes | `main`, and the verb says it went off tracker |
| explicit `--base X` (X ≠ `main`) | any | X, unchanged |
| any | the epic is unreachable or unreadable | `main` with a stated reason — **fail open, never refuse** |

The epic lookup is one extra `issueView` (`ticket-start.mjs:93`; the verb already returns
`body`), so no new port verb. The saying-which-mode-it-took shape follows `--in-place`
(AGENTS.md:233-239) and the fail-open clause follows the freshness warning that warns and
never refuses (`ticket-start.mjs:151-173`).

**The gate: a new `base-branch` job (option B2), not an extension of `issue-link`.** The
acceptance demands that reverting only the check turns exactly its own test red, which is
clean with its own module and job and awkward inside a shared handler; and #564 refuses
changes to `issue-link`'s policy, which adding a second invariant to that job sits
adjacent to. Ruling 1 does **not** settle this in B1's favour: required-at-`lite` is a
`GATE_MATRIX` row, available to a new job as much as to an old one. What B1 would have
bought is the one real cost of B2 — a new REQUIRED context is not enforced until an admin
re-runs `npm run brain:protect` (Tier 2, AGENTS.md:145-147). That is an operational step
in the tasks phase, not an architectural argument, and H2 already refuses at creation
time, so the gate is the second line.

**Two tracker questions, two oracles, both said.** "Which base must this slice target?"
is answered by the epic's declared `tracker:` — data. "Is this PR's head itself a
tracker?" is answered by the `feature/` prefix (`stranded.mjs:19-28` and the maintainer's
02/09 ruling recorded in its header), because the data answer would cost an `issueList`
plus N `issueView` calls inside a PR gate. They agree by construction: the declaration's
grammar is `feature/<name>`, so a declared tracker always satisfies the prefix. The prefix
therefore becomes the shape rule on the declaration plus the fallback for a branch nobody
declared — one definition, one named fallback, no change to `stranded.mjs`.

**Tracker PR timing, settled:** opened when it has a diff (GitHub cannot open an empty
PR), and `stranded.mjs` reports it until then. The tree already implements this answer;
this change ratifies it in writing.

**The UI.** No UI code here. Once the fields exist, #881 slice 4 / #882 group by epic and
render a parent-that-is-not-an-epic, and a PR whose base is not its epic's tracker, as
"said, not hidden" marks (H6).

## Constraints (quoted)

| Constraint | Source |
|---|---|
| "Commit directly to `brain/core/**` or `brain/project/**` — the knowledge half" is prohibited; doctrine ships as a draft | AGENTS.md:158-159 (explore.md:85) |
| "Push to any branch", "Create or merge an MR", infrastructure changes are Tier 2 — the workflow edits and `brain:protect` are the maintainer's confirm | AGENTS.md:145-147 (explore.md:86) |
| "`<tracker>` is the integration base (e.g. `feature/v2.0.0`), not `main`, while an epic is in flight" — the rule H2 implements is already written | `harness-contract.md:28` / AGENTS.md:223 |
| "When adding a job: add a `GATE_MATRIX` row (governance-tiers.mjs) AND add the job to governance.yml in the same commit, or the drift-guard test turns red" — five registration sites | `governance-checks.mjs:27-28` (explore.md:58-63) |
| A subcommand declared in `SUBCOMMAND_PORT_REACH` must declare `VCS_TOKEN` in its workflow step | `workflow-auth.mjs:566-567` (#479) |
| "Sub-issues (`/issues/:n/sub_issues`) are deliberately NOT read" | `github.mjs:183-187`, ADR-0029 D2 |
| Tier `lite`, 1000 counted lines, with `**/*.test.mjs` and `openspec/changes/**` ignored | AGENTS.md:447, `brain.config.json:17-29` |
| "L1 enforces observable outputs … It does NOT enforce judgment" — a base equal to a declared field is an output check | AGENTS.md:529-541 |
| Every operator string is an `i18n` key with an `es` twin, asserted in both directions | `i18n/coverage.test.mjs:96-98` |

## Risks and open questions handed to design

| # | Question or risk | Why it matters |
|---|---|---|
| Q1 | The `--base` disambiguation shape: a `baseExplicit` flag, or `baseBranch: null` when absent? | `ticket-args.mjs:60-61` cannot express it today, so ruling 3 is unimplementable until this changes. Both shapes touch `ticket-args.test.mjs`'s asserted return shape |
| Q2 | The seam for the verb: extract a pure `resolveBase({issue, port, args})` leaf, or make `ticket-start.mjs` importable? | The script reads `process.argv` at module scope and has no test (explore.md:50). The acceptance's "the verb's test" cannot exist without one. House precedent (#782) says extract a leaf |
| Q3 | The parent regex and its said fallback: exact anchor (`^Parent:\s*#(\d+)`), case, first-match-wins, and whether `Epic: #N` is a synonym | Both spellings exist; `issue-337-efficacy-probes/proposal.md:3` carries a mid-line `Parent: #335. Epic: #313.` where the parent is *not* the epic. Ruling 2's line-initial anchor makes that body parse to null, which is the safe answer. Recommendation: do not read `Epic:` — maintainer's confirmation wanted |
| Q4 | B2 confirmed, or fall back to B1? | B2 costs five registration sites, two drift guards, the `VCS_TOKEN` rule and a `brain:protect` re-run. Design must confirm before touching CI |
| Q5 | The two tracker oracles as stated — confirm the gate never scans the forge for open epics | A per-PR `issueList` + N `issueView` fan-out inside a gate is the cost being refused |
| Q6 | Where the doctrine drafts land | There is **no `brain-graph/1` spec under `brain/core/**`** (explore.md:135); the block's doctrine home is ADR-0032/ADR-0029 under `brain/project/decisions/`. Likely: an ADR amendment draft for the keys, plus a sentence for `workflow-governance.md` for the `lite` exception. Both drafts, both Tier 3 |
| Q7 | `tracker:` on a non-epic. Proposal's position: parsed and carried (data is data), honoured for resolution **only** on a node with `kind: epic` | Keeps one rule; the maintainer may widen it later without a parser change |
| Q8 | The known bill of tests that break by shape | `epic-map.test.mjs`'s `assert.deepEqual(g, {track, needs, blocks, files})` at :39-41, :91, :97, :103, :174, :180; the unreadable reset; `i18n` en/es parity; the governance drift guards. Mechanical, but it is the real cost of H1 |
| R1 | A wrong refusal stops a session | Mitigated by the fail-open clause: an unreachable or unreadable epic resolves to `main` with a reason, never a refusal |
| R2 | Between merge and `brain:protect`, the gate runs but cannot block | Named as an explicit maintainer step in tasks; H2 refuses at creation time meanwhile |
| R3 | The fields are inert until bodies declare them | Accepted — nothing regresses. The activation step is #878 declaring `kind: epic` and `tracker: feature/brain-ui`; a body edit, not code |
| R4 | `ticket-args.test.mjs:88-118` contains doctrine-oracle tests that read `harness-contract.md` | Adding an oracle for a doctrine line the maintainer has not yet signed would ship a red test. H2 needs no new doctrine — `harness-contract.md:28` already says it |

Not verified in this phase: every issue body was read from the exploration's verbatim
captures, not from the forge. #881's asserted `Parent: #878` line could not be confirmed
(explore.md:41); design should re-read it before pinning the regex.

## Delivery

Counted lines exclude tests and `openspec/changes/**` (`brain.config.json:18-29`), so the
binding constraint is the 400-line **review** budget, not the 1000-line `lite` budget.
Forecast: 400-540 counted production lines, 900-1200 lines of review (explore.md:141-147)
— one PR is out of the question.

A **feature-branch chain on `feature/issue-967`**, three child PRs, because B and C both
read the fields A creates. Delivering this stacked onto `main` would be the ticket
contradicting its own content.

| PR | Content |
|---|---|
| A | The parser keys and node fields, the prose-parent reader, the snapshot fields and the unreadable reset, the block-keys doctrine draft |
| B | `ticket-args` disambiguation and `--off-tracker`, the resolver leaf, `ticket-start` wiring, `en`+`es` strings |
| C | The `base-branch` check, its five registration sites, both CI files, the `lite`-exception doctrine draft |

The tracker PR to `main` is opened once A has landed on it and it has a diff. Note for
planning: this worktree's branch was created off `origin/main`, not off a tracker
(explore.md:151) — the tracker branch must be created and this branch rebased onto it
before PR #1. Commit and PR mechanics are the tasks phase's business.

**Rollback.** A is additive: absent keys read as null and `scalar()` ignores what no
caller names, so reverting it restores the previous node shape exactly. B is a behaviour
change in one verb, revertible in one PR (`--off-tracker` disappears with it). C is the
only slice with CI wiring: reverting it means reverting all five registration sites
together plus a `brain:protect` re-run to drop the required context.

## Success criteria

- [ ] An epic declaring `tracker:` and `kind: epic` is parsed into the graph node and the
      snapshot; an issue declaring none of the three keys parses exactly as today.
- [ ] A child declaring `parent:` and a child carrying a line-initial `Parent: #N` both
      yield `node.parent`, each stating its `parentSource`; the snapshot's fake-port test
      (`snapshot.test.mjs:133-215`) covers the new fields, and an unreadable node carries
      none of them.
- [ ] `brain:ticket:start -- <slice id>` on an issue whose epic declares a tracker creates
      the worktree off that tracker and prints the reason; an explicit `--base main`
      refuses and names the tracker; `--off-tracker` allows it. Fixture-tested in
      `ticket-args.test.mjs` and in the new resolver leaf's test, never against the real
      forge.
- [ ] An unreachable or unreadable epic resolves to `main` with a stated reason and never
      refuses.
- [ ] `base-branch` **fails** a slice PR against `main` at `lite`; a PR on an issue with no
      epic, or whose epic declares no tracker, passes untouched (the memory-lane PR is the
      standing case). Reverting only the check turns exactly its test red.
- [ ] The tracker-PR question is settled in writing: opened when it has a diff, reported by
      `stranded.mjs` until then.
- [ ] Doctrine drafts for the new block keys and for the `lite` exception exist under the
      change directory; nothing is committed to `brain/core/**` or `brain/project/**`.
- [ ] End to end on the live instance: #878 declares `kind: epic` and
      `tracker: feature/brain-ui`, and a slice of it resolves that tracker without a human
      remembering the rule.
