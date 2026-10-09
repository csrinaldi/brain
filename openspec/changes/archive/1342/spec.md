---
status: draft
issue: 1342
---

# Spec — chips-and-states-followups (issue 1342)

## Requirements

**R1342-1 — Presence is an allow-list (#1298).** A document of a sourced SDD tab is present only when its state is `present` or `truncated`. Any other state, known or not, is not present. The unreadable detail carries the git reason, never the fallback text.

**R1342-2 — A Not computed roadmap row says why (#1342).** A roadmap row whose state is Not computed carries the reason naming the missing sources (or, on the legacy path, the roadmap's own reason) as visible text and as the `title` of that text. A state with nothing to explain says nothing.

**R1342-3 — One approval label (#1342).** `status:approved` is declared once (`ui/lib/approval-label.mjs`). `epic-graph.mjs` and `state-vocab.mjs` import it and restate no literal. Comments and design text that describe the state table, the precedence and the in-flight join match what shipped.

**R1342-4 — An idle source is not loading (#1303).** `missingSources()` separates `idle` from `pending`. Notices, the hierarchy notice and the Not computed reason word an idle source as not read yet, with its reason. No consumer of `pending` in `ui` words a paused lane as loading. `hierarchy` and `localWorktrees` keep `idle` and the reason in the snapshot.

**R1342-5 — Ready to close is as-of its list (#1360).** When the closed list is as of an earlier complete read (a refresh failed after one), the Ready to close reason carries the rollup's stale qualifier. `stateOf` documents the #1309 precedence.

**R1342-6 — Each review thread is worded by its own state (#1365).** In a Reviews tab where no round was read, queued threads read "not read yet", failed threads read "unreadable". A single phrase for all threads is used only when every thread agrees.

**R1342-7 — Verdict text has its own tokens (#1365).** `--verdict-approve`, `--verdict-revise` and `--verdict-stop` exist in the light base, the media-query dark block and the stamped dark block, differ per verdict in each, and meet WCAG AA 4.5:1 on `--surface`, `--paper` and the verdict's chip ground. The footer and the queue chip read them, not `--state-*-fg`.

## Scenarios

- GIVEN an origin source whose design document has state `refused-new-kind` WHEN the SDD tab is built THEN design is not present (R1342-1).
- GIVEN the origin tree cannot be listed WHEN the SDD tab is built THEN every stage detail carries the git reason and not "no reason was given" (R1342-1).
- GIVEN a node with prs failed and remoteChanges idle and no work evidence WHEN its roadmap row is built THEN `stateReason` names both and the idle one reads "was not read yet" (R1342-2, R1342-4).
- GIVEN `--no-poll` WHEN the in-flight notices are built THEN none contains "loading" and each idle source reads "not read yet, polling is paused" (R1342-4).
- GIVEN an epic with 2 of 2 children closed and a closed lane `failed` with `lastCompleteAt` WHEN its state is read THEN the reason ends with "closed list as of <date>; refresh failed (<reason>)" (R1342-5).
- GIVEN one queued and one failed thread and no rounds WHEN the Reviews tab is built THEN `#queued (not read yet: …)` and `#failed (unreadable: …)` (R1342-6).
- GIVEN the light theme WHEN a verdict is drawn THEN APPROVE, REVISE and STOP differ in colour and meet 4.5:1 (R1342-7).
