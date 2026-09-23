---
status: draft
issue: 619
---

# Spec — publish-allowlist-reads-the-tarball (issue 619)

## REQ-619-1 — The evidence is the artifact, not a report about it

`npm pack --pack-destination`, extract, walk. No npm version can change what a
tarball contains. A consumer receives what npm *did* pack, not what it said it
would.

## REQ-619-2 — The reader still fails loudly, and about the right thing

An empty extraction throws. The previous message asserted "the pack failed"
without establishing it — it could not tell "npm reported nothing" from "npm
reported it differently".

## REQ-619-3 — Every existing assertion survives unchanged

Byte-needing coverage, the `regenerate` exclusion, the must-not-ship list, the
size canary and the licence check are untouched. Both original mutations stay
red through the new reader.
