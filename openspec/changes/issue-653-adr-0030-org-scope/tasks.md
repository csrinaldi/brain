---
status: draft
issue: 653
---

# Tasks — ADR-0030 Amendment 2, the organisation scope (issue 653)

- [x] Read what the signed record actually says before treating this as a
      contradiction — it deferred, it did not reject
- [x] Measure the registry rather than assume: `@logikas/brain` 404,
      `@csrinaldi/brain` 404 and never published, `brain` 200
- [x] Locate all five passages carrying the old scope, including one inside
      Amendment 1's signed section
- [x] Write the draft: five in-place edits + the signed section
- [x] Verify every anchor against the real target — 5 edits, each `f:1 r:0`,
      all `pending`; `planAmendment` → **8 acts**, all pending
- [x] Verify the body: 2639 chars, cut before `### Notes for the promoter`,
      `**Signed**:` stamped by the verb
- [ ] Human: `npm run brain:promote -- openspec/changes/issue-653-adr-0030-org-scope/brain-drafts/adr-0030-amendment-2.draft.md`, then commit

## What the mechanics said, and why edit 5 differs

`assessEdit` reports `k = countOccurrences(replace, find)` — how often the found
text survives inside its replacement. Edits 1–4 annotate, so the original is
still there and `k:1`. Edit 5 **rewrites** the scope inside Amendment 1's
sentence, so `k:0`.

Checked rather than waved at, because `free = f - r*k` is what decides
`done`/`pending`/`blocked`: after edit 5 applies, `f` drops to 0 and `r` becomes
1, giving `free = 0` and the state `done`. **Idempotence holds on both shapes**,
so a re-run of `brain:promote` is safe.

## Out of scope

- The rename, `package.json`, the publish workflow — the #435 publish slice, and
  it lands *after* this is promoted.
- `openspec/changes/**`, per #648's line: records are not rewritten. The
  distinction from Amendment 1's section is that an amendment is current
  doctrine, not an archived artifact.

## Follow-up recorded, not performed

`installed-package-root.resolve.test.mjs` (#625) and
`install-spec-registry.test.mjs` (#644, PR #646) inject `@csrinaldi/brain` as
their scoped fixture. They still pass — the whole point of injecting the name is
that it is not load-bearing — but they should read `@logikas/brain` once #646
merges. Reaching into another branch from here would create a conflict for no
gain.
