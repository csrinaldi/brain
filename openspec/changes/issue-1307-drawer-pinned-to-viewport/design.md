---
status: approved
issue: 1307
---

# Design — drawer-pinned-to-viewport (issue 1307)

### D119: A sticky, viewport-tall column instead of a stretched flex child

`.workspace` is a flex row with `align-items: stretch`, so the drawer takes the page height. The drawer gets `align-self: flex-start; position: sticky; top: 0; max-height: 100vh; overflow: hidden`. The status bar is not sticky, so `top: 0` cannot cover it. Known limit: at scroll 0 the drawer's lower edge is below the fold by the height of the chrome above it; the body scrolls, and the rest comes into view as the page scrolls.

### D120: Header outside the scroller, tabs sticky inside it

`renderDrawer` builds `.drawer-head` (never scrolls) and a `.drawer-body` (`flex: 1; min-height: 0; overflow: auto`) that receives everything else. The tab bar sits mid-body (after the title, children and notes), so it is `position: sticky; top: 0` in the body: it scrolls up to the top and stays. The old `.drawer-head { position: sticky }` is dropped (the head is outside the scroller). The padding rule `.drawer > .note, > .said, > div` becomes `.drawer-body > ...`.

### D121: Phone layout unchanged

Under 760 px the drawer is a full-width block below the canvas: `position: static; max-height: none; overflow: visible`.

### Pure logic

None: the change is CSS plus the DOM nesting in `app.js`. Tests: a CSS scan (`drawer-pinned.test.mjs`) and a fake-DOM structure test.
