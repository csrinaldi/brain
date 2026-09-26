---
status: draft
issue: 1122
---

# Design: ADR-0036, the fresh-consumer definition of done

## Shape

One new ADR, not an amendment. The decision applies to every change brain ships, and no
existing ADR owns "when is a change done": ADR-0015 owns gate honesty, ADR-0026 tiers, ADR-0030
distribution. Grafting it onto any of them would hide it under the wrong subject (the same
reasoning ADR-0035 used to stay separate from ADR-0034).

The draft follows the new-ADR contract of `brain/scripts/brain-promote.mjs`:

- basename `adr-0036-<slug>.md` (`DRAFT_BASENAME_RE`); the slug names the decision;
- first content line `# ADR-0036 — <title>` (`H1_RE`);
- the preamble between the H1 and the first `## ` is blockquotes only (`> **status:** …`,
  `> **relates to:** …`, the Tier 2 banner), which `transformDraft` strips and replaces with
  `**Status**: Accepted` / `**Date**: <today> — <git user>`;
- no line in the body starts with `**Status**:` (`single-status-line` guard);
- no non-reserved hostname (`shipped-hostnames` guard; the destination ships in the tarball).

Sections mirror ADR-0035: Context, Decision, relations, Consequences, What does NOT change,
Rejected alternatives.

## Decisions inside the ADR

- **D1: "fresh" is five conditions, not a label.** The recurring defect is a precondition only
  brain has, so each condition removes one way a precondition can leak in (brain's tree, a
  link to the source, skipped bootstrap, untouched code path, inherited state).
- **D2: "one person" is three checks tied to observable output.** Each has a failure condition
  (a second identity needed; a step no verb named; an instruction only in an ADR).
- **D3: the not-covered set is declared data, and a setup failure is a failure.** Without both,
  the gate could turn a red into a gap at run time, which is the overclaim ADR-0015 and ADR-0026
  forbid.
- **D4: the gate must be shown red on a replayed defect before it counts.** The house mutation
  discipline (`bootstrap-smoke`'s red-proof table), applied to #1136.
- **D5: until #1136 ships, the bar is stated, not enforced,** and the ADR says so.

## Evidence used

`gh issue view` for #211, #397, #1094, #1112, #1113, #1116, #1121, #1123–#1125, #1136; #1081's
exit comment on #864 (comment 5821234111); `CHANGELOG.md` v0.9.5; `test/bootstrap-smoke/README.md`
and `smoke.mjs:195` (the fixture is brain's tree minus `.git`, `node_modules`, `.brain-source`);
`test/fresh-install/README.md` and `package.json` (`test:fresh-install`, run by hand, from the
published registry package); `.github/workflows/publish.yml:4` (a wrong tarball cannot be cleanly
unpublished).

## Verification

A scratch script imports `transformDraft`, `destinationFor`, `insertAdrLink` and
`checkShippedContent` and runs them on the draft (what `planNewAdrPromotion` does before the
typed confirmation). `npm run brain:repo:check` must pass.
