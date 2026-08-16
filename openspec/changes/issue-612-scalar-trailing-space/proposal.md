# Proposal: `scalar()` must not read a trailing space as a value (#612)

## Intent

`scalar()` (`brain/scripts/review/lib/yaml-block.mjs:57`) uses `^${key}:[ \t]*(.+)$`. `[ \t]*` backtracks, so on `findings: ` the capture is the space itself: the match succeeds, `.trim()` yields `''`, and `scalar` answers non-`null`. In `parseEntryList` that routes the key into the INLINE branch and the block branch never runs — two readable findings become `malformed: ["findings"]`. One space is the difference between reading a blocker and reporting none.

## Decisions (the three #477 deferred)

**D1 — repair `(.+)` → `(\S.*)`, not trim-to-`null`.**
`scalar`'s contract is already written, in `parse-verdict.mjs:73-77`: it answers `null` for BOTH a missing key and a key whose value it could not capture, and callers needing the distinction probe the key line separately (`SEQUENCING_KEY_RE`, `CONTROLS_KEY_RE`, `CONTROLS_NOT_APPLIED_KEY_RE`). So `key:` + whitespace must answer `null` — "no value" — not a third sentinel. Both candidates do that; they diverge on a value led by exotic whitespace (`key: v`): `(\S.*)` answers `null`, `(.*)`+trim answers `v`. Choose `(\S.*)`, because its failure direction is refusal, and refusal is the safe direction on the governance path (D4). It also matches the precedent already in-tree: `governance-checks.test.mjs:42`, `^    name: (\S+)\s*$` — "non-space value, optional trailing space".

**D2 — brain's emitters do not produce one, and that does not downgrade this.**
`renderDecision`, `renderVerdict` (`verdict.mjs:247`), and `renderCheckpointClaim` all build `` `key: ${value}` ``: a trailing space requires a field that stringifies to `''`, which no current caller passes. So the defect only bites FOREIGN and hand-edited blocks — which is the whole population `cold-boot`/`board`/the cold reviewer read. `brain-graph/1` has **no emitter at all** (`epic-graph.mjs:12-13` documents a hand-written shape, `track:    A`); every graph block in existence is hand-edited. Exposure there is total, not marginal.

**D3 — the `#452/#478-F2` pin is REWRITTEN in place, never deleted.**
`parse-verdict.test.mjs:331` becomes the assertion that entries under a space-suffixed key now parse, keeping its comment block and its `#452/#478-F2` id as the record of why the line changed. Deleting a pin because its behaviour flipped is how the repo loses the reason.

## D4 — Governance blast radius (`actor-check`, ADR-0026 Am. 2)

The repair changes exactly one input class: `key:` + whitespace-only, `''` → `null`. Case analysis over `brain-decision/1`, both directions:

| key | today (`''`) | after (`null`) | admission |
|---|---|---|---|
| `protocol` | `'' !== PROTOCOL` → refuse | `null !== PROTOCOL` → refuse | unchanged |
| `decision` | `'' !== 'APPROVE'` → refuse | refuse | unchanged |
| `head_sha` | falsy → refuse | falsy → refuse | unchanged |
| `actor` | falsy → refuse | falsy → refuse | unchanged |
| `at`, `in_reply_to` | `result.at = ''` | omitted | audit-only, never gates |

**No block becomes admissible that was not, and none stops being admissible.** Every gate compares against a non-empty literal or tests truthiness, so `''` and `null` are already indistinguishable to all four of them. `sniffDecisionProtocol` (`actor-check.mjs:229`) is invariant too: `''` fails `DECISION_PROTOCOL_PREFIX_RE`, `null` fails the explicit `=== null` — both `continue` silently, neither sets `addressed`. This is a case analysis, not a green suite.

## Scope

### In Scope
- `scalar()` regex + a JSDoc stating the contract ("the value, or `null` when the key carries none").
- Rewrite the `#452/#478-F2` pin; drop the "not repaired" claims at `parse-verdict.mjs:127-136` and `yaml-block.mjs`.
- Red-first tests per consumer for the whitespace-only class: `parse-verdict`, `decision-block`, `epic-graph`, `checkpoint-block`, `actor-check`.

### Out of Scope
- Emitter hardening (rejecting `''` field values).
- A generic YAML parser; `parseEntryList` extraction; PR #695's locator work.

## Capabilities

### New Capabilities
- `yaml-block-scalar`: the shared `key: value` reader's three-state contract and its blast radius across all five consumers.

### Modified Capabilities
- None (no prior top-level `openspec/specs/`).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `brain/scripts/review/lib/yaml-block.mjs` | Modified | `scalar` regex + contract JSDoc |
| `brain/scripts/review/lib/parse-verdict.mjs` | Modified | comment only — stale "not repaired" note |
| `brain/scripts/review/lib/parse-verdict.test.mjs` | Modified | F2 pin inverted |
| `review/lib/decision-block.mjs`, `checkpoint-block.mjs`, `status/epic-graph.mjs`, `vcs/actor-check.mjs` | Unmodified, re-pinned | consumers; tests added, code untouched |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `findings: ` with nothing under it flips UNREADABLE → `[]` ("reviewer found nothing") — the direction `evidence-reader-empty-on-failure` polices | High (by design) | Accepted and pinned: the answer becomes identical to the byte-equivalent clean `findings:`, which already yields `[]`. Trailing whitespace is insignificant in YAML; consistency with the clean form is the standard, not "conservative always" |
| `epic-graph`: `track: ` moves from its own group `''` to `'?'`/UNCLASSIFIED (`epic-graph.mjs:73,240`) — can surface a NEW ready-conflict | Low | Correct (an empty track is not a track) and conservative in direction; pin it |
| `checkpoint-block`: `integerField` error text changes from "must be a non-negative integer, got ''" to "missing the required `key:`" | Low | Both `{ok:false}`; no test pins either string (grepped). Pin the new one |
| The ticket's "exactly 1 failure in 3394" is quoted, NOT re-measured — no shell in the propose phase | Medium | `sdd-apply` MUST re-measure before and after; treat a second failure as a stop-and-report, not a fix-forward |
| Collision with PR #695 (issue #639) | Medium | See below |

## Dependencies — PR #695

**Not verified: no shell available here, so `gh pr diff 695` was not run.** From the branch name (`fix/issue-639-fixstatus-parsegraphblock-reads-the-firs`) and `parseGraphBlock`'s current `extractFencedBlock(body)` call (`epic-graph.mjs:55`), #695 changes WHICH block is located; #612 changes HOW a value is read out of one. Different functions, orthogonal semantics — they compose. Textual conflict risk is real but low-grade: if #695 adds a tag-aware locator to `yaml-block.mjs` it lands next to `extractFencedBlock` (lines 51-54), immediately above `scalar` (56-59). `sdd-apply` must diff #695 first and rebase, not merge blind. Both PRs touch `epic-graph.mjs` behaviour for graph blocks, so whichever lands second re-runs the other's tests.

## Rollback Plan

Single-line revert of the `scalar` regex; the pin rewrite and new tests revert with it in the same commit. No data migration, no persisted state, no wire-format change — `scalar` is a pure function and every consumer is a reader.

## Success Criteria

- [ ] `findings: ` (trailing space) with two entries under it parses to two findings; `malformed` is absent.
- [ ] Re-measured suite: the only pre-existing test that changes is `#452/#478-F2`, rewritten not deleted.
- [ ] A test per consumer proves `brain-decision/1` admission is byte-for-byte unchanged across the whitespace-only class, in BOTH directions.
- [ ] `scalar`'s JSDoc states the contract; no file still claims the defect is unrepaired.
