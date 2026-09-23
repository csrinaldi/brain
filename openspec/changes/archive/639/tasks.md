---
status: draft
issue: 639
---

# Tasks — issue 639

- [x] **T1** Measure the real defect before writing: run the old and new locator
  over the four candidate body shapes. Result — the ticket's ` ```js ` fixture was
  already green; the untagged fence and the foreign-protocol ` ```yaml ` fence
  were red. Recorded in `proposal.md`.
- [x] **T2** Measure the live incident count over all 312 issues in the repo.
  Result — 2 bodies mention the protocol, both in prose; **0** carry a declared
  block, so **0** nodes are recovered. Recorded in `proposal.md`, as the ticket's
  exit criteria require.
- [x] **T3** `epic-graph.mjs` — locate through `fencedBlocks`, select on the
  `protocol:` scalar, drop the `extractFencedBlock` import (REQ-639-1, REQ-639-2).
- [x] **T4** `epic-graph.mjs` — more than one block returns `{ ok: false, error }`
  naming the count and the body lines (REQ-639-3, REQ-639-4).
- [x] **T5** `epic-graph.mjs` — `buildGraph` collects `blocksUnreadable`; an
  unreadable block places no node and draws no edge (REQ-639-5).
- [x] **T6** `epic-render.mjs` — `renderSummary` prints the unreadable blocks on
  their own line, distinct from **Sin ubicar** (REQ-639-5).
- [x] **T7** `epic-map.test.mjs` — six cases: the two shapes that were red, the
  ticket's fixture pinned and labelled as already-green, the duplicate-count
  error, the `blocksUnreadable` carry-out, and the summary line.
- [x] **T8** Red-proof: with `epic-graph.mjs` reverted, **5 of the 6** new tests
  go red. The sixth is the already-green pin and is documented as such.
- [x] **T9** Full suite: 3827 pass, 0 fail. `brain:repo:check` clean.
