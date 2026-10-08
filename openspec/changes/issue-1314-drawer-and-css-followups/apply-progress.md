---
status: done
issue: 1314
---

# Apply progress: drawer-and-css-followups

Mode: Strict TDD. All 12 tasks complete (1.1-1.5, 2.1-2.2, 3.1-3.2, 4.1-4.2, 5.1).

## TDD cycle evidence

| Task | RED (failing first) | GREEN | Refactor |
|------|---------------------|-------|----------|
| 1.1 R1314-1 | lane-model.test "blockers in blockedBy only" failed | mark removed from `stateAndMarks` | none |
| 1.2 R1314-2 | 3 drawer-model tests (counts, blanks, header) failed | `countOf`, `headerOf`, app.js head line and button titles | none |
| 1.3 R1314-3 | drawer-polish R1314-3 failed (band present) | `note decision-drift-none` line | none |
| 1.4 R1314-4 | decisions-model + render test failed | `statusShown/statusClass/statusTitle`; file column repeat removed | none |
| 1.5 R1314-5 | render test failed (track line in epic mode) | `laneSummary(value, clustering)` | cluster view's own epic line removed |
| 2.1 R1318-1 | n/a new guard; proved by mutation (`.queue-row`, `.openable`, `.escalate` display) failing it | render guard in table-cells.test.mjs | source-scan claim narrowed |
| 2.2 R1318-2 | n/a editorial | R1310-1 reworded with MUST NOT | none |
| 3.1 R1321-1 | `font: inherit` test failed | rule shipped | none |
| 3.2 R1321-2 | passes on current code (blocks are identical); proved by mutating the media block only | contrast and identical-values tests | none |
| 4.1 R1330-1 | n/a new fake-DOM capability; dom.test.mjs pins clamp | `clientHeight`, `scrollHeight`, clamped `scrollTop`, px `min-height` in flow | none |
| 4.2 R1330-2 | `${0}px` mutation fails `minHeight === '400px'` | assertion added, scrollers opt-in | none |

## Mutations (each reverted)

- #1314: re-add the blocked mark; count tasks without `progress.ok`; count reviews with an unreadable thread; drift-none wrapped as the band; `superseded = false`; epic summary forced to track.
- #1318: `display: block` on `.queue-row`, `.openable`, `.escalate`.
- #1321: drop `font: inherit`; change `--accent` in the media dark block only.
- #1330: `built.panel.style.minHeight = \`${0}px\``.

## Deviations

- Epic summary (R1314-5) also removes the cluster view's own "N declared epic(s)" line: one summary, not two.
- Zero counts (Reviews 0, Records 0) are shown when the source was read and held none: measured zeros.
