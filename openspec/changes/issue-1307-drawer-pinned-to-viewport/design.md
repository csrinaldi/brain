---
status: approved
issue: 1307
---

# Design — drawer-pinned-to-viewport (issue 1307)

### D119: A sticky, viewport-tall column instead of a stretched flex child

`.workspace` is a flex row with `align-items: stretch`, so the drawer takes the page height. The drawer gets `align-self: flex-start; position: sticky; top: 0; max-height: 100vh; overflow: hidden`. The status bar is not sticky, so `top: 0` cannot cover it. Known limit: at scroll 0 the drawer's lower edge is below the fold by the height of the chrome above it; the body scrolls, and the rest comes into view as the page scrolls.

### D120: Header and tab bar outside the scroller

`renderDrawer` builds `.drawer-head` (never scrolls; `flex: none; flex-wrap: wrap`) and a `.drawer-body` (`flex: 1; min-height: 0; overflow: auto`) that receives everything else. The tab bar is appended to the head as a full-width line (`flex: 1 0 100%`). A first attempt kept the tabs mid-body with `position: sticky`; the browser measurement showed it never engages for an epic: the 49-children list pushes the tabs to the bottom of the body, so the body cannot scroll far enough for them to reach the top. The old `.drawer-head { position: sticky }` is dropped. The padding rule `.drawer > .note, > .said, > div` becomes `.drawer-body > ...`. Cost: the tab bar now sits above the title instead of below the children list.

### D121: Phone layout unchanged

Under 760 px the drawer is a full-width block below the canvas: `position: static; max-height: none; overflow: visible`.

### Pure logic

None: the change is CSS plus the DOM nesting in `app.js`. Tests: a CSS scan (`drawer-pinned.test.mjs`) and a fake-DOM structure test.
