# Proposal — phase-1 exit demonstration on 1.11.0 (#1229)

Re-run the phase-1 exit of epic #1121 on the published `@logikas/brain@1.11.0`, after the fixes for #1205, #1206 and #1207 shipped. The targets are two freshly recreated consumers: `csrinaldi/brain-test-plainfiles` and `csrinaldi/brain-test-engram`.

The run covers the first feature PR through `brain:ship` (issue created without labels, as a user would), the first real merge and its post-merge run, the memory chain through the lane, and #1081's four seams plus #1118. Every transcript is in `evidence/`.
