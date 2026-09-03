# Apply Progress: #323 S5 — single PR (closes #840; #323 lives to S7)

- [x] 1.1 parseSliceScopes in the single accessor — JSON only, refusals as
      sentences, absence → [] (grandfather by absence). RED first.
- [x] 1.2 check-refs S-1b: declared-but-broken goes red naming the file,
      repo-wide + archive; PROVEN LIVE both directions (broke the dogfood
      block → red; restored → green).
- [x] 1.3 strandedTrackers pure (+4 tests) + gatherStranded I/O half with
      seams, degrading in band; wired into runStatus. feature/* only,
      REPORTED — the two rulings of 02/09.
- [x] 1.4 The dogfood: this tasks.md carries the tree's first real block.
- [x] 1.5 #839 filed (reviewer consumption + new-change enforcement — the
      block's named consumer, unread-field satisfied in order); #840 filed
      as the slice target. Suite fail==0 asserted; gates clean.
