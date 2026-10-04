# Proposal — phase-1 exit demonstration on 1.10.1 (#1204)

Re-run the phase-1 exit of epic #1121 on the published `@logikas/brain@1.10.1`, after the fixes for #1186, #1187 and #1188 shipped. The targets are two freshly recreated consumers: `csrinaldi/brain-test-plainfiles` and `csrinaldi/brain-test-engram`.

The run covers the first feature PR through `brain:ship` with no manual fallback, the first real merge and its post-merge run, the memory chain through the lane, and #1081's four seams. Every transcript is in `evidence/`, which is tracked.
