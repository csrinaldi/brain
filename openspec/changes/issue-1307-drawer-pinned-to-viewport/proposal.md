---
status: approved
issue: 1307
---

# Proposal — drawer-pinned-to-viewport (issue 1307)

## Intent

The inspector drawer is a flex sibling of the canvas inside `.workspace`, which stretches it (`align-items: stretch`) to the full height of the page. Measured on the running UI: the drawer is 5053 px tall and scrolls with the page. Opening a node at `scrollY` 2600 puts the drawer top at -2365 px, so the click looks like it did nothing, and the drawer header scrolls away from its tabs.

The design (`stitch_brain_ui_dashboard_design_system/brain_ui_interactive_surface/screen.png`) draws a right column with its own scroll: header and tabs always visible.

## Scope

### In
- The drawer is pinned to the viewport (`position: sticky; top: 0`, viewport-bounded height) and scrolls independently.
- The drawer DOM separates a non-scrolling header from a scrolling body; the tab bar is sticky at the top of the body.

### Out
- The phone layout (`max-width: 760px`): the drawer stays a full-width block under the canvas.
- Keyboard behaviour (Esc, Tab), the drawer model and every drawer text.

## Rejected alternatives

| Alternative | Why not |
|---|---|
| `scrollIntoView` on open | Moves the page instead of fixing the layout; the header would still scroll away from the tabs. |
| Turn the page into a fixed-height shell with a scrolling canvas | Larger change; page scroll is what readers and tests use today. |

## Size

About 40 gated lines, against the `lite` budget of 1000. One PR.

## Success criteria

- At any page scroll, opening a node shows the drawer header in view (top >= 0, < viewport height).
- Scrolling the drawer body leaves the tab bar's top unchanged.
