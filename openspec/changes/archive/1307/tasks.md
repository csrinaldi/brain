---
status: approved
issue: 1307
---

# Tasks — drawer-pinned-to-viewport (issue 1307)

- [x] 1.1 RED: CSS scan test pinning R1307-1..4 (`static/drawer-pinned.test.mjs`)
- [x] 1.2 RED: fake-DOM test for R1307-2 (head/body separation)
- [x] 2.1 GREEN: `app.css` sticky drawer, scrolling body, tabs as a line of the fixed head (D120)
- [x] 2.2 GREEN: `app.js` nests the drawer content in `.drawer-body`
- [x] 3.1 Full `npm test`, `brain:repo:check`, `brain:nav`, gated diff, mutation
- [x] 4.1 Real-browser proof (below-fold open, drawer scroll)
- [x] 5.1 Review round 1: tab click scrolls the panel to the top of the body, data re-render keeps scrollTop (D122), head tab bar specificity fix
- [x] 5.2 Real-browser proof of the tab-click scroll
