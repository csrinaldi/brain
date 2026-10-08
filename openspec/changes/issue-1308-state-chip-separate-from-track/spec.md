---
status: draft
issue: 1308
---

# Spec — state-chip-separate-from-track (issue 1308)

"Work evidence" below means the four sources `inflight-model.mjs` joins (#1284): a non-archived
change dir, a local worktree, a grammar remote branch, or a PR, each naming the issue.

## Requirements

**R1308-1 — Two chips.** Every node card (track lane, `?` holding lane, epic cluster) and the
drawer header show a lifecycle-state chip and, separately, a track chip. The state chip never
carries track information and the track chip never carries lifecycle information.

**R1308-2 — Track chip.** `Track <id>` when the node declares a track; `? No track` when it
declares a `brain-graph/1` block without a track; a WARNING chip `⚠ Configuration missing` (own
chip, warning colours, accessible text "configuration missing") when it declares no block at all;
a distinct WARNING chip `⚠ Configuration unreadable` when a block exists and the graph could not
read it (`blocksUnreadable`: two `brain-graph/1` fences, an unterminated fence, the legacy
`yaml` + `protocol:` shape). An unreadable node (body not read) shows no track chip — its declaration is unknown, not absent.

**R1308-3 — In flight from work evidence.** An open issue named by at least one work-evidence
source reads `◐ In flight`, whether or not it declares a track.

**R1308-4 — Planned only when measured.** An open issue reads `○ Planned` only when all four
work-evidence sources are ready and none names it.

**R1308-5 — Pending/failed sources.** When at least one work-evidence source is pending or failed
and no ready source names the issue, it reads `— Not computed`, never `Planned`; the state's
reason names the missing source(s). Positive evidence from a ready source is enough for
`In flight` while another source is still pending.

**R1308-8 — Precedence (ruled 2026-10-05).** `Unreadable > Done > Blocked > Awaiting review [label renamed to Awaiting approval by #1379] > In
flight > Not computed > Planned`. Lifecycle is computed for every node; for an undeclared node
Awaiting review [label renamed to Awaiting approval by #1379] is read from `status:approved` in its labels, by the same rule as every node.

**R1308-9 — Stale evidence (ruled 2026-10-05).** An issue whose only work evidence is stale
(>= 7 days, the "In flight" section's collapsed stale group) reads `◐ In flight`.

**R1308-10 — Missing configuration is shown and fixable (ruled 2026-10-05).** Selecting an
undeclared node shows, in the drawer, the `brain-graph/1` block to paste — `DECLARE_SNIPPET` with
`parent:` prefilled when known, with its example-not-form note — as text only. No command line is
shown: `declareCommand` is `null` until #1335 ships `brain:ticket:declare`. A declared node shows
no such block. A node whose block exists but is unreadable shows the graph's own error text in
the drawer and NO paste block: pasting would add another fence.

**R1308-6 — One derivation.** Cards, holding rows, epic clusters, the drawer header, the drawer's
children list, the roadmap rows and the home "In flight" section read the same evidence join; an
issue listed in the "In flight" section never shows `Planned` or `Not computed` on its card.

**R1308-7 — Legend and counts.** The legend shows lifecycle states and track marks as two
labelled groups, each built from its table in `state-vocab.mjs`. `Configuration missing` is not listed
as a state. Each lane header's state counts sum to the lane's node count and use only lifecycle codes.

## Scenarios

### S1 — declared + in flight
- GIVEN open #1198 declares `track: UI` and a local worktree names it
- WHEN the board renders
- THEN its card shows `◐ In flight` and `Track UI`, and the UI lane header counts `In flight × 1`

### S2 — undeclared + in flight (the #1263 shape)
- GIVEN open #1263 has no `brain-graph/1` block, an open PR and worktrees naming it
- WHEN the board renders
- THEN its `?`-lane row and drawer header show `◐ In flight` and the `⚠ Configuration missing` chip
- AND it is listed in the home "In flight" section

### S3 — undeclared + no work
- GIVEN open #1300 has no block and all four sources are ready and none names it
- THEN it shows `○ Planned` and the `⚠ Configuration missing` chip

### S4 — declared + planned
- GIVEN open #1199 declares `track: UI`, all sources ready, none names it
- THEN it shows `○ Planned` and `Track UI`

### S5 — sources pending, no evidence yet
- GIVEN `prs` and `remoteChanges` are pending, local sources ready, nothing names #1199
- THEN #1199 shows `— Not computed` (not `Planned`), with a reason naming `prs` and `remoteChanges`
- WHEN both arrive ready and still name nothing
- THEN it shows `○ Planned`

### S6 — sources pending, local evidence present
- GIVEN `prs` is pending and a local change dir names #1198
- THEN #1198 shows `◐ In flight` without waiting for `prs`

### S7 — source failed
- GIVEN `remoteChanges` failed with a reason and no ready source names #1199
- THEN #1199 shows `— Not computed` with that reason; it never shows `Planned`

### S8 — unreadable body
- GIVEN the forge did not hand over #1201's body
- THEN it shows `⚠ Unreadable` and no track chip

### S9 — legend and counts consistent
- GIVEN a lane with one In flight, one Planned and one Blocked node
- THEN its header reads exactly those three codes with counts summing to 3
- AND the legend lists `Configuration missing` only in the track group

### S10 — undeclared and not approved
- GIVEN open #1300 has no block and no `status:approved` label, and nothing names it
- THEN it shows `◇ Awaiting review [label renamed to Awaiting approval by #1379]` and the warning chip

### S11 — precedence
- GIVEN open #1198 is blocked by an open issue and a worktree names it
- THEN it shows `⊘ Blocked`, not `◐ In flight`

### S12 — stale-only evidence
- GIVEN the only evidence for #1198 is a worktree last touched 30 days ago
- THEN it shows `◐ In flight`

### S13 — the paste block
- GIVEN #1263 declares no block and names `#878` as its prose parent
- WHEN its drawer opens
- THEN the body shows a copyable `brain-graph/1` block with `parent: 878` and the example note
- AND no command line is shown, and the model's `declareCommand` is `null`
- AND a declared node's drawer shows no such block

### S14 — a malformed declaration is not a missing one
- GIVEN an issue whose body carries two `brain-graph/1` fences (or an unterminated fence)
- WHEN its card renders and its drawer opens
- THEN the track chip reads `⚠ Configuration unreadable`, never `Configuration missing`
- AND the drawer shows the graph's error (e.g. "2 `brain-graph/1` blocks found")
- AND the drawer shows no paste block, and `declare` is `null`
- AND an issue with no block at all still reads `Configuration missing` with the paste block
