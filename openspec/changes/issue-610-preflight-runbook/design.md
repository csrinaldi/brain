---
status: draft
issue: 610
---

# Design — preflight-runbook (issue 610)

## D1 — A runbook, not a script

Precedent: `openspec/changes/archive/231/cp-a2b-runbook.md` — the agent prepares,
the human executes. Right here for a stronger reason than convention: the output
is credential material, and the environment an agent runs in cannot produce it
anyway (§0.3 — no `gh`, and a proxy that injects its own identity, #604).

## D2 — Lead with the reframing

The runbook opens by stating that the gate it implements was already passed. A
document that reads as authorisation for something already done would send its
executor looking for the wrong thing — approval rather than exposure.

## D3 — Enumerate the expected benign hits

Four fixture files legitimately contain PAT, AWS-key and private-key shapes,
with counts. Without that table the first gitleaks run produces 15 hits and no
way to tell signal from fixture, which is how a real finding gets waved through.

## D4 — Measured numbers, not placeholders

Every count in the runbook was measured on `main` @ `b2a6b37`: 2177 records,
10 mentioning #410/#427, 2070 `@legacy`/human, and the §3 reference inventory
(engram 219, gentle-ai 71, gitlab.com 33, SCIT 25, samples-of-html5 6). An
executor can tell immediately whether their tree matches.

## Hot micro-decisions

- `SCIT` is flagged as the term to read closely: it names a specific self-hosted
  environment, where `engram` and `gentle-ai` are product surface.
- Author emails in commit metadata are called out as **not** a finding — public
  in every git history by construction, and otherwise the first thing a scan
  surfaces.
- The runbook does not pre-judge §2b. All three options are defensible and the
  choice is the maintainer's.
