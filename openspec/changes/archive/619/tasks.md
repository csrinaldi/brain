---
status: draft
issue: 619
---

# Tasks — publish-allowlist-reads-the-tarball (issue 619)

- [x] Reproduce the shape difference: `files[]` present on npm 10.9.7, absent on the maintainer's npm
- [x] Verify both readers agree on this tree (423 entries) before switching
- [x] Rewrite `packedContents` to pack, extract and walk
- [x] Re-prove both original mutations through the new reader
- [x] Correct the header: the report shape is not stable; the artifact is
