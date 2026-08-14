---
status: draft
issue: 629
---

# Tasks — ADR-0030 reachability amendment (issue 629)

- [x] Measure the absence rather than assert it: 0 mentions of mirror / firewall
      / air-gap / proxy / offline / registry access in the signed record
- [x] Measure the escape hatch instead of assuming it — install HEAD over
      `git+file://` into a clean fixture: 433 files, 5.5 MB, `files` honoured,
      `.memory/` `openspec/` `test/` `docs/` `.brain-source` `.git` all absent
- [x] Confirm it works under `private: true` (it did — `private` blocks
      publishing, not git installs)
- [x] Write the draft: 4 in-place edits + the signed section
- [x] Verify every anchor against the real target — 4 edits, each `f:1, r:0`,
      `planAmendment` → **7 acts, all pending**
- [x] Verify the body extraction: 3715 chars, cut before `### Notes for the
      promoter`, `**Signed**:` stamped by the verb
- [ ] Human: `npm run brain:promote -- openspec/changes/issue-629-adr-0030-reachability/brain-drafts/adr-0030-amendment-1.draft.md`, then commit

## What I got wrong on the way

`planAmendment`'s act 3 reports `after: contract.bodyHeading` — a **display
label**, not the body. Read as evidence it says the appended section is 76
characters long, which looks exactly like a truncated body. I checked the
extractor directly rather than believing the render: 3715 chars, correct
boundaries. Third time this session that a return shape has been read instead of
inspected; the difference here is that inspecting it was the step that produced
the right answer.

## Out of scope

- The decision. The registry stays the mechanism.
- `day-start.mjs` itself — #627, and it is sequenced after the publish.
- ADR-0006, which stays superseded and untouched.
