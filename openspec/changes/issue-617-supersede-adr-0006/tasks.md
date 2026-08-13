---
status: draft
issue: 617
---

# Tasks — supersede-adr-0006 (issue 617)

- [x] Read ADR-0006 in full and identify what its decision actually rested on
- [x] Measure the premise: `private: false`, `brain` taken (200), `@csrinaldi/brain` free (404)
- [x] Establish there is no supersession precedent or tooling in the repo
- [x] Write ADR-0030 (new-ADR draft)
- [x] Write ADR-0006 Amendment 1 (`brain-amendment/1` draft), five anchors each verified unique
- [x] Validate draft A with `transformDraft`: destination, number, title, commit command
- [x] Validate draft B with `parseAmendmentDraft` + `planAmendment` against the real target — ok, 8 acts, 5 in-place edits resolved
- [ ] **HUMAN**: promote ADR-0030, then the amendment, and commit each signature

## Out of scope

The mechanism — #435. Nothing here touches code.

## Reported

`brain:promote` has no supersession shape and no ADR has ever been marked
superseded. Recorded in ADR-0030's closing section and in #617; whether the verb
should grow one, and whether `brain:nav`/`decision-gate` should treat a
superseded ADR differently, is a separate decision.
