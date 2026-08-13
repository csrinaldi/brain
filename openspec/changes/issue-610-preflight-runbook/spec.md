---
status: draft
issue: 610
---

# Spec — preflight-runbook (issue 610)

## REQ-610-P1 — The runbook refuses a shallow clone before anything else

The audit surface is every commit. A shallow clone reads as a clean history
because the failing commits are absent. `git rev-parse --is-shallow-repository`
must print `false`, and the runbook says STOP otherwise.

## REQ-610-P2 — Two scanners, not one

gitleaks and trufflehog use different rules and different entropy heuristics.
Agreement is weak evidence; disagreement is the interesting case. #435's own
wording: automated scanning is necessary and **not sufficient**, so the runbook
also drives commit messages and deleted blobs, which scanners are weakest at.

## REQ-610-P3 — Expected benign hits are enumerated

Four credential-shaped fixtures exist on purpose (the secret-scrub tests). The
runbook names them with counts, so anything else is unambiguously a finding
rather than a judgement call at 2am.

## REQ-610-P4 — Rotation is the remedy, and it is ordered first

On a public repo, containment is rotating the credential at its provider.
`git filter-repo` is hygiene afterwards and never containment. The runbook
states the order.

## REQ-610-P5 — The §2b decision is forced, not assumed

The runbook makes the maintainer tick one of keep / prune / other for the 2070
human session summaries, so the current state stops being the result of nobody
choosing.

## REQ-610-P6 — The agent's own pass is recorded as insufficient

§4.0 states what was already run and why it does not satisfy §1 — a shallow
clone, 218 of ~534 commits. A smoke test that found nothing, never evidence.
