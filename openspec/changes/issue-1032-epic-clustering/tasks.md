# Tasks — issue-1032-epic-clustering

- [x] T1. `epicGrouping` groups by declared epic; no-parent nodes untouched (R1032-1).
- [x] T2. `parent-not-epic` and `parent-not-in-graph` kept apart, the first carrying the graph's own reported reason (R1032-1).
- [x] T3. Nested epics stay flat, the dropped relation said as `nested-epic-not-supported` (R1032-2).
- [x] T4. `trackerInfo` names the branch with a stamp, or says `epic-declares-no-tracker` (R1032-3).
- [x] T5. `unclaimed` states who the grouping did not claim, and the three sets partition the graph (R1032-4).
- [x] T6. `groupedRow` carries every field a lane card carries, minus coordinates (R1032-5).
- [x] T7. The declare snippet gains `kind` and `parent`, with a note; every key in it is one the parser reads (R1032-6).
- [x] T8. `app.js`: the clustering control is enabled, clusters render above the lanes, and the lanes filter by `unclaimed`.
- [x] T9. `canvas-model.mjs` and its test removed; the three comments citing it rewritten.
- [x] T11. The `?` batch excludes what a cluster already shows and states the count; the page passes the clustering mode to the model (R1032-4).
- [x] T12. The declare note is rendered beside the snippet (R1032-6).
- [ ] T10. A slice whose open PR targets a base other than its epic's tracker — needs the PR list, which this model is not given. Each grouped child carries an explicitly failed `baseCheck` naming the reason. Ticket to open.
