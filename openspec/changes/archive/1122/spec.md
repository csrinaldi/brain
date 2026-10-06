---
status: draft
issue: 1122
---

# Fresh-consumer definition of done — Delta Spec

This change ships doctrine, not code. Each requirement names the observation that would prove
it false. `DRAFT` below is
`openspec/changes/issue-1122-fresh-consumer-done/brain-drafts/adr-0036-a-change-is-done-when-it-works-on-a-fresh-consumer-install.md`.

## Requirements

### Requirement: the draft is a promotable new ADR

`DRAFT`'s basename MUST match `brain-promote.mjs#DRAFT_BASENAME_RE`, its H1 number MUST equal
its filename number, `0036` MUST be free in `brain/project/decisions/` and `brain/HOME.md` on
`origin/main`, and the draft MUST pass `transformDraft`, `insertAdrLink` and
`checkShippedContent` over the destination content.

**Falsified by:** any of those functions returning `ok: false` / `inserted: false`; a file
`brain/project/decisions/adr-0036-*` or an `ADR-0036` line on `origin/main`.

#### Scenario: planner run
- **WHEN** the planner functions run on `DRAFT` with a non-empty git user name
- **THEN** the destination is `brain/project/decisions/<DRAFT basename>`, the transformed text
  has exactly one `**Status**:` line, `brain/HOME.md` gains one ADR-0036 line, and both
  content guards run and pass

### Requirement: "a fresh consumer install" is defined by five checkable conditions

`DRAFT` MUST define a fresh consumer install as all of: a new repository; brain installed from
the `npm pack` tarball (a link, `file:` path or copy is named as not an install); install,
bootstrap and diagnosis performed; the changed behaviour exercised through a consumer verb;
no state carried over from brain's repository or the operator's machine.

**Falsified by:** `DRAFT` omitting any of the five, or allowing a workspace link.

### Requirement: "a cost one person can pay" is defined by three checkable conditions

`DRAFT` MUST define it as: the default path completes with one maintainer (tied to #1124 and
ADR-0026's `lite` review count of 0); every manual step is named by `init`, `env:init`,
`brain:upgrade` or the diagnosis verb; no step requires reading an ADR.

**Falsified by:** `DRAFT` omitting any of the three, or stating one only as an aspiration with
no observable failure condition.

### Requirement: the publish gate never reports success over a known gap

`DRAFT` MUST define the gate as platform (each CI can exercise; today `claude`, `antigravity`)
× {`plainfiles`, `engram`} × {`github`, `gitlab`}; a covered failure refuses the publish; an
unexercisable combination is reported `not covered` with a reason; an environment failure in a
covered combination is a failure, not `not covered`.

**Falsified by:** `DRAFT` permitting a skipped combination to be absent from the summary, or
permitting a setup failure to be reclassified as `not covered`.

### Requirement: the evidence is cited and resolvable

`DRAFT` MUST cite v0.9.5/#211, #397, #1094, #1113, #1112, #1116 and #1081's ten findings, and
MUST name why `bootstrap-smoke` and `test/fresh-install` do not already meet the bar.

**Falsified by:** a cited issue that does not exist or does not describe the defect `DRAFT`
attributes to it (`gh issue view <n>`), or a description of either existing check that
contradicts its README.

### Requirement: relations and non-changes are stated

`DRAFT` MUST relate the decision to ADR-0015, ADR-0026, ADR-0027, ADR-0030, ADR-0035, #1123,
#1124 and #1125, and MUST state that existing gates and brain's own suite are unchanged.

**Falsified by:** any of those references missing, or `DRAFT` stating that a gate, tier
parameter or required status context changes.

### Requirement: no `brain/**` edit

This change MUST NOT modify any path under `brain/`.

**Falsified by:** `git diff --name-only origin/main...HEAD` listing a `brain/` path.
